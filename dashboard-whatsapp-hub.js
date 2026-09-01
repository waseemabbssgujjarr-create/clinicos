/**
 * Doctors My Agency — WhatsApp Command Center
 *
 * Runs on all /dashboard/* pages.
 * Full hub UI is rendered on /dashboard/whatsapp/.
 * A compact teaser is injected on /dashboard/settings/.
 *
 * CONNECTION METHOD
 *   Meta Embedded Signup is the ONLY customer-facing WhatsApp connection flow.
 *   There is no manual WABA ID / token / form in this file.
 *
 * FEATURE FLAG
 *   The server controls whether the Connect button is shown via:
 *   GET /api/whatsapp/connections/config → { enabled: true/false, appId, configId }
 *
 *   enabled: true  → Connect button is rendered, FB SDK loaded on click, flow runs.
 *   enabled: false → No button. No SDK. No dialog. Clear unavailable message.
 *
 * FB SDK / FACEBOOK LOGIN SAFETY
 *   - postMessage listener is registered only inside runEmbeddedConnect(),
 *     only when config.enabled === true, only when the button is clicked.
 *   - FB SDK script is injected only at that moment.
 *   - Listener is deregistered after success, failure, or cancellation.
 *   - Hard guard at top of runEmbeddedConnect rejects any call when disabled.
 *   - META_APP_ID and META_CONFIG_ID are never exposed to the browser from
 *     this file — they come from /api/whatsapp/connections/config.
 *   - META_APP_SECRET is never in the browser.
 */
(function () {
  if (!/^\/dashboard(\/|$)/.test(location.pathname)) return;

  var isWhatsAppPage = /^\/dashboard\/whatsapp\/?$/.test(location.pathname);
  var isSettingsPage = /^\/dashboard\/settings\/?$/.test(location.pathname);
  var ROOT_ID = 'dma-wa-command-center';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function authHeaders() {
    var token = localStorage.getItem('token');
    return token
      ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = (s == null ? '' : String(s));
    return d.innerHTML;
  }

  function apiGet(path) {
    return fetch(path, { headers: authHeaders(), credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : Promise.resolve({}); })
      .catch(function () { return {}; });
  }

  function apiPost(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    });
  }

  // ── FB SDK loader ─────────────────────────────────────────────────────────────
  // Only ever called from runEmbeddedConnect(), which is only called when
  // config.enabled === true. Never runs when the feature flag is false.

  function loadFbSdk(appId, cb) {
    if (window.FB && window.__fbWaReady) { cb(); return; }
    if (window.__fbSdkLoader) {
      typeof window.__fbSdkLoader.push === 'function'
        ? window.__fbSdkLoader.push(cb)
        : cb();
      return;
    }
    window.__fbSdkLoader = [cb];
    window.fbAsyncInit = function () {
      FB.init({ appId: appId, cookie: true, xfbml: false, version: 'v21.0' });
      window.__fbWaReady = true;
      var q = window.__fbSdkLoader || [];
      window.__fbSdkLoader = { push: function (fn) { fn(); } };
      q.forEach(function (fn) { try { fn(); } catch (_) {} });
    };
    if (!document.getElementById('facebook-jssdk')) {
      var s = document.createElement('script');
      s.id = 'facebook-jssdk';
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      document.head.appendChild(s);
    } else if (window.FB) {
      window.fbAsyncInit();
    }
  }

  // ── Embedded Signup flow ──────────────────────────────────────────────────────
  // waitForSessionInfo polls for the WA_EMBEDDED_SIGNUP postMessage.

  function waitForSessionInfo(cb) {
    if (window.__waSessionInfo) { cb(window.__waSessionInfo); return; }
    var waited = 0;
    var iv = setInterval(function () {
      waited += 100;
      if (window.__waSessionInfo || waited >= 8000) {
        clearInterval(iv);
        cb(window.__waSessionInfo || null);
      }
    }, 100);
  }

  function runEmbeddedConnect(config, btnEl, errEl, onSuccess) {
    // ── Hard guard ────────────────────────────────────────────────────────────
    // If the server says disabled, this function must never proceed further.
    // The button is only rendered when config.enabled === true, but this
    // guard provides a second layer of protection.
    if (!config || config.enabled !== true) {
      if (errEl) {
        errEl.textContent = 'WhatsApp connection is currently unavailable. Please try again later.';
        errEl.style.display = 'block';
      }
      return;
    }

    // ── Register postMessage listener ──────────────────────────────────────────
    // Registered only at the moment the user clicks Connect — never at page load.
    // Deregistered after success, failure, or cancellation via the cleanup flag.
    var listenerRef = null;
    if (!window.__waSessionInfoListenerAdded) {
      window.__waSessionInfoListenerAdded = true;
      listenerRef = function (ev) {
        if (!ev.data || typeof ev.data !== 'object') return;
        var d = ev.data;
        if (d.type === 'WA_EMBEDDED_SIGNUP') { window.__waSessionInfo = d.data || d; }
        else if (d.event === 'FINISH')        { window.__waSessionInfo = d.data || d; }
        else if (d.waba_id || d.wabaId)       { window.__waSessionInfo = d; }
      };
      window.addEventListener('message', listenerRef);
    }

    function cleanup() {
      if (listenerRef) {
        window.removeEventListener('message', listenerRef);
        listenerRef = null;
        window.__waSessionInfoListenerAdded = false;
      }
    }

    // ── Launch ─────────────────────────────────────────────────────────────────
    // Only clear __waSessionInfo if it isn't already set from an earlier postMessage
    // on this page. Meta can fire WA_EMBEDDED_SIGNUP before FB.login returns.
    if (!window.__waSessionInfo) {
      window.__waSessionInfo = null;
    }
    if (btnEl) { btnEl.disabled = true; btnEl.dataset.origText = btnEl.textContent; btnEl.textContent = 'Connecting…'; }
    if (errEl) errEl.style.display = 'none';

    loadFbSdk(config.appId, function () {
      FB.login(function (response) {
        if (!response.authResponse || !response.authResponse.code) {
          cleanup();
          if (errEl) { errEl.textContent = 'Meta signup cancelled. Please try again.'; errEl.style.display = 'block'; }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp with Meta'; }
          return;
        }

        var code = response.authResponse.code;
        waitForSessionInfo(function (si) {
          cleanup();
          si = si || {};

          apiPost('/api/whatsapp/connections/embedded', {
            code:                 code,
            waba_id:              si.waba_id              || si.wabaId              || '',
            phone_number_id:      si.phone_number_id      || si.phoneNumberId      || '',
            display_phone_number: si.display_phone_number || si.displayPhoneNumber || '',
          }).then(function (res) {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp with Meta'; }
            if (!res.ok) {
              if (errEl) { errEl.textContent = res.d.error || 'Connection failed. Please try again.'; errEl.style.display = 'block'; }
              return;
            }
            if (onSuccess) onSuccess(res.d);
            else location.reload();
          }).catch(function () {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect WhatsApp with Meta'; }
            if (errEl) { errEl.textContent = 'Network error. Check your connection and try again.'; errEl.style.display = 'block'; }
          });
        });
      }, {
        config_id:                       config.configId,
        response_type:                   'code',
        override_default_response_type:  true,
        scope:                           'whatsapp_business_messaging,whatsapp_business_management,business_management',
        extras:                          config.extras || {
          version:            'v4',
          sessionInfoVersion: '3',
          featureType:        'whatsapp_business_app_onboarding',
        },
      });
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────

  function statCard(label, value, sub) {
    return '<div class="dma-wa-stat">' +
      '<span class="dma-wa-stat__val">' + esc(value) + '</span>' +
      '<span class="dma-wa-stat__lbl">' + esc(label) + '</span>' +
      (sub ? '<span class="dma-wa-stat__sub">' + esc(sub) + '</span>' : '') +
      '</div>';
  }

  // ── Connection panel: connected state ─────────────────────────────────────────

  function renderConnectedPanel(data) {
    var phoneDisplay = esc(data.phoneNumber || data.displayName || 'WhatsApp Business');
    var webhookBadge = data.webhookStatus === 'subscribed'
      ? '<span style="color:#15803d">✓ subscribed</span>'
      : '<span style="color:#b45309">⚠ ' + esc(data.webhookStatus || 'unknown') + '</span>';

    return '' +
      '<div class="dma-wa-connected-info">' +
        '<div class="dma-wa-phone-badge">' +
          '<span class="dma-wa-phone-icon">📱</span>' +
          '<div>' +
            '<p class="dma-wa-phone-number">' + phoneDisplay + '</p>' +
            '<p class="dma-wa-phone-meta">Connected through Meta · Webhook: ' + webhookBadge + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dma-wa-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
        '<a href="/dashboard/messages/" class="dma-wa-btn dma-wa-btn--primary">Open WhatsApp Inbox</a>' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-verify-waba">Check Webhook</button>' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-disconnect">Disconnect</button>' +
      '</div>' +
      '<div id="dma-wa-webhook-result" style="margin-top:10px;font-size:.8rem"></div>';
  }

  // ── Connection panel: not-connected state ─────────────────────────────────────
  // ── Connection panel: not-connected state ─────────────────────────────────
  // Shows Embedded Signup button when enabled, or a clear setup message.

  function renderConnectPanel(config) {
    // credentials present but something specific is missing — show actionable message
    if (!config || config.enabled !== true) {
      var code = (config && config.code) || '';
      var msg  = (config && config.message) || 'Contact your platform administrator to configure WhatsApp.';

      var actionLink = '';
      if (code === 'META_CREDENTIALS_MISSING' || code === 'META_CONFIG_ID_MISSING' || code === 'EMBEDDED_SIGNUP_DISABLED') {
        actionLink =
          '<a href="/superadmin/integrations/" ' +
            'style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:.8125rem;' +
                   'font-weight:700;color:#2563EB;text-decoration:none;padding:8px 14px;' +
                   'border:1.5px solid rgba(37,99,235,.4);border-radius:8px;background:#EFF6FF">' +
            '⚙️ Superadmin → Integrations' +
          '</a>';
      }

      return '' +
        '<div style="text-align:center;padding:1.75rem 1rem">' +
          '<div style="font-size:2.25rem;margin-bottom:10px">' +
            (code === 'META_CREDENTIALS_MISSING' || code === 'META_CONFIG_ID_MISSING' ? '⚙️' : '💬') +
          '</div>' +
          '<p style="font-size:.9375rem;font-weight:700;color:#111827;margin:0 0 8px">Connect with your approved Meta app</p>' +
          '<p style="font-size:.8125rem;color:#6B7280;margin:0 auto;line-height:1.6;max-width:340px">' + esc(msg) + '</p>' +
          actionLink +
        '</div>';
    }

    // All credentials present — show the Connect button
    return '' +
      '<p style="color:#374151;font-size:.9rem;margin:0 0 16px;line-height:1.6">' +
        'Connect your clinic\'s WhatsApp Business account securely through Meta.' +
      '</p>' +
      '<p id="dma-wa-error" class="dma-wa-error" style="display:none"></p>' +
      '<div class="dma-wa-actions">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--primary dma-wa-btn--whatsapp" id="dma-wa-connect-embedded">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex-shrink:0">' +
            '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
          '</svg>' +
          '&nbsp;Connect WhatsApp with Meta' +
        '</button>' +
      '</div>';
  }

  // ── WABA webhook health panel ─────────────────────────────────────────────────

  function renderWabaHealthPanel(container) {
    if (!container) return;
    container.innerHTML =
      '<h2>Webhook health</h2>' +
      '<p class="dma-wa-muted">Verifies inbound messages are being delivered to this clinic.</p>' +
      '<div id="dma-wa-waba-check-result"></div>' +
      '<div class="dma-wa-actions" style="margin-top:10px">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-waba-check-btn">Check subscription</button>' +
        '&nbsp;' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--primary" id="dma-wa-waba-fix-btn" style="display:none">Re-subscribe</button>' +
      '</div>';

    var resultEl = container.querySelector('#dma-wa-waba-check-result');
    var checkBtn = container.querySelector('#dma-wa-waba-check-btn');
    var fixBtn   = container.querySelector('#dma-wa-waba-fix-btn');

    function runCheck(resubscribe) {
      checkBtn.disabled = fixBtn.disabled = true;
      resultEl.innerHTML = '<p class="dma-wa-muted">Checking…</p>';
      var req = resubscribe ? apiPost('/api/whatsapp/verify-waba', {}) : apiGet('/api/whatsapp/verify-waba');
      req.then(function (d) {
        checkBtn.disabled = fixBtn.disabled = false;
        var data = resubscribe ? d.d : d;
        if (data.subscribed) {
          resultEl.innerHTML = '<p style="color:#15803d;font-weight:600">✓ Subscribed — inbound messages active.</p>';
          fixBtn.style.display = 'none';
        } else {
          resultEl.innerHTML = '<p style="color:#b91c1c;font-weight:600">✗ Not subscribed — inbound messages will not arrive.</p>' +
            (data.error ? '<p class="dma-wa-muted">' + esc(data.error) + '</p>' : '');
          fixBtn.style.display = '';
        }
      }).catch(function () {
        checkBtn.disabled = fixBtn.disabled = false;
        resultEl.innerHTML = '<p style="color:#b91c1c">Network error. Try again.</p>';
      });
    }

    checkBtn.onclick = function () { runCheck(false); };
    fixBtn.onclick   = function () { runCheck(true);  };
  }

  // ── Full hub renderer ─────────────────────────────────────────────────────────

  function renderHub(data, config, log) {
    var host = document.getElementById(ROOT_ID);
    if (!host) return;

    var s         = data.stats || {};
    var connected = data.connected;
    var caps      = (data.capabilities || []).map(function (c) {
      return '<li><span class="dma-wa-check">✓</span> ' + esc(c) + '</li>';
    }).join('');

    var logRows = (log.messages || []).slice(0, 10).map(function (m) {
      var dir = m.direction === 'INBOUND' ? '← In' : '→ Out';
      var who = m.patient && m.patient.fullName ? m.patient.fullName
        : (m.direction === 'INBOUND' ? m.fromNumber : m.toNumber);
      return '<tr>' +
        '<td>' + esc(dir) + '</td>' +
        '<td>' + esc(who) + '</td>' +
        '<td class="dma-wa-log-preview">' + esc((m.body || '').slice(0, 80)) + '</td>' +
        '<td>' +
          (m.isHandledByAI ? '<span class="dma-wa-pill dma-wa-pill--ai">AI</span>' : '') +
          (m.needsReview   ? ' <span class="dma-wa-pill dma-wa-pill--warn">Review</span>' : '') +
        '</td>' +
      '</tr>';
    }).join('');

    var connPanelTitle = connected ? 'WhatsApp Connected' : 'Connect WhatsApp';
    var connPanelContent = connected ? renderConnectedPanel(data) : renderConnectPanel(config);

    host.innerHTML =
      // Hero
      '<div class="dma-wa-hero">' +
        '<div class="dma-wa-hero__text">' +
          '<p class="dma-wa-eyebrow">WhatsApp Command Center</p>' +
          '<h1>Your clinic on WhatsApp — managed like a human receptionist</h1>' +
          '<p>Patients message your business number. AI books appointments, captures leads, and escalates when needed.</p>' +
        '</div>' +
        '<div class="dma-wa-hero__status ' + (connected ? 'is-connected' : 'is-off') + '">' +
          '<span class="dma-wa-hero__dot"></span>' +
          (connected
            ? esc(data.phoneNumber || data.displayName || 'WhatsApp') + ' · Connected'
            : 'Not connected') +
        '</div>' +
      '</div>' +

      // Stats (only meaningful when connected)
      (connected
        ? '<div class="dma-wa-stats">' +
            statCard('Messages today',  s.inboundToday        || 0, 'inbound') +
            statCard('AI handled',      s.aiHandledToday      || 0, 'auto-replies') +
            statCard('Needs you',       s.needsReview         || 0, 'escalations') +
            statCard('Booked today',    s.appointmentsBooked  || 0, 'via WhatsApp') +
            statCard('Hot leads',       s.leadsHot            || 0, 'pipeline') +
          '</div>'
        : '') +

      // Grid
      '<div class="dma-wa-grid">' +

        // Connection panel
        '<section class="dma-wa-panel" id="dma-wa-conn-panel">' +
          '<h2>' + esc(connPanelTitle) + '</h2>' +
          connPanelContent +
        '</section>' +

        // Capabilities
        '<section class="dma-wa-panel">' +
          '<h2>What your AI receptionist does 24/7</h2>' +
          '<ul class="dma-wa-caps">' + caps + '</ul>' +
          '<p class="dma-wa-muted">Configure in <a href="/dashboard/settings/">Settings</a> — treatments, hours, intro message.</p>' +
        '</section>' +

        // Webhook health — only when connected
        (connected ? '<section class="dma-wa-panel" id="dma-wa-health-panel"></section>' : '') +

        // Quick actions
        '<section class="dma-wa-panel' + (connected ? '' : ' dma-wa-panel--wide') + '">' +
          '<h2>Quick actions</h2>' +
          '<div class="dma-wa-quick">' +
            '<a href="/dashboard/messages/"     class="dma-wa-quick__item"><strong>Inbox</strong><span>Reply &amp; review escalations</span></a>' +
            '<a href="/dashboard/appointments/" class="dma-wa-quick__item"><strong>Appointments</strong><span>AI-booked slots</span></a>' +
            '<a href="/dashboard/ai/"           class="dma-wa-quick__item"><strong>AI settings</strong><span>Personality &amp; language</span></a>' +
            '<a href="/dashboard/settings/"     class="dma-wa-quick__item"><strong>Clinic profile</strong><span>Treatments &amp; hours</span></a>' +
          '</div>' +
        '</section>' +

        // Recent log
        '<section class="dma-wa-panel dma-wa-panel--wide">' +
          '<h2>Recent WhatsApp activity</h2>' +
          (logRows
            ? '<table class="dma-wa-log"><thead><tr><th></th><th>Contact</th><th>Message</th><th></th></tr></thead><tbody>' + logRows + '</tbody></table>'
            : '<p class="dma-wa-muted">No messages yet — connect WhatsApp and send a test message from your phone.</p>') +
        '</section>' +

      '</div>';

    // Wire: webhook health panel
    if (connected) {
      renderWabaHealthPanel(document.getElementById('dma-wa-health-panel'));
    }

    // Wire: disconnect
    var discBtn = document.getElementById('dma-wa-disconnect');
    if (discBtn) {
      discBtn.onclick = function () {
        if (!confirm('Disconnect WhatsApp from this clinic?')) return;
        discBtn.disabled = true; discBtn.textContent = 'Disconnecting…';
        fetch('/api/whatsapp/connections/disconnect', {
          method: 'DELETE', headers: authHeaders(), credentials: 'include',
        }).then(function () { location.reload(); });
      };
    }

    // Wire: inline webhook check
    var verifyBtn = document.getElementById('dma-wa-verify-waba');
    if (verifyBtn) {
      verifyBtn.onclick = function () {
        verifyBtn.disabled = true; verifyBtn.textContent = 'Checking…';
        var resultEl = document.getElementById('dma-wa-webhook-result');
        apiPost('/api/whatsapp/verify-waba', {}).then(function (res) {
          verifyBtn.disabled = false; verifyBtn.textContent = 'Check Webhook';
          if (!resultEl) return;
          resultEl.innerHTML = res.d.subscribed
            ? '<span style="color:#15803d">✓ Webhook subscribed — inbound messages active</span>'
            : '<span style="color:#b91c1c">✗ ' + esc(res.d.message || res.d.error || 'Not subscribed') + '</span>';
        }).catch(function () { verifyBtn.disabled = false; verifyBtn.textContent = 'Check Webhook'; });
      };
    }

    // Wire: Embedded Signup connect button
    var connectBtn = document.getElementById('dma-wa-connect-embedded');
    if (connectBtn) {
      connectBtn.onclick = function () {
        runEmbeddedConnect(config, connectBtn, document.getElementById('dma-wa-error'), function () { boot(); });
      };
    }
  }

  // ── Extra CSS for connected-info layout ───────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('dma-wa-hub-styles')) return;
    var s = document.createElement('style');
    s.id = 'dma-wa-hub-styles';
    s.textContent =
      '.dma-wa-connected-info{margin-bottom:4px}' +
      '.dma-wa-phone-badge{display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px 16px}' +
      '.dma-wa-phone-icon{font-size:1.5rem;flex-shrink:0}' +
      '.dma-wa-phone-number{font-size:1.05rem;font-weight:700;color:#0f172a;margin:0 0 3px}' +
      '.dma-wa-phone-meta{font-size:.75rem;color:#64748b;margin:0}' +
      '.dma-wa-unavailable{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;text-align:center}' +
      '.dma-wa-btn--whatsapp{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#25d366,#128c7e)!important;font-size:.92rem!important}';
    document.head.appendChild(s);
  }

  // ── Sidebar link injection ────────────────────────────────────────────────────

  function injectSidebarLink() {
    var aside = document.querySelector('aside');
    if (!aside || aside.querySelector('a[href="/dashboard/whatsapp/"]')) return;
    var msgs = aside.querySelector('a[href="/dashboard/messages"], a[href="/dashboard/messages/"]');
    var a = document.createElement('a');
    a.href = '/dashboard/whatsapp/';
    a.className = (msgs && msgs.className) || 'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm';
    a.innerHTML = '<span style="color:#25d366;font-weight:700">●</span><span>WhatsApp</span>';
    if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(a, msgs);
    else (aside.querySelector('nav') || aside).appendChild(a);
  }

  // ── Shell mount ───────────────────────────────────────────────────────────────

  function mountShell() {
    if (document.getElementById(ROOT_ID)) return;
    var main = document.querySelector('main');
    if (!main) return;

    if (isWhatsAppPage) {
      var wrap = main.querySelector('div') || main;
      wrap.innerHTML = '<div id="' + ROOT_ID + '" class="dma-wa-root"><p class="dma-wa-muted">Loading WhatsApp…</p></div>';
      document.title = 'WhatsApp — Doctors My Agency';
      injectStyles();
      return;
    }

    if (isSettingsPage) {
      var host = main.querySelector('div[class*="max-w"]') || main.querySelector('div') || main;
      if (!document.getElementById('dma-wa-settings-teaser')) {
        var t = document.createElement('div');
        t.id = 'dma-wa-settings-teaser';
        t.className = 'dma-wa-settings-teaser';
        t.innerHTML =
          '<strong>WhatsApp Command Center</strong> — connect &amp; manage at ' +
          '<a href="/dashboard/whatsapp/">Dashboard → WhatsApp</a>';
        host.insertBefore(t, host.firstChild);
      }
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  function boot() {
    injectSidebarLink();
    if (!isWhatsAppPage && !isSettingsPage) return;
    mountShell();
    if (!isWhatsAppPage) return;

    Promise.all([
      apiGet('/api/whatsapp/hub'),
      apiGet('/api/whatsapp/connections/config'),
      apiGet('/api/whatsapp/message-log'),
    ]).then(function (parts) {
      renderHub(parts[0], parts[1], parts[2]);
    }).catch(function () {
      var h = document.getElementById(ROOT_ID);
      if (h) h.innerHTML = '<p class="dma-wa-muted">Could not load WhatsApp data. Check your connection and refresh.</p>';
    });
  }

  function scheduleBoot() {
    boot();
    setTimeout(boot, 800);
    setTimeout(boot, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBoot);
  } else {
    scheduleBoot();
  }
})();
