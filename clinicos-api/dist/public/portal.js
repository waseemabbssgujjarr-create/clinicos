/** Sync token + user into Zustand persist store used by Next.js dashboard */
(function applySavedThemeEarly() {
  try {
    if (localStorage.getItem('dma-theme') === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) {}
})();

function syncClinicosStore(user, token) {
  if (!user || !token) return;
  localStorage.setItem('token', token);
  localStorage.setItem('clinicos-store', JSON.stringify({
    state: { user, token },
    version: 0,
  }));
}

/** Button loading state — prevents double-submit on login/register forms */
function setBtnLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.origText) btn.dataset.origText = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    if (loadingText) btn.textContent = loadingText;
  } else {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = btn.dataset.origText || btn.textContent;
  }
}

/** FAQ accordion (landing page) */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;
  items.forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      items.forEach((i) => {
        i.classList.remove('is-open');
        i.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

function ensureThemeToggleInNav() {
  const sunSvg = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  const moonSvg = '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  document.querySelectorAll('.nav-inner').forEach((nav) => {
    if (nav.querySelector('.theme-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Switch theme');
    btn.innerHTML = sunSvg + moonSvg;
    const cta = nav.querySelector('.nav-cta');
    if (cta) {
      cta.insertBefore(btn, cta.firstChild);
    } else {
      nav.appendChild(btn);
    }
  });
}

/** Theme toggle (dark default, light = white base) */
function initThemeToggle() {
  const KEY = 'dma-theme';
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    if (!btn.querySelector('svg')) {
      btn.innerHTML = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    function syncIcon() {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      btn.classList.toggle('is-light', light);
      btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    }
    syncIcon();
    btn.addEventListener('click', () => {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      const next = light ? 'dark' : 'light';
      if (next === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      localStorage.setItem(KEY, next);
      syncIcon();
    });
  });
}

/** Mobile hamburger nav (landing + portal pages) */
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  if (!toggle || !menu || toggle.dataset.bound) return;
  toggle.dataset.bound = '1';

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('nav-open', open);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (!menu.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMenu();
  });
}

/** Force same-origin /api/* (see api-shim.js) */
(function () {
  var RAILWAY = 'clinicos-api-production.up.railway.app';
  if (!window.fetch || window.__clinicosApiShim) return;
  window.__clinicosApiShim = true;
  var orig = window.fetch;
  function toSameOrigin(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf(RAILWAY) !== -1) return url.replace(/^https?:\/\/clinicos-api-production\.up\.railway\.app/i, '');
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
    return orig.call(this, input, init);
  };
})();

/** Password show/hide toggle for portal login pages */
function initPasswordToggles(root) {
  const scope = root || document;
  scope.querySelectorAll('.password-wrap').forEach((wrap) => {
    const input = wrap.querySelector('input');
    const btn = wrap.querySelector('[data-password-toggle]');
    if (!input || !btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('is-visible', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('title', show ? 'Hide password' : 'Show password');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();
    initMobileNav();
    initFaqAccordion();
    injectPlatformHovers();
    ensureThemeToggleInNav();
    initThemeToggle();
    trimLandingFooterGap();
    setTimeout(trimLandingFooterGap, 500);
    setTimeout(trimLandingFooterGap, 2000);
    window.addEventListener('resize', trimLandingFooterGap);
  });
} else {
  initPasswordToggles();
  initMobileNav();
  initFaqAccordion();
  injectPlatformHovers();
  ensureThemeToggleInNav();
  initThemeToggle();
  trimLandingFooterGap();
  setTimeout(trimLandingFooterGap, 500);
  setTimeout(trimLandingFooterGap, 2000);
  window.addEventListener('resize', trimLandingFooterGap);
}

function injectPlatformHovers() {
  if (document.querySelector('link[href="/platform-hovers.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/platform-hovers.css';
  document.head.appendChild(l);
  if (!document.querySelector('link[href="/dma-theme.css"]')) {
    const t = document.createElement('link');
    t.rel = 'stylesheet';
    t.href = '/dma-theme.css';
    document.head.appendChild(t);
  }
}

/** Pin chat widget/glows so they never extend page scroll */
function trimLandingFooterGap() {
  if (document.body.classList.contains('portal-page')) return;

  document.querySelectorAll('.glow, #salesbot-bubble, #salesbot-window').forEach(function (el) {
    el.style.position = 'fixed';
  });

  var win = document.getElementById('salesbot-window');
  var bubble = document.getElementById('salesbot-bubble');
  if (win) {
    if (win.classList.contains('open')) {
      win.style.removeProperty('display');
      win.style.removeProperty('height');
      win.style.removeProperty('overflow');
    } else {
      win.style.display = 'none';
      win.style.height = '0';
      win.style.overflow = 'hidden';
    }
  }
  if (bubble && win && win.classList.contains('open')) {
    bubble.style.removeProperty('display');
  }
  if (typeof window.__dmaSalesBotSync === 'function') {
    window.__dmaSalesBotSync();
  }
}
window.trimLandingFooterGap = trimLandingFooterGap;
