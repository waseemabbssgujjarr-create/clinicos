/**
 * Superadmin clinics — table stays visible; row click opens a detail drawer.
 */
(function () {
  if (!window.DmaAdminShell) return;
  if (!DmaAdminShell.initStaticPage("/superadmin/clinics/")) return;

  var UI = window.DmaUI || {};
  var esc = UI.esc || function (s) { return String(s || ""); };
  var toast = UI.toast || function (m) { window.alert(m); };

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
    if (st === "CONNECTED" || st === "LIVE" || st === "ACTIVE") return { t: "Connected", kind: "ok" };
    if (w.phoneNumber || w.phoneNumberId) return { t: "Partial", kind: "warn" };
    return { t: "Off", kind: "off" };
  }
  function aiLabel(c) {
    return c.aiEnabled ? { t: "On", kind: "ok" } : { t: "Off", kind: "off" };
  }
  function clinicStatus(c) {
    if (!c.isActive) return { t: "Suspended", kind: "danger" };
    var ps = String(c.planStatus || "").toUpperCase();
    if (ps === "PAST_DUE") return { t: "Past due", kind: "warn" };
    if (ps === "CANCELLED") return { t: "Cancelled", kind: "off" };
    return { t: "Active", kind: "ok" };
  }
  function badge(info) { return UI.badge(info.t, info.kind); }

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

  function fmt(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString(); } catch (_) { return String(iso); }
  }

  function openClinicDrawer(id) {
    var d = UI.drawer({
      title: "Organization",
      subtitle: "Loading…",
      wide: true,
      tabs: [
        { id: "overview", label: "Overview" },
        { id: "profile", label: "Profile" },
        { id: "whatsapp", label: "WhatsApp" },
        { id: "ai", label: "AI" },
        { id: "subscription", label: "Subscription" },
        { id: "activity", label: "Activity" }
      ],
      footer: '<a class="ds-btn ds-btn-outline" href="/superadmin/clinics/' + encodeURIComponent(id) + '/">Open full workspace</a>',
      onTab: function (tab, api) { renderTab(tab, api); }
    });
    var clinic = null;

    function renderTab(tab, api) {
      if (!clinic) { api.setBody(UI.skeleton(5)); return; }
      var wa = clinic.whatsapp || {};
      var st = clinicStatus(clinic);
      if (tab === "billing") tab = "subscription";
      if (tab === "users") {
        api.setBody(UI.kv([
          ["Owner", clinic.ownerName],
          ["Staff", (clinic._count && clinic._count.staff) || 0],
          ["Patients", (clinic._count && clinic._count.patients) || 0]
        ]));
        api.setFooter('<a class="ds-btn ds-btn-primary" href="/superadmin/clinics/' + encodeURIComponent(id) + '/">Open workspace</a>');
        return;
      }
      if (tab === "overview") {
        api.setBody(
          UI.kv([
            ["Status", badge(st), true],
            ["Owner", clinic.ownerName],
            ["Email", clinic.email],
            ["Phone", clinic.phone],
            ["WhatsApp", waLabel(clinic).t],
            ["AI", aiLabel(clinic).t],
            ["Patients", (clinic._count && clinic._count.patients) || 0],
            ["Appointments", (clinic._count && clinic._count.appointments) || 0],
            ["Plan", (clinic.plan || "—") + " · " + (clinic.planStatus || "")]
          ])
        );
      } else if (tab === "profile") {
        api.setBody(
          '<div class="dma-field"><label>Clinic name</label><input id="ed-name" value="' + esc(clinic.name) + '"></div>' +
          '<div class="dma-field"><label>Owner</label><input id="ed-owner" value="' + esc(clinic.ownerName) + '"></div>' +
          '<div class="dma-field"><label>Email</label><input id="ed-email" value="' + esc(clinic.email) + '"></div>' +
          '<div class="dma-field"><label>Phone</label><input id="ed-phone" value="' + esc(clinic.phone) + '"></div>' +
          '<div class="dma-field"><label>Specialty</label><input id="ed-spec" value="' + esc(clinic.specialty) + '"></div>'
        );
        api.setFooter(
          '<button type="button" class="ds-btn ds-btn-outline" data-close="1">Cancel</button>' +
          '<button type="button" class="ds-btn ds-btn-primary" id="ed-save">Save</button>'
        );
        var save = document.getElementById("ed-save");
        if (save) save.onclick = function () {
          save.disabled = true;
          DmaAdminShell.api("/api/superadmin/clinics/" + id, {
            method: "PATCH",
            body: {
              name: document.getElementById("ed-name").value,
              ownerName: document.getElementById("ed-owner").value,
              email: document.getElementById("ed-email").value,
              phone: document.getElementById("ed-phone").value,
              specialty: document.getElementById("ed-spec").value
            }
          }).then(function (c) {
            clinic = c;
            toast("Saved", "ok");
            api.setTitle(c.name, c.ownerName);
            load();
          }).catch(function (e) { toast(e.message || "Save failed", "err"); })
            .finally(function () { save.disabled = false; });
        };
      } else if (tab === "whatsapp") {
        api.setBody(UI.kv([
          ["Status", wa.connectionStatus || "Not connected"],
          ["Phone", wa.phoneNumber || wa.displayName],
          ["WABA", wa.wabaId],
          ["Method", wa.connectionMethod]
        ]));
        api.setFooter('<a class="ds-btn ds-btn-outline" href="/superadmin/clinics/' + encodeURIComponent(id) + '/">Open workspace</a>');
      } else if (tab === "ai") {
        api.setBody(UI.kv([
          ["AI receptionist", clinic.aiEnabled ? "Enabled" : "Disabled"],
          ["Language", clinic.aiLanguage]
        ]));
        api.setFooter('<a class="ds-btn ds-btn-outline" href="/superadmin/clinics/' + encodeURIComponent(id) + '/">Open workspace</a>');
      } else if (tab === "subscription") {
        api.setBody(
          '<div class="dma-field"><label>Plan</label><select id="plan-select">' +
            ["TRIAL", "STARTER", "PRO", "ENTERPRISE"].map(function (p) {
              return '<option value="' + p + '"' + (clinic.plan === p ? " selected" : "") + ">" + p + "</option>";
            }).join("") + "</select></div>" +
          '<div class="dma-field"><label>Status</label><select id="plan-status-select">' +
            ["ACTIVE", "PAST_DUE", "CANCELLED"].map(function (p) {
              return '<option value="' + p + '"' + (clinic.planStatus === p ? " selected" : "") + ">" + p + "</option>";
            }).join("") + "</select></div>"
        );
        api.setFooter('<button type="button" class="ds-btn ds-btn-primary" id="save-plan-btn">Save plan</button>');
        var sp = document.getElementById("save-plan-btn");
        if (sp) sp.onclick = function () {
          DmaAdminShell.api("/api/superadmin/clinics/" + id + "/plan", {
            method: "PATCH",
            body: {
              plan: document.getElementById("plan-select").value,
              planStatus: document.getElementById("plan-status-select").value
            }
          }).then(function () { toast("Plan updated", "ok"); load(); })
            .catch(function (e) { toast(e.message || "Update failed", "err"); });
        };
      } else if (tab === "activity") {
        api.setBody(UI.skeleton(4));
        DmaAdminShell.api("/api/superadmin/clinics/" + id + "/activity").then(function (d) {
          var list = d.data || [];
          api.setBody(list.length
            ? '<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>When</th><th>Action</th></tr></thead><tbody>' +
              list.slice(0, 20).map(function (l) {
                return "<tr><td>" + esc(fmt(l.createdAt)) + "</td><td>" + esc(l.action) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<p class="ds-empty">No activity yet.</p>');
        }).catch(function (e) { api.setBody('<p class="ds-error">' + esc(e.message) + "</p>"); });
      }

      if (tab !== "profile" && tab !== "subscription") {
        api.setFooter(
          '<button type="button" class="ds-btn ds-btn-outline" data-act="toggle">' + (clinic.isActive ? "Suspend" : "Activate") + "</button>" +
          '<button type="button" class="ds-btn ds-btn-danger" data-act="delete">Delete</button>' +
          '<a class="ds-btn ds-btn-primary" href="/superadmin/clinics/' + encodeURIComponent(id) + '/">Open full workspace</a>'
        );
        api.footerEl.onclick = function (e) {
          var act = e.target.getAttribute("data-act");
          if (act === "toggle") {
            var next = !clinic.isActive;
            DmaAdminShell.api("/api/superadmin/clinics/" + id + "/status", { method: "PATCH", body: { isActive: next } })
              .then(function () { toast("Updated", "ok"); clinic.isActive = next; load(); d.close(); })
              .catch(function (err) { toast(err.message || "Failed", "err"); });
          }
          if (act === "delete") {
            if (!confirm("Permanently delete this clinic?")) return;
            DmaAdminShell.api("/api/superadmin/clinics/" + id, { method: "DELETE" })
              .then(function () { toast("Deleted", "ok"); d.close(); load(); })
              .catch(function (err) { toast(err.message || "Failed", "err"); });
          }
        };
      }
    }

    DmaAdminShell.api("/api/superadmin/clinics/" + id).then(function (c) {
      clinic = c;
      d.setTitle(c.name || "Clinic", c.ownerName || c.email || "");
      var active = d.el.querySelector(".ds-drawer-tabs button.active");
      renderTab(active ? active.getAttribute("data-tab") : "overview", d);
    }).catch(function (e) {
      d.setBody('<p class="ds-error">' + esc(e.message || "Could not load clinic.") + "</p>");
    });
  }

  function actMenu(c) {
    return '<div class="ds-actions">' +
      '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" data-act="open" data-id="' + esc(c.id) + '">Open</button>' +
      '<button type="button" class="ds-btn ds-btn-ghost ds-btn-sm" data-act="toggle" data-id="' + esc(c.id) + '">' + (c.isActive ? 'Suspend' : 'Reactivate') + '</button>' +
      '<a class="ds-btn ds-btn-ghost ds-btn-sm" href="/superadmin/clinics/' + encodeURIComponent(c.id) + '/">Workspace</a>' +
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
      var patients = (c._count && c._count.patients) || 0;
      var appts = (c._count && c._count.appointments) || 0;
      return '<tr data-id="' + esc(c.id) + '">' +
        "<td><strong>" + esc(c.name) + "</strong><div class=\"ds-clinic-meta\">" + esc(c.specialty || "") + "</div></td>" +
        "<td>" + esc(c.ownerName || "—") + "</td>" +
        "<td>" + esc(c.email || "—") + (c.phone ? "<div class=\"ds-clinic-meta\">" + esc(c.phone) + "</div>" : "") + "</td>" +
        "<td>" + badge(waLabel(c)) + "</td>" +
        "<td>" + badge(aiLabel(c)) + "</td>" +
        "<td>" + patients + "</td><td>" + appts + "</td>" +
        "<td>" + esc(c.plan || "—") + "</td>" +
        "<td>" + badge(clinicStatus(c)) + "</td>" +
        "<td>" + actMenu(c) + "</td></tr>";
    }).join("");
    cardsEl.innerHTML = list.map(function (c) {
      return '<article class="ds-clinic-card" data-id="' + esc(c.id) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><h3>' + esc(c.name) + "</h3>" + badge(clinicStatus(c)) + "</div>" +
        '<div class="ds-clinic-meta">' + esc(c.ownerName || "—") + " · " + esc(c.email || "—") + "</div>" +
        actMenu(c) + "</article>";
    }).join("");
    var pages = Math.max(1, Math.ceil(total / limit));
    pagerEl.innerHTML =
      "<span>Page " + page + " of " + pages + "</span>" +
      '<div class="ds-actions">' +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" id="prev"' + (page <= 1 ? " disabled" : "") + ">Previous</button>" +
        '<button type="button" class="ds-btn ds-btn-outline ds-btn-sm" id="next"' + (page >= pages ? " disabled" : "") + ">Next</button></div>";
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
    if (e.target.closest("a")) return;
    if (btn && btn.getAttribute("data-act") === "open") {
      e.preventDefault();
      e.stopPropagation();
      openClinicDrawer(btn.getAttribute("data-id"));
      return;
    }
    if (btn && btn.getAttribute("data-act") === "toggle") {
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute("data-id");
      var row = rows.filter(function (c) { return c.id === id; })[0];
      if (!row) return;
      var next = !row.isActive;
      DmaAdminShell.api("/api/superadmin/clinics/" + id + "/status", { method: "PATCH", body: { isActive: next } })
        .then(function () { toast(next ? "Reactivated" : "Suspended", "ok"); load(); })
        .catch(function (err) { toast(err.message || "Failed", "err"); });
      return;
    }
    if (row) openClinicDrawer(row.getAttribute("data-id"));
  }
  tableBody.addEventListener("click", onAction);
  cardsEl.addEventListener("click", onAction);
  load();
})();
