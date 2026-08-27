/**
 * Ensures WhatsApp + Integrations appear in React superadmin sidebar
 * (Overview, Clinics, Revenue, Announcements — layout chunk pages)
 */
(function () {
  if (!/^\/superadmin(\/|$)/.test(location.pathname)) return;
  if (document.documentElement.classList.contains('sa-static')) return;

  var LINKS = [
    {
      href: '/superadmin/whatsapp/',
      after: '/superadmin/users',
      label: 'WhatsApp',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    },
    {
      href: '/superadmin/integrations/',
      before: '/superadmin/settings',
      label: 'Integrations',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/></svg>',
    },
    {
      href: '/superadmin/health/',
      after: '/superadmin/integrations',
      label: 'System Health',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    },
    {
      href: '/superadmin/audit/',
      before: '/superadmin/settings',
      label: 'Audit Log',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    },
    {
      href: '/superadmin/announcements/',
      before: '/superadmin/settings',
      label: 'Announcements',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    },
  ];

  function norm(href) {
    return (href || '').replace(/\/+$/, '') || '/';
  }

  function injectOne(aside, spec) {
    if (aside.querySelector('a[href="' + spec.href + '"], a[href="' + spec.href.replace(/\/$/, '') + '"]')) return;
    var anchor = null;
    if (spec.after) {
      anchor = aside.querySelector('a[href="' + spec.after + '"], a[href="' + spec.after + '/"]');
    } else if (spec.before) {
      anchor = aside.querySelector('a[href="' + spec.before + '"], a[href="' + spec.before + '/"]');
    }
    var a = document.createElement('a');
    a.href = spec.href;
    a.className = (anchor && anchor.className) || 'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold';
    a.innerHTML = spec.svg + '<span>' + spec.label + '</span>';
    if (spec.before && anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(a, anchor);
    } else if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(a, anchor.nextSibling);
    } else {
      (aside.querySelector('nav') || aside).appendChild(a);
    }
  }

  function run() {
    var aside = document.querySelector('aside');
    if (!aside) return;
    LINKS.forEach(function (spec) { injectOne(aside, spec); });
    aside.querySelectorAll('a[href]').forEach(function (el) {
      var h = norm(el.getAttribute('href'));
      if (h === '/superadmin/whatsapp' || h === '/superadmin/integrations') {
        el.addEventListener('click', function () {
          document.body.classList.remove('dma-sa-nav-open', 'sa-nav-open');
        });
      }
    });
  }

  run();
  setTimeout(run, 400);
  setTimeout(run, 1200);
  setTimeout(run, 2500);
  if (window.MutationObserver && document.body && !window.__saNavFixObserver) {
    window.__saNavFixObserver = true;
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
})();
