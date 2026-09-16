/**
 * Clinicos website chat widget.
 * Posts to POST /api/public/clinics/:slug/ai-chat — same AI receptionist
 * training WhatsApp uses (published profile / latest draft until first publish).
 * Does not diagnose. Does not invent a second brain.
 *
 * Embed: <script src="https://HOST/widget.js" data-clinic="BOOKING_SLUG" async></script>
 */
(function () {
  if (window.__clinicosWidgetBooted) return;
  window.__clinicosWidgetBooted = true;

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }

  var params = new URLSearchParams(location.search);
  var clinic = (script && script.getAttribute("data-clinic")) || params.get("clinic") || "";
  var origin = "";
  try {
    origin = script && script.src ? new URL(script.src).origin : location.origin;
  } catch (_) {
    origin = location.origin;
  }
  var inline = /\/widget\.html(?:$|\?)/.test(location.pathname + "") ||
    (script && script.getAttribute("data-open") === "1") ||
    params.get("open") === "1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  var css =
    ":host, .cw-root { all: initial; font-family: Inter, 'Plus Jakarta Sans', system-ui, sans-serif; }" +
    ".cw-root { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; color: #E8EEF8; }" +
    ".cw-root.cw-page { position: static; inset: auto; width: 100%; height: 100%; right: auto; bottom: auto; }" +
    ".cw-fab { width: 56px; height: 56px; border: 0; border-radius: 50%; cursor: pointer;" +
    " background: radial-gradient(circle at 30% 20%, #66FCF1, #2565FC 55%, #1E40AF);" +
    " color: #fff; box-shadow: 0 10px 28px rgba(37,101,252,.45); display: grid; place-items: center; }" +
    ".cw-fab svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; }" +
    ".cw-panel { width: min(360px, calc(100vw - 24px)); height: min(520px, calc(100vh - 96px));" +
    " display: none; flex-direction: column; overflow: hidden;" +
    " background: linear-gradient(180deg, rgba(28, 38, 56,.96), rgba(20, 28, 43,.98));" +
    " border: 1px solid rgba(255,255,255,.1); border-radius: 18px;" +
    " box-shadow: 0 24px 64px rgba(0,0,0,.45); backdrop-filter: blur(18px); }" +
    ".cw-root.is-open .cw-panel, .cw-root.cw-page .cw-panel { display: flex; }" +
    ".cw-root.cw-page .cw-panel { width: 100%; height: 100%; border-radius: 0; border: 0; }" +
    ".cw-root.cw-page .cw-fab { display: none; }" +
    ".cw-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px;" +
    " border-bottom: 1px solid rgba(255,255,255,.08); }" +
    ".cw-dot { width: 10px; height: 10px; border-radius: 50%; background: #34D399; box-shadow: 0 0 8px #34D399; }" +
    ".cw-head strong { display: block; font-family: Montserrat, Inter, sans-serif; font-size: 13px; font-weight: 700; color: #fff; }" +
    ".cw-head span { display: block; font-size: 11px; color: #93B4FF; }" +
    ".cw-x { margin-left: auto; background: rgba(255,255,255,.06); border: 0; color: #fff;" +
    " width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 18px; line-height: 1; }" +
    ".cw-log { flex: 1; overflow: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }" +
    ".cw-bubble { max-width: 86%; padding: 10px 12px; border-radius: 14px; font-size: 13px; line-height: 1.45; }" +
    ".cw-in { align-self: flex-start; background: rgba(255,255,255,.07); color: #E8EEF8; }" +
    ".cw-out { align-self: flex-end; background: linear-gradient(135deg, #2565FC, #14967F); color: #fff; }" +
    ".cw-note { font-size: 11px; color: #A8B6CC; padding: 0 14px 8px; line-height: 1.4; }" +
    ".cw-form { display: flex; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid rgba(255,255,255,.08); }" +
    ".cw-form input { flex: 1; min-height: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1);" +
    " background: rgba(255,255,255,.05); color: #fff; padding: 0 12px; font: inherit; font-size: 13px; }" +
    ".cw-form button { min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; cursor: pointer;" +
    " background: #2565FC; color: #fff; font-weight: 700; font-size: 13px; }" +
    ".cw-form button:disabled { opacity: .55; cursor: wait; }";

  var host = document.createElement("div");
  host.id = "clinicos-chat-widget";
  var shadow;
  try { shadow = host.attachShadow({ mode: "open" }); }
  catch (_) { shadow = host; }

  var wrap = document.createElement("div");
  wrap.className = "cw-root" + (inline ? " cw-page is-open" : "");
  wrap.innerHTML =
    '<style>' + css + "</style>" +
    '<button type="button" class="cw-fab" aria-label="Open clinic chat">' +
      '<svg viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H9l-5 3z"/></svg>' +
    "</button>" +
    '<section class="cw-panel" role="dialog" aria-label="Clinic chat">' +
      '<div class="cw-head"><i class="cw-dot"></i><div><strong>AI Receptionist</strong><span class="cw-sub">Online</span></div>' +
      '<button type="button" class="cw-x" aria-label="Close">×</button></div>' +
      '<div class="cw-log" aria-live="polite"></div>' +
      '<p class="cw-note">Answers hours, services and booking from this clinic’s published receptionist training. It does not diagnose.</p>' +
      '<form class="cw-form"><input maxlength="500" autocomplete="off" placeholder="Ask about hours or booking…">' +
      '<button type="submit">Send</button></form>' +
    "</section>";

  shadow.appendChild(wrap);
  if (inline) {
    document.body.style.margin = "0";
    document.body.style.height = "100%";
    document.documentElement.style.height = "100%";
    host.style.height = "100%";
  }
  document.body.appendChild(host);

  var fab = wrap.querySelector(".cw-fab");
  var closeBtn = wrap.querySelector(".cw-x");
  var log = wrap.querySelector(".cw-log");
  var form = wrap.querySelector(".cw-form");
  var input = form.querySelector("input");
  var sendBtn = form.querySelector("button");
  var sub = wrap.querySelector(".cw-sub");
  var history = [];
  var ready = false;
  var clinicName = "";
  var intro = "";

  function add(role, text) {
    var div = document.createElement("div");
    div.className = "cw-bubble " + (role === "user" ? "cw-out" : "cw-in");
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function sessionId() {
    var key = "clinicos-webchat-" + clinic;
    try {
      var id = localStorage.getItem(key);
      if (!id) {
        id = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return "guest";
    }
  }

  function setOpen(on) {
    wrap.classList.toggle("is-open", on);
    if (on && !history.length && intro) add("ai", intro);
  }

  fab.addEventListener("click", function () { setOpen(!wrap.classList.contains("is-open")); });
  closeBtn.addEventListener("click", function () { setOpen(false); });

  if (!clinic) {
    add("ai", "This chat widget is missing a clinic slug. Add data-clinic on the script tag.");
    sendBtn.disabled = true;
    if (inline) setOpen(true);
    return;
  }

  fetch(origin + "/api/public/clinics/" + encodeURIComponent(clinic), { credentials: "omit" })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) {
        add("ai", (res.d && res.d.error) || "This clinic is not accepting website chat.");
        sendBtn.disabled = true;
        return;
      }
      if (res.d.websiteWidget === false) {
        add("ai", "Website chat is not enabled for this clinic.");
        sendBtn.disabled = true;
        sub.textContent = "Off";
        return;
      }
      ready = true;
      clinicName = res.d.name || "Clinic";
      wrap.querySelector(".cw-head strong").textContent = clinicName;
      intro = res.d.customIntroMsg || ("Welcome to " + clinicName + ". How can we help you today?");
      sub.textContent = "Online · receptionist";
      if (inline) add("ai", intro);
    })
    .catch(function () {
      add("ai", "Could not reach the clinic chat service.");
      sendBtn.disabled = true;
    });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!ready) return;
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    add("user", text);
    history.push({ role: "user", text: text });
    sendBtn.disabled = true;
    var convo = history.slice(0, -1).map(function (h) {
      return (h.role === "user" ? "Patient: " : "AI: ") + h.text;
    }).join("\n");
    fetch(origin + "/api/public/clinics/" + encodeURIComponent(clinic) + "/ai-chat", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text.slice(0, 500),
        conversationHistory: convo.slice(0, 3000),
        sessionId: sessionId()
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        sendBtn.disabled = false;
        var reply = (res.d && (res.d.aiReply || res.d.reply || res.d.error)) || "No reply received.";
        add("ai", reply);
        history.push({ role: "ai", text: reply });
      })
      .catch(function () {
        sendBtn.disabled = false;
        add("ai", "Network error — could not send that message.");
      });
  });
})();
