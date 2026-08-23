/**
 * Doctor dashboard shell — full sidebar on standalone pages; enhances React dashboard aside.
 */
(function (global) {
  var NAV = [
    { href: '/dashboard/', label: 'Dashboard', icon: 'grid' },
    { href: '/dashboard/appointments/', label: 'Appointments', icon: 'cal' },
    { href: '/dashboard/patients/', label: 'Patients', icon: 'users' },
    { href: '/dashboard/whatsapp/', label: 'WhatsApp', icon: 'wa', wa: true },
    { href: '/dashboard/messages/', label: 'Messages', icon: 'msg' },
    { href: '/dashboard/ai/', label: 'AI Receptionist', icon: 'bot' },
    { href: '/dashboard/analytics/', label: 'Analytics', icon: 'chart' },
    { href: '/dashboard/reviews/', label: 'Reviews', icon: 'star' },
    { href: '/dashboard/staff/', label: 'Staff', icon: 'staff' },
    { href: '/dashboard/billing/', label: 'Billing', icon: 'bill' },
    { href: '/dashboard/settings/', label: 'Settings', icon: 'gear' },
  ];

  var ICONS = {
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    wa: '<span class="doc-wa-dot">●</span>',
    msg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M9 13v2M15 13v2"/></svg>',
    chart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    staff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    bill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>',
    gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  };

  function getUser() {
    try {
      var raw = localStorage.getItem('clinicos-store');
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && parsed.state && parsed.state.user) || {};
    } catch (_) {
      return {};
    }
  }

  function isActive(href) {
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var target = href.replace(/\/+$/, '') || '/';
    if (target === '/dashboard') return path === '/dashboard';
    return path.indexOf(target) === 0;
  }

  function renderStaticSidebar(container, activeHref) {
    if (!container) return;
    var user = getUser();
    var clinic = user.clinicName || user.name || 'Your clinic';
    var owner = user.ownerName || user.name || 'Doctor';
    var plan = user.plan || user.subscriptionPlan || 'Trial Plan';

    var links = NAV.map(function (item) {
      var cls = isActive(item.href) || (activeHref && item.href.replace(/\/+$/, '') === String(activeHref).replace(/\/+$/, ''))
        ? 'active' + (item.wa ? ' doc-nav-wa' : '')
        : (item.wa ? 'doc-nav-wa' : '');
      return (
        '<a href="' + item.href + '" class="' + cls + '">' +
        (ICONS[item.icon] || '') +
        '<span>' + item.label + '</span></a>'
      );
    }).join('');

    container.innerHTML =
      '<div class="doc-brand">' +
        '<div class="doc-brand-icon">DM</div>' +
        '<strong>Doctors My Agency</strong>' +
        '<span>' + clinic + '</span>' +
      '</div>' +
      '<nav>' + links + '</nav>' +
      '<div class="doc-sidebar-footer">' +
        '<strong>' + owner + '</strong>' +
        plan +
      '</div>';
  }

  function injectReactWhatsAppLink(aside) {
    if (!aside || aside.querySelector('a[href="/dashboard/whatsapp/"], a[href="/dashboard/whatsapp"]')) return;
    var msgs = aside.querySelector('a[href="/dashboard/messages"], a[href="/dashboard/messages/"]');
    var a = document.createElement('a');
    a.href = '/dashboard/whatsapp/';
    a.className = (msgs && msgs.className) || 'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold';
    a.innerHTML = '<span style="color:#25d366;font-weight:800;font-size:1rem;line-height:1">●</span><span>WhatsApp</span>';
    if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(a, msgs);
    else (aside.querySelector('nav') || aside).appendChild(a);
  }

  function rebrandReactAside(aside) {
    aside.querySelectorAll('*').forEach(function (el) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        var t = el.textContent || '';
        if (/ClinicOS|MediCore/i.test(t)) {
          el.textContent = t
            .replace(/ClinicOS AI/g, 'Doctors My Agency')
            .replace(/MediCore AI/g, 'Doctors My Agency')
            .replace(/ClinicOS/g, 'Doctors My Agency');
        }
      }
    });
  }

  function enhanceReactDashboard() {
    var aside = document.querySelector('aside');
    if (!aside) return;
    injectReactWhatsAppLink(aside);
    rebrandReactAside(aside);
  }

  function initStaticPage(activeHref, pageTitle) {
    document.documentElement.classList.add('doc-static');
    if (!localStorage.getItem('token')) {
      location.replace('/doctor-login/?next=' + encodeURIComponent(location.pathname));
      return false;
    }
    var sidebar = document.getElementById('doc-sidebar');
    renderStaticSidebar(sidebar, activeHref);
    if (pageTitle) {
      var h = document.getElementById('doc-page-title');
      if (h) h.textContent = pageTitle;
    }
    var menuBtn = document.querySelector('.doc-menu-btn');
    if (menuBtn) {
      menuBtn.onclick = function () {
        document.body.classList.toggle('doc-nav-open');
      };
    }
    document.title = (pageTitle || 'Dashboard') + ' — Doctors My Agency';
    return true;
  }

  function watchReactDashboard() {
    if (!/^\/dashboard(\/|$)/.test(location.pathname)) return;
    if (document.documentElement.classList.contains('doc-static')) return;
    enhanceReactDashboard();
    setTimeout(enhanceReactDashboard, 400);
    setTimeout(enhanceReactDashboard, 1200);
    setTimeout(enhanceReactDashboard, 2500);
    if (window.MutationObserver && document.body && !window.__dmaDocNavObserver) {
      window.__dmaDocNavObserver = true;
      new MutationObserver(function () { enhanceReactDashboard(); }).observe(document.body, { childList: true, subtree: true });
    }
  }

  global.DmaDoctorShell = {
    NAV: NAV,
    initStaticPage: initStaticPage,
    enhanceReactDashboard: enhanceReactDashboard,
    renderStaticSidebar: renderStaticSidebar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchReactDashboard);
  } else {
    watchReactDashboard();
  }
})(window);
