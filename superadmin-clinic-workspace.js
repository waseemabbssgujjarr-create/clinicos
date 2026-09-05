/**
 * Superadmin clinic workspace — tabbed inspect/edit on /superadmin/clinics/:id
 */
(function () {
  if (!/\/superadmin\/clinics\//.test(location.pathname)) return;

  var TABS = [
    ["overview", "Overview"],
    ["profile", "Profile"],
    ["whatsapp", "WhatsApp"],
    ["ai", "AI"],
    ["training", "Training"],
    ["patients", "Patients"],
    ["appointments", "Appointments"],
    ["messages", "Messages"],
    ["subscription", "Subscription"],
    ["activity", "Activity"]
  ];

  function clinicIdFromLocation() {
    var q = new URLSearchParams(location.search).get("id");
    if (q) return q;
    var parts = location.pathname.replace(/\/+$/, "").split("/");
    var last = parts[parts.length - 1];
    if (!last || last === "detail" || last === "clinics") return null;
    return last;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function fmt(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString(); } catch (_) { return String(iso); }
  }

  function boot() {
    if (!window.DmaAdminShell) return;
    var id = clinicIdFromLocation();
    var host = document.getElementById("cos-workspace") || document.getElementById("content");
    if (!id || !host) return;

    var tabsEl = document.createElement("div");
    tabsEl.className = "dma-tabs";
    tabsEl.id = "cos-clinic-tabs";
    tabsEl.innerHTML = TABS.map(function (t, i) {
      return '<button type="button" data-t="' + t[0] + '" class="' + (i === 0 ? "active" : "") + '">' + t[1] + "</button>";
    }).join("");
    var body = document.createElement("div");
    body.id = "cos-clinic-tab";
    host.appendChild(tabsEl);
    host.appendChild(body);

    var tab = "overview";
    var clinic = null;

    function api(path) { return DmaAdminShell.api(path); }

    function setTab(next) {
      tab = next;
      tabsEl.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-t") === tab);
      });
      render();
    }
    tabsEl.onclick = function (e) {
      var b = e.target.closest("button");
      if (b) setTab(b.getAttribute("data-t"));
    };

    function kv(label, value) {
      return "<div><dt>" + esc(label) + "</dt><dd>" + (value || "—") + "</dd></div>";
    }

    function render() {
      if (!clinic) { body.innerHTML = "<p class='cos-hint'>Loading…</p>"; return; }
      if (tab === "overview") {
        var wa = clinic.whatsapp || {};
        var warn = [];
        if (!clinic.isActive) warn.push("Clinic is suspended.");
        if (!wa.phoneNumberId) warn.push("WhatsApp is not connected.");
        if (!clinic.aiEnabled) warn.push("AI receptionist is off.");
        if (clinic.lastError) warn.push("Recent AI error: " + (clinic.lastError.error || clinic.lastError.action || ""));
        body.innerHTML =
          (warn.length ? '<div class="dma-banner warn">' + esc(warn.join(" ")) + "</div>" : "") +
          '<dl class="sa-info-list">' +
          kv("Created", fmt(clinic.createdAt)) +
          kv("Last activity", fmt(clinic.lastActivityAt || clinic.updatedAt)) +
          kv("Plan", esc(clinic.plan) + " · " + esc(clinic.planStatus)) +
          kv("WhatsApp", wa.connectionStatus ? esc(wa.connectionStatus) + " · " + esc(wa.phoneNumber || wa.displayName || "") : "Not connected") +
          kv("AI", clinic.aiEnabled ? "Enabled · " + esc(clinic.aiLanguage || "") : "Disabled") +
          "</dl>";
      } else if (tab === "profile") {
        body.innerHTML = '<div class="dma-grid-2">' +
          '<div class="dma-field"><label>Clinic name</label><input id="ed-name" value="' + esc(clinic.name) + '"></div>' +
          '<div class="dma-field"><label>Owner</label><input id="ed-owner" value="' + esc(clinic.ownerName) + '"></div>' +
          '<div class="dma-field"><label>Email</label><input id="ed-email" value="' + esc(clinic.email) + '"></div>' +
          '<div class="dma-field"><label>Phone</label><input id="ed-phone" value="' + esc(clinic.phone) + '"></div>' +
          '<div class="dma-field"><label>Specialty</label><input id="ed-spec" value="' + esc(clinic.specialty) + '"></div>' +
          '<div class="dma-field"><label>Timezone</label><input id="ed-tz" value="' + esc(clinic.timezone) + '"></div>' +
          '</div><div class="dma-field"><label>Address</label><textarea id="ed-addr" rows="3">' + esc(clinic.address) + "</textarea></div>" +
          '<div class="cos-savebar"><button type="button" class="sa-btn-primary" id="ed-save">Save profile</button></div>';
        document.getElementById("ed-save").onclick = function () {
          var payload = {
            name: document.getElementById("ed-name").value,
            ownerName: document.getElementById("ed-owner").value,
            email: document.getElementById("ed-email").value,
            phone: document.getElementById("ed-phone").value,
            specialty: document.getElementById("ed-spec").value,
            timezone: document.getElementById("ed-tz").value,
            address: document.getElementById("ed-addr").value,
          };
          DmaAdminShell.api("/api/superadmin/clinics/" + id, { method: "PATCH", body: payload })
            .then(function (d) {
              Object.assign(clinic, d);
              alert("Saved.");
            })
            .catch(function (e) { alert(e.message || "Save failed"); });
        };
      } else if (tab === "whatsapp") {
        var w = clinic.whatsapp || {};
        body.innerHTML = '<dl class="sa-info-list">' +
          kv("Status", esc(w.connectionStatus || "not connected")) +
          kv("Method", esc(w.connectionMethod)) +
          kv("Phone", esc(w.phoneNumber || w.displayName)) +
          kv("Phone number ID", esc(w.phoneNumberId)) +
          kv("WABA", esc(w.wabaId)) +
          kv("Webhook", esc(w.webhookStatus)) +
          kv("Connected", fmt(w.connectedAt)) +
          kv("Last verified", fmt(w.lastVerifiedAt)) +
          kv("Last error", esc(w.lastError)) +
          "</dl>" +
          (w.phoneNumberId ? '<button type="button" class="sa-btn-outline" id="wa-rev">Revoke connection</button>' : "");
        var rev = document.getElementById("wa-rev");
        if (rev) rev.onclick = function () {
          if (!confirm("Disconnect WhatsApp for this clinic?")) return;
          DmaAdminShell.api("/api/superadmin/whatsapp/clinics/" + id, { method: "DELETE" })
            .then(function () { location.reload(); })
            .catch(function (e) { alert(e.message); });
        };
      } else if (tab === "subscription") {
        body.innerHTML = '<div class="dma-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:560px">' +
          '<div class="dma-field"><label>Plan</label><select class="cos-input" id="plan-select">' +
            ["TRIAL","STARTER","PRO","ENTERPRISE"].map(function (p) {
              return '<option value="' + p + '"' + (clinic.plan === p ? " selected" : "") + ">" + p + "</option>";
            }).join("") +
          "</select></div>" +
          '<div class="dma-field"><label>Plan status</label><select class="cos-input" id="plan-status-select">' +
            ["ACTIVE","PAST_DUE","CANCELLED"].map(function (p) {
              return '<option value="' + p + '"' + (clinic.planStatus === p ? " selected" : "") + ">" + p + "</option>";
            }).join("") +
          "</select></div></div>" +
          '<dl class="sa-info-list">' + kv("Trial ends", fmt(clinic.trialEndsAt)) + kv("Period end", fmt(clinic.currentPeriodEnd)) + "</dl>" +
          '<div class="cos-savebar"><button type="button" class="ds-btn ds-btn-primary" id="save-plan-btn">Save plan</button></div>';
        document.getElementById("save-plan-btn").onclick = function () {
          var plan = document.getElementById("plan-select").value;
          var planStatus = document.getElementById("plan-status-select").value;
          DmaAdminShell.api("/api/superadmin/clinics/" + id + "/plan", { method: "PATCH", body: { plan: plan, planStatus: planStatus } })
            .then(function () {
              clinic.plan = plan;
              clinic.planStatus = planStatus;
              if (window.DmaUI) DmaUI.toast("Plan updated", "ok");
              else alert("Plan updated.");
            })
            .catch(function (e) { alert(e.message || "Update failed"); });
        };
      } else if (tab === "ai" || tab === "training") {
        body.innerHTML = "<p class='cos-hint'>Loading AI configuration…</p>";
        api("/api/superadmin/clinics/" + id + "/ai").then(function (d) {
          var p = (d.profile && d.profile.personality) || {};
          var rules = d.rules || [];
          body.innerHTML = '<dl class="sa-info-list">' +
            kv("Enabled", d.clinic && d.clinic.aiEnabled ? "Yes" : "No") +
            kv("Language", esc(p.language || (d.clinic && d.clinic.aiLanguage))) +
            kv("Tone", esc(p.tone || (d.clinic && d.clinic.aiPersonality))) +
            kv("Custom replies", String(rules.length)) +
            kv("AI logs", String(d.stats && d.stats.logs)) +
            kv("Failures", String(d.stats && d.stats.failures)) +
            "</dl>" +
            (tab === "training" ? "<pre style='white-space:pre-wrap;font-size:12px;background:#F8FAFC;padding:12px;border-radius:8px;border:1px solid #E2E8F0'>" +
              esc(JSON.stringify(d.profile || {}, null, 2).slice(0, 4000)) + "</pre>" : "");
        }).catch(function (e) { body.innerHTML = "<p>" + esc(e.message) + "</p>"; });
      } else if (tab === "patients") {
        loadTable("/api/superadmin/clinics/" + id + "/patients", ["Name", "Phone", "Score", "Active"], function (r) {
          return [r.fullName, r.phone, r.leadScore, r.isActive ? "Yes" : "No"];
        });
      } else if (tab === "appointments") {
        loadTable("/api/superadmin/clinics/" + id + "/appointments", ["When", "Patient", "Treatment", "Status"], function (r) {
          return [fmt(r.dateTime), r.patient && r.patient.fullName, r.treatment, r.status];
        });
      } else if (tab === "messages") {
        loadTable("/api/superadmin/clinics/" + id + "/messages", ["When", "Dir", "Patient", "Body"], function (r) {
          return [fmt(r.createdAt), r.direction, r.patient && r.patient.fullName, String(r.body || "").slice(0, 80)];
        });
      } else if (tab === "activity") {
        body.innerHTML = "<p class='cos-hint'>Loading…</p>";
        api("/api/superadmin/clinics/" + id + "/activity").then(function (d) {
          var rows = d.data || [];
          body.innerHTML = '<div class="dma-table-wrap cos-stack-mobile"><table class="dma-table"><thead><tr><th>When</th><th>Action</th><th>OK</th><th>Detail</th></tr></thead><tbody>' +
            (rows.map(function (l) {
              return "<tr><td>" + esc(fmt(l.createdAt)) + "</td><td>" + esc(l.action) + "</td><td>" + (l.success === false ? "No" : "Yes") + "</td><td>" + esc(String(l.details || l.error || "").slice(0, 140)) + "</td></tr>";
            }).join("") || "<tr><td colspan='4'>No activity</td></tr>") +
            "</tbody></table></div>";
        });
      }
    }

    function loadTable(path, headers, mapRow) {
      body.innerHTML = "<p class='cos-hint'>Loading…</p>";
      api(path).then(function (d) {
        var rows = d.data || [];
        body.innerHTML = '<div class="dma-table-wrap cos-stack-mobile"><table class="dma-table"><thead><tr>' +
          headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          (rows.map(function (r) {
            return "<tr>" + mapRow(r).map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
          }).join("") || "<tr><td colspan='" + headers.length + "'>No records</td></tr>") +
          "</tbody></table></div>";
      }).catch(function (e) { body.innerHTML = "<p>" + esc(e.message) + "</p>"; });
    }

    function waitForClinic(n) {
      if (n > 40) {
        api("/api/superadmin/clinics/" + id).then(function (c) { clinic = c; render(); }).catch(function () {});
        return;
      }
      var name = document.getElementById("clinic-name");
      if (name && name.textContent && name.textContent !== "—") {
        api("/api/superadmin/clinics/" + id).then(function (c) {
          clinic = c;
          render();
        });
        return;
      }
      setTimeout(function () { waitForClinic(n + 1); }, 200);
    }

    waitForClinic(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
