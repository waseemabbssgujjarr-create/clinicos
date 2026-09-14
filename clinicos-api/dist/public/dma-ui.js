/**
 * ClinicOS shared UI — drawer, modal, tabs, toast, confirm.
 * Consumes dma-design-system.css. Do not add a second design layer.
 */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function toast(msg, kind) {
    var el = document.createElement("div");
    el.className = "ds-toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2600);
  }

  function copy(text) {
    var t = String(text || "");
    function ok() { toast("Copied", "ok"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(ok).catch(function () { fallback(); });
    }
    function fallback() {
      var i = document.createElement("textarea");
      i.value = t;
      document.body.appendChild(i);
      i.select();
      try { document.execCommand("copy"); ok(); } catch (_) { toast("Copy failed", "err"); }
      document.body.removeChild(i);
    }
    fallback();
  }

  function badge(text, kind) {
    var cls = "ds-badge ds-badge-off";
    if (kind === "ok") cls = "ds-badge sa-badge-ok";
    else if (kind === "warn") cls = "ds-badge sa-badge-warn";
    else if (kind === "danger") cls = "ds-badge ds-badge-danger";
    return '<span class="' + cls + '">' + esc(text) + "</span>";
  }

  function kv(rows) {
    return '<dl class="sa-info-list ds-kv">' + (rows || []).map(function (r) {
      return "<div><dt>" + esc(r[0]) + "</dt><dd>" + (r[2] ? r[1] : esc(r[1] == null ? "—" : r[1])) + "</dd></div>";
    }).join("") + "</dl>";
  }

  function skeleton(n) {
    n = n || 3;
    var rows = "";
    for (var i = 0; i < n; i++) rows += '<div class="ds-skel"></div>';
    return '<div class="ds-skel-wrap" aria-hidden="true">' + rows + "</div>";
  }

  function focusables(container) {
    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true";
    });
  }

  function trapFocus(container, onEscape) {
    var prev = document.activeElement;
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (onEscape) onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      var list = focusables(container);
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return function release() {
      document.removeEventListener("keydown", onKey, true);
      if (prev && typeof prev.focus === "function") {
        try { prev.focus(); } catch (_) {}
      }
    };
  }

  function bindTablist(root) {
    if (!root || root.dataset.tabKeys === "1") return;
    root.dataset.tabKeys = "1";
    if (!root.getAttribute("role")) root.setAttribute("role", "tablist");
    root.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
      var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"], button[data-t], button[data-tab], button[data-v]'));
      if (!tabs.length) tabs = Array.prototype.slice.call(root.querySelectorAll("button"));
      if (!tabs.length) return;
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) i = tabs.findIndex(function (t) { return t.classList.contains("active"); });
      if (e.key === "Home") i = 0;
      else if (e.key === "End") i = tabs.length - 1;
      else i = e.key === "ArrowRight" ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
      e.preventDefault();
      tabs[i].focus();
      tabs[i].click();
    });
  }

  function closeExisting(id) {
    var existing = document.getElementById(id);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function drawer(opts) {
    opts = opts || {};
    closeExisting("ds-drawer");
    var wrap = document.createElement("div");
    wrap.id = "ds-drawer";
    wrap.className = "ds-drawer" + (opts.wide ? " wide" : "");
    var tabsHtml = "";
    if (opts.tabs && opts.tabs.length) {
      tabsHtml = '<div class="ds-tabs ds-drawer-tabs">' + opts.tabs.map(function (t, i) {
        return '<button type="button" data-tab="' + esc(t.id) + '" class="' + (i === 0 ? "active" : "") + '">' + esc(t.label) + "</button>";
      }).join("") + "</div>";
    }
    wrap.innerHTML =
      '<div class="ds-drawer-bg" data-close="1"></div>' +
      '<aside class="ds-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="ds-drawer-title">' +
        '<div class="ds-drawer-h"><div><strong id="ds-drawer-title">' + esc(opts.title || "Details") + "</strong>" +
          (opts.subtitle ? '<p class="ds-drawer-sub">' + esc(opts.subtitle) + "</p>" : "") +
        "</div><button type=\"button\" class=\"ds-btn ds-btn-outline ds-btn-sm\" data-close=\"1\" aria-label=\"Close details\">Close</button></div>" +
        tabsHtml +
        '<div class="ds-drawer-b">' + (opts.html || skeleton(4)) + "</div>" +
        (opts.footer ? '<div class="ds-drawer-f">' + opts.footer + "</div>" : '<div class="ds-drawer-f" style="display:none"></div>') +
      "</aside>";
    document.body.appendChild(wrap);
    document.body.classList.add("ds-drawer-open");
    var release = trapFocus(wrap, close);
    requestAnimationFrame(function () {
      wrap.classList.add("open");
      var focusEl = wrap.querySelector(".ds-drawer-panel button, .ds-drawer-panel a, .ds-drawer-panel input");
      if (focusEl && focusEl.focus) focusEl.focus();
    });

    var api = {
      el: wrap,
      body: wrap.querySelector(".ds-drawer-b"),
      footerEl: wrap.querySelector(".ds-drawer-f"),
      close: close,
      setBody: function (html) { api.body.innerHTML = html; },
      setFooter: function (html) {
        api.footerEl.style.display = html ? "flex" : "none";
        api.footerEl.innerHTML = html || "";
      },
      setTitle: function (t, sub) {
        var strong = wrap.querySelector(".ds-drawer-h strong");
        if (strong) strong.textContent = t || "";
        var p = wrap.querySelector(".ds-drawer-sub");
        if (sub) {
          if (!p) {
            p = document.createElement("p");
            p.className = "ds-drawer-sub";
            wrap.querySelector(".ds-drawer-h div").appendChild(p);
          }
          p.textContent = sub;
        }
      }
    };

    function close() {
      if (release) release();
      wrap.classList.remove("open");
      document.body.classList.remove("ds-drawer-open");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 180);
      if (opts.onClose) opts.onClose();
    }

    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) close();
    });

    if (opts.tabs && opts.onTab) {
      var tabRoot = wrap.querySelector(".ds-drawer-tabs");
      if (tabRoot) bindTablist(tabRoot);
      wrap.querySelectorAll(".ds-drawer-tabs button").forEach(function (b, i) {
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", i === 0 ? "true" : "false");
        b.addEventListener("click", function () {
          wrap.querySelectorAll(".ds-drawer-tabs button").forEach(function (x) {
            x.classList.toggle("active", x === b);
            x.setAttribute("aria-selected", x === b ? "true" : "false");
          });
          opts.onTab(b.getAttribute("data-tab"), api);
        });
      });
      opts.onTab(opts.tabs[0].id, api);
    }
    return api;
  }

  function modal(opts) {
    opts = opts || {};
    closeExisting("ds-modal");
    var wrap = document.createElement("div");
    wrap.id = "ds-modal";
    wrap.className = "ds-modal-wrap";
    wrap.innerHTML =
      '<div class="ds-modal-bg" data-close="1"></div>' +
      '<div class="ds-modal" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title">' +
        '<div class="ds-drawer-h"><strong id="ds-modal-title">' + esc(opts.title || "") + '</strong>' +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-close="1" aria-label="Close dialog">Close</button></div>' +
        '<div class="ds-modal-b">' + (opts.html || "") + "</div>" +
        (opts.footer ? '<div class="ds-drawer-f">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(wrap);
    var release;
    function close() {
      if (release) release();
      wrap.classList.remove("open");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 160);
    }
    release = trapFocus(wrap, close);
    requestAnimationFrame(function () {
      wrap.classList.add("open");
      var focusEl = wrap.querySelector(".ds-modal button, .ds-modal input, .ds-modal textarea");
      if (focusEl && focusEl.focus) focusEl.focus();
    });
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) close();
    });
    return { el: wrap, close: close, body: wrap.querySelector(".ds-modal-b") };
  }

  function confirmDlg(message, onYes) {
    var m = modal({
      title: "Confirm",
      html: "<p class=\"cos-hint\" style=\"margin:0;font-size:0.9375rem;color:var(--ds-text)\">" + esc(message) + "</p>",
      footer: '<button type="button" class="ds-btn ds-btn-outline" data-close="1">Cancel</button>' +
        '<button type="button" class="ds-btn ds-btn-danger" id="ds-confirm-yes">Confirm</button>'
    });
    var yes = m.el.querySelector("#ds-confirm-yes");
    if (yes) yes.onclick = function () { m.close(); if (onYes) onYes(); };
    return m;
  }

  function display(val, fallback) {
    if (val == null || val === "" || val === "undefined" || val === "null") {
      return fallback == null ? "Unavailable" : String(fallback);
    }
    if (typeof val === "number" && !isFinite(val)) {
      return fallback == null ? "Unavailable" : String(fallback);
    }
    if (typeof val === "object") {
      return fallback == null ? "Unavailable" : String(fallback);
    }
    return String(val);
  }

  global.DmaUI = {
    esc: esc,
    toast: toast,
    copy: copy,
    badge: badge,
    kv: kv,
    skeleton: skeleton,
    drawer: drawer,
    modal: modal,
    confirm: confirmDlg,
    display: display,
    trapFocus: trapFocus,
    bindTablist: bindTablist
  };

  document.addEventListener("focusin", function (e) {
    var list = e.target && e.target.closest && e.target.closest(".dma-tabs, .ds-tabs, .cos-settings-nav");
    if (list) bindTablist(list);
  });
})(window);
