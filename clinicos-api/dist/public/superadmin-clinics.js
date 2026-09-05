/**
 * Superadmin clinics directory — table on desktop, cards on mobile.
 * Uses GET /api/superadmin/clinics (search, page, limit).
 */
(function () {
  if (!window.DmaAdminShell) return;
  if (!DmaAdminShell.initStaticPage("/superadmin/clinics/")) return;

  var esc = (window.DmaUI && DmaUI.esc) ? DmaUI.esc : function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  };
  var toast = (window.DmaUI && DmaUI.toast) ? DmaUI.toast : function (m) { window.alert(m); };

  var page = 1;
  var limit = 25;
  var search = "";
  var plan = "";
  var status = "";
  var sortKey = "createdAt";
  var sortDir = "desc";
  var rows = [];
  var total = 0;

  var searchEl = document.getElementById("q");
  var planEl = document.getElementById("plan");
  var statusEl = document.getElementById("status");
  var tableBody = document.getElementById("tbody");
  var cardsEl = document.getElementById("cards");
  var metaEl = document.getElementById("meta");
  var pagerEl = document.getElementById("pager");
  var stateEl = document.getElementById("state");

  function waLabel(c) {
    var w = c.whatsapp || {};
    var st = String(w.connectionStatus || "").toUpperCase();
    if (st === "CONNECTED" || st === "LIVE") return { t: "Connected", cls: "sa-badge-ok" };
    if (w.phoneNumber || w.phoneNumberId) return { t: "Partial", cls: "sa-badge-warn" };
    return { t: "Off", cls: "ds-badge-off" };
  }
  function aiLabel(c) {
    return c.aiEnabled ? { t: "On", cls: "sa-badge-ok" } : { t: "Off", cls: "ds-badge-off" };
  }
  function clinicStatus(c) {
    if (!c.isActive) return { t: "Suspended", cls: "ds-badge-danger" };
    var ps = String(c.planStatus || "").toUpperCase();
    if (ps === "PAST_DUE") return { t: "Past due", cls: "sa-badge-warn" };
    if (ps === "CANCELLED") return { t: "Cancelled", cls: "ds-badge-off" };
    return { t: "Active", cls: "sa-badge-ok" };
  }

  function sortRows(list) {
    var copy = list.slice();
    copy.sort(function (a, b) {
      var va, vb;
      if (sortKey === "patients") { va = (a._count && a._count.patients) || 0; vb = (b._count && b._count.patients) || 0; }
      else if (sortKey === "appointments") { va = (a._count && a._count.appointments) || 0; vb = (b._count && b._count.appointments) || 0; }
      else if (sortKey === "name") { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
      else { va = a[sortKey] || ""; vb = b[sortKey] || ""; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }

  function openClinic(id) {
    location.href = "/superadmin/clinics/" + encodeURIComponent(id) + "/";
  }

  function actMenu(c) {
    return '<div class="ds-actions">' +
      '<a class="ds-btn ds-btn-outline ds-btn-sm" href="/superadmin/clinics/' + encodeURIComponent(c.id) + '/">Open</a>' +
      '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-act="toggle" data-id="' + esc(c.id) + '">' +
        (c.isActive ? "Suspend" : "Activate") + "</button>" +
      '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-act="delete" data-id="' + esc(c.id) + '">Delete</button>' +
      "</div>";
  }

  function render() {
    var list = sortRows(rows);
    if (!list.length) {
      tableBody.innerHTML = "";
      cardsEl.innerHTML = "";
      stateEl.style.display = "block";
      stateEl.className = "ds-empty";
      stateEl.textContent = search || plan || status ? "No clinics match these filters." : "No clinics yet.";
      pagerEl.innerHTML = "";
      metaEl.textContent = "0 clinics";
      return;
    }
    stateEl.style.display = "none";
    metaEl.textContent = total + " clinic" + (total === 1 ? "" : "s");

    tableBody.innerHTML = list.map(function (c) {
      var wa = waLabel(c);
      var ai = aiLabel(c);
      var st = clinicStatus(c);
      var patients = (c._count && c._count.patients) || 0;
      var appts = (c._count && c._count.appointments) || 0;
      return '<tr data-id="' + esc(c.id) + '">' +
        "<td><strong>" + esc(c.name) + "</strong><div class=\"ds-clinic-meta\">" + esc(c.specialty || "") + "</div></td>" +
        "<td>" + esc(c.ownerName || "—") + "</td>" +
        "<td>" + esc(c.email || "—") + (c.phone ? "<div class=\"ds-clinic-meta\">" + esc(c.phone) + "</div>" : "") + "</td>" +
        '<td><span class="ds-badge ' + wa.cls + '">' + wa.t + "</span></td>" +
        '<td><span class="ds-badge ' + ai.cls + '">' + ai.t + "</span></td>" +
        "<td>" + patients + "</td>" +
        "<td>" + appts + "</td>" +
        "<td>" + esc(c.plan || "—") + "</td>" +
        '<td><span class="ds-badge ' + st.cls + '">' + st.t + "</span></td>" +
        "<td>" + actMenu(c) + "</td>" +
        "</tr>";
    }).join("");

    cardsEl.innerHTML = list.map(function (c) {
      var wa = waLabel(c);
      var ai = aiLabel(c);
      var st = clinicStatus(c);
      return '<article class="ds-clinic-card" data-id="' + esc(c.id) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
          "<h3>" + esc(c.name) + "</h3>" +
          '<span class="ds-badge ' + st.cls + '">' + st.t + "</span></div>" +
        '<div class="ds-clinic-meta">' + esc(c.ownerName || "—") + " · " + esc(c.email || "—") + "</div>" +
        '<div class="ds-clinic-metrics">' +
          "<span>WhatsApp: " + wa.t + "</span>" +
          "<span>AI: " + ai.t + "</span>" +
          "<span>Patients: " + ((c._count && c._count.patients) || 0) + "</span>" +
          "<span>Appts: " + ((c._count && c._count.appointments) || 0) + "</span>" +
        "</div>" + actMenu(c) + "</article>";
    }).join("");

    var pages = Math.max(1, Math.ceil(total / limit));
    pagerEl.innerHTML =
      '<span>Page ' + page + " of " + pages + "</span>" +
      '<div class="ds-actions">' +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" id="prev"' + (page <= 1 ? " disabled" : "") + ">Previous</button>" +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" id="next"' + (page >= pages ? " disabled" : "") + ">Next</button>" +
      "</div>";
    var prev = document.getElementById("prev");
    var next = document.getElementById("next");
    if (prev) prev.onclick = function () { if (page > 1) { page -= 1; load(); } };
    if (next) next.onclick = function () { if (page < pages) { page += 1; load(); } };
  }

  function load() {
    stateEl.style.display = "block";
    stateEl.className = "ds-loading";
    stateEl.textContent = "Loading clinics…";
    var q = "/api/superadmin/clinics?page=" + page + "&limit=" + limit;
    if (search) q += "&search=" + encodeURIComponent(search);
    if (plan) q += "&plan=" + encodeURIComponent(plan);
    if (status) q += "&status=" + encodeURIComponent(status);
    DmaAdminShell.api(q).then(function (data) {
      rows = data.data || [];
      total = data.total || rows.length;
      render();
    }).catch(function (err) {
      tableBody.innerHTML = "";
      cardsEl.innerHTML = "";
      pagerEl.innerHTML = "";
      stateEl.style.display = "block";
      stateEl.className = "ds-error";
      stateEl.innerHTML = (err.message || "Could not load clinics.") +
        ' <button type="button" class="ds-btn ds-btn-primary ds-btn-sm" id="retry">Retry</button>';
      var retry = document.getElementById("retry");
      if (retry) retry.onclick = load;
    });
  }

  document.getElementById("filters").addEventListener("submit", function (e) {
    e.preventDefault();
    search = (searchEl.value || "").trim();
    plan = planEl.value;
    status = statusEl.value;
    page = 1;
    load();
  });

  document.querySelectorAll("th[data-sort]").forEach(function (th) {
    th.style.cursor = "pointer";
    th.addEventListener("click", function () {
      var key = th.getAttribute("data-sort");
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortKey = key; sortDir = "asc"; }
      render();
    });
  });

  function onAction(e) {
    var btn = e.target.closest("[data-act]");
    var row = e.target.closest("[data-id]");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute("data-id");
      var clinic = rows.filter(function (c) { return c.id === id; })[0];
      if (!clinic) return;
      if (btn.getAttribute("data-act") === "toggle") {
        var next = !clinic.isActive;
        if (!confirm(next ? "Activate this clinic?" : "Suspend this clinic?")) return;
        DmaAdminShell.api("/api/superadmin/clinics/" + id + "/status", { method: "PATCH", body: { isActive: next } })
          .then(function () { toast("Clinic updated", "ok"); load(); })
          .catch(function (err) { toast(err.message || "Update failed", "err"); });
        return;
      }
      if (btn.getAttribute("data-act") === "delete") {
        if (!confirm("Permanently delete \"" + (clinic.name || "this clinic") + "\"?")) return;
        if (!confirm("This cannot be undone. Delete forever?")) return;
        DmaAdminShell.api("/api/superadmin/clinics/" + id, { method: "DELETE" })
          .then(function () { toast("Clinic deleted", "ok"); load(); })
          .catch(function (err) { toast(err.message || "Delete failed", "err"); });
        return;
      }
    }
    if (row && !e.target.closest("a,button")) openClinic(row.getAttribute("data-id"));
  }
  tableBody.addEventListener("click", onAction);
  cardsEl.addEventListener("click", onAction);

  load();
})();
