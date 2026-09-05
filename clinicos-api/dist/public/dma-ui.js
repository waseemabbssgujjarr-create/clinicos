/**
 * ClinicOS shared UI primitives — toast, drawer, confirm, escape.
 * Consumes dma-design-system.css tokens/classes.
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
    }, 2800);
  }

  function drawer(opts) {
    opts = opts || {};
    var existing = document.getElementById("ds-drawer");
    if (existing) existing.parentNode.removeChild(existing);
    var wrap = document.createElement("div");
    wrap.id = "ds-drawer";
    wrap.className = "ds-drawer";
    wrap.innerHTML =
      '<div class="ds-drawer-bg" data-close="1"></div>' +
      '<aside class="ds-drawer-panel" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || "Details") + '">' +
        '<div class="ds-drawer-h"><strong>' + esc(opts.title || "Details") + "</strong>" +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-close="1">Close</button></div>' +
        '<div class="ds-drawer-b">' + (opts.html || "") + "</div>" +
      "</aside>";
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add("open"); });
    function close() {
      wrap.classList.remove("open");
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 200);
    }
    wrap.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) close();
    });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onEsc);
        close();
      }
    });
    return { el: wrap, close: close, body: wrap.querySelector(".ds-drawer-b") };
  }

  global.DmaUI = { esc: esc, toast: toast, drawer: drawer };
})(window);
