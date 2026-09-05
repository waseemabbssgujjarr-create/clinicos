/**
 * Structured AI receptionist training — tabs wired to /api/ai/training-profile
 * and custom replies. Draft is saved per section; Publish pushes live WhatsApp.
 */
(function (global) {
  var TABS = [
    ["personality", "Personality"],
    ["knowledge", "Clinic knowledge"],
    ["services", "Services"],
    ["rules", "Business rules"],
    ["booking", "Booking rules"],
    ["custom", "Custom replies"],
    ["handling", "Customer handling"],
    ["human", "Human-like"],
    ["test", "Test chat"],
    ["publish", "Publish"],
    ["activity", "Activity"]
  ];

  function A() { return global.DmaApp; }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return A() ? A().esc(s) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
  }); }

  function field(id, label, hint, control) {
    return '<div class="dma-field"><label class="cos-label" for="' + id + '">' + esc(label) + "</label>" +
      (hint ? '<p class="cos-hint">' + hint + "</p>" : "") + control + "</div>";
  }
  function input(id, val, ph) {
    return '<input class="cos-input" id="' + id + '" value="' + esc(val || "") + '" placeholder="' + esc(ph || "") + '">';
  }
  function area(id, val, ph, rows) {
    return '<textarea class="cos-input area" id="' + id + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || "") + '">' + esc(val || "") + "</textarea>";
  }
  function select(id, options, val) {
    return '<select class="cos-input" id="' + id + '">' + options.map(function (o) {
      var v = o[0], l = o[1];
      return '<option value="' + v + '"' + (String(val) === String(v) ? " selected" : "") + ">" + l + "</option>";
    }).join("") + "</select>";
  }
  function toggle(id, on) {
    return '<label class="dma-switch"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + "><span></span></label>";
  }

  function getPath(obj, path, fallback) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (!cur || typeof cur !== "object") return fallback;
      cur = cur[path[i]];
    }
    return cur == null ? fallback : cur;
  }

  function mount(root) {
    if (!root) return;
    var tab = (A() && A().qs("tab", "personality")) || "personality";
    var draft = null;
    var meta = {};
    var clinic = {};
    var dirty = false;
    var testHistory = [];

    root.innerHTML =
      '<div class="dma-head dma-head-page"><div><h1>Train AI receptionist</h1>' +
      '<p>Structured training the conversation engine actually uses — draft, test, then publish to WhatsApp.</p></div>' +
      '<div class="dma-head-actions">' +
        '<a class="dma-btn dma-btn-ghost" href="/dashboard/whatsapp/">WhatsApp</a>' +
        '<button type="button" class="dma-btn dma-btn-primary" id="ai-save-top">Save draft</button>' +
      "</div></div>" +
      '<p class="cos-hint" id="ai-meta">Loading training…</p>' +
      '<div class="dma-tabs" id="ai-tabs"></div>' +
      '<div id="ai-body">' + (A() ? A().spinner() : "Loading…") + "</div>";

    function drawTabs() {
      el("ai-tabs").innerHTML = TABS.map(function (t) {
        return '<button type="button" data-t="' + t[0] + '" class="' + (tab === t[0] ? "active" : "") + '">' + t[1] + "</button>";
      }).join("");
    }

    function setMeta() {
      var d = meta.draftUpdatedAt ? new Date(meta.draftUpdatedAt).toLocaleString() : "—";
      var p = meta.publishedAt ? new Date(meta.publishedAt).toLocaleString() : "Never";
      el("ai-meta").textContent = (dirty ? "Unsaved changes · " : "") +
        "Draft updated " + d + " · Live published " + p +
        (meta.isPublished ? "" : " · WhatsApp is using the latest draft until you publish");
    }

    function saveDraft(showToast) {
      if (!draft) return Promise.resolve();
      return A().put("/api/ai/training-profile", { profile: draft }).then(function (r) {
        if (!r.ok) {
          if (showToast !== false) A().toast((r.d && r.d.error) || "Save failed", "err");
          return r;
        }
        dirty = false;
        if (r.d && r.d.draftUpdatedAt) meta.draftUpdatedAt = r.d.draftUpdatedAt;
        setMeta();
        if (showToast !== false) A().toast("Draft saved", "ok");
        return r;
      });
    }

    function collectCurrentTab() {
      if (!draft) return;
      if (tab === "personality") {
        draft.personality.enabled = !!(el("ai-on") && el("ai-on").checked);
        draft.personality.receptionistName = el("ai-name") && el("ai-name").value;
        draft.personality.language = el("ai-lang") && el("ai-lang").value;
        draft.personality.tone = el("ai-tone") && el("ai-tone").value;
        draft.personality.introMessage = el("ai-intro") && el("ai-intro").value;
        draft.personality.emojiPolicy = el("ai-emoji") && el("ai-emoji").value;
      } else if (tab === "knowledge") {
        draft.clinicKnowledge.about = el("kn-about") && el("kn-about").value;
        draft.clinicKnowledge.parking = el("kn-park") && el("kn-park").value;
        draft.clinicKnowledge.insurance = el("kn-ins") && el("kn-ins").value;
      } else if (tab === "services") {
        draft.services.notes = el("sv-notes") && el("sv-notes").value;
        draft.services.highlight = el("sv-hi") && el("sv-hi").value;
      } else if (tab === "rules") {
        draft.businessRules.policies = el("br-pol") && el("br-pol").value;
        draft.businessRules.cancellation = el("br-can") && el("br-can").value;
        draft.businessRules.payment = el("br-pay") && el("br-pay").value;
        draft.businessRules.emergency = el("br-em") && el("br-em").value;
        draft.businessRules.whatNotToSay = el("br-no") && el("br-no").value;
      } else if (tab === "booking") {
        draft.appointmentRules.autoConfirm = el("bk-auto") && el("bk-auto").value === "true";
        draft.appointmentRules.requireTreatmentFirst = el("bk-tx") && el("bk-tx").checked;
        draft.appointmentRules.collectName = el("bk-name") && el("bk-name").checked;
        draft.appointmentRules.confirmationStyle = el("bk-style") && el("bk-style").value;
        draft.appointmentRules.bookingLeadHours = Number(el("bk-lead") && el("bk-lead").value || 2);
        draft.appointmentRules.maxAdvanceDays = Number(el("bk-adv") && el("bk-adv").value || 30);
      } else if (tab === "handling") {
        draft.customerHandling.skipRepeatGreeting = el("ch-skip") && el("ch-skip").checked;
        draft.customerHandling.askOneQuestion = el("ch-one") && el("ch-one").checked;
        draft.customerHandling.greetReturning = el("ch-ret") && el("ch-ret").checked;
        draft.customerHandling.escalateKeywords = el("ch-esc") && el("ch-esc").value;
        draft.customerHandling.unknownPolicy = el("ch-unk") && el("ch-unk").value;
        draft.customerHandling.memoryNotes = el("ch-mem") && el("ch-mem").value;
      } else if (tab === "human") {
        draft.humanLike.typingIndicator = el("hl-type") && el("hl-type").checked;
        draft.humanLike.naturalDelay = el("hl-delay") && el("hl-delay").checked;
        draft.humanLike.avoidRepeatFallback = el("hl-rep") && el("hl-rep").checked;
        draft.humanLike.followUpAwareness = el("hl-fu") && el("hl-fu").checked;
        draft.humanLike.wpm = Number(el("hl-wpm") && el("hl-wpm").value || 280);
      }
    }

    function markDirty() { dirty = true; setMeta(); }

    function renderTab() {
      if (!draft) return;
      var p = draft.personality || {};
      var k = draft.clinicKnowledge || {};
      var s = draft.services || {};
      var b = draft.businessRules || {};
      var a = draft.appointmentRules || {};
      var h = draft.customerHandling || {};
      var u = draft.humanLike || {};
      var body = el("ai-body");

      if (tab === "personality") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Receptionist personality</h2>' +
          toggle("ai-on", p.enabled !== false) + '</div><div class="dma-panel-b">' +
          '<p class="cos-hint">Controls tone, language, and whether the live WhatsApp receptionist is on. Saved into the clinic record and the training profile.</p>' +
          '<div class="dma-row">' +
            field("ai-name", "Receptionist name", "Optional. Used if a patient asks who they are speaking with.", input("ai-name", p.receptionistName, "e.g. Sara")) +
            field("ai-lang", "Language", "", select("ai-lang", [["english","English"],["urdu","Urdu"],["arabic","Arabic"],["hindi","Hindi"]], p.language)) +
          '</div><div class="dma-row">' +
            field("ai-tone", "Tone", "", select("ai-tone", [["professional","Professional"],["friendly","Friendly"],["formal","Formal"],["warm","Warm"]], p.tone)) +
            field("ai-emoji", "Emoji", "", select("ai-emoji", [["none","None"],["minimal","Minimal"],["natural","Natural"]], p.emojiPolicy || "minimal")) +
          "</div>" +
          field("ai-intro", "First-contact intro", "Used only on a true first turn — not repeated every message.", area("ai-intro", p.introMessage, "Hello, thanks for contacting our clinic…")) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div>' +
          "</div></section>";
      } else if (tab === "knowledge") {
        var txs = [];
        try { txs = A().parseJson(clinic.treatments, []) || []; } catch (_) {}
        body.innerHTML = '<p class="cos-hint">Facts the engine injects on every turn. Treatments and hours still live in Settings so booking slots stay accurate.</p>' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Clinic facts</h2></div><div class="dma-panel-b">' +
          field("kn-about", "About the clinic", "Identity, doctors, neighbourhood — anything patients ask that is not a treatment name.", area("kn-about", k.about)) +
          field("kn-park", "Parking / arrival", "", area("kn-park", k.parking, "", 3)) +
          field("kn-ins", "Insurance / payment notes", "", area("kn-ins", k.insurance, "", 3)) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "services") {
        var list = [];
        try { list = A().parseJson(clinic.treatments, []) || []; } catch (_) {}
        if (!Array.isArray(list)) list = [];
        body.innerHTML = '<p class="cos-hint">Bookable treatments come from Settings. Extra notes here are sent to the conversation engine.</p>' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Treatments in Settings</h2><a href="/dashboard/settings/?tab=treatments">Edit treatments</a></div><div class="dma-panel-b">' +
          (list.map(function (t) {
            var name = typeof t === "string" ? t : (t.name || "");
            var fee = typeof t === "object" ? (t.fee || t.price) : "";
            return '<div class="dma-row-item"><div class="name">' + esc(name) + '</div><div class="meta">' + (fee ? A().money(fee) : "") + "</div></div>";
          }).join("") || A().empty("No treatments", "Add them so WhatsApp booking knows what you offer.", "/dashboard/settings/?tab=treatments", "Add treatments")) +
          "</div></section>" +
          '<section class="dma-panel" style="margin-top:16px"><div class="dma-panel-h"><h2>Service notes for the receptionist</h2></div><div class="dma-panel-b">' +
          field("sv-hi", "Highlight", "One thing the receptionist should mention when asked “what do you offer?”", input("sv-hi", s.highlight, "e.g. Same-day cleaning when slots allow")) +
          field("sv-notes", "Additional service notes", "", area("sv-notes", s.notes)) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "rules") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Business rules</h2></div><div class="dma-panel-b">' +
          '<p class="cos-hint">Policies the engine must not invent around. Empty fields are omitted from the prompt.</p>' +
          field("br-pol", "Clinic policies", "", area("br-pol", b.policies)) +
          field("br-can", "Cancellation / no-show", "", area("br-can", b.cancellation, "", 3)) +
          field("br-pay", "Payment", "", area("br-pay", b.payment, "", 3)) +
          field("br-em", "Emergency handling", "", area("br-em", b.emergency, "", 3)) +
          field("br-no", "What not to say", "Never diagnose, never invent prices, never mention other clinics.", area("br-no", b.whatNotToSay, "", 3)) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "booking") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Appointment & booking rules</h2></div><div class="dma-panel-b">' +
          field("bk-auto", "Auto-confirm", "Yes writes CONFIRMED appointments. No leaves them PENDING for the doctor.", select("bk-auto", [["true","Yes — AI confirms"],["false","No — doctor confirms"]], a.autoConfirm !== false)) +
          field("bk-style", "Confirmation style", "", select("bk-style", [["confirm_then_book","Confirm details, then book"],["book_when_clear","Book as soon as slot is clear"]], a.confirmationStyle || "confirm_then_book")) +
          '<div class="dma-row">' +
            field("bk-lead", "Minimum notice (hours)", "", input("bk-lead", a.bookingLeadHours || 2)) +
            field("bk-adv", "Max days ahead", "", input("bk-adv", a.maxAdvanceDays || 30)) +
          "</div>" +
          '<div class="dma-row"><label class="dma-switch">Require treatment first ' + toggle("bk-tx", a.requireTreatmentFirst !== false) + "</label>" +
          '<label class="dma-switch">Ask for name if unknown ' + toggle("bk-name", a.collectName !== false) + "</label></div>" +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "handling") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Customer handling</h2></div><div class="dma-panel-b">' +
          '<p class="cos-hint">Follow-ups like “yes”, “tomorrow”, or “good” are interpreted against the previous question when this is on.</p>' +
          '<div class="dma-row"><label>Skip repeat greetings ' + toggle("ch-skip", h.skipRepeatGreeting !== false) + "</label>" +
          "<label>Ask one question at a time " + toggle("ch-one", h.askOneQuestion !== false) + "</label>" +
          "<label>Warm returning patients " + toggle("ch-ret", h.greetReturning !== false) + "</label></div>" +
          field("ch-esc", "Escalate keywords", "Comma-separated. Matching messages skip the LLM and notify staff.", input("ch-esc", h.escalateKeywords, "speak to doctor, human, manager")) +
          field("ch-unk", "Unknown questions", "", select("ch-unk", [["ask_clarify_then_escalate","Clarify once, then escalate"],["escalate","Escalate immediately"]], h.unknownPolicy || "ask_clarify_then_escalate")) +
          field("ch-mem", "Memory notes for this clinic", "Standing reminders the receptionist should keep in mind.", area("ch-mem", h.memoryNotes, "", 3)) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "human") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Human-like behaviour</h2></div><div class="dma-panel-b">' +
          '<p class="cos-hint">Typing uses Meta’s official typing indicator on the inbound message — not a fake “…” text. Delay scales with reply length.</p>' +
          "<label>Typing indicator " + toggle("hl-type", u.typingIndicator !== false) + "</label>" +
          "<label>Natural delay " + toggle("hl-delay", u.naturalDelay !== false) + "</label>" +
          "<label>Avoid repeating the same fallback " + toggle("hl-rep", u.avoidRepeatFallback !== false) + "</label>" +
          "<label>Follow-up awareness " + toggle("hl-fu", u.followUpAwareness !== false) + "</label>" +
          field("hl-wpm", "Typing speed (WPM)", "Used only to size the delay. Default 280.", input("hl-wpm", u.wpm || 280)) +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-primary" id="sec-save">Save section</button></div></div></section>';
      } else if (tab === "test") {
        renderTest(body);
        return;
      } else if (tab === "publish") {
        body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Publish to WhatsApp</h2></div><div class="dma-panel-b">' +
          '<p class="cos-hint">Draft is what you edit and test. Publish copies the draft to the live engine used by inbound WhatsApp. Until the first publish, live traffic uses the latest draft so existing clinics keep working.</p>' +
          "<p>Last published: <strong>" + esc(meta.publishedAt ? new Date(meta.publishedAt).toLocaleString() : "Never") + "</strong></p>" +
          '<div class="cos-savebar"><button type="button" class="dma-btn dma-btn-ghost" id="pub-save">Save draft first</button>' +
          '<button type="button" class="dma-btn dma-btn-primary" id="pub-go">Publish live</button></div></div></section>';
        el("pub-save").onclick = function () { collectCurrentTab(); saveDraft(true); };
        el("pub-go").onclick = function () {
          collectCurrentTab();
          saveDraft(false).then(function () {
            return A().post("/api/ai/training-profile/publish", {});
          }).then(function (r) {
            if (!r.ok) { A().toast((r.d && r.d.error) || "Publish failed", "err"); return; }
            meta.isPublished = true;
            meta.publishedAt = (r.d && r.d.publishedAt) || new Date().toISOString();
            setMeta();
            A().toast("Published to WhatsApp receptionist", "ok");
            renderTab();
          });
        };
        return;
      } else if (tab === "activity") {
        body.innerHTML = A().spinner();
        A().get("/api/ai/logs?limit=40").then(function (logs) {
          var rows = Array.isArray(logs) ? logs : (logs.data || []);
          body.innerHTML = '<section class="dma-panel"><div class="dma-table-wrap"><table class="dma-table"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead><tbody>' +
            (rows.map(function (l) {
              return "<tr><td>" + A().ago(l.createdAt) + "</td><td>" + A().chip(l.action || "event") + "</td><td>" + esc((l.details || l.summary || "").toString().slice(0, 180)) + "</td></tr>";
            }).join("") || '<tr><td colspan="3">' + A().empty("No AI activity yet", "Connect WhatsApp and send a test message.") + "</td></tr>") +
            "</tbody></table></div></section>";
        });
        return;
      } else if (tab === "custom") {
        renderCustom(body);
        return;
      }

      var saveBtn = el("sec-save");
      if (saveBtn) saveBtn.onclick = function () { collectCurrentTab(); saveDraft(true); };
      body.querySelectorAll("input,select,textarea").forEach(function (n) {
        n.addEventListener("change", markDirty);
        n.addEventListener("input", markDirty);
      });
    }

    function renderTest(body) {
      body.innerHTML = '<section class="dma-panel"><div class="dma-panel-h"><h2>Test chat</h2></div><div class="dma-panel-b">' +
        '<p class="cos-hint">Uses the unsaved-or-saved draft, not WhatsApp. History is kept for this tab so follow-ups like “yes” work.</p>' +
        '<div id="ai-chat" class="dma-thread-m" style="min-height:280px;border:1px solid var(--cos-border);border-radius:10px;margin-bottom:10px;padding:12px;overflow:auto"></div>' +
        '<form id="ai-form" style="display:flex;gap:8px"><input id="ai-q" class="cos-input" placeholder="e.g. Do you do teeth whitening tomorrow?" style="flex:1">' +
        '<button class="dma-btn dma-btn-primary" type="submit">Send</button></form></div></section>';
      var log = el("ai-chat");
      function add(who, text, extra) {
        log.innerHTML += '<div class="dma-bubble ' + (who === "you" ? "out" : "in") + '">' + esc(text) +
          (extra ? '<div class="cos-meta">' + esc(extra) + "</div>" : "") + "</div>";
        log.scrollTop = log.scrollHeight;
      }
      testHistory.forEach(function (h) { add(h.role === "user" ? "you" : "ai", h.content, h.extra); });
      if (!testHistory.length) add("ai", "Ask anything the receptionist should know — hours, a treatment, or a follow-up like “tomorrow”.");
      el("ai-form").onsubmit = function (e) {
        e.preventDefault();
        var q = el("ai-q").value.trim();
        if (!q) return;
        el("ai-q").value = "";
        add("you", q);
        testHistory.push({ role: "user", content: q });
        collectCurrentTab();
        saveDraft(false).then(function () {
          return A().post("/api/ai/test-chat", { message: q, history: testHistory.slice(0, -1) });
        }).then(function (r) {
          var d = r.d || {};
          var reply = d.reply || d.message || (r.ok ? "No reply returned." : (d.error || "AI test failed"));
          var extra = [d.path, d.intent, d.action].filter(Boolean).join(" · ");
          add("ai", reply, extra);
          testHistory.push({ role: "assistant", content: reply, extra: extra });
        });
      };
    }

    function renderCustom(body) {
      var CAT_LABELS = { general: "General", pricing: "Pricing", hours: "Hours", treatments: "Treatments", booking: "Booking", policies: "Policies" };
      body.innerHTML = A().spinner();
      A().get("/api/ai/training-rules").then(function (d) {
        var rules = d.rules || [];
        body.innerHTML = '<p class="cos-hint">Matched in code before the LLM. Short follow-ups like “yes” skip these so conversation state still works.</p>' +
          '<section class="dma-panel"><div class="dma-panel-h"><h2>Custom replies <span class="dma-chip">' + rules.length + "</span></h2>" +
          '<button type="button" class="dma-btn dma-btn-primary dma-btn-sm" id="rl-new">Add reply</button></div><div class="dma-panel-b" id="rl-list">' +
          (rules.map(function (r) {
            return '<div class="dma-row-item" style="flex-direction:column;align-items:flex-start;gap:6px">' +
              "<div><strong>" + esc(r.question) + "</strong> · " + esc(CAT_LABELS[r.category] || r.category) +
              ' · <button type="button" class="dma-btn dma-btn-ghost dma-btn-sm rl-tog" data-id="' + esc(r.id) + '">' + (r.isActive ? "On" : "Off") + "</button>" +
              ' <button type="button" class="dma-btn dma-btn-ghost dma-btn-sm rl-ed" data-id="' + esc(r.id) + '">Edit</button>' +
              ' <button type="button" class="dma-btn dma-btn-danger dma-btn-sm rl-del" data-id="' + esc(r.id) + '">Delete</button></div>' +
              '<div class="cos-hint">' + esc(r.answer) + "</div></div>";
          }).join("") || A().empty("No custom replies", "Add exact answers the receptionist must use.")) +
          "</div></section>";
        el("rl-new").onclick = function () { openRule(null, rules); };
        body.querySelectorAll(".rl-del").forEach(function (btn) {
          btn.onclick = function () {
            if (!confirm("Delete this reply?")) return;
            A().del("/api/ai/training-rules/" + btn.getAttribute("data-id")).then(function (r) {
              if (r.ok) { A().toast("Deleted", "ok"); renderCustom(body); }
              else A().toast((r.d && r.d.error) || "Failed", "err");
            });
          };
        });
        body.querySelectorAll(".rl-tog").forEach(function (btn) {
          btn.onclick = function () {
            A().patch("/api/ai/training-rules/" + btn.getAttribute("data-id") + "/toggle", {}).then(function (r) {
              if (r.ok) renderCustom(body);
            });
          };
        });
        body.querySelectorAll(".rl-ed").forEach(function (btn) {
          btn.onclick = function () {
            var rule = rules.find(function (x) { return x.id === btn.getAttribute("data-id"); });
            openRule(rule, rules);
          };
        });
      });

      function openRule(rule) {
        A().modal(rule ? "Edit custom reply" : "Add custom reply",
          field("rl-q", "Patient question", "", input("rl-q", rule && rule.question, "What are your fees?")) +
          field("rl-a", "Exact answer", "", area("rl-a", rule && rule.answer)) +
          '<div class="dma-row">' + field("rl-cat", "Category", "", select("rl-cat", [["general","General"],["pricing","Pricing"],["hours","Hours"],["treatments","Treatments"],["booking","Booking"],["policies","Policies"]], rule && rule.category)) +
          field("rl-match", "Match", "", select("rl-match", [["contains","Contains"],["exact","Exact"],["starts_with","Starts with"]], rule && rule.matchType)) + "</div>",
          '<button class="dma-btn dma-btn-ghost" data-close>Cancel</button><button class="dma-btn dma-btn-primary" id="rl-save">Save</button>'
        );
        el("rl-save").onclick = function () {
          var payload = { question: el("rl-q").value.trim(), answer: el("rl-a").value.trim(), category: el("rl-cat").value, matchType: el("rl-match").value, isActive: true };
          if (!payload.question || !payload.answer) { A().toast("Question and answer required", "err"); return; }
          var call = rule ? A().patch("/api/ai/training-rules/" + rule.id, payload) : A().post("/api/ai/training-rules", payload);
          call.then(function (r) {
            if (!r.ok) { A().toast((r.d && r.d.error) || "Save failed", "err"); return; }
            A().closeModal();
            A().toast("Saved", "ok");
            renderCustom(body);
          });
        };
      }
    }

    el("ai-tabs").onclick = function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      collectCurrentTab();
      tab = b.getAttribute("data-t");
      if (A().setQs) A().setQs({ tab: tab }, true);
      drawTabs();
      renderTab();
    };
    el("ai-save-top").onclick = function () { collectCurrentTab(); saveDraft(true); };

    drawTabs();
    A().get("/api/ai/training-profile").then(function (d) {
      draft = d.profile || {};
      meta = d.meta || {};
      clinic = d.clinic || {};
      setMeta();
      renderTab();
    }).catch(function () {
      el("ai-body").innerHTML = A().empty("Could not load training", "Check your connection and try again.");
    });
  }

  global.DmaAiTraining = { mount: mount };
})(typeof window !== "undefined" ? window : this);
