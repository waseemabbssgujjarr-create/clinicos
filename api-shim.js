/**
 * Force same-origin /api/* — rewrites stale Railway or absolute API URLs to relative paths.
 * Load before Next.js chunks on auth/register pages.
 */
(function () {
  var RAILWAY = 'clinicos-api-production.up.railway.app';
  var orig = window.fetch;
  if (!orig || window.__clinicosApiShim) return;
  window.__clinicosApiShim = true;

  function toSameOrigin(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf(RAILWAY) !== -1) {
      return url.replace(/^https?:\/\/clinicos-api-production\.up\.railway\.app/i, '');
    }
    if (/^https?:\/\//i.test(url)) {
      try {
        var u = new URL(url, window.location.origin);
        if (u.pathname.indexOf('/api/') === 0) {
          return u.pathname + u.search;
        }
      } catch (_) { /* ignore */ }
    }
    return url;
  }

  window.fetch = function (input, init) {
    if (typeof input === 'string') {
      input = toSameOrigin(input);
    } else if (input && typeof input.url === 'string') {
      var fixed = toSameOrigin(input.url);
      if (fixed !== input.url) input = new Request(fixed, input);
    }
    return orig.call(this, input, init);
  };
})();
