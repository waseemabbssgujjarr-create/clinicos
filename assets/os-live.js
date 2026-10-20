/**
 * Wire Clinicos prototype shell (os.css / OS rails) to live DmaApp APIs.
 * Pages set body[data-live="1"] and optional data-page / data-os-init.
 */
(function () {
  if (!window.OS) return;

  function ensureLiveThemeClasses() {
    var html = document.documentElement;
    html.classList.add('os-live');
    var area = document.body.getAttribute('data-area');
    if (area === 'clinic') html.classList.add('doc-static');
    else if (area === 'admin') html.classList.add('sa-static');
  }

  function readLiveTheme() {
    return 'light';
  }

  function applyLiveTheme(theme, persist) {
    var canvas = 'light';
    document.documentElement.dataset.theme = canvas;
    document.documentElement.style.colorScheme = canvas;
    OS.S.set('theme', canvas);
    if (window.DmaTheme && DmaTheme.apply) {
      try {
        DmaTheme.apply(canvas, false);
      } catch (_) {}
    }
  }

  function wireLiveThemeToggle() {
    if (OS._liveThemeWired) return;
    OS._liveThemeWired = true;
    var orig = OS.A.theme;
    OS.A.theme = function () {
      if (orig) orig();
      applyLiveTheme('light', false);
    };
  }

  var ROUTE_PAGE = {
    dashboard: 'home',
    'dashboard/appointments': 'appointments',
    'dashboard/calendar': 'calendar',
    'dashboard/waiting': 'waiting',
    'dashboard/patients': 'patients',
    'dashboard/patients/detail': 'patient',
    'dashboard/messages': 'messages',
    'dashboard/ai': 'ai',
    'dashboard/analytics': 'analytics',
    'dashboard/reviews': 'reviews',
    'dashboard/staff': 'staff',
    'dashboard/billing': 'billing',
    'dashboard/settings': 'settings',
    'dashboard/notifications': 'updates',
    'dashboard/payments': 'payments',
    'dashboard/doctors': 'doctors',
    'dashboard/rooms': 'rooms',
    'dashboard/clinical': 'clinical',
    'dashboard/consult': 'consult',
    'dashboard/vitals': 'vitals',
    'dashboard/prescriptions': 'prescriptions',
    'dashboard/laboratory': 'laboratory',
    'dashboard/telemedicine': 'telemedicine',
    'dashboard/tasks': 'tasks',
    'dashboard/inventory': 'inventory',
    'dashboard/documents': 'documents',
    'dashboard/leave': 'leave',
    'dashboard/locations': 'locations',
    'dashboard/reports': 'reports',
    'dashboard/operations': 'operations',
    'dashboard/communication': 'messages',
  };

  var DMA_FALLBACK_ROUTES = {
    'dashboard/patients/detail': true,
    'superadmin/clinics/detail': true,
  };

  function cleanUrl(r) {
    if (!r) return '/';
    if (/^(https?:|#|mailto:|tel:|\/)/.test(r)) return r;
    var path = r.replace(/\/?$/, '/');
    if (!path.startsWith('/')) path = '/' + path;
    return path;
  }

  OS.U = function (r) {
    if (/^(https?:|#|mailto:|tel:)/.test(r)) return r;
    var h = '';
    var q = '';
    if (r.includes('#')) {
      r = r.split('#');
      h = '#' + r[1];
      r = r[0];
    }
    if (r.includes('?')) {
      r = r.split('?');
      q = '?' + r[1];
      r = r[0];
    }
    return cleanUrl(r) + q + h;
  };

  function routeFromLocation() {
    var p = location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '';
    if (!p) return 'index';
    var m = p.match(/^\/dashboard\/patients\/([^/]+)$/);
    if (m && m[1] !== 'detail') return 'dashboard/patients/detail';
    var m2 = p.match(/^\/superadmin\/clinics\/([^/]+)$/);
    if (m2 && m2[1] !== 'detail') return 'superadmin/clinics/detail';
    return p.replace(/^\//, '');
  }

  function liveRole() {
    if (!window.DmaApp) return OS.role();
    var u = DmaApp.user();
    if (!u || !u.role) return 'owner';
    if (u.role === 'STAFF') {
      var sr = (u.staffRole || u.clinicRole || 'RECEPTIONIST').toUpperCase();
      return sr;
    }
    if (u.role === 'SUPERADMIN') return 'admin';
    return 'owner';
  }

  function syncLiveState() {
    var role = liveRole();
    if (role === 'admin') return;
    OS.S.set('role', role === 'OWNER' ? 'owner' : role);
    if (window.DmaApp) {
      var u = DmaApp.user();
      OS.CLINIC = u.clinicName || u.name || 'Clinic';
    }
    applyLiveTheme(readLiveTheme(), false);
  }

  function pageTitle(route) {
    return OS.titles[route] || document.title.split('·')[0].trim() || 'Clinicos';
  }

  function mountStandard(pageId, titleAttr) {
    var pg = document.getElementById('pg');
    if (!pg) return;
    pg.classList.add('os-live-mount');
    pg.innerHTML =
      '<main class="doc-main" id="doc-page" data-page="' +
      OS.esc(pageId) +
      '" data-title="' +
      OS.esc(titleAttr || pageTitle(OS.route)) +
      '"></main>';
    if (window.DmaPages && DmaPages.mount) DmaPages.mount();
  }

  function mountPrototype(route) {
    var pg = document.getElementById('pg');
    if (!pg || !OS.pages[route] || DMA_FALLBACK_ROUTES[route]) return false;
    pg.classList.add('os-live-mount');
    try {
      pg.innerHTML = OS.pages[route]() || '';
    } catch (e) {
      pg.innerHTML =
        OS.empty('Page error', 'This screen could not render. Try refreshing.') || '';
      return true;
    }
    var initFn = OS.init[route];
    if (initFn) {
      try {
        initFn();
      } catch (_) {}
    }
    OS.post(pg);
    return true;
  }

  function applyPreserve() {
    var box = document.getElementById('os-live-preserve');
    var pg = document.getElementById('pg');
    if (!box || !pg) return false;
    pg.classList.add('os-live-mount', 'sa-main');
    pg.innerHTML = box.innerHTML;
    box.remove();
    return true;
  }

  function patchLiveChrome() {
    if (!window.DmaApp) return;
    var u = DmaApp.user() || {};
    var clinic = u.clinicName || u.name;
    if (clinic) {
      OS.CLINIC = clinic;
      var rb = document.querySelector('.rb small');
      if (rb) rb.textContent = clinic;
    }
    var name = u.ownerName || u.name || '';
    var chipEl = document.querySelector('.uchip');
    if (chipEl && name) {
      var av = chipEl.querySelector('.av');
      if (av && DmaApp.initials) av.textContent = DmaApp.initials(name);
      var sp = chipEl.querySelector('span');
      if (sp) sp.textContent = name;
    }
    DmaApp.waStatus()
      .catch(function () {
        return { unavailable: true };
      })
      .then(function (wa) {
        var connected = !!(wa.connected || wa.status === 'connected' || wa.status === 'CONNECTED');
        try {
          OS.S.set('wa', connected);
        } catch (_) {}
        var wachip = document.querySelector('.wachip');
        if (wachip) {
          wachip.classList.toggle('off', !connected && !wa.unavailable);
          var span = wachip.querySelector('span');
          if (span && !wa.unavailable) {
            span.textContent = 'WhatsApp ' + (connected ? 'connected' : 'not connected');
          }
        }
      });
    DmaApp.get('/api/notifications?limit=1&unread=1')
      .catch(function () {
        return { unread: 0 };
      })
      .then(function (n) {
        var count = (n && (n.unread != null ? n.unread : n.unreadCount)) || 0;
        var badge = document.querySelector('.tbs .nb');
        if (badge) {
          badge.textContent = count > 99 ? '99+' : String(count);
          badge.style.display = count > 0 ? '' : 'none';
        }
      });
  }

  function wireChrome() {
    document.querySelectorAll('[data-act="pal"], .tbtn.srch').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (window.DmaUI && DmaUI.openCommand) {
          e.preventDefault();
          e.stopPropagation();
          DmaUI.openCommand();
        }
      });
    });
    document.querySelectorAll('a[href*="doctor-login"], a[href*="staff-login"]').forEach(function (a) {
      if (a.getAttribute('aria-label') === 'Logout' || (a.href && /login/.test(a.href))) {
        a.addEventListener('click', function (e) {
          if (a.getAttribute('aria-label') === 'Logout' && window.DmaApp) {
            e.preventDefault();
            DmaApp.logout();
          }
        });
      }
    });
    var tray = document.querySelector('.tray');
    if (tray) tray.remove();
    patchLiveChrome();
  }

  function bootClinic() {
    if (!window.DmaApp || !DmaApp.requireAuth()) return;
    syncLiveState();
    var route = OS.route || routeFromLocation();
    OS.route = route;
    var title = pageTitle(route);
    document.title = title + ' · Clinicos';
    var app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = OS.clinicShell(title, '<div class="os-live-loading mut" style="padding:24px">Loading…</div>');
    wireChrome();

    var mounted = mountPrototype(route);
    if (!mounted && applyPreserve()) {
      if (window.__OS_LIVE_INIT__) window.__OS_LIVE_INIT__();
      if (window.DmaDoctorShell && DmaDoctorShell.refreshBadges) DmaDoctorShell.refreshBadges();
      OS.post(app);
      return;
    }
    if (!mounted) {
      var pageId = document.body.getAttribute('data-page') || ROUTE_PAGE[route];
      if (pageId) mountStandard(pageId, document.body.getAttribute('data-title') || title);
    }
    if (window.__OS_LIVE_INIT__) window.__OS_LIVE_INIT__();
    if (window.DmaDoctorShell && DmaDoctorShell.refreshBadges) DmaDoctorShell.refreshBadges();
    OS.post(app);
  }

  function bootAdmin() {
    if (!window.DmaAdminShell || !DmaAdminShell.requireAuth()) return;
    syncLiveState();
    var route = OS.route || routeFromLocation();
    OS.route = route;
    var title = pageTitle(route);
    document.title = title + ' · Clinicos';
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = OS.adminShell(title, '<div class="os-live-loading mut" style="padding:24px">Loading…</div>');
    wireChrome();

    var mounted = mountPrototype(route);
    if (!mounted && applyPreserve()) {
      var pg = document.getElementById('pg');
      pg.classList.add('sa-main');
      var inner = document.createElement('div');
      inner.className = 'sa-main-inner';
      while (pg.firstChild) inner.appendChild(pg.firstChild);
      pg.appendChild(inner);
      if (window.DmaAdminShell && DmaAdminShell.renderWorkspaceTabs) {
        try {
          DmaAdminShell.renderWorkspaceTabs();
        } catch (_) {}
      }
      if (window.__OS_LIVE_INIT__) window.__OS_LIVE_INIT__();
      OS.post(app);
      return;
    }
    if (!mounted) mountStandard('home', title);
    if (window.__OS_LIVE_INIT__) window.__OS_LIVE_INIT__();
    OS.post(app);
  }

  function bootPublicLive() {
    if (window.__OS_LIVE_PUBLIC__) return;
    OS.boot();
  }

  window.OsLive = { patchChrome: patchLiveChrome };

  window.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.live !== '1') return;
    ensureLiveThemeClasses();
    wireLiveThemeToggle();
    OS.route = document.body.getAttribute('data-route') || routeFromLocation();
    OS.area = document.body.getAttribute('data-area') || 'clinic';
    if (OS.area === 'clinic') bootClinic();
    else if (OS.area === 'admin') bootAdmin();
    else bootPublicLive();
  });
})();
