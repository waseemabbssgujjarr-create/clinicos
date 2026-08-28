/**
 * Load FIRST on dashboard / staff / superadmin Next.js pages (before other scripts).
 * 1) Rewrites stale Railway API URLs to same-origin /api/*
 * 2) Gives Zustand persist time to rehydrate before auth redirects fire
 */
(function () {
  var RAILWAY = 'clinicos-api-production.up.railway.app';

  if (window.fetch && !window.__clinicosApiShim) {
    window.__clinicosApiShim = true;
    var origFetch = window.fetch;
    function toSameOrigin(url) {
      if (!url || typeof url !== 'string') return url;
      if (url.indexOf(RAILWAY) !== -1) {
        return url.replace(/^https?:\/\/clinicos-api-production\.up\.railway\.app/i, '');
      }
      if (/^https?:\/\//i.test(url)) {
        try {
          var u = new URL(url, window.location.origin);
          if (u.pathname.indexOf('/api/') === 0) return u.pathname + u.search;
        } catch (_) {}
      }
      return url;
    }
    window.fetch = function (input, init) {
      if (typeof input === 'string') input = toSameOrigin(input);
      else if (input && typeof input.url === 'string') {
        var fixed = toSameOrigin(input.url);
        if (fixed !== input.url) input = new Request(fixed, input);
      }
      return origFetch.call(this, input, init);
    };
  }

  try {
    var token = localStorage.getItem('token');
    var raw = localStorage.getItem('clinicos-store');
    if (token && raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.user && parsed.state.token) {
        window.__clinicosAuthReady = true;
      }
    }
  } catch (_) {}

  window.addEventListener('storage', function () {
    window.__clinicosAuthReady = true;
  });

  // Next.js static export has no dynamic [id] pages — force full load so Apache
  // serves the matching detail/index.html (see .htaccess).
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!el) return;
    var href = el.getAttribute('href');
    if (!href) return;
    if (/^\/superadmin\/clinics\/[a-zA-Z0-9]+\/?$/.test(href) ||
        /^\/dashboard(\/|$)/.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = href;
    }
  }, true);

  if (!document.querySelector('link[href*="platform-polish.css"]')) {
    var polishLink = document.createElement('link');
    polishLink.rel = 'stylesheet';
    polishLink.href = '/platform-polish.css?v=4';
    document.head.appendChild(polishLink);
  }
  if (!document.querySelector('link[href*="platform-hovers.css"]')) {
    var hoverLink = document.createElement('link');
    hoverLink.rel = 'stylesheet';
    hoverLink.href = '/platform-hovers.css?v=1';
    document.head.appendChild(hoverLink);
  }
  if (!document.querySelector('link[href*="dma-dashboard.css"]')) {
    var dashLink = document.createElement('link');
    dashLink.rel = 'stylesheet';
    dashLink.href = '/dma-dashboard.css?v=10';
    document.head.appendChild(dashLink);
  }

  // ── NEW DESIGN SYSTEM v4 ────────────────────────────────────────────────
  if (!document.querySelector('link[href*="dma-design-system.css"]')) {
    var dsLink = document.createElement('link');
    dsLink.rel = 'stylesheet';
    dsLink.href = '/dma-design-system.css?v=4';
    document.head.appendChild(dsLink);
  }

  // ── CLINIC UI — light sidebar, blue brand, IQPigeon-inspired ────────────
  var isDocStatic = document.documentElement.classList.contains('doc-static');
  if (!isDocStatic && !document.querySelector('link[href*="dma-clinic-ui.css"]')) {
    var clinicUiLink = document.createElement('link');
    clinicUiLink.rel = 'stylesheet';
    clinicUiLink.href = '/dma-clinic-ui.css?v=2';
    document.head.appendChild(clinicUiLink);
  }

  // ── ADMIN UI — dark-blue sidebar, blue brand for superadmin ─────────────
  if (/^\/superadmin(\/|$)/.test(location.pathname)) {
    if (!document.querySelector('link[href*="dma-admin-ui.css"]')) {
      var adminUiLink = document.createElement('link');
      adminUiLink.rel = 'stylesheet';
      adminUiLink.href = '/dma-admin-ui.css?v=1';
      document.head.appendChild(adminUiLink);
    }
  }
  if (!isDocStatic && !document.querySelector('link[href*="dma-doctor-app.css"]')) {
    var appCss = document.createElement('link');
    appCss.rel = 'stylesheet';
    appCss.href = '/dma-doctor-app.css?v=1';
    document.head.appendChild(appCss);
  }

  if (!document.querySelector('link[href*="Montserrat"]')) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  function isLiveActiveLabel(text) {
    return /^Live\s*(?:&|and)\s*Active$/i.test(text);
  }

  function markLiveStatusBadges() {
    document.querySelectorAll('span, button').forEach(function (el) {
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!isLiveActiveLabel(text)) return;

      var pill = el.closest('[class*="rounded-btn"], [class*="border-brand"], [class*="cursor-pointer"]') || el.parentElement;
      if (pill) {
        pill.classList.add('dma-ai-status-live');
        var dot = pill.querySelector('[class*="rounded-full"]');
        if (dot) dot.classList.add('dma-live-dot');
      }

      el.classList.add('dma-live-label');
    });
  }

  if (!document.getElementById('dma-live-badge-style')) {
    var liveStyle = document.createElement('style');
    liveStyle.id = 'dma-live-badge-style';
    liveStyle.textContent =
      '.dma-ai-status-live{background:rgba(34,197,94,.12)!important;border-color:rgba(34,197,94,.45)!important}.dma-ai-status-live .dma-live-label,.dma-ai-status-live span.text-brand{color:#15803d!important}.dma-ai-status-live .dma-live-dot{background:#22c55e!important}';
    document.head.appendChild(liveStyle);
  }

  function scheduleLiveBadgeMark() {
    markLiveStatusBadges();
    setTimeout(markLiveStatusBadges, 800);
    setTimeout(markLiveStatusBadges, 2500);
    if (window.MutationObserver && document.body && !window.__dmaLiveBadgeObserver) {
      window.__dmaLiveBadgeObserver = true;
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          markLiveStatusBadges();
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) scheduleLiveBadgeMark();
  else document.addEventListener('DOMContentLoaded', scheduleLiveBadgeMark);

  if (!isDocStatic && /^\/(dashboard|staff)(\/|$)/.test(location.pathname)) {
    if (!document.querySelector('link[href*="dashboard-professional.css"]')) {
      var proCss = document.createElement('link');
      proCss.rel = 'stylesheet';
      proCss.href = '/dashboard-professional.css?v=1';
      document.head.appendChild(proCss);
    }
    if (!document.querySelector('link[href*="dashboard-unified.css"]')) {
      var unifiedCss = document.createElement('link');
      unifiedCss.rel = 'stylesheet';
      unifiedCss.href = '/dashboard-unified.css?v=3';
      document.head.appendChild(unifiedCss);
    }
    if (!document.querySelector('link[href*="dashboard-layout.css"]')) {
      var layoutCss = document.createElement('link');
      layoutCss.rel = 'stylesheet';
      layoutCss.href = '/dashboard-layout.css?v=7';
      document.head.appendChild(layoutCss);
    }
    if (!document.querySelector('link[href*="dashboard-fixes.css"]')) {
      var fixesCss = document.createElement('link');
      fixesCss.rel = 'stylesheet';
      fixesCss.href = '/dashboard-fixes.css?v=3';
      document.head.appendChild(fixesCss);
    }
    if (!document.querySelector('script[src*="dashboard-layout.js"]')) {
      var layoutJs = document.createElement('script');
      layoutJs.src = '/dashboard-layout.js?v=6';
      layoutJs.defer = true;
      (document.head || document.documentElement).appendChild(layoutJs);
    }
    if (!document.querySelector('script[src*="dashboard-fixes.js"]')) {
      var fixesJs = document.createElement('script');
      fixesJs.src = '/dashboard-fixes.js?v=3';
      fixesJs.defer = true;
      (document.head || document.documentElement).appendChild(fixesJs);
    }
  }

  if (!isDocStatic && /^\/dashboard\/reviews\/?$/.test(location.pathname)) {
    if (!document.querySelector('link[href*="dashboard-reviews.css"]')) {
      var revCss = document.createElement('link');
      revCss.rel = 'stylesheet';
      revCss.href = '/dashboard-reviews.css?v=2';
      document.head.appendChild(revCss);
    }
    if (!document.querySelector('script[src*="dashboard-reviews.js"]')) {
      var revJs = document.createElement('script');
      revJs.src = '/dashboard-reviews.js?v=1';
      revJs.defer = true;
      (document.head || document.documentElement).appendChild(revJs);
    }
  }

  if (/^\/dashboard(\/|$)/.test(location.pathname)) {
    (function gateUnverifiedDoctor() {
      var token = localStorage.getItem('token');
      if (!token) return;
      fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include',
      })
        .then(function (r) {
          if (!r.ok) return null;
          return r.json();
        })
        .then(function (me) {
          if (!me || me.role !== 'DOCTOR') return;
          if (me.emailVerified === false || me.emailVerified === 0) {
            var email = encodeURIComponent(me.email || '');
            location.replace('/verify-email/?email=' + email + '&next=/register/plan/');
          }
        })
        .catch(function () {});
    })();

    if (!isDocStatic && !document.querySelector('link[href="/dashboard-signature.css"]')) {
      var sigCss = document.createElement('link');
      sigCss.rel = 'stylesheet';
      sigCss.href = '/dashboard-signature.css?v=3';
      document.head.appendChild(sigCss);
    }
    if (!isDocStatic && !document.querySelector('script[src="/dashboard-signature.js"]')) {
      var sigJs = document.createElement('script');
      sigJs.src = '/dashboard-signature.js?v=4';
      sigJs.defer = true;
      (document.head || document.documentElement).appendChild(sigJs);
    }
  }

  if (/^\/superadmin(\/|$)/.test(location.pathname)) {
    if (!document.querySelector('link[href*="dashboard-unified.css"]')) {
      var saUnified = document.createElement('link');
      saUnified.rel = 'stylesheet';
      saUnified.href = '/dashboard-unified.css?v=2';
      document.head.appendChild(saUnified);
    }
    if (!document.querySelector('script[src*="superadmin-nav-fix.js"]')) {
      var saNavFix = document.createElement('script');
      saNavFix.src = '/superadmin-nav-fix.js?v=1';
      (document.head || document.documentElement).appendChild(saNavFix);
    }
    if (!document.querySelector('link[href*="superadmin-theme.css"]')) {
      var saCss = document.createElement('link');
      saCss.rel = 'stylesheet';
      saCss.href = '/superadmin-theme.css?v=8';
      document.head.appendChild(saCss);
    }
    if (!document.querySelector('link[href*="superadmin-polish.css"]')) {
      var saPolish = document.createElement('link');
      saPolish.rel = 'stylesheet';
      saPolish.href = '/superadmin-polish.css?v=1';
      document.head.appendChild(saPolish);
    }
    if (!document.getElementById('dma-sa-critical-style')) {
      var saCrit = document.createElement('style');
      saCrit.id = 'dma-sa-critical-style';
      saCrit.textContent =
        '.bg-sidebar{background:#1c1917!important;background-image:linear-gradient(180deg,#1c1917,#0a0a0a)!important}' +
        '.nav-item{color:#e5e5e5!important}.nav-item:hover{background:rgba(249,115,22,.12)!important;color:#fff!important}' +
        '.nav-item-active{background:rgba(249,115,22,.22)!important;border-left-color:#F97316!important;color:#fff!important}' +
        '.bg-brand:not(.dma-live-badge):not(.dma-ai-status-live){background:#F97316!important}' +
        '.text-brand:not(.dma-live-label){color:#F97316!important}' +
        '.border-brand,.border-l-brand{border-color:#F97316!important}' +
        'main.flex-1,main.flex-1 .text-primary,main.flex-1 h1,main.flex-1 h2{color:#0a0a0a!important}' +
        'aside .text-white{color:#fff!important}aside .text-slate-400{color:#e5e5e5!important}';
      document.head.appendChild(saCrit);
    }

    function ensureReactMobileNav() {
      var isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (!document.querySelector('.dma-sa-topbar')) {
        var top = document.createElement('div');
        top.className = 'dma-sa-topbar';
        top.innerHTML =
          '<button type="button" class="sa-menu-btn" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
          '<div class="sa-mobile-brand"><strong>Doctors My Agency</strong><span>Platform Admin</span></div>';
        document.body.appendChild(top);
        top.querySelector('.sa-menu-btn').onclick = function () {
          var open = !document.body.classList.contains('dma-sa-nav-open');
          document.body.classList.toggle('dma-sa-nav-open', open);
          this.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
      }
      if (!document.querySelector('.dma-sa-backdrop')) {
        var backdrop = document.createElement('div');
        backdrop.className = 'dma-sa-backdrop';
        document.body.appendChild(backdrop);
        backdrop.onclick = function () {
          document.body.classList.remove('dma-sa-nav-open');
        };
      }

      document.querySelectorAll('[class*="ml-[220px]"], [class*="ml-\\[220px\\]"]').forEach(function (el) {
        if (isMobile) {
          el.style.marginLeft = '0';
          el.style.width = '100%';
          el.style.maxWidth = '100%';
        } else {
          el.style.marginLeft = '';
          el.style.width = '';
          el.style.maxWidth = '';
        }
      });

      var main = document.querySelector('main') || document.querySelector('[class*="ml-[220px]"]');
      if (main) {
        if (isMobile) {
          main.style.marginLeft = '0';
          main.style.width = '100%';
        } else {
          main.style.marginLeft = '';
          main.style.width = '';
        }
      }
    }

    function injectWhatsAppLink(aside) {
      if (!aside || aside.querySelector('a[href="/superadmin/whatsapp/"], a[href="/superadmin/whatsapp"]')) return;
      var users = aside.querySelector('a[href="/superadmin/users"], a[href="/superadmin/users/"]');
      var a = document.createElement('a');
      a.href = '/superadmin/whatsapp/';
      a.className = (users && users.className) || 'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold';
      a.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
        '<span>WhatsApp</span>';
      if (users && users.parentNode) users.parentNode.insertBefore(a, users.nextSibling);
      else {
        var nav = aside.querySelector('nav') || aside;
        nav.appendChild(a);
      }
    }

    function injectIntegrationsLink(aside) {
      if (!aside || aside.querySelector('a[href="/superadmin/integrations/"], a[href="/superadmin/integrations"]')) return;
      var settings = aside.querySelector('a[href="/superadmin/settings"], a[href="/superadmin/settings/"]');
      var a = document.createElement('a');
      a.href = '/superadmin/integrations/';
      a.className = (settings && settings.className) || 'nav-item flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold';
      a.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/></svg>' +
        '<span>Integrations</span>';
      if (settings && settings.parentNode) settings.parentNode.insertBefore(a, settings);
      else {
        var nav = aside.querySelector('nav') || aside;
        nav.appendChild(a);
      }
    }

    function normalizeNavLabels(aside) {
      if (!aside) return;
      aside.querySelectorAll('a').forEach(function (el) {
        var href = (el.getAttribute('href') || '').replace(/\/+$/, '');
        var map = {
          '/superadmin/subscriptions': 'Subscriptions',
          '/superadmin/users': 'Users',
          '/superadmin/whatsapp': 'WhatsApp',
          '/superadmin/settings': 'Settings',
          '/superadmin/stripe': 'Connect Stripe',
          '/superadmin/integrations': 'Integrations',
        };
        if (map[href]) {
          var spans = el.querySelectorAll('span');
          var label = spans.length ? spans[spans.length - 1] : null;
          if (label && label.childNodes.length === 1 && label.childNodes[0].nodeType === 3) {
            label.textContent = map[href];
          } else {
            el.childNodes.forEach(function (n) {
              if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ' ' + map[href];
            });
          }
        }
        el.addEventListener('click', function () {
          document.body.classList.remove('dma-sa-nav-open');
        });
      });
    }

    function rebrandSuperadmin() {
      document.title = document.title
        .replace(/ClinicOS AI/g, 'Doctors My Agency')
        .replace(/MediCore AI/g, 'Doctors My Agency')
        .replace(/MediCore/g, 'Doctors My Agency')
        .replace(/ClinicOS/g, 'Doctors My Agency');
      document.querySelectorAll('h1, h2, p, span, strong').forEach(function (el) {
        if (el.children.length) return;
        var t = el.textContent || '';
        if (/MediCore|ClinicOS/i.test(t)) {
          el.textContent = t
            .replace(/MediCore AI — Super Admin Dashboard/g, 'Platform Admin')
            .replace(/MediCore AI Super Admin Dashboard/g, 'Platform Admin')
            .replace(/MediCore AI/g, 'Doctors My Agency')
            .replace(/ClinicOS AI/g, 'Doctors My Agency')
            .replace(/MediCore/g, 'Doctors My Agency')
            .replace(/ClinicOS/g, 'Doctors My Agency');
        }
      });
      var aside = document.querySelector('aside');
      if (!aside) return;
      ensureReactMobileNav();
      injectWhatsAppLink(aside);
      injectIntegrationsLink(aside);
      normalizeNavLabels(aside);
      if (aside.dataset.dmaRebranded) return;
      aside.dataset.dmaRebranded = '1';
      aside.querySelectorAll('*').forEach(function (el) {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
          var t = el.textContent;
          if (/ClinicOS|MediCore|Super Admin/i.test(t)) {
            el.textContent = t
              .replace(/ClinicOS AI/g, 'Doctors My Agency')
              .replace(/MediCore AI/g, 'Doctors My Agency')
              .replace(/Super Admin/g, 'Platform Admin');
          }
        }
      });
    }

    rebrandSuperadmin();
    setTimeout(rebrandSuperadmin, 400);
    setTimeout(rebrandSuperadmin, 1200);
    setTimeout(rebrandSuperadmin, 2500);
    window.addEventListener('resize', function () {
      ensureReactMobileNav();
    });
    if (window.MutationObserver && document.body && !window.__dmaSaRebrandObserver) {
      window.__dmaSaRebrandObserver = true;
      new MutationObserver(function () { rebrandSuperadmin(); }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (/^\/dashboard(\/|$)/.test(location.pathname)) {
    if (!document.querySelector('link[href*="dashboard-doctor-shell.css"]')) {
      var docShellCss = document.createElement('link');
      docShellCss.rel = 'stylesheet';
      docShellCss.href = '/dashboard-doctor-shell.css?v=2';
      document.head.appendChild(docShellCss);
    }
    if (!document.querySelector('script[src*="dashboard-doctor-shell.js"]')) {
      var docShellJs = document.createElement('script');
      docShellJs.src = '/dashboard-doctor-shell.js?v=1';
      (document.head || document.documentElement).appendChild(docShellJs);
    }
    if (!document.querySelector('link[href*="dashboard-whatsapp-hub.css"]')) {
      var waHubCss = document.createElement('link');
      waHubCss.rel = 'stylesheet';
      waHubCss.href = '/dashboard-whatsapp-hub.css?v=4';
      document.head.appendChild(waHubCss);
    }
    if (!document.querySelector('script[src*="dashboard-whatsapp-hub.js"]')) {
      var waHubJs = document.createElement('script');
      waHubJs.src = '/dashboard-whatsapp-hub.js?v=2';
      (document.head || document.documentElement).appendChild(waHubJs);
    }
  }

  if (/^\/dashboard\/settings\/?$/.test(location.pathname)) {
    function fillSettingsPlaceholders() {
      var map = [
        { label: /clinic name/i, ph: 'e.g. Smile Dental Clinic' },
        { label: /doctor name|owner/i, ph: 'e.g. Dr. Sara Khan' },
        { label: /phone|whatsapp/i, ph: 'e.g. +971501234567' },
        { label: /specialty/i, ph: 'e.g. Dermatology' },
        { label: /address/i, ph: 'e.g. Clinic address, city' },
      ];
      document.querySelectorAll('label, p, span, div').forEach(function (lab) {
        var text = (lab.textContent || '').trim();
        if (!text || text.length > 40) return;
        map.forEach(function (m) {
          if (!m.label.test(text)) return;
          var wrap = lab.closest('div') || lab.parentElement;
          if (!wrap) return;
          var input = wrap.querySelector('input:not([type="hidden"]):not([type="file"]), textarea');
          if (!input) {
            var next = lab.nextElementSibling;
            if (next && (next.tagName === 'INPUT' || next.tagName === 'TEXTAREA')) input = next;
          }
          if (input && !input.getAttribute('placeholder')) {
            input.setAttribute('placeholder', m.ph);
          }
        });
      });
      document.querySelectorAll('input, textarea').forEach(function (el) {
        if (!el.getAttribute('placeholder') && !el.value) {
          var name = (el.getAttribute('name') || el.id || '').toLowerCase();
          if (/name/.test(name) && /clinic/.test(name)) el.placeholder = 'e.g. Smile Dental Clinic';
          if (/owner|doctor/.test(name)) el.placeholder = 'e.g. Dr. Sara Khan';
          if (/phone/.test(name)) el.placeholder = 'e.g. +971501234567';
          if (/special/.test(name)) el.placeholder = 'e.g. Dermatology';
          if (/address/.test(name)) el.placeholder = 'e.g. Clinic address, city';
        }
      });
    }
    setTimeout(fillSettingsPlaceholders, 500);
    setTimeout(fillSettingsPlaceholders, 1500);
    setTimeout(fillSettingsPlaceholders, 3000);
  }
})();

// ═══════════════════════════════════════════════════════════
// DARK THEME TOGGLE + MOBILE NAV INJECTION
// Appended by design system v4 upgrade
// ═══════════════════════════════════════════════════════════
(function () {
  // ── 1. Apply stored theme immediately (before paint) ──
  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('dma-theme') || 'light'; } catch (_) {}
  document.documentElement.setAttribute('data-theme', savedTheme);

  function isDashboard() {
    return /^\/(dashboard|staff|superadmin)(\/|$)/.test(location.pathname);
  }

  if (!isDashboard()) return;

  // ── 2. Inject dark/light toggle button ──
  function injectThemeToggle() {
    if (document.getElementById('dma-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'dma-theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.title = 'Toggle dark / light mode';

    function getIcon(theme) {
      return theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }

    var current = document.documentElement.getAttribute('data-theme') || 'light';
    btn.innerHTML = getIcon(current);

    btn.onclick = function () {
      var now = document.documentElement.getAttribute('data-theme') || 'light';
      var next = now === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('dma-theme', next); } catch (_) {}
      btn.innerHTML = getIcon(next);
    };

    document.body.appendChild(btn);
  }

  // ── 3. Inject mobile bottom navigation ──
  function injectMobileNav() {
    if (document.getElementById('dma-mobile-nav')) return;
    if (!/^\/dashboard(\/|$)/.test(location.pathname)) return;

    var path = location.pathname.replace(/\/$/, '') || '/dashboard';

    function isActive(href) {
      var h = href.replace(/\/$/, '');
      return path === h || path.startsWith(h + '/') ? ' active' : '';
    }

    var nav = document.createElement('nav');
    nav.id = 'dma-mobile-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');
    nav.innerHTML =
      '<a href="/dashboard/" class="' + isActive('/dashboard') + '" aria-label="Dashboard">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
        'Home' +
      '</a>' +
      '<a href="/dashboard/appointments/" class="' + isActive('/dashboard/appointments') + '" aria-label="Appointments">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
        'Appts' +
      '</a>' +
      '<a href="/dashboard/patients/" class="' + isActive('/dashboard/patients') + '" aria-label="Patients">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
        'Patients' +
      '</a>' +
      '<a href="/dashboard/messages/" class="' + isActive('/dashboard/messages') + '" aria-label="Messages">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        'Messages' +
      '</a>' +
      '<a href="/dashboard/analytics/" class="' + isActive('/dashboard/analytics') + '" aria-label="Analytics">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
        'Analytics' +
      '</a>';

    document.body.appendChild(nav);
  }

  // ── 4. Run after DOM ready ──
  function run() {
    injectThemeToggle();
    injectMobileNav();
  }

  if (document.body) run();
  else document.addEventListener('DOMContentLoaded', run);
})();
