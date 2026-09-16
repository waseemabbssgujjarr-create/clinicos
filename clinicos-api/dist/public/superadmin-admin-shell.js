(function (global) {
  if (typeof document !== 'undefined' && !document.querySelector('link[href*="dma-design-system.css"]')) {
    var ds = document.createElement('link');
    ds.rel = 'stylesheet';
    ds.href = '/dma-design-system.css?v=48';
    document.head.appendChild(ds);
  }
  var ICONS = {
    overview: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    clinics: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>',
    revenue: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    announce: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    plans: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    plug: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    stripe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
    whatsapp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    api: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    health: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    audit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  };

  var NAV_GROUPS = [
    { label: 'Platform', items: [
      { href: '/superadmin/', label: 'Overview', icon: 'overview' },
      { href: '/superadmin/clinics/', label: 'Clinics', icon: 'clinics' },
      { href: '/superadmin/users/', label: 'Users', icon: 'users' },
    ]},
    { label: 'Business', items: [
      { href: '/superadmin/subscriptions/', label: 'Billing', icon: 'plans' },
    ]},
    { label: 'Operations', items: [
      { href: '/superadmin/whatsapp/', label: 'WhatsApp', icon: 'whatsapp' },
    ]},
    { label: 'System', items: [
      { href: '/superadmin/settings/', label: 'Settings', icon: 'settings' },
    ]},
  ];

  var NAV = [];
  NAV_GROUPS.forEach(function (g) { g.items.forEach(function (i) { NAV.push(i); }); });

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('token');
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  function api(path, opts) {
    opts = opts || {};
    var retries = opts.retries != null ? opts.retries : 3;
    var retryDelay = opts.retryDelay != null ? opts.retryDelay : 900;

    function attempt(n) {
      return fetch(path, {
        method: opts.method || 'GET',
        headers: authHeaders(),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'include',
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) {
            var msg = data.error || data.message || 'Request failed';
            var transient =
              r.status >= 500 ||
              /database|temporarily unavailable|ECONNREFUSED|connection|prisma/i.test(msg);
            if (n < retries && transient) {
              return new Promise(function (resolve) {
                setTimeout(resolve, retryDelay * (n + 1));
              }).then(function () {
                return attempt(n + 1);
              });
            }
            if (/database|temporarily unavailable/i.test(msg)) {
              throw new Error(
                'Could not reach the database. Retried ' +
                  (n + 1) +
                  ' times — please wait a moment and click Retry, or contact your admin if this persists.'
              );
            }
            throw new Error(msg);
          }
          return data;
        });
      });
    }

    return attempt(0);
  }

  function getUserEmail() {
    try {
      var raw = localStorage.getItem('clinicos-store');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.state && parsed.state.user && parsed.state.user.email) {
          return parsed.state.user.email;
        }
      }
    } catch (_) {}
    return '';
  }

  function isActive(href, activeHref) {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var target = href.replace(/\/+$/, '') || '/';
    if (activeHref) {
      var a = String(activeHref).replace(/\/+$/, '') || '/';
      if (target === a) return true;
    }
    if (target === '/superadmin') return path === '/superadmin';
    if (target === '/superadmin/subscriptions') {
      return path.indexOf('/superadmin/subscriptions') === 0 || path.indexOf('/superadmin/stripe') === 0 || path.indexOf('/superadmin/revenue') === 0;
    }
    if (target === '/superadmin/whatsapp') {
      return path.indexOf('/superadmin/whatsapp') === 0 || path.indexOf('/superadmin/announcements') === 0 || path.indexOf('/superadmin/support') === 0;
    }
    if (target === '/superadmin/settings') {
      return path.indexOf('/superadmin/settings') === 0 || path.indexOf('/superadmin/security') === 0 || path.indexOf('/superadmin/health') === 0 || path.indexOf('/superadmin/audit') === 0 || path.indexOf('/superadmin/integrations') === 0 || path.indexOf('/superadmin/api') === 0;
    }
    return path.indexOf(target) === 0;
  }

  function setNavOpen(open) {
    document.body.classList.toggle('sa-nav-open', !!open);
    var layout = document.querySelector('.sa-layout');
    if (layout) layout.classList.toggle('sa-nav-open', !!open);
  }

  var SA_WORKSPACES = [
    {
      match: ['/superadmin/subscriptions', '/superadmin/stripe', '/superadmin/revenue'],
      tabs: [
        { href: '/superadmin/subscriptions/', label: 'Billing' },
        { href: '/superadmin/stripe/', label: 'Plans' },
        { href: '/superadmin/revenue/', label: 'Analytics' }
      ]
    },
    {
      match: ['/superadmin/whatsapp', '/superadmin/announcements', '/superadmin/support'],
      tabs: [
        { href: '/superadmin/whatsapp/', label: 'WhatsApp' },
        { href: '/superadmin/announcements/', label: 'Announcements' },
        { href: '/superadmin/support/', label: 'Support' }
      ]
    },
    {
      match: ['/superadmin/settings', '/superadmin/security', '/superadmin/health', '/superadmin/audit', '/superadmin/integrations', '/superadmin/api'],
      tabs: [
        { href: '/superadmin/settings/', label: 'Settings' },
        { href: '/superadmin/security/', label: 'Security' },
        { href: '/superadmin/health/', label: 'Health' },
        { href: '/superadmin/audit/', label: 'Audit' },
        { href: '/superadmin/integrations/', label: 'Integrations' },
        { href: '/superadmin/api/', label: 'API' }
      ]
    }
  ];

  function renderWorkspaceTabs() {
    if (document.querySelector('.ds-workspace-tabs')) return;
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var ws = null;
    SA_WORKSPACES.forEach(function (w) {
      if (w.match.some(function (m) { return path === m || path.indexOf(m) === 0; })) ws = w;
    });
    if (!ws) return;
    var main = document.querySelector('.sa-main');
    if (!main) return;
    var nav = document.createElement('nav');
    nav.className = 'ds-workspace-tabs';
    nav.setAttribute('aria-label', 'Section');
    nav.innerHTML = ws.tabs.map(function (t) {
      var target = t.href.replace(/\/+$/, '');
      var on = path === target || path.indexOf(target) === 0;
      return '<a href="' + t.href + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + t.label + '</a>';
    }).join('');
    if (main.firstChild) main.insertBefore(nav, main.firstChild);
    else main.appendChild(nav);
  }

  function wrapMainContent(main) {
    if (!main || main.querySelector('.sa-main-inner')) return;
    var inner = document.createElement('div');
    inner.className = 'sa-main-inner';
    while (main.firstChild) inner.appendChild(main.firstChild);
    main.appendChild(inner);
  }

  function wireMobileChrome() {
    if (!document.querySelector('.sa-mobile-bar')) {
      var bar = document.createElement('div');
      bar.className = 'sa-mobile-bar';
      bar.innerHTML =
        '<button type="button" class="sa-menu-btn" aria-label="Open menu" aria-expanded="false">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="sa-mobile-brand"><strong>Doctors My Agency</strong><span>Control Center</span></div>';
      document.body.appendChild(bar);
      bar.querySelector('.sa-menu-btn').onclick = function () {
        var open = !document.body.classList.contains('sa-nav-open');
        setNavOpen(open);
        this.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
    }
    if (!document.querySelector('.sa-nav-backdrop')) {
      var backdrop = document.createElement('div');
      backdrop.className = 'sa-nav-backdrop';
      document.body.appendChild(backdrop);
      backdrop.onclick = function () { setNavOpen(false); };
    }
  }

  function renderSidebar(container, activeHref) {
    if (!container) return;
    var email = getUserEmail();
    var links = NAV_GROUPS.map(function (group) {
      var items = group.items.map(function (item) {
        var cls = isActive(item.href, activeHref) ? ' class="active"' : '';
        var icon = ICONS[item.icon] || '';
        return '<a href="' + item.href + '"' + cls + '><span class="sa-nav-icon" aria-hidden="true">' + icon + '</span><span>' + item.label + '</span></a>';
      }).join('');
      return '<div class="sa-nav-group"><span class="sa-nav-label">' + group.label + '</span>' + items + '</div>';
    }).join('');

    container.innerHTML =
      '<div class="sa-brand">' +
        '<div class="sa-brand-icon">DM</div>' +
        '<div class="sa-brand-text"><strong>Doctors My Agency</strong><span>Control Center</span></div>' +
      '</div>' +
      '<nav>' + links + '</nav>' +
      '<div class="sa-sidebar-footer">' +
        (email ? '<div class="sa-user">' + email + '</div>' : '') +
        '<button type="button" class="sa-logout" id="sa-logout-btn">Log out</button>' +
      '</div>';

    var logout = container.querySelector('#sa-logout-btn');
    if (logout) {
      logout.onclick = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('clinicos-store');
        location.href = '/admin-login/';
      };
    }

    container.querySelectorAll('nav a').forEach(function (a) {
      a.addEventListener('click', function () { setNavOpen(false); });
    });

    wireMobileChrome();
    var main = document.querySelector('.sa-main');
    wrapMainContent(main);
  }

  function requireAuth() {
    if (!localStorage.getItem('token')) {
      location.replace('/admin-login/');
      return false;
    }
    return true;
  }

  function initStaticPage(activeHref) {
    if (!requireAuth()) return false;
    document.documentElement.classList.add('sa-static');
    var sidebar = document.getElementById('sa-sidebar');
    renderSidebar(sidebar, activeHref);
    renderWorkspaceTabs();
    document.title = document.title.replace(/ClinicOS AI|MediCore AI|MediCore|ClinicOS/g, 'Doctors My Agency');
    var nameInput = document.getElementById('plat-name');
    if (nameInput && /ClinicOS|MediCore/i.test(nameInput.value || '')) {
      nameInput.value = 'Doctors My Agency';
    }
    return true;
  }

  function renderNav(container, activeHref) {
    renderSidebar(container, activeHref);
  }

  function wireLogout() {
    var btn = document.getElementById('logout-btn');
    if (btn) {
      btn.style.display = '';
      btn.onclick = function (e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('clinicos-store');
        location.href = '/admin-login/';
      };
    }
  }

  global.DmaAdminShell = {
    NAV: NAV,
    NAV_GROUPS: NAV_GROUPS,
    ICONS: ICONS,
    api: api,
    renderNav: renderNav,
    renderSidebar: renderSidebar,
    requireAuth: requireAuth,
    initStaticPage: initStaticPage,
    wireLogout: wireLogout,
    setNavOpen: setNavOpen,
  };
})(window);
