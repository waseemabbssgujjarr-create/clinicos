/**
 * Clinicos theme: prefers-color-scheme, persist, no-flash companion.
 * Inline boot in <head> must run first. This file is the toggle API.
 */
(function (global) {
  var KEY = "dma-theme";

  function root() {
    return document.documentElement;
  }

  function isAuth() {
    return /\bdma-world-auth\b/.test(root().className);
  }

  function isPublic() {
    return /\bdma-world-public\b/.test(root().className);
  }

  function isApp() {
    return /\bdoc-static\b/.test(root().className) || /\bsa-static\b/.test(root().className);
  }

  function systemTheme() {
    try {
      return global.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (_) {
      return "light";
    }
  }

  function stored() {
    try {
      var t = localStorage.getItem(KEY);
      return t === "light" || t === "dark" ? t : "";
    } catch (_) {
      return "";
    }
  }

  function resolve(explicit) {
    if (isAuth()) return "light";
    if (explicit === "light" || explicit === "dark") return explicit;
    var s = stored();
    if (s) return s;
    if (isPublic() || isApp()) return "dark";
    return systemTheme();
  }

  function apply(theme, persist) {
    var t = resolve(theme);
    root().setAttribute("data-theme", t);
    root().style.colorScheme = t;
    if (persist && !isAuth()) {
      try { localStorage.setItem(KEY, t); } catch (_) {}
    }
    var btn = document.querySelectorAll("[data-ds-theme-toggle]");
    for (var i = 0; i < btn.length; i++) {
      btn[i].setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      btn[i].setAttribute("title", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    return t;
  }

  function toggle() {
    var cur = root().getAttribute("data-theme") === "dark" ? "dark" : "light";
    return apply(cur === "dark" ? "light" : "dark", true);
  }

  function boot() {
    apply(stored() || undefined, false);
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest("[data-ds-theme-toggle]");
      if (!t) return;
      e.preventDefault();
      toggle();
    });
    try {
      var mq = global.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (!stored() && !isAuth() && !isPublic()) apply(undefined, false);
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (_) {}
  }

  global.DmaTheme = {
    apply: apply,
    toggle: toggle,
    resolve: resolve,
    stored: stored,
    key: KEY,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
