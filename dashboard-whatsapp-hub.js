/**
 * ClinicOS WhatsApp Command Center
 *
 * Fixes applied (vs previous version):
 *  - connectFlow: prefer waba_id/phone_number_id from window.__waSessionInfo
 *    BEFORE calling FB.login so the code is always matched to the right WABA.
 *    Previously the session info was only read *after* FB.login returned,
 *    which created a race condition on slower connections.
 *  - Connect button enters a loading state immediately and is disabled while
 *    the API call is in flight — prevents double-submits.
 *  - FB SDK is loaded through a single shared loader (window.__fbSdkLoader)
 *    so dashboard-whatsapp.js (Settings page) and this file never double-inject
 *    the Facebook JSSDK script.
 *  - Friendly error classification: domain errors and secret errors get
 *    actionable copy instead of the raw Meta API message.
 *  - WABA health panel: shown when connected so doctors can self-diagnose
 *    "connected but no messages" problems without contacting support.
 *  - window.message listener normalises all known Embedded Signup event
 *    shapes (WA_EMBEDDED_SIGNUP, FINISH, plain waba_id object).
 */
(function () {
  if (!/^\/dashboard(\/|$)/.test(location.pathname)) return;

  var isWhatsAppPage = /^\/dashboard\/whatsapp\/?$/.test(location.pathname);
  var isSettingsPage = /^\/dashboard\/settings\/?$/.test(location.pathname);

  var ROOT_ID = 'dma-wa-command-center';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function authHeaders() {
    var token = localStorage.getItem('token');
    return token
      ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Classify Meta error strings into actionable categories
  function classifyError(msg) {
    var lower = (msg || '').toLowerCase();
    if (lower.indexOf('client secret') !== -1 || lower.indexOf('validating client secret') !== -1) {
      return 'secret';
    }
    if (
      lower.indexOf('domain') !== -1 ||
      lower.indexOf("can't load url") !== -1 ||
      lower.indexOf('app domains') !== -1
    ) {
      return 'domain';
    }
    if (lower.indexOf('redirect_uri') !== -1 || lower.indexOf('redirect uri') !== -1) {
      return 'redirect';
    }
    if (lower.indexOf('has been used') !== -1 || lower.indexOf('code') !== -1) {
      return 'code';
    }
    return 'generic';
  }

  // ── FB SDK shared loader ────────────────────────────────────────────────────
  //
  // Both this file (hub) and dashboard-whatsapp.js (settings card) may run on
  // the same page. A shared Promise-based loader ensures the SDK script is only
  // injected once and both callers get the same FB object.

  function loadFbSdk(appId, cb) {
    // Already initialised
    if (window.FB && window.__fbWaReady) { cb(); return; }

    // Pending load — queue the callback
    if (window.__fbSdkLoader) {
      window.__fbSdkLoader.push(cb);
      return;
    }

    window.__fbSdkLoader = [cb];

    window.fbAsyncInit = function () {
      FB.init({ appId: appId, cookie: true, xfbml: false, version: 'v21.0' });
      window.__fbWaReady = true;
      var queue = window.__fbSdkLoader || [];
      window.__fbSdkLoader = { push: function (fn) { fn(); } }; // future callers run immediately
      queue.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    };

    if (!document.getElementById('facebook-jssdk')) {
      var s = document.createElement('script');
      s.id = 'facebook-jssdk';
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      document.head.appendChild(s);
    } else if (window.FB) {
      // Script tag already exists but fbAsyncInit hasn't fired yet — fire it now
      window.fbAsyncInit();
    }
  }

  // ── Embedded Signup session info listener ──────────────────────────────────
  //
  // Meta's Embedded Signup SDK fires a postMessage containing the WABA ID and
  // phone number ID before FB.login's callback resolves. Capturing it here
  // means connectFlow can read those IDs immediately — no more race condition.

  window.addEventListener('message', function (ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    var d = ev.data;
    // Three known shapes from different Meta SDK versions
    if (d.type === 'WA_EMBEDDED_SIGNUP') {
      window.__waSessionInfo = d.data || d;
    } else if (d.event === 'FINISH') {
      window.__waSessionInfo = d.data || d;
    } else if (d.waba_id || d.wabaId) {
      window.__waSessionInfo = d;
    }
  });

  // ── Connect flow ───────────────────────────────────────────────────────────

  /**
   * Meta's Embedded Signup SDK fires the postMessage containing waba_id and
   * phone_number_id BEFORE FB.login's callback resolves — but only when the
   * popup closes cleanly. On some browsers / slow connections the postMessage
   * races the callback. We wait up to 2 s for it before falling back to
   * whatever is already in window.__waSessionInfo.
   *
   * Timeline on a good flow:
   *   1. FB.login popup opens
   *   2. User completes Embedded Signup → popup fires postMessage (waba_id etc.)
   *   3. Popup closes → FB.login callback fires with code
   *   4. We wait up to 2 s for postMessage if __waSessionInfo is still null
   *   5. Build payload and POST to /api/whatsapp/connect
   */
  function waitForSessionInfo(cb) {
    if (window.__waSessionInfo) { cb(window.__waSessionInfo); return; }
    var waited = 0;
    var interval = setInterval(function () {
      waited += 100;
      if (window.__waSessionInfo) {
        clearInterval(interval);
        cb(window.__waSessionInfo);
      } else if (waited >= 2000) {
        clearInterval(interval);
        cb(null); // timed out — proceed without session info (Graph API fallback)
      }
    }, 100);
  }

  function connectFlow(config, btnEl, errEl, onSuccess) {
    // Immediately lock the button — prevents double-clicks
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.dataset.origText = btnEl.textContent;
      btnEl.textContent = 'Connecting…';
    }
    if (errEl) errEl.style.display = 'none';

    loadFbSdk(config.appId, function () {
      // Clear any stale session info BEFORE launching so we get fresh data
      window.__waSessionInfo = null;

      FB.login(function (response) {
        if (!response.authResponse || !response.authResponse.code) {
          if (errEl) {
            errEl.textContent = 'Meta signup was cancelled. Please try again.';
            errEl.style.display = 'block';
          }
          if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp Business';
          }
          return;
        }

        var oauthCode = response.authResponse.code;

        // Wait up to 2 s for the sessionInfo postMessage before proceeding
        waitForSessionInfo(function (si) {
          si = si || {};

          // Debug log — visible in browser console to confirm what was captured
          console.log('[WA Connect] sessionInfo captured:', {
            waba_id: si.waba_id || si.wabaId || '(none)',
            phone_number_id: si.phone_number_id || si.phoneNumberId || '(none)',
            display_phone_number: si.display_phone_number || si.displayPhoneNumber || '(none)',
          });

          var payload = {
            code: oauthCode,
            waba_id: si.waba_id || si.wabaId || '',
            phone_number_id: si.phone_number_id || si.phoneNumberId || '',
            display_phone_number: si.display_phone_number || si.displayPhoneNumber || '',
          };

          fetch('/api/whatsapp/connect', {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload),
          })
            .then(function (r) {
              return r.json().then(function (d) { return { ok: r.ok, d: d }; });
            })
            .then(function (res) {
              if (!res.ok) {
                var kind = classifyError(res.d.error || '');
                var msg = res.d.error || 'Connection failed';
                if (kind === 'secret') {
                  msg = '🔑 App Secret mismatch — ' + msg;
                } else if (kind === 'domain') {
                  msg = '🌐 Domain error — ' + msg;
                } else if (kind === 'code') {
                  msg = '⏱ Code expired — ' + msg;
                }
                if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
                if (btnEl) {
                  btnEl.disabled = false;
                  btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp Business';
                }
                return;
              }
              if (onSuccess) onSuccess();
              else location.reload();
            })
            .catch(function () {
              if (errEl) {
                errEl.textContent = 'Network error — check your connection and try again.';
                errEl.style.display = 'block';
              }
              if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp Business';
              }
            });
        }); // end waitForSessionInfo
      }, {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        // whatsapp_business_management is required for the Graph API fallback
        // walk (businesses → WABAs → phone_numbers) when sessionInfo is missing
        scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
        extras: config.extras || {
          version: 'v4',
          sessionInfoVersion: '3',
          featureType: 'whatsapp_business_app_onboarding',
        },
      });
    });
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function statCard(label, value, sub) {
    return (
      '<div class="dma-wa-stat">' +
        '<span class="dma-wa-stat__val">' + esc(value) + '</span>' +
        '<span class="dma-wa-stat__lbl">' + esc(label) + '</span>' +
        (sub ? '<span class="dma-wa-stat__sub">' + esc(sub) + '</span>' : '') +
      '</div>'
    );
  }

  // ── WABA health panel ──────────────────────────────────────────────────────
  //
  // Shown only when connected. Lets the doctor trigger a WABA subscription
  // check / re-subscribe without contacting support ("connected but no messages"
  // is almost always a missing WABA subscription).

  function renderWabaHealth(container) {
    if (!container) return;
    container.innerHTML =
      '<h2>Webhook health</h2>' +
      '<p class="dma-wa-muted">Checks whether your WhatsApp Business Account is subscribed to receive inbound messages.</p>' +
      '<div id="dma-wa-waba-result"></div>' +
      '<div class="dma-wa-actions">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-waba-check">Check subscription</button>' +
        '&nbsp;' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--primary" id="dma-wa-waba-fix" style="display:none">Re-subscribe WABA</button>' +
      '</div>';

    var resultEl = document.getElementById('dma-wa-waba-result');
    var checkBtn = document.getElementById('dma-wa-waba-check');
    var fixBtn   = document.getElementById('dma-wa-waba-fix');

    function runCheck(resubscribe) {
      checkBtn.disabled = true;
      fixBtn.disabled = true;
      resultEl.innerHTML = '<p class="dma-wa-muted">Checking…</p>';

      fetch('/api/whatsapp/verify-waba', {
        method: resubscribe ? 'POST' : 'GET',
        headers: authHeaders(),
        credentials: 'include',
        body: resubscribe ? JSON.stringify({ resubscribe: true }) : undefined,
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          checkBtn.disabled = false;
          fixBtn.disabled   = false;
          if (d.subscribed) {
            resultEl.innerHTML =
              '<p style="color:#15803d;font-weight:600">✓ Subscribed — inbound messages will be delivered.</p>';
            fixBtn.style.display = 'none';
          } else {
            resultEl.innerHTML =
              '<p style="color:#b91c1c;font-weight:600">✗ Not subscribed — inbound messages will NOT arrive.</p>' +
              (d.error ? '<p class="dma-wa-muted">' + esc(d.error) + '</p>' : '');
            fixBtn.style.display = '';
          }
        })
        .catch(function () {
          checkBtn.disabled = false;
          fixBtn.disabled   = false;
          resultEl.innerHTML = '<p style="color:#b91c1c">Network error — try again.</p>';
        });
    }

    checkBtn.onclick = function () { runCheck(false); };
    fixBtn.onclick   = function () { runCheck(true);  };
  }

  // ── Full hub renderer ──────────────────────────────────────────────────────

  function renderHub(data, config, log) {
    var host = document.getElementById(ROOT_ID);
    if (!host) return;

    var s = data.stats || {};
    var connected = data.connected;
    var caps = (data.capabilities || []).map(function (c) {
      return '<li><span class="dma-wa-check">✓</span> ' + esc(c) + '</li>';
    }).join('');

    var logRows = (log.messages || []).slice(0, 10).map(function (m) {
      var dir = m.direction === 'INBOUND' ? '← In' : '→ Out';
      var who = m.patient && m.patient.fullName
        ? m.patient.fullName
        : (m.direction === 'INBOUND' ? m.fromNumber : m.toNumber);
      return (
        '<tr>' +
          '<td>' + esc(dir) + '</td>' +
          '<td>' + esc(who) + '</td>' +
          '<td class="dma-wa-log-preview">' + esc((m.body || '').slice(0, 80)) + '</td>' +
          '<td>' +
            (m.isHandledByAI ? '<span class="dma-wa-pill dma-wa-pill--ai">AI</span>' : '') +
            (m.needsReview   ? ' <span class="dma-wa-pill dma-wa-pill--warn">Review</span>' : '') +
          '</td>' +
        '</tr>'
      );
    }).join('');

    // Connection panel content
    var connectionContent;
    if (connected) {
      connectionContent =
        '<p>Number <strong>' + esc(data.phoneNumber) + '</strong> is live. ' +
        'Webhook routes patients to <strong>' + esc(data.clinicName) + '</strong>.</p>' +
        '<div class="dma-wa-actions">' +
          '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-disconnect">Disconnect</button>' +
        '</div>';
    } else if (config && config.configured) {
      connectionContent =
        '<p>Link your clinic WhatsApp Business number via Meta — your AI receptionist goes live immediately after.</p>' +
        '<ol class="dma-wa-steps">' +
          '<li>Click <strong>Connect WhatsApp Business</strong> below</li>' +
          '<li>Log in with your Meta Business account</li>' +
          '<li>Select your clinic phone number &amp; approve permissions</li>' +
        '</ol>' +
        '<p id="dma-wa-error" class="dma-wa-error" style="display:none"></p>' +
        '<div class="dma-wa-actions">' +
          '<button type="button" class="dma-wa-btn dma-wa-btn--primary" id="dma-wa-connect">Connect WhatsApp Business</button>' +
        '</div>';
    } else {
      connectionContent =
        '<p class="dma-wa-muted">Platform admin must configure Meta App ID &amp; Config ID in ' +
        '<a href="/superadmin/integrations/">Superadmin → Integrations</a>.</p>';
    }

    host.innerHTML =
      // Hero
      '<div class="dma-wa-hero">' +
        '<div class="dma-wa-hero__text">' +
          '<p class="dma-wa-eyebrow">WhatsApp Command Center</p>' +
          '<h1>Your clinic on WhatsApp — managed like a human receptionist</h1>' +
          '<p>Patients message your business number. AI books appointments, captures leads, and escalates to your team when needed.</p>' +
        '</div>' +
        '<div class="dma-wa-hero__status ' + (connected ? 'is-connected' : 'is-off') + '">' +
          '<span class="dma-wa-hero__dot"></span>' +
          (connected ? ('Connected · ' + esc(data.phoneNumber || 'WhatsApp')) : 'Not connected') +
        '</div>' +
      '</div>' +

      // Stats row
      '<div class="dma-wa-stats">' +
        statCard('Messages today',  s.inboundToday      || 0, 'inbound') +
        statCard('AI handled',      s.aiHandledToday    || 0, 'auto-replies') +
        statCard('Needs you',       s.needsReview       || 0, 'escalations') +
        statCard('Booked today',    s.appointmentsBooked || 0, 'via WhatsApp') +
        statCard('Hot leads',       s.leadsHot          || 0, 'pipeline') +
      '</div>' +

      // Grid panels
      '<div class="dma-wa-grid">' +

        // Connection
        '<section class="dma-wa-panel">' +
          '<h2>Connection</h2>' +
          connectionContent +
        '</section>' +

        // Capabilities
        '<section class="dma-wa-panel">' +
          '<h2>What your agent does 24/7</h2>' +
          '<ul class="dma-wa-caps">' + caps + '</ul>' +
          '<p class="dma-wa-muted">Configure knowledge in <a href="/dashboard/settings/">Settings</a> — treatments, hours, intro message.</p>' +
        '</section>' +

        // Webhook health — only shown when connected
        (connected
          ? '<section class="dma-wa-panel" id="dma-wa-waba-health"></section>'
          : '') +

        // Quick actions
        '<section class="dma-wa-panel' + (connected ? '' : ' dma-wa-panel--wide') + '">' +
          '<h2>Quick actions</h2>' +
          '<div class="dma-wa-quick">' +
            '<a href="/dashboard/messages/"      class="dma-wa-quick__item"><strong>Inbox</strong><span>Reply &amp; review escalations</span></a>' +
            '<a href="/dashboard/appointments/"  class="dma-wa-quick__item"><strong>Appointments</strong><span>AI-booked slots</span></a>' +
            '<a href="/dashboard/ai/"            class="dma-wa-quick__item"><strong>AI settings</strong><span>Personality &amp; language</span></a>' +
            '<a href="/dashboard/settings/"      class="dma-wa-quick__item"><strong>Clinic profile</strong><span>Treatments &amp; hours</span></a>' +
            (data.advancedToolsUrl
              ? '<a href="' + esc(data.advancedToolsUrl) + '" target="_blank" rel="noopener" class="dma-wa-quick__item dma-wa-quick__item--adv"><strong>Broadcasts &amp; training</strong><span>Advanced tools (optional)</span></a>'
              : '') +
          '</div>' +
        '</section>' +

        // Recent log
        '<section class="dma-wa-panel dma-wa-panel--wide">' +
          '<h2>Recent WhatsApp activity</h2>' +
          (logRows
            ? '<table class="dma-wa-log"><thead><tr><th></th><th>Contact</th><th>Message</th><th></th></tr></thead><tbody>' + logRows + '</tbody></table>'
            : '<p class="dma-wa-muted">No messages yet — connect WhatsApp and send a test message.</p>') +
        '</section>' +

      '</div>';

    // Wire up WABA health panel
    if (connected) {
      renderWabaHealth(document.getElementById('dma-wa-waba-health'));
    }

    // Disconnect
    var discBtn = document.getElementById('dma-wa-disconnect');
    if (discBtn) {
      discBtn.onclick = function () {
        if (!confirm('Disconnect WhatsApp from this clinic?')) return;
        discBtn.disabled = true;
        discBtn.textContent = 'Disconnecting…';
        fetch('/api/whatsapp/disconnect', {
          method: 'DELETE',
          headers: authHeaders(),
          credentials: 'include',
        }).then(function () { location.reload(); });
      };
    }

    // Connect
    var connBtn = document.getElementById('dma-wa-connect');
    if (connBtn) {
      connBtn.onclick = function () {
        connectFlow(
          config,
          connBtn,
          document.getElementById('dma-wa-error'),
          function () { boot(true); }
        );
      };
    }
  }

  // ── Sidebar link injection ─────────────────────────────────────────────────

  function injectSidebarLink() {
    var aside = document.querySelector('aside');
    if (!aside || aside.querySelector('a[href="/dashboard/whatsapp/"]')) return;
    var msgs = aside.querySelector('a[href="/dashboard/messages"], a[href="/dashboard/messages/"]');
    var a = document.createElement('a');
    a.href = '/dashboard/whatsapp/';
    a.className =
      (msgs && msgs.className) ||
      'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm';
    a.innerHTML =
      '<span style="color:#25d366;font-weight:700">●</span><span>WhatsApp</span>';
    if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(a, msgs);
    else (aside.querySelector('nav') || aside).appendChild(a);
  }

  // ── Shell mount ────────────────────────────────────────────────────────────

  function mountShell() {
    if (document.getElementById(ROOT_ID)) return;
    var main = document.querySelector('main');
    if (!main) return;

    if (isWhatsAppPage) {
      var wrap = main.querySelector('div') || main;
      wrap.innerHTML =
        '<div id="' + ROOT_ID + '" class="dma-wa-root">' +
          '<p class="dma-wa-muted">Loading WhatsApp…</p>' +
        '</div>';
      document.title = 'WhatsApp — Doctors My Agency';
      return;
    }

    if (isSettingsPage) {
      var settingsHost =
        main.querySelector('div[class*="max-w"]') ||
        main.querySelector('div') ||
        main;
      if (!document.getElementById('dma-wa-settings-teaser')) {
        var teaser = document.createElement('div');
        teaser.id = 'dma-wa-settings-teaser';
        teaser.className = 'dma-wa-settings-teaser';
        teaser.innerHTML =
          '<strong>WhatsApp Command Center</strong> — connect, stats &amp; broadcasts at ' +
          '<a href="/dashboard/whatsapp/">Dashboard → WhatsApp</a>';
        settingsHost.insertBefore(teaser, settingsHost.firstChild);
      }
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  function boot() {
    injectSidebarLink();
    if (!isWhatsAppPage && !isSettingsPage) return;
    mountShell();
    if (!isWhatsAppPage) return;

    Promise.all([
      fetch('/api/whatsapp/hub', {
        headers: authHeaders(), credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : {}; }),
      fetch('/api/whatsapp/signup-config', {
        headers: authHeaders(), credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : { configured: false }; }),
      fetch('/api/whatsapp/message-log', {
        headers: authHeaders(), credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : { messages: [] }; }),
    ]).then(function (parts) {
      renderHub(parts[0], parts[1], parts[2]);
    }).catch(function () {
      var host = document.getElementById(ROOT_ID);
      if (host) host.innerHTML = '<p class="dma-wa-muted">Could not load WhatsApp data — check your connection and refresh.</p>';
    });
  }

  function scheduleBoot() {
    boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBoot);
  } else {
    scheduleBoot();
  }
})();
