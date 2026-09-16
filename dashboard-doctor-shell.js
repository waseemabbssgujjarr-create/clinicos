/**
 * Clinic shell — role-generated navigation (owner / reception / nurse / manager).
 */
(function (global) {
  if (typeof document !== 'undefined' && !document.querySelector('link[href*="dma-design-system.css"]')) {
    var ds = document.createElement('link');
    ds.rel = 'stylesheet';
    ds.href = '/dma-design-system.css?v=51';
    document.head.appendChild(ds);
  }

  var ALL_ITEMS = {
    home: { id: 'home', href: '/dashboard/', label: 'Dashboard', icon: 'home' },
    appointments: { id: 'appointments', href: '/dashboard/appointments/', label: 'Schedule', icon: 'cal' },
    calendar: { id: 'calendar', href: '/dashboard/calendar/', label: 'Calendar', icon: 'cal' },
    waiting: { id: 'waiting', href: '/dashboard/waiting/', label: 'Waiting Room', icon: 'wait' },
    patients: { id: 'patients', href: '/dashboard/patients/', label: 'Patients', icon: 'users' },
    doctors: { id: 'doctors', href: '/dashboard/doctors/', label: 'Doctors', icon: 'doctor' },
    staff: { id: 'staff', href: '/dashboard/staff/', label: 'Team', icon: 'staff' },
    rooms: { id: 'rooms', href: '/dashboard/rooms/', label: 'Operations', icon: 'ops' },
    clinical: { id: 'clinical', href: '/dashboard/clinical/', label: 'Consultations', icon: 'clinical' },
    vitals: { id: 'vitals', href: '/dashboard/vitals/', label: 'Vitals', icon: 'vitals' },
    prescriptions: { id: 'prescriptions', href: '/dashboard/prescriptions/', label: 'Prescriptions', icon: 'rx' },
    laboratory: { id: 'laboratory', href: '/dashboard/laboratory/', label: 'Laboratory', icon: 'lab' },
    telemedicine: { id: 'telemedicine', href: '/dashboard/telemedicine/', label: 'Telemedicine', icon: 'video' },
    leads: { id: 'leads', href: '/dashboard/leads/', label: 'Leads', icon: 'leads' },
    whatsapp: { id: 'whatsapp', href: '/dashboard/whatsapp/', label: 'WhatsApp', icon: 'wa' },
    messages: { id: 'messages', href: '/dashboard/messages/', label: 'Inbox', icon: 'msg' },
    broadcasts: { id: 'broadcasts', href: '/dashboard/broadcasts/', label: 'Broadcasts', icon: 'broadcast' },
    ai: { id: 'ai', href: '/dashboard/ai/', label: 'AI Receptionist', icon: 'bot' },
    analytics: { id: 'analytics', href: '/dashboard/analytics/', label: 'Analytics', icon: 'chart' },
    reports: { id: 'reports', href: '/dashboard/reports/', label: 'Reports', icon: 'chart' },
    reviews: { id: 'reviews', href: '/dashboard/reviews/', label: 'Reviews', icon: 'star' },
    billing: { id: 'billing', href: '/dashboard/billing/', label: 'Billing', icon: 'bill' },
    payments: { id: 'payments', href: '/dashboard/payments/', label: 'Payments', icon: 'pay' },
    tasks: { id: 'tasks', href: '/dashboard/tasks/', label: 'Tasks', icon: 'task' },
    inventory: { id: 'inventory', href: '/dashboard/inventory/', label: 'Inventory', icon: 'box' },
    operations: { id: 'operations', href: '/dashboard/operations/', label: 'Operations', icon: 'ops' },
    updates: { id: 'updates', href: '/dashboard/notifications/', label: 'Updates', icon: 'bell' },
    settings: { id: 'settings', href: '/dashboard/settings/', label: 'Settings', icon: 'gear' },
    documents: { id: 'documents', href: '/dashboard/documents/', label: 'Documents', icon: 'task' },
    leave: { id: 'leave', href: '/dashboard/leave/', label: 'Leave', icon: 'cal' },
    locations: { id: 'locations', href: '/dashboard/locations/', label: 'Locations', icon: 'room' },
  };

  var OWNER_ONLY = ['whatsapp', 'broadcasts', 'ai', 'analytics', 'reviews', 'billing', 'settings', 'rooms', 'inventory', 'telemedicine', 'laboratory', 'prescriptions'];

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
    wait: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    doctor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v4M10 13h4"/></svg>',
    room: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    clinical: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
    vitals: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    rx: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    lab: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v7L4.2 19.5A2 2 0 0 0 5.9 22h12.2a2 2 0 0 0 1.7-3.5L14 10V3"/></svg>',
    video: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
    pay: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
    task: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    ops: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };

  function getUser() {
    if (global.DmaApp) return DmaApp.user();
    try {
      var parsed = JSON.parse(localStorage.getItem('clinicos-store') || '{}');
      return (parsed.state && parsed.state.user) || {};
    } catch (_) { return {}; }
  }

  function staffRoleOf(u) {
    u = u || getUser();
    if (u.role === 'STAFF') {
      var sr = u.staffRole || u.clinicRole;
      if (!sr) {
        try {
          var t = localStorage.getItem('token') || '';
          var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          sr = p.staffRole;
        } catch (_) {}
      }
      return String(sr || 'RECEPTIONIST').toUpperCase();
    }
    return '';
  }

  function isOwner(u) {
    u = u || getUser();
    return u.role !== 'STAFF';
  }

  function navFor(user) {
    var role = staffRoleOf(user);
    var keys;
    if (!role) {
      keys = [
        ['Clinic', ['home', 'patients']],
        ['Front desk', ['appointments', 'waiting', 'messages']],
        ['Care', ['clinical']],
        ['Practice', ['staff', 'rooms']],
        ['Grow', ['ai', 'analytics']],
        ['Setup', ['settings']],
      ];
    } else if (role === 'NURSE') {
      keys = [
        ['Care', ['home', 'patients', 'waiting', 'vitals', 'clinical', 'appointments']],
      ];
    } else if (role === 'MANAGER') {
      keys = [
        ['Care', ['home', 'appointments', 'patients']],
        ['Team', ['doctors', 'staff']],
        ['Operations', ['operations']],
        ['Insights', ['reports']],
      ];
    } else if (role === 'ASSISTANT') {
      keys = [
        ['Care', ['home', 'appointments', 'patients']],
        ['Operations', ['tasks', 'messages']],
      ];
    } else {
      keys = [
        ['Care', ['home', 'appointments', 'calendar', 'patients']],
        ['Operations', ['waiting', 'payments', 'messages']],
      ];
    }
    return keys.map(function (g) {
      return {
        label: g[0],
        items: g[1].map(function (id) { return ALL_ITEMS[id]; }).filter(Boolean),
      };
    });
  }

  function flatNav(user) {
    var out = [];
    navFor(user).forEach(function (g) { out = out.concat(g.items); });
    return out;
  }

  function isOwnerOnlyPath(path) {
    path = String(path || '').replace(/\/+$/, '');
    return OWNER_ONLY.some(function (id) {
      var href = ALL_ITEMS[id].href.replace(/\/+$/, '');
      return path === href || path.indexOf(href + '/') === 0;
    });
  }

  function loginPath() {
    return staffRoleOf() ? '/staff-login/' : '/doctor-login/';
  }

  function isActive(href) {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var target = href.replace(/\/+$/, '') || '/';
    if (target === '/dashboard') return path === '/dashboard';
    if (target === '/dashboard/patients' && /\/dashboard\/patients\/detail/.test(path)) return true;
    if (target === '/dashboard/appointments') {
      return path === '/dashboard/appointments' || path.indexOf('/dashboard/calendar') === 0;
    }
    if (target === '/dashboard/messages') {
      return path.indexOf('/dashboard/messages') === 0 || path.indexOf('/dashboard/whatsapp') === 0 || path.indexOf('/dashboard/broadcasts') === 0 || path.indexOf('/dashboard/communication') === 0;
    }
    if (target === '/dashboard/rooms') {
      return path.indexOf('/dashboard/rooms') === 0 || path.indexOf('/dashboard/inventory') === 0 || path.indexOf('/dashboard/leave') === 0 || path.indexOf('/dashboard/telemedicine') === 0 || path.indexOf('/dashboard/operations') === 0;
    }
    if (target === '/dashboard/clinical') {
      return path.indexOf('/dashboard/clinical') === 0 || path.indexOf('/dashboard/consult') === 0 || path.indexOf('/dashboard/vitals') === 0 || path.indexOf('/dashboard/prescriptions') === 0 || path.indexOf('/dashboard/laboratory') === 0 || path.indexOf('/dashboard/documents') === 0;
    }
    if (target === '/dashboard/staff') {
      return path.indexOf('/dashboard/staff') === 0 || path.indexOf('/dashboard/doctors') === 0;
    }
    if (target === '/dashboard/analytics') {
      return path.indexOf('/dashboard/analytics') === 0 || path.indexOf('/dashboard/reports') === 0 || path.indexOf('/dashboard/reviews') === 0;
    }
    if (target === '/dashboard/settings') {
      return path.indexOf('/dashboard/settings') === 0 || path.indexOf('/dashboard/billing') === 0 || path.indexOf('/dashboard/locations') === 0;
    }
    return path.indexOf(target) === 0;
  }

  var WORKSPACES = [
    {
      label: 'Schedule',
      match: ['/dashboard/appointments', '/dashboard/calendar'],
      tabs: [
        { href: '/dashboard/calendar/', label: 'Calendar' },
        { href: '/dashboard/appointments/', label: 'Appointments' }
      ]
    },
    {
      label: 'Communication',
      match: ['/dashboard/messages', '/dashboard/whatsapp', '/dashboard/broadcasts', '/dashboard/communication'],
      tabs: [
        { href: '/dashboard/messages/', label: 'Inbox' },
        { href: '/dashboard/whatsapp/', label: 'WhatsApp' },
        { href: '/dashboard/broadcasts/', label: 'Broadcasts' }
      ]
    },
    {
      label: 'Care',
      match: ['/dashboard/clinical', '/dashboard/consult', '/dashboard/vitals', '/dashboard/prescriptions', '/dashboard/laboratory', '/dashboard/documents'],
      tabs: [
        { href: '/dashboard/clinical/', label: 'Consultations' },
        { href: '/dashboard/vitals/', label: 'Vitals' },
        { href: '/dashboard/prescriptions/', label: 'Prescriptions' },
        { href: '/dashboard/laboratory/', label: 'Laboratory' },
        { href: '/dashboard/documents/', label: 'Documents' }
      ]
    },
    {
      label: 'Team',
      match: ['/dashboard/staff', '/dashboard/doctors'],
      tabs: [
        { href: '/dashboard/staff/', label: 'Team' },
        { href: '/dashboard/doctors/', label: 'Doctors' }
      ]
    },
    {
      label: 'Operations',
      match: ['/dashboard/rooms', '/dashboard/inventory', '/dashboard/leave', '/dashboard/telemedicine', '/dashboard/operations'],
      tabs: [
        { href: '/dashboard/rooms/', label: 'Rooms' },
        { href: '/dashboard/inventory/', label: 'Inventory' },
        { href: '/dashboard/leave/', label: 'Leave' },
        { href: '/dashboard/telemedicine/', label: 'Telemedicine' }
      ]
    },
    {
      label: 'Insights',
      match: ['/dashboard/analytics', '/dashboard/reports', '/dashboard/reviews'],
      tabs: [
        { href: '/dashboard/analytics/', label: 'Analytics' },
        { href: '/dashboard/reports/', label: 'Reports' },
        { href: '/dashboard/reviews/', label: 'Reviews' }
      ]
    },
    {
      label: 'Setup',
      match: ['/dashboard/settings', '/dashboard/billing', '/dashboard/locations'],
      tabs: [
        { href: '/dashboard/settings/', label: 'Settings' },
        { href: '/dashboard/billing/', label: 'Billing' },
        { href: '/dashboard/locations/', label: 'Locations' }
      ]
    }
  ];

  function renderWorkspaceTabs() {
    if (document.querySelector('.ds-workspace-tabs')) return;
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var ws = null;
    WORKSPACES.forEach(function (w) {
      if (w.match.some(function (m) { return path === m || path.indexOf(m) === 0; })) ws = w;
    });
    if (!ws) return;
    var tabs = ws.tabs.slice();
    if (!isOwner()) {
      tabs = tabs.filter(function (t) {
        return !OWNER_ONLY.some(function (id) {
          var href = ALL_ITEMS[id].href.replace(/\/+$/, '');
          var th = t.href.replace(/\/+$/, '');
          return th === href || th.indexOf(href + '/') === 0;
        });
      });
      if (tabs.length < 2) return;
    }
    var wrap = document.querySelector('.doc-main-wrap');
    var main = document.querySelector('.doc-main');
    if (!wrap || !main) return;
    var nav = document.createElement('nav');
    nav.className = 'ds-workspace-tabs';
    nav.setAttribute('aria-label', ws.label);
    nav.innerHTML = tabs.map(function (t) {
      var target = t.href.replace(/\/+$/, '');
      var on = path === target || path.indexOf(target) === 0;
      return '<a href="' + t.href + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + t.label + '</a>';
    }).join('');
    wrap.insertBefore(nav, main);
  }

  function planLabel(u) {
    var p = String(u.plan || u.subscriptionPlan || u.planStatus || 'Trial').toLowerCase();
    if (p === 'trial') return 'Trial Plan';
    if (p === 'starter') return 'Starter Plan';
    if (p === 'pro') return 'Pro Plan';
    if (p === 'enterprise') return 'Enterprise Plan';
    return (u.plan || 'Trial') + ' Plan';
  }

  function initialsOf(name) {
    var parts = String(name || 'Doctor').replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'DR';
    return parts.slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  }

  function bindLogout(btn) {
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.onclick = function () {
      var next = loginPath();
      if (global.DmaApp) DmaApp.logout(next);
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('clinicos-store');
        location.replace(next);
      }
    };
  }

  function renderStaticSidebar(container, activeHref) {
    if (!container) return;
    var u = getUser();
    var clinic = u.clinicName || u.name || 'Your clinic';
    var groups = navFor(u);
    var html = '<button type="button" class="doc-nav-close" id="doc-sidebar-close" aria-label="Close menu">Close</button><div class="doc-brand">' +
      '<div class="doc-brand-icon" aria-hidden="true">C</div>' +
      '<strong>Clinicos</strong>' +
      '<span>' + clinic + '</span></div>' +
      '<nav class="doc-nav" aria-label="Clinic">';

    groups.forEach(function (g) {
      var more = String(g.label).toLowerCase() === 'more';
      var moreOpen = more && g.items.some(function (item) {
        return isActive(item.href) || (activeHref && item.href.replace(/\/+$/, '') === String(activeHref).replace(/\/+$/, ''));
      });
      if (more) html += '<details class="doc-nav-more"' + (moreOpen ? ' open' : '') + '><summary class="doc-nav-section">More</summary><div class="doc-nav-more-items">';
      else html += '<div class="doc-nav-section">' + g.label + '</div>';
      g.items.forEach(function (item) {
        var on = isActive(item.href) || (activeHref && item.href.replace(/\/+$/, '') === String(activeHref).replace(/\/+$/, ''));
        var cls = on ? 'active' : '';
        if (item.id === 'whatsapp') cls += (cls ? ' ' : '') + 'doc-nav-wa';
        html += '<a href="' + item.href + '" class="' + cls + '" data-nav="' + item.id + '"' + (on ? ' aria-current="page"' : '') + '>' +
          '<span class="doc-nav-icon">' + (ICONS[item.icon] || '') + '</span>' +
          '<span>' + item.label + '</span>' +
          (item.id === 'whatsapp' ? '<span class="doc-wa-status" id="doc-wa-dot"></span>' : '') +
          (item.id === 'updates' ? '<span class="doc-nav-badge" id="doc-upd-badge" hidden></span>' : '') +
          '</a>';
      });
      if (more) html += '</div></details>';
    });

    html += '</nav>';
    var existingPlan = container.querySelector('.doc-plan-card');
    if (existingPlan) existingPlan.remove();
    if (isOwner(u)) {
      html += '<div class="doc-plan-card" id="doc-plan-card">' +
        '<div class="text-faint">Current plan</div>' +
        '<strong>' + planLabel(u) + '</strong>' +
        '<a href="/dashboard/billing/">Manage subscription</a>' +
      '</div>';
    }

    container.innerHTML = html;
    var planCards = container.querySelectorAll('.doc-plan-card');
    for (var pi = 1; pi < planCards.length; pi++) planCards[pi].remove();
    refreshBadges();
  }

  function paintHeader() {
    var actions = document.querySelector('.doc-topbar-actions');
    if (!actions) return;
    var u = getUser();
    var owner = u.ownerName || u.name || 'Doctor';
    var staff = !isOwner(u);
    var bits = [];
    if (!staff) {
      bits.push(
        '<a class="doc-chip-wa" id="doc-wa-chip" href="/dashboard/whatsapp/" title="WhatsApp status">' +
          '<span class="doc-wa-status" id="doc-wa-chip-dot"></span><span class="label">WhatsApp</span></a>'
      );
    }
    bits.push(
      '<input class="doc-topbar-search" type="search" readonly placeholder="Search (Ctrl+K)" aria-label="Open search" id="doc-cmd-open">'
    );
    bits.push(
      '<a class="doc-chip-note" href="/dashboard/notifications/" title="Updates">' +
        'Updates<span class="doc-nav-badge" id="doc-upd-badge-top" hidden></span></a>'
    );
    bits.push('<a class="dma-btn dma-btn-ghost dma-btn-sm" href="/dashboard/appointments/?action=book">Book</a>');
    bits.push(
      '<div class="doc-user-chip">' +
        '<div class="doc-user-avatar" aria-hidden="true">' + initialsOf(owner) + '</div>' +
        '<span class="doc-user-name" id="doc-user-label">' + owner + '</span>' +
        '<button type="button" class="doc-logout" id="doc-logout">Logout</button>' +
      '</div>'
    );
    actions.innerHTML = bits.join('');
    bindLogout(document.getElementById('doc-logout'));
    var cmd = document.getElementById('doc-cmd-open');
    if (cmd) {
      cmd.addEventListener('click', function () {
        if (global.DmaUI && typeof global.DmaUI.openCommand === 'function') global.DmaUI.openCommand();
      });
      cmd.addEventListener('focus', function () {
        cmd.blur();
        if (global.DmaUI && typeof global.DmaUI.openCommand === 'function') global.DmaUI.openCommand();
      });
    }
    refreshBadges();
  }

  function refreshBadges() {
    var App = global.DmaApp;
    if (!App) return;
    if (isOwner()) {
      App.waStatus().then(function (s) {
        var on = !!(s.connected || s.status === 'connected' || s.status === 'CONNECTED');
        ['doc-wa-dot', 'doc-wa-chip-dot'].forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          el.className = 'doc-wa-status' + (on ? ' is-on' : '');
          el.title = on ? 'WhatsApp connected' : 'WhatsApp not connected';
        });
        var chip = document.getElementById('doc-wa-chip');
        if (chip) {
          chip.classList.toggle('is-on', on);
          var lab = chip.querySelector('.label');
          if (lab) lab.textContent = on ? 'Connected' : 'WhatsApp';
        }
      }).catch(function () {});
    }
    App.get('/api/notifications/unread-count').then(function (d) {
      var n = (d && (d.count || d.unread)) || 0;
      ['doc-upd-badge', 'doc-upd-badge-top'].forEach(function (id) {
        var b = document.getElementById(id);
        if (!b) return;
        if (n > 0) { b.hidden = false; b.textContent = n > 9 ? '9+' : String(n); }
        else b.hidden = true;
      });
    }).catch(function () {});
  }

  function renderBottomNav() {
    if (document.getElementById('dma-bottom-nav')) return;
    var items = flatNav();
    var prefer = isOwner()
      ? ['home', 'appointments', 'whatsapp', 'patients']
      : (staffRoleOf() === 'NURSE'
        ? ['home', 'waiting', 'patients', 'vitals']
        : ['home', 'appointments', 'patients', 'messages']);
    var map = {};
    if (isOwner()) {
      prefer.forEach(function (k) { if (ALL_ITEMS[k]) map[k] = ALL_ITEMS[k]; });
    } else {
      items.forEach(function (i) { map[i.id] = i; });
    }
    var keys = prefer.filter(function (k) { return map[k]; }).slice(0, 4);
    var nav = document.createElement('nav');
    nav.id = 'dma-bottom-nav';
    nav.className = 'dma-bottom-nav';
    nav.setAttribute('aria-label', 'Primary');
    nav.innerHTML = keys.map(function (k) {
      var i = map[k];
      var shorts = { home: 'Home', appointments: 'Appts', whatsapp: 'WhatsApp', patients: 'Patients', waiting: 'Waiting', vitals: 'Vitals', messages: 'Inbox' };
      var short = shorts[k] || i.label;
      return '<a href="' + i.href + '" class="' + (isActive(i.href) ? 'on' : '') + '">' +
        (ICONS[i.icon] || '') + '<span>' + short + '</span></a>';
    }).join('') +
      '<button type="button" class="dma-bottom-more" id="dma-more-btn" aria-label="More">' +
      (ICONS.more || '') + '<span>More</span></button>';
    document.body.appendChild(nav);
    var moreBtn = document.getElementById('dma-more-btn');
    if (moreBtn) moreBtn.onclick = function () {
      var menuBtn = document.querySelector('.doc-menu-btn');
      if (menuBtn) menuBtn.click();
    };
  }

  function wireChrome() {
    var menuBtn = document.querySelector('.doc-menu-btn');
    var sidebar = document.getElementById('doc-sidebar');
    var backdrop = document.getElementById('doc-sidebar-backdrop');
    var sidebarRelease = null;
    function close() {
      if (sidebarRelease) { sidebarRelease(); sidebarRelease = null; }
      document.body.classList.remove('doc-nav-open');
      if (sidebar) sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      document.body.classList.toggle('doc-nav-open');
      if (sidebar) sidebar.classList.toggle('is-open');
      if (backdrop) backdrop.classList.toggle('is-open');
      var isOpen = document.body.classList.contains('doc-nav-open');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen && sidebar && global.DmaUI && DmaUI.trapFocus) {
        sidebarRelease = DmaUI.trapFocus(sidebar, close);
      } else if (sidebarRelease) {
        sidebarRelease();
        sidebarRelease = null;
      }
    }
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.onclick = open;
    }
    if (backdrop) backdrop.onclick = close;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        if (e.target.closest('a') || e.target.closest('#doc-sidebar-close')) close();
      });
    }
    renderBottomNav();
    paintHeader();
    renderWorkspaceTabs();
  }

  function initStaticPage(activeHref, pageTitle) {
    document.documentElement.classList.add('doc-static');
    if (!localStorage.getItem('token')) {
      location.replace(loginPath() + '?next=' + encodeURIComponent(location.pathname + location.search));
      return false;
    }
    if (!isOwner() && isOwnerOnlyPath(location.pathname)) {
      location.replace('/dashboard/');
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
    var item = flatNav().filter(function (n) { return n.id === id; })[0];
    var href = item ? item.href : '/dashboard/';
    var title = (page && page.getAttribute('data-title')) || (item && item.label) || 'Dashboard';
    return initStaticPage(href, title);
  }

  global.DmaDoctorShell = {
    NAV: flatNav(),
    GROUPS: navFor(),
    navFor: navFor,
    initStaticPage: initStaticPage,
    renderStaticSidebar: renderStaticSidebar,
    bootFromPage: bootFromPage,
    refreshBadges: refreshBadges,
  };

  document.addEventListener('dma:wa', function () { refreshBadges(); });
})(window);
