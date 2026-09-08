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
      '<aside class="ds-drawer-panel" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || "Details") + '">' +
        '<div class="ds-drawer-h"><div><strong>' + esc(opts.title || "Details") + "</strong>" +
          (opts.subtitle ? '<p class="ds-drawer-sub">' + esc(opts.subtitle) + "</p>" : "") +
        "</div><button type=\"button\" class=\"ds-btn ds-btn-outline ds-btn-sm\" data-close=\"1\" aria-label=\"Close\">Close</button></div>" +
        tabsHtml +
        '<div class="ds-drawer-b">' + (opts.html || skeleton(4)) + "</div>" +
        (opts.footer ? '<div class="ds-drawer-f">' + opts.footer + "</div>" : '<div class="ds-drawer-f" style="display:none"></div>') +
      "</aside>";
    document.body.appendChild(wrap);
    document.body.classList.add("ds-drawer-open");
    requestAnimationFrame(function () { wrap.classList.add("open"); });

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
      wrap.classList.remove("open");
      document.body.classList.remove("ds-drawer-open");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 180);
      if (opts.onClose) opts.onClose();
    }

    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) close();
    });
    function onEsc(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onEsc);
        close();
      }
    }
    document.addEventListener("keydown", onEsc);

    if (opts.tabs && opts.onTab) {
      wrap.querySelectorAll(".ds-drawer-tabs button").forEach(function (b) {
        b.addEventListener("click", function () {
          wrap.querySelectorAll(".ds-drawer-tabs button").forEach(function (x) {
            x.classList.toggle("active", x === b);
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
      '<div class="ds-modal" role="dialog" aria-modal="true">' +
        '<div class="ds-drawer-h"><strong>' + esc(opts.title || "") + '</strong>' +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-close="1">Close</button></div>' +
        '<div class="ds-modal-b">' + (opts.html || "") + "</div>" +
        (opts.footer ? '<div class="ds-drawer-f">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add("open"); });
    function close() {
      wrap.classList.remove("open");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 160);
    }
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
    display: display
  };
})(window);
