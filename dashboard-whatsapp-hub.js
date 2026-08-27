/**
 * Doctors My Agency — WhatsApp Command Center
 *
 * Handles:
 *  - Sidebar "WhatsApp" link injection on all /dashboard/* pages
 *  - Settings page teaser (links to /dashboard/whatsapp/)
 *  - Full hub UI on /dashboard/whatsapp/
 *
 * Connection methods:
 *  - Manual Meta Connection — ALWAYS available, primary method
 *  - Embedded Signup — shown only when API returns enabled:true
 *    (controlled by WHATSAPP_EMBEDDED_SIGNUP_ENABLED on the server)
 *
 * No IQPigeon dependency. No external platform dependency.
 * All API calls go to /api/whatsapp/* on this same domain.
 */
(function () {
  if (!/^\/dashboard(\/|$)/.test(location.pathname)) return;

  var isWhatsAppPage  = /^\/dashboard\/whatsapp\/?$/.test(location.pathname);
  var isSettingsPage  = /^\/dashboard\/settings\/?$/.test(location.pathname);
  var ROOT_ID         = 'dma-wa-command-center';

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  // ── Shared FB SDK loader ─────────────────────────────────────────────────
  // Only called from runEmbeddedConnect, which is only called when
  // config.enabled === true (server returned enabled:true with appId+configId).
  // Never called when WHATSAPP_EMBEDDED_SIGNUP_ENABLED=false.

  function loadFbSdk(appId, cb) {
    if (window.FB && window.__fbWaReady) { cb(); return; }
    if (window.__fbSdkLoader) {
      if (typeof window.__fbSdkLoader.push === 'function') {
        window.__fbSdkLoader.push(cb);
      } else {
        cb();
      }
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

  // ── Embedded Signup flow ──────────────────────────────────────────────────
  // runEmbeddedConnect is only called when the server returns config.enabled===true.
  // The postMessage listener for WA_EMBEDDED_SIGNUP is registered here, inside
  // this function, so it is never active when Embedded Signup is disabled.

  // ── Manual Connection flow ───────────────────────────────────────────────────

  function runManualConnect(btnEl, errEl, stepsEl, onSuccess) {
    var wabaId     = (document.getElementById('dma-wa-waba-id')      || {}).value || '';
    var phoneId    = (document.getElementById('dma-wa-phone-id')     || {}).value || '';
    var token      = (document.getElementById('dma-wa-token')        || {}).value || '';
    var portfolioId = (document.getElementById('dma-wa-portfolio-id') || {}).value || '';

    if (!wabaId.trim() || !phoneId.trim() || !token.trim()) {
      if (errEl) { errEl.textContent = 'WABA ID, Phone Number ID, and Access Token are required.'; errEl.style.display = 'block'; }
      return;
    }

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Validating…'; }
    if (errEl) { errEl.style.display = 'none'; }
    if (stepsEl) { stepsEl.innerHTML = '<p class="dma-wa-muted">Running validation…</p>'; }

    apiPost('/api/whatsapp/connections/manual', {
      access_token: token.trim(),
      waba_id: wabaId.trim(),
      phone_number_id: phoneId.trim(),
      business_portfolio_id: portfolioId.trim(),
    }).then(function (res) {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Validate & Connect'; }

      // Render step-by-step progress
      if (stepsEl && res.d && res.d.steps) {
        stepsEl.innerHTML = res.d.steps.map(function (s) {
          var icon = s.status === 'pass' ? '✓' : s.status === 'warn' ? '⚠' : '✗';
          var cls  = s.status === 'pass' ? 'dma-step-pass' : s.status === 'warn' ? 'dma-step-warn' : 'dma-step-fail';
          return '<div class="dma-step-row ' + cls + '">' +
            '<span class="dma-step-icon">' + icon + '</span>' +
            '<div><strong>Step ' + s.step + ': ' + esc(s.label) + '</strong>' +
            (s.detail ? '<br><span class="dma-step-detail">' + esc(s.detail) + '</span>' : '') +
            '</div></div>';
        }).join('');
      }

      if (!res.ok) {
        if (errEl) {
          errEl.textContent = res.d.error || 'Validation failed — check the step details above.';
          errEl.style.display = 'block';
        }
        return;
      }

      if (onSuccess) onSuccess(res.d);
      else location.reload();
    }).catch(function () {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Validate & Connect'; }
      if (errEl) { errEl.textContent = 'Network error — check your connection and try again.'; errEl.style.display = 'block'; }
    });
  }

  // ── Embedded Signup flow (only runs when config.enabled === true) ────────────

  function waitForSessionInfo(cb) {
    if (window.__waSessionInfo) { cb(window.__waSessionInfo); return; }
    var waited = 0;
    var iv = setInterval(function () {
      waited += 100;
      if (window.__waSessionInfo || waited >= 2000) {
        clearInterval(iv);
        cb(window.__waSessionInfo || null);
      }
    }, 100);
  }

  function runEmbeddedConnect(config, btnEl, errEl, onSuccess) {
    // ── Hard guard — must never run if server says disabled ────────────────
    // This is a defence-in-depth check. The button is only rendered when
    // config.enabled===true, so reaching here with enabled:false would mean
    // the button was injected by something outside this file.
    if (!config || config.enabled !== true) {
      if (errEl) {
        errEl.textContent =
          'Meta Embedded Signup is currently disabled. Use Manual Meta Connection instead.';
        errEl.style.display = 'block';
      }
      return;
    }

    // Register the postMessage listener now — only when actually launching.
    // This prevents the listener from running on every /dashboard/* page load
    // when Embedded Signup is disabled.
    if (!window.__waSessionInfoListenerAdded) {
      window.__waSessionInfoListenerAdded = true;
      window.addEventListener('message', function (ev) {
        if (!ev.data || typeof ev.data !== 'object') return;
        var d = ev.data;
        if (d.type === 'WA_EMBEDDED_SIGNUP') { window.__waSessionInfo = d.data || d; }
        else if (d.event === 'FINISH')        { window.__waSessionInfo = d.data || d; }
        else if (d.waba_id || d.wabaId)       { window.__waSessionInfo = d; }
      });
    }

    window.__waSessionInfo = null;
    if (btnEl) { btnEl.disabled = true; btnEl.dataset.origText = btnEl.textContent; btnEl.textContent = 'Connecting…'; }
    if (errEl) errEl.style.display = 'none';

    loadFbSdk(config.appId, function () {
      FB.login(function (response) {
        if (!response.authResponse || !response.authResponse.code) {
          if (errEl) { errEl.textContent = 'Meta signup cancelled. Try again.'; errEl.style.display = 'block'; }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect via Meta'; }
          return;
        }
        var code = response.authResponse.code;
        waitForSessionInfo(function (si) {
          si = si || {};
          apiPost('/api/whatsapp/connections/embedded', {
            code: code,
            waba_id: si.waba_id || si.wabaId || '',
            phone_number_id: si.phone_number_id || si.phoneNumberId || '',
            display_phone_number: si.display_phone_number || si.displayPhoneNumber || '',
          }).then(function (res) {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect via Meta'; }
            if (!res.ok) {
              if (errEl) { errEl.textContent = res.d.error || 'Connection failed'; errEl.style.display = 'block'; }
              return;
            }
            if (onSuccess) onSuccess(res.d);
            else location.reload();
          }).catch(function () {
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnEl.dataset.origText || 'Connect via Meta'; }
            if (errEl) { errEl.textContent = 'Network error. Try again.'; errEl.style.display = 'block'; }
          });
        });
      }, {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        scope: 'whatsapp_business_messaging,whatsapp_business_management,business_management',
        extras: config.extras || { version: 'v4', sessionInfoVersion: '3', featureType: 'whatsapp_business_app_onboarding' },
      });
    });
  }

  // ── UI components ─────────────────────────────────────────────────────────────

  function statCard(label, value, sub) {
    return '<div class="dma-wa-stat">' +
      '<span class="dma-wa-stat__val">' + esc(value) + '</span>' +
      '<span class="dma-wa-stat__lbl">' + esc(label) + '</span>' +
      (sub ? '<span class="dma-wa-stat__sub">' + esc(sub) + '</span>' : '') +
      '</div>';
  }

  function renderConnectedPanel(data) {
    return '<p>Number <strong>' + esc(data.phoneNumber || data.displayName || 'WhatsApp Business') + '</strong> is live.' +
      (data.connectionMethod === 'MANUAL' ? ' <span style="font-size:.75rem;color:#64748b">(Manual connection)</span>' : '') + '</p>' +
      '<p class="dma-wa-muted">Webhook: ' + (data.webhookStatus === 'subscribed'
        ? '<span style="color:#15803d">✓ subscribed</span>'
        : '<span style="color:#b45309">⚠ ' + esc(data.webhookStatus || 'unknown') + '</span>') + '</p>' +
      '<div class="dma-wa-actions" style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-disconnect">Disconnect</button>' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-verify-waba">Check Webhook</button>' +
      '</div>' +
      '<div id="dma-wa-webhook-result" style="margin-top:10px;font-size:.8rem"></div>';
  }

  function renderManualConnectPanel(config) {
    return '<p>Enter your Meta credentials from <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" style="color:#ea580c">Meta App Dashboard</a> → WhatsApp → API Setup.</p>' +
      '<div class="dma-wa-form">' +
        '<div class="dma-wa-field">' +
          '<label>WABA ID <span style="color:#ef4444">*</span></label>' +
          '<input type="text" id="dma-wa-waba-id" placeholder="Numeric WABA ID (e.g. 12345678901234)" autocomplete="off" />' +
        '</div>' +
        '<div class="dma-wa-field">' +
          '<label>Phone Number ID <span style="color:#ef4444">*</span></label>' +
          '<input type="text" id="dma-wa-phone-id" placeholder="Phone Number ID from API Setup page" autocomplete="off" />' +
        '</div>' +
        '<div class="dma-wa-field">' +
          '<label>System User Access Token <span style="color:#ef4444">*</span></label>' +
          '<input type="password" id="dma-wa-token" placeholder="System User permanent access token" autocomplete="off" />' +
        '</div>' +
        '<div class="dma-wa-field">' +
          '<label>Business Portfolio ID <span style="color:#64748b;font-size:.75rem">(optional)</span></label>' +
          '<input type="text" id="dma-wa-portfolio-id" placeholder="Meta Business Portfolio ID" autocomplete="off" />' +
        '</div>' +
      '</div>' +
      '<p id="dma-wa-error" class="dma-wa-error" style="display:none"></p>' +
      '<div id="dma-wa-steps" class="dma-wa-steps-list"></div>' +
      '<div class="dma-wa-actions" style="margin-top:14px">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--primary" id="dma-wa-connect-manual">Validate &amp; Connect</button>' +
        (config && config.enabled
          ? '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-connect-embedded" style="margin-left:8px">Connect via Meta Signup</button>'
          : '') +
      '</div>' +
      '<p class="dma-wa-muted" style="margin-top:12px;font-size:.75rem">' +
        'Need help? <a href="/dashboard/whatsapp/manual-connect.html" style="color:#ea580c">Step-by-step guide ↗</a>' +
      '</p>';
  }

  function renderWabaHealthPanel(container) {
    if (!container) return;
    container.innerHTML =
      '<h2>Webhook health</h2>' +
      '<p class="dma-wa-muted">Verifies your WABA is subscribed to receive inbound messages.</p>' +
      '<div id="dma-wa-waba-check-result"></div>' +
      '<div class="dma-wa-actions" style="margin-top:10px">' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--ghost" id="dma-wa-waba-check-btn">Check subscription</button>' +
        '&nbsp;' +
        '<button type="button" class="dma-wa-btn dma-wa-btn--primary" id="dma-wa-waba-fix-btn" style="display:none">Re-subscribe</button>' +
      '</div>';

    var resultEl  = container.querySelector('#dma-wa-waba-check-result');
    var checkBtn  = container.querySelector('#dma-wa-waba-check-btn');
    var fixBtn    = container.querySelector('#dma-wa-waba-fix-btn');

    function runCheck(resubscribe) {
      checkBtn.disabled = fixBtn.disabled = true;
      resultEl.innerHTML = '<p class="dma-wa-muted">Checking…</p>';
      var req = resubscribe
        ? apiPost('/api/whatsapp/verify-waba', {})
        : apiGet('/api/whatsapp/verify-waba');
      req.then(function (d) {
        checkBtn.disabled = fixBtn.disabled = false;
        var data = resubscribe ? d.d : d;
        if (data.subscribed) {
          resultEl.innerHTML = '<p style="color:#15803d;font-weight:600">✓ Subscribed — inbound messages will be delivered.</p>';
          fixBtn.style.display = 'none';
        } else {
          resultEl.innerHTML = '<p style="color:#b91c1c;font-weight:600">✗ Not subscribed — inbound messages will NOT arrive.</p>' +
            (data.error ? '<p class="dma-wa-muted">' + esc(data.error) + '</p>' : '');
          fixBtn.style.display = '';
        }
      }).catch(function () {
        checkBtn.disabled = fixBtn.disabled = false;
        resultEl.innerHTML = '<p style="color:#b91c1c">Network error. Try again.</p>';
      });
    }

    checkBtn.onclick = function () { runCheck(false); };
    fixBtn.onclick   = function () { runCheck(true); };
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
        '</td></tr>';
    }).join('');

    // Connection panel — manual form or connected status
    var connectionContent = connected
      ? renderConnectedPanel(data)
      : renderManualConnectPanel(config);

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
          (connected ? 'Connected · ' + esc(data.phoneNumber || data.displayName || 'WhatsApp') : 'Not connected') +
        '</div>' +
      '</div>' +

      // Stats
      '<div class="dma-wa-stats">' +
        statCard('Messages today',  s.inboundToday       || 0, 'inbound') +
        statCard('AI handled',      s.aiHandledToday     || 0, 'auto-replies') +
        statCard('Needs you',       s.needsReview        || 0, 'escalations') +
        statCard('Booked today',    s.appointmentsBooked || 0, 'via WhatsApp') +
        statCard('Hot leads',       s.leadsHot           || 0, 'pipeline') +
      '</div>' +

      // Grid
      '<div class="dma-wa-grid">' +

        // Connection panel
        '<section class="dma-wa-panel" id="dma-wa-conn-panel">' +
          '<h2>' + (connected ? 'Connection' : 'Connect WhatsApp — Manual Meta Connection') + '</h2>' +
          connectionContent +
        '</section>' +

        // Capabilities
        '<section class="dma-wa-panel">' +
          '<h2>What your agent does 24/7</h2>' +
          '<ul class="dma-wa-caps">' + caps + '</ul>' +
          '<p class="dma-wa-muted">Configure in <a href="/dashboard/settings/">Settings</a> — treatments, hours, intro message.</p>' +
        '</section>' +

        // Webhook health (only when connected)
        (connected ? '<section class="dma-wa-panel" id="dma-wa-health-panel"></section>' : '') +

        // Quick actions
        '<section class="dma-wa-panel' + (connected ? '' : ' dma-wa-panel--wide') + '">' +
          '<h2>Quick actions</h2>' +
          '<div class="dma-wa-quick">' +
            '<a href="/dashboard/messages/"     class="dma-wa-quick__item"><strong>Inbox</strong><span>Reply &amp; review escalations</span></a>' +
            '<a href="/dashboard/appointments/" class="dma-wa-quick__item"><strong>Appointments</strong><span>AI-booked slots</span></a>' +
            '<a href="/dashboard/ai/"           class="dma-wa-quick__item"><strong>AI settings</strong><span>Personality &amp; language</span></a>' +
            '<a href="/dashboard/settings/"     class="dma-wa-quick__item"><strong>Clinic profile</strong><span>Treatments &amp; hours</span></a>' +
            '<a href="/dashboard/whatsapp/manual-connect.html" class="dma-wa-quick__item dma-wa-quick__item--adv"><strong>Connection guide</strong><span>Step-by-step setup</span></a>' +
          '</div>' +
        '</section>' +

        // Recent log
        '<section class="dma-wa-panel dma-wa-panel--wide">' +
          '<h2>Recent WhatsApp activity</h2>' +
          (logRows
            ? '<table class="dma-wa-log"><thead><tr><th></th><th>Contact</th><th>Message</th><th></th></tr></thead><tbody>' + logRows + '</tbody></table>'
            : '<p class="dma-wa-muted">No messages yet. Connect WhatsApp and send a test message.</p>') +
        '</section>' +

      '</div>'; // end grid

    // Wire up webhook health panel
    if (connected) {
      renderWabaHealthPanel(document.getElementById('dma-wa-health-panel'));
    }

    // Disconnect button
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

    // Inline verify-waba from connected panel
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

    // Manual connect form
    var manualBtn = document.getElementById('dma-wa-connect-manual');
    if (manualBtn) {
      manualBtn.onclick = function () {
        runManualConnect(
          manualBtn,
          document.getElementById('dma-wa-error'),
          document.getElementById('dma-wa-steps'),
          function () { boot(); }
        );
      };
    }

    // Embedded Signup button (only rendered when API says enabled:true)
    var embeddedBtn = document.getElementById('dma-wa-connect-embedded');
    if (embeddedBtn && config && config.enabled) {
      embeddedBtn.onclick = function () {
        runEmbeddedConnect(config, embeddedBtn, document.getElementById('dma-wa-error'), function () { boot(); });
      };
    }
  }

  // ── CSS injection for form and step elements ──────────────────────────────────

  function injectFormStyles() {
    if (document.getElementById('dma-wa-form-styles')) return;
    var s = document.createElement('style');
    s.id = 'dma-wa-form-styles';
    s.textContent =
      '.dma-wa-form{display:flex;flex-direction:column;gap:10px;margin:12px 0}' +
      '.dma-wa-field{display:flex;flex-direction:column;gap:4px}' +
      '.dma-wa-field label{font-size:.78rem;font-weight:600;color:#475569}' +
      '.dma-wa-field input{padding:9px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-size:.85rem;font-family:Inter,sans-serif;outline:none;transition:border-color .15s}' +
      '.dma-wa-field input:focus{border-color:#f97316}' +
      '.dma-wa-steps-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}' +
      '.dma-step-row{display:flex;gap:10px;align-items:flex-start;padding:7px 10px;border-radius:8px;font-size:.8rem;line-height:1.4}' +
      '.dma-step-pass{background:#f0fdf4;border:1px solid #86efac}' +
      '.dma-step-warn{background:#fffbeb;border:1px solid #fcd34d}' +
      '.dma-step-fail{background:#fef2f2;border:1px solid #fca5a5}' +
      '.dma-step-icon{font-weight:800;flex-shrink:0;margin-top:1px}' +
      '.dma-step-pass .dma-step-icon{color:#15803d}' +
      '.dma-step-warn .dma-step-icon{color:#92400e}' +
      '.dma-step-fail .dma-step-icon{color:#b91c1c}' +
      '.dma-step-detail{color:#64748b;font-size:.75rem}';
    document.head.appendChild(s);
  }

  // ── Sidebar link ──────────────────────────────────────────────────────────────

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
      injectFormStyles();
      return;
    }

    if (isSettingsPage) {
      var host = main.querySelector('div[class*="max-w"]') || main.querySelector('div') || main;
      if (!document.getElementById('dma-wa-settings-teaser')) {
        var t = document.createElement('div');
        t.id = 'dma-wa-settings-teaser';
        t.className = 'dma-wa-settings-teaser';
        t.innerHTML =
          '<strong>WhatsApp Command Center</strong> — connect, stats &amp; activity at ' +
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
