/**
 * Doctor dashboard shell — IQPigeon-style grouped sidebar for clinic pages.
 */
(function (global) {
  var GROUPS = [
    {
      label: 'Practice',
      items: [
        { id: 'home', href: '/dashboard/', label: 'Home', icon: 'home', color: '#2563eb' },
        { id: 'appointments', href: '/dashboard/appointments/', label: 'Appointments', icon: 'cal', color: '#0891b2' },
        { id: 'patients', href: '/dashboard/patients/', label: 'Patients', icon: 'users', color: '#6366f1' },
        { id: 'leads', href: '/dashboard/leads/', label: 'Leads', icon: 'leads', color: '#ea580c' },
      ],
    },
    {
      label: 'Inbox',
      items: [
        { id: 'whatsapp', href: '/dashboard/whatsapp/', label: 'WhatsApp', icon: 'wa', color: '#25D366' },
        { id: 'messages', href: '/dashboard/messages/', label: 'Messages', icon: 'msg', color: '#0ea5e9' },
        { id: 'broadcasts', href: '/dashboard/broadcasts/', label: 'Broadcasts', icon: 'broadcast', color: '#db2777' },
      ],
    },
    {
      label: 'Growth',
      items: [
        { id: 'ai', href: '/dashboard/ai/', label: 'Train AI', icon: 'bot', color: '#7c3aed' },
        { id: 'analytics', href: '/dashboard/analytics/', label: 'Analytics', icon: 'chart', color: '#0d9488' },
        { id: 'reviews', href: '/dashboard/reviews/', label: 'Reviews', icon: 'star', color: '#d97706' },
      ],
    },
    {
      label: 'Clinic',
      items: [
        { id: 'staff', href: '/dashboard/staff/', label: 'Team', icon: 'staff', color: '#6366f1' },
        { id: 'billing', href: '/dashboard/billing/', label: 'Billing', icon: 'bill', color: '#16a34a' },
        { id: 'updates', href: '/dashboard/notifications/', label: 'Updates', icon: 'bell', color: '#db2777' },
        { id: 'settings', href: '/dashboard/settings/', label: 'Settings', icon: 'gear', color: '#64748b' },
      ],
    },
  ];

  var NAV = [];
  GROUPS.forEach(function (g) { NAV = NAV.concat(g.items); });

  var ICONS = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
    msg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M9 13v2M15 13v2"/></svg>',
    leads: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>',
    broadcast: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.82 2 2 0 0 1 3.57 2.63H6.5a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.05 6.05l1.36-1.36a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    staff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    bill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
    gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4a5 5 0 0 0-5 5v3.5L5.5 16h13L17 12.5V9a5 5 0 0 0-5-5Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  };

  function getUser() {
    if (global.DmaApp) return DmaApp.user();
    try {
      var parsed = JSON.parse(localStorage.getItem('clinicos-store') || '{}');
      return (parsed.state && parsed.state.user) || {};
    } catch (_) { return {}; }
  }

  function isActive(href) {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var target = href.replace(/\/+$/, '') || '/';
    if (target === '/dashboard') return path === '/dashboard';
    if (target === '/dashboard/patients' && /\/dashboard\/patients\/detail/.test(path)) return true;
    return path.indexOf(target) === 0;
  }

  function planLabel(u) {
    var p = String(u.plan || u.subscriptionPlan || u.planStatus || 'Trial').toLowerCase();
    if (p === 'trial') return 'Trial Plan';
    if (p === 'starter') return 'Starter Plan';
    if (p === 'pro') return 'Pro Plan';
    if (p === 'enterprise') return 'Enterprise Plan';
    return (u.plan || 'Trial') + ' Plan';
  }

  function renderStaticSidebar(container, activeHref) {
    if (!container) return;
    var u = getUser();
    var clinic = u.clinicName || u.name || 'Your clinic';
    var owner = u.ownerName || u.name || 'Doctor';
    var plan = planLabel(u);

    var html = '<div class="doc-brand">' +
      '<div class="doc-brand-icon">DM</div>' +
      '<strong>Doctors My Agency</strong>' +
      '<span>' + (clinic) + '</span></div>';

    GROUPS.forEach(function (g) {
      html += '<div class="doc-nav-section">' + g.label + '</div><nav>';
      g.items.forEach(function (item) {
        var on = isActive(item.href) || (activeHref && item.href.replace(/\/+$/, '') === String(activeHref).replace(/\/+$/, ''));
        var cls = on ? 'active' : '';
        if (item.id === 'whatsapp') cls += (cls ? ' ' : '') + 'doc-nav-wa';
        html += '<a href="' + item.href + '" class="' + cls + '" data-nav="' + item.id + '" style="--nav-c:' + item.color + '">' +
          '<span class="doc-nav-icon" style="color:' + (on ? '#fff' : item.color) + '">' + (ICONS[item.icon] || '') + '</span>' +
          '<span>' + item.label + '</span>' +
          (item.id === 'whatsapp' ? '<span class="doc-wa-status" id="doc-wa-dot"></span>' : '') +
          (item.id === 'updates' ? '<span class="doc-nav-badge" id="doc-upd-badge" hidden>0</span>' : '') +
          '</a>';
      });
      html += '</nav>';
    });

    html +=
      '<div class="doc-plan-card">' +
        '<div class="text-faint">Current plan</div>' +
        '<strong>' + plan + '</strong>' +
        '<a href="/dashboard/billing/">Manage subscription</a>' +
      '</div>' +
      '<div class="doc-sidebar-footer">' +
        '<div class="doc-sidebar-footer-avatar">' + (owner.slice(0, 2).toUpperCase() || 'DR') + '</div>' +
        '<div class="doc-sidebar-footer-info"><strong>' + owner + '</strong><span>Owner</span></div>' +
        '<button type="button" class="doc-logout" id="doc-logout">Logout</button>' +
      '</div>';

    container.innerHTML = html;

    var logoutBtn = container.querySelector('#doc-logout');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        if (global.DmaApp) DmaApp.logout();
        else {
          localStorage.removeItem('token');
          localStorage.removeItem('clinicos-store');
          location.replace('/doctor-login/');
        }
      };
    }
    refreshBadges();
  }

  function refreshBadges() {
    var App = global.DmaApp;
    if (!App) return;
    App.waStatus().then(function (s) {
      var el = document.getElementById('doc-wa-dot');
      if (!el) return;
      var on = !!(s.connected || s.status === 'connected' || s.status === 'CONNECTED');
      el.className = 'doc-wa-status' + (on ? ' is-on' : '');
      el.title = on ? 'WhatsApp connected' : 'WhatsApp not connected';
    }).catch(function () {});
    App.get('/api/notifications/unread-count').then(function (d) {
      var n = (d && (d.count || d.unread)) || 0;
      var b = document.getElementById('doc-upd-badge');
      if (!b) return;
      if (n > 0) { b.hidden = false; b.textContent = n > 9 ? '9+' : String(n); }
      else b.hidden = true;
    }).catch(function () {});
  }

  function renderBottomNav() {
    if (document.getElementById('dma-bottom-nav')) return;
    var keys = ['home', 'appointments', 'whatsapp', 'leads', 'settings'];
    var map = {};
    NAV.forEach(function (i) { map[i.id] = i; });
    var nav = document.createElement('nav');
    nav.id = 'dma-bottom-nav';
    nav.className = 'dma-bottom-nav';
    nav.innerHTML = keys.map(function (k) {
      var i = map[k];
      if (!i) return '';
      return '<a href="' + i.href + '" class="' + (isActive(i.href) ? 'on' : '') + '">' +
        (ICONS[i.icon] || '') + '<span>' + i.label.replace('Appointments', 'Appts') + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  }

  function wireChrome() {
    var menuBtn = document.querySelector('.doc-menu-btn');
    var sidebar = document.getElementById('doc-sidebar');
    var backdrop = document.getElementById('doc-sidebar-backdrop');
    function close() {
      document.body.classList.remove('doc-nav-open');
      if (sidebar) sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
    }
    function open() {
      document.body.classList.toggle('doc-nav-open');
      if (sidebar) sidebar.classList.toggle('is-open');
      if (backdrop) backdrop.classList.toggle('is-open');
    }
    if (menuBtn) menuBtn.onclick = open;
    if (backdrop) backdrop.onclick = close;
    renderBottomNav();
    var label = document.getElementById('doc-user-label');
    var u = getUser();
    if (label) label.textContent = u.ownerName || u.name || 'Doctor';
  }

  function initStaticPage(activeHref, pageTitle) {
    document.documentElement.classList.add('doc-static');
    if (!localStorage.getItem('token')) {
      location.replace('/doctor-login/?next=' + encodeURIComponent(location.pathname + location.search));
      return false;
    }
    renderStaticSidebar(document.getElementById('doc-sidebar'), activeHref);
    if (pageTitle) {
      var h = document.getElementById('doc-page-title');
      if (h) h.textContent = pageTitle;
      document.title = pageTitle + ' — Doctors My Agency';
    }
    wireChrome();
    return true;
  }

  function bootFromPage() {
    var page = document.getElementById('doc-page');
    var id = page && page.getAttribute('data-page');
    var item = NAV.filter(function (n) { return n.id === id; })[0];
    var href = item ? item.href : '/dashboard/';
    var title = (page && page.getAttribute('data-title')) || (item && item.label) || 'Dashboard';
    return initStaticPage(href, title);
  }

  global.DmaDoctorShell = {
    NAV: NAV,
    GROUPS: GROUPS,
    initStaticPage: initStaticPage,
    renderStaticSidebar: renderStaticSidebar,
    bootFromPage: bootFromPage,
    refreshBadges: refreshBadges,
  };

  document.addEventListener('dma:wa', function () { refreshBadges(); });
})(window);
