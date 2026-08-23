/**
 * ClinicOS — Meta WhatsApp Embedded Signup card on /dashboard/settings/
 *
 * Fixes applied (vs previous version):
 *  - FB SDK is loaded through window.__fbSdkLoader (shared with dashboard-
 *    whatsapp-hub.js) — the script tag is only injected once even when both
 *    files are loaded on the same page.
 *  - Classified error display: domain errors, secret errors, redirect-URI
 *    errors, and expired-code errors each show distinct actionable copy.
 *  - Connect button enters a loading state and is re-enabled on any failure.
 *  - Session info listener re-declared safely (no conflict if hub.js also
 *    runs — both write to the same window.__waSessionInfo).
 *  - renderCard() guards against being called twice (idempotent).
 */
(function () {
  if (!/^\/dashboard\/settings\/?$/.test(location.pathname)) return;

  var CARD_ID = 'dma-whatsapp-connect-card';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function authHeaders() {
    var token = localStorage.getItem('token');
    return token
      ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  // ── FB SDK shared loader ─────────────────────────────────────────────────
  //
  // Uses window.__fbSdkLoader (also used by dashboard-whatsapp-hub.js).
  // This prevents the facebook-jssdk script being injected twice when both
  // files are loaded on the Settings page.

  function loadFbSdk(appId, cb) {
    if (window.FB && window.__fbWaReady) { cb(); return; }

    if (window.__fbSdkLoader) {
      if (typeof window.__fbSdkLoader.push === 'function') {
        window.__fbSdkLoader.push(cb);
      } else {
        // Already resolved (push replaced with pass-through)
        cb();
      }
      return;
    }

    window.__fbSdkLoader = [cb];

    window.fbAsyncInit = function () {
      FB.init({ appId: appId, cookie: true, xfbml: false, version: 'v21.0' });
      window.__fbWaReady = true;
      var queue = window.__fbSdkLoader || [];
      window.__fbSdkLoader = { push: function (fn) { fn(); } };
      queue.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
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

  // ── Embedded Signup session info listener ─────────────────────────────────
  //
  // Safe to register even if hub.js already registered one — both write to the
  // same window.__waSessionInfo so only the last assignment wins, which is
  // correct: the most-recent postMessage is always the one we want.

  if (!window.__waSessionInfoListenerAdded) {
    window.__waSessionInfoListenerAdded = true;
    window.addEventListener('message', function (ev) {
      if (!ev.data || typeof ev.data !== 'object') return;
      var d = ev.data;
      if (d.type === 'WA_EMBEDDED_SIGNUP') {
        window.__waSessionInfo = d.data || d;
      } else if (d.event === 'FINISH') {
        window.__waSessionInfo = d.data || d;
      } else if (d.waba_id || d.wabaId) {
        window.__waSessionInfo = d;
      }
    });
  }

  // ── Error classification ──────────────────────────────────────────────────

  function friendlyError(raw) {
    var lower = (raw || '').toLowerCase();

    if (lower.indexOf('client secret') !== -1 || lower.indexOf('validating client secret') !== -1) {
      return (
        '🔑 App Secret mismatch — ' + raw + '. ' +
        'Go to Superadmin → Integrations and re-enter the App Secret from ' +
        'Meta → App Dashboard → Settings → Basic, then Save and try again.'
      );
    }
    if (
      lower.indexOf('domain') !== -1 ||
      lower.indexOf("can't load url") !== -1 ||
      lower.indexOf('app domains') !== -1
    ) {
      return (
        '🌐 Domain not allowed — ' + raw + '. ' +
        'In Meta → App Dashboard → Settings → Basic, add this domain to App Domains and Save Changes.'
      );
    }
    if (lower.indexOf('redirect_uri') !== -1 || lower.indexOf('redirect uri') !== -1) {
      return (
        '🔗 Redirect URI mismatch — ' + raw + '. ' +
        'In Meta → Facebook Login → Settings, add the Settings page URL as a valid OAuth redirect URI.'
      );
    }
    if (lower.indexOf('has been used') !== -1) {
      return '⏱ Code already used — click Connect WhatsApp again to get a fresh code.';
    }
    if (lower.indexOf('expired') !== -1) {
      return '⏱ Code expired — click Connect WhatsApp again and complete the signup without using browser Back.';
    }
    return raw || 'Connection failed — please try again.';
  }

  // ── Card renderer ─────────────────────────────────────────────────────────

  function renderCard(status, config) {
    // Idempotent — only render once
    if (document.getElementById(CARD_ID)) return;

    var main = document.querySelector('main');
    if (!main) return;
    var host =
      main.querySelector('div[class*="max-w"]') ||
      main.querySelector('div') ||
      main;

    var card = document.createElement('section');
    card.id = CARD_ID;
    card.className = 'dma-whatsapp-card';
    card.innerHTML =
      '<div class="dma-whatsapp-card__head">' +
        '<div>' +
          '<h2>WhatsApp Business</h2>' +
          '<p>Connect your clinic number via Meta — patients message you on WhatsApp and AI replies inside ClinicOS.</p>' +
        '</div>' +
        '<span class="dma-whatsapp-badge" id="dma-wa-badge">Checking…</span>' +
      '</div>' +
      '<div class="dma-whatsapp-body" id="dma-wa-body">' +
        '<p class="dma-whatsapp-hint">Loading connection status…</p>' +
      '</div>' +
      '<div class="dma-whatsapp-actions" id="dma-wa-actions"></div>';

    host.insertBefore(card, host.firstChild);

    var badge   = document.getElementById('dma-wa-badge');
    var body    = document.getElementById('dma-wa-body');
    var actions = document.getElementById('dma-wa-actions');

    // ── Not configured by superadmin ──
    if (!config || !config.configured) {
      badge.textContent = 'Not configured';
      badge.className = 'dma-whatsapp-badge dma-whatsapp-badge--warn';
      body.innerHTML =
        '<p class="dma-whatsapp-hint">Platform admin must set Meta App ID and Config ID under ' +
        '<a href="/superadmin/integrations/">Superadmin → Integrations</a>.</p>';
      return;
    }

    // ── Already connected ──
    if (status && status.connected) {
      badge.textContent = 'Connected';
      badge.className = 'dma-whatsapp-badge dma-whatsapp-badge--ok';
      body.innerHTML =
        '<p><strong>Number:</strong> ' + (status.phoneNumber || 'WhatsApp Business') + '</p>' +
        '<p class="dma-whatsapp-hint">' +
          'Inbound messages appear in Messages. ' +
          'Outbound uses your connected Meta number (Twilio is fallback only).' +
        '</p>';
      actions.innerHTML =
        '<button type="button" class="dma-btn-secondary" id="dma-wa-disconnect">Disconnect</button>' +
        '&nbsp;' +
        '<a href="/dashboard/whatsapp/" class="dma-btn-secondary">Open WhatsApp hub ↗</a>';

      var discBtn = document.getElementById('dma-wa-disconnect');
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
      return;
    }

    // ── Not connected ──
    badge.textContent = 'Not connected';
    badge.className = 'dma-whatsapp-badge dma-whatsapp-badge--warn';
    body.innerHTML =
      '<p class="dma-whatsapp-hint">' +
        'Use Meta Embedded Signup to link your WhatsApp Business number. ' +
        'You stay inside ClinicOS — no third-party login needed.' +
      '</p>' +
      '<p id="dma-wa-error" class="dma-whatsapp-error" style="display:none"></p>';
    actions.innerHTML =
      '<button type="button" class="dma-btn-primary" id="dma-wa-connect">Connect WhatsApp</button>';

    var errEl  = document.getElementById('dma-wa-error');
    var connBtn = document.getElementById('dma-wa-connect');

    connBtn.onclick = function () {
      errEl.style.display = 'none';

      // Lock button immediately
      connBtn.disabled = true;
      connBtn.textContent = 'Connecting…';

      // Clear stale session info before launching
      window.__waSessionInfo = null;

      loadFbSdk(config.appId, function () {
        FB.login(function (response) {
          if (!response.authResponse || !response.authResponse.code) {
            errEl.textContent = 'Meta signup was cancelled or failed. Please try again.';
            errEl.style.display = 'block';
            connBtn.disabled = false;
            connBtn.textContent = 'Connect WhatsApp';
            return;
          }

          var oauthCode = response.authResponse.code;

          // Wait up to 2 s for the sessionInfo postMessage (same fix as hub.js)
          var waited = 0;
          var waitInterval = setInterval(function () {
            waited += 100;
            var ready = window.__waSessionInfo || waited >= 2000;
            if (!ready) return;
            clearInterval(waitInterval);

            var si = window.__waSessionInfo || {};
            console.log('[WA Connect Settings] sessionInfo:', {
              waba_id: si.waba_id || si.wabaId || '(none)',
              phone_number_id: si.phone_number_id || si.phoneNumberId || '(none)',
            });

            var payload = {
              code: oauthCode,
              waba_id:              si.waba_id              || si.wabaId              || '',
              phone_number_id:      si.phone_number_id      || si.phoneNumberId      || '',
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
                errEl.textContent = friendlyError(res.d.error || '');
                errEl.style.display = 'block';
                connBtn.disabled = false;
                connBtn.textContent = 'Connect WhatsApp';
                return;
              }
              location.reload();
            })
            .catch(function () {
              errEl.textContent = 'Network error — check your connection and try again.';
              errEl.style.display = 'block';
              connBtn.disabled = false;
              connBtn.textContent = 'Connect WhatsApp';
            });

          }); // end waitInterval / setInterval
        }, {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
          extras: config.extras || {
            version: 'v4',
            sessionInfoVersion: '3',
            featureType: 'whatsapp_business_app_onboarding',
          },
        });
      });
    };
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function boot() {
    Promise.all([
      fetch('/api/whatsapp/status', {
        headers: authHeaders(), credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : {}; }),
      fetch('/api/whatsapp/signup-config', {
        headers: authHeaders(), credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : { configured: false }; }),
    ])
      .then(function (parts) { renderCard(parts[0], parts[1]); })
      .catch(function () { renderCard(null, { configured: false }); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 400);
  }
})();
