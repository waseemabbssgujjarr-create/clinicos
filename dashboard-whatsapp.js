/**
 * Doctors My Agency — WhatsApp card on /dashboard/settings/
 *
 * This file ONLY handles the compact status card on the Settings page.
 * It shows:
 *   - Connected state with a "Go to WhatsApp Hub" link
 *   - Not-connected state with a "Connect WhatsApp" link to /dashboard/whatsapp/
 *
 * IMPORTANT: This file contains NO Embedded Signup code, NO FB.login call,
 * NO Facebook SDK loader, and NO config_id usage.
 *
 * The full connection UI (Manual + optionally Embedded Signup) lives in
 * dashboard-whatsapp-hub.js and /dashboard/whatsapp/.
 *
 * The Embedded Signup feature flag (WHATSAPP_EMBEDDED_SIGNUP_ENABLED) is
 * enforced server-side. This file never reads that flag and never opens
 * any Facebook OAuth dialog.
 */
(function () {
  if (!/^\/dashboard\/settings\/?$/.test(location.pathname)) return;

  var CARD_ID = 'dma-whatsapp-connect-card';

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

  // ── Card renderer ─────────────────────────────────────────────────────────
  // Reads from the new API response shape: { enabled, manualConnectionAvailable }
  // Does NOT use the old `config.configured` field.

  function renderCard(status) {
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

    var inner;

    if (status && status.connected) {
      // ── Connected ──────────────────────────────────────────────────────────
      inner =
        '<div class="dma-whatsapp-card__head">' +
          '<div>' +
            '<h2>WhatsApp Business</h2>' +
            '<p>Your clinic is connected via Meta WhatsApp.</p>' +
          '</div>' +
          '<span class="dma-whatsapp-badge dma-whatsapp-badge--ok">Connected</span>' +
        '</div>' +
        '<div class="dma-whatsapp-body">' +
          '<p><strong>Number:</strong> ' + esc(status.phoneNumber || 'WhatsApp Business') + '</p>' +
          '<p class="dma-whatsapp-hint">Inbound messages appear in Messages. Manage in the WhatsApp hub.</p>' +
        '</div>' +
        '<div class="dma-whatsapp-actions">' +
          '<a href="/dashboard/whatsapp/" class="dma-btn-primary">Open WhatsApp Hub →</a>' +
          '&nbsp;' +
          '<button type="button" class="dma-btn-secondary" id="dma-wa-settings-disconnect">Disconnect</button>' +
        '</div>';
    } else {
      // ── Not connected ──────────────────────────────────────────────────────
      inner =
        '<div class="dma-whatsapp-card__head">' +
          '<div>' +
            '<h2>WhatsApp Business</h2>' +
            '<p>Connect your clinic WhatsApp number to activate the AI receptionist.</p>' +
          '</div>' +
          '<span class="dma-whatsapp-badge dma-whatsapp-badge--warn">Not connected</span>' +
        '</div>' +
        '<div class="dma-whatsapp-body">' +
          '<p class="dma-whatsapp-hint">' +
            'Connect your WhatsApp Business account securely through Meta Embedded Signup.' +
          '</p>' +
        '</div>' +
        '<div class="dma-whatsapp-actions">' +
          '<a href="/dashboard/whatsapp/" class="dma-btn-primary">Connect WhatsApp →</a>' +
        '</div>';
    }

    card.innerHTML = inner;
    host.insertBefore(card, host.firstChild);

    var discBtn = document.getElementById('dma-wa-settings-disconnect');
    if (discBtn) {
      discBtn.onclick = function () {
        if (!confirm('Disconnect WhatsApp from this clinic?')) return;
        discBtn.disabled = true;
        discBtn.textContent = 'Disconnecting…';
        fetch('/api/whatsapp/connections/disconnect', {
          method: 'DELETE',
          headers: authHeaders(),
          credentials: 'include',
        }).then(function () { location.reload(); });
      };
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  // Only fetches connection status — does not fetch signup config.
  // Flag state is irrelevant on the Settings page: connect action always
  // goes to /dashboard/whatsapp/ which shows the correct UI.

  function boot() {
    fetch('/api/whatsapp/connections/status', {
      headers: authHeaders(),
      credentials: 'include',
    })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (status) { renderCard(status); })
      .catch(function () { renderCard(null); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 400);
  }
})();
