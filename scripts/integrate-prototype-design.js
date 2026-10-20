"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROTO = path.join(ROOT, "Clinicos_Prototype", "clinicos-prototypes");
const ASSETS = "/assets";

const SKIP_PROTO = new Set(["index.html", "widget.html"]);

const THEME_BOOT = `<script>(function(){try{var r=document.documentElement;r.classList.add('os-live');var t=localStorage.getItem('dma-theme');if(t!=='light'&&t!=='dark'){var c=localStorage.getItem('cl_theme');if(c){try{c=JSON.parse(c)}catch(e){}if(c==='light'||c==='dark')t=c}}if(t!=='light'&&t!=='dark')t='light';r.setAttribute('data-theme',t);r.style.colorScheme=t;}catch(e){}})();</script>`;

const ROUTE_PAGE = {
  "dashboard/index.html": { route: "dashboard", page: "home", title: "Home" },
  "dashboard/appointments/index.html": { route: "dashboard/appointments", page: "appointments", title: "Appointments" },
  "dashboard/calendar/index.html": { route: "dashboard/calendar", page: "calendar", title: "Calendar" },
  "dashboard/waiting/index.html": { route: "dashboard/waiting", page: "waiting", title: "Waiting room" },
  "dashboard/patients/index.html": { route: "dashboard/patients", page: "patients", title: "Patients" },
  "dashboard/patients/detail/index.html": { route: "dashboard/patients/detail", page: "patient", title: "Patient" },
  "dashboard/communication/index.html": { route: "dashboard/communication", page: "communication", title: "Communication" },
  "dashboard/messages/index.html": { route: "dashboard/messages", page: "messages", title: "Inbox" },
  "dashboard/whatsapp/index.html": { route: "dashboard/whatsapp", preserve: true },
  "dashboard/broadcasts/index.html": { route: "dashboard/broadcasts", preserve: true },
  "dashboard/leads/index.html": { route: "dashboard/leads", preserve: true },
  "dashboard/ai/index.html": { route: "dashboard/ai", page: "ai", title: "AI Receptionist" },
  "dashboard/analytics/index.html": { route: "dashboard/analytics", page: "analytics", title: "Analytics" },
  "dashboard/reviews/index.html": { route: "dashboard/reviews", page: "reviews", title: "Reviews" },
  "dashboard/staff/index.html": { route: "dashboard/staff", page: "staff", title: "Team" },
  "dashboard/billing/index.html": { route: "dashboard/billing", page: "billing", title: "Billing" },
  "dashboard/settings/index.html": { route: "dashboard/settings", page: "settings", title: "Settings" },
  "dashboard/notifications/index.html": { route: "dashboard/notifications", page: "updates", title: "Updates" },
  "dashboard/payments/index.html": { route: "dashboard/payments", page: "payments", title: "Payments" },
  "dashboard/doctors/index.html": { route: "dashboard/doctors", page: "doctors", title: "Doctors" },
  "dashboard/rooms/index.html": { route: "dashboard/rooms", page: "rooms", title: "Rooms" },
  "dashboard/clinical/index.html": { route: "dashboard/clinical", page: "clinical", title: "Consultations" },
  "dashboard/consult/index.html": { route: "dashboard/consult", page: "consult", title: "Consultation" },
  "dashboard/vitals/index.html": { route: "dashboard/vitals", page: "vitals", title: "Vitals" },
  "dashboard/prescriptions/index.html": { route: "dashboard/prescriptions", page: "prescriptions", title: "Prescriptions" },
  "dashboard/laboratory/index.html": { route: "dashboard/laboratory", page: "laboratory", title: "Laboratory" },
  "dashboard/telemedicine/index.html": { route: "dashboard/telemedicine", page: "telemedicine", title: "Telemedicine" },
  "dashboard/tasks/index.html": { route: "dashboard/tasks", page: "tasks", title: "Tasks" },
  "dashboard/inventory/index.html": { route: "dashboard/inventory", page: "inventory", title: "Inventory" },
  "dashboard/documents/index.html": { route: "dashboard/documents", page: "documents", title: "Documents" },
  "dashboard/leave/index.html": { route: "dashboard/leave", page: "leave", title: "Leave" },
  "dashboard/locations/index.html": { route: "dashboard/locations", page: "locations", title: "Locations" },
  "dashboard/reports/index.html": { route: "dashboard/reports", page: "reports", title: "Reports" },
  "dashboard/operations/index.html": { route: "dashboard/operations", page: "operations", title: "Operations" },
};

function walkHtml(dir, base, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkHtml(p, base, out);
    else if (name === "index.html") out.push(path.relative(base, p).replace(/\\/g, "/"));
  }
}

function depthToRoot(rel) {
  const d = rel.split("/").length - 1;
  return d ? "../".repeat(d) : "./";
}

function extractPreserve(existingPath) {
  if (!fs.existsSync(existingPath)) return { html: "", scripts: "" };
  const html = fs.readFileSync(existingPath, "utf8");
  const mainMatch =
    html.match(/<main[^>]*class="doc-main[^"]*"[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<main[^>]*class="sa-main"[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<main[^>]*id="doc-page"[^>]*>([\s\S]*?)<\/main>/i);
  const bodyInner = mainMatch ? mainMatch[1] : "";
  const scripts = [];
  const re = /<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const body = m[2].trim();
    if (!body || body.length < 20) continue;
    if (/DmaDoctorShell\.(bootFromPage|initStaticPage)|document\.documentElement\.className|dma-world-auth/.test(body)) continue;
    if (/window\.__OS_LIVE_INIT__/.test(body)) continue;
    scripts.push(body);
  }
  const srcScripts = [];
  const re2 = /<script[^>]+src="([^"]+)"[^>]*><\/script>/gi;
  while ((m = re2.exec(html))) {
    const src = m[1];
    if (!src.startsWith("/")) continue;
    if (/dashboard-whatsapp|dashboard-bootstrap|superadmin-|clinic-workspace|clinics\.js/i.test(src)) {
      if (!srcScripts.includes(src)) srcScripts.push(src);
    }
  }
  return { html: bodyInner, scripts: scripts.join("\n"), srcScripts };
}

function clinicShellHtml(meta, rel, preserve, extraScripts) {
  const root = depthToRoot(rel);
  const area = "clinic";
  const attrs = [
    `data-live="1"`,
    `data-area="${area}"`,
    `data-route="${meta.route}"`,
  ];
  if (meta.page) attrs.push(`data-page="${meta.page}"`);
  if (meta.title) attrs.push(`data-title="${meta.title}"`);

  const liveScripts = [
    "/assets/os.js?v=2",
    "/dma-doctor-app.js?v=6",
    "/js/ds-theme.js?v=2",
    "/js/ds-status.js?v=1",
    "/js/ds-format.js?v=1",
    "/dma-clinicos-clinical.js?v=4",
    "/dma-ui.js?v=10",
    "/dma-doctor-pages.js?v=19",
    "/dma-clinicos-inner.js?v=14",
    "/assets/os-live.js?v=3",
  ];

  const preserveBlock = preserve
    ? `<div id="os-live-preserve" hidden>${preserve.html}</div>`
    : "";

  let initBody = preserve && preserve.scripts ? preserve.scripts : "";
  initBody = initBody.replace(/if\s*\(\s*!DmaDoctorShell\.initStaticPage\([^)]+\)\)\s*return;?/g, "if(!window.DmaApp||!DmaApp.requireAuth())return;");
  initBody = initBody.replace(/if\s*\(\s*!DmaAdminShell\.initStaticPage\([^)]+\)\)\s*return;?/g, "if(!window.DmaAdminShell||!DmaAdminShell.requireAuth())return;");
  const init = initBody ? `<script>window.__OS_LIVE_INIT__=function(){${initBody}};</script>` : "";

  const extra = ((preserve && preserve.srcScripts) || [])
    .map((s) => `<script src="${s.startsWith("/") ? s : root + s.replace(/^\//, "")}"></script>`)
    .join("\n");

  return `<!doctype html>
<html lang="en" class="doc-static os-live">
<head>
<meta charset="utf-8">
${THEME_BOOT}
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#14967F">
<meta name="robots" content="noindex, nofollow">
<title>${meta.title || "Clinicos"} · Clinicos</title>
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${ASSETS}/os.css?v=2">
<link rel="stylesheet" href="${ASSETS}/os-live.css?v=4">
<link rel="stylesheet" href="/dma-design-system.css?v=61">
<link rel="stylesheet" href="/dma-doctor-pages.css?v=10">
</head>
<body ${attrs.join(" ")}>
<div id="app"></div>
${preserveBlock}
${liveScripts.map((s) => `<script src="${s}"></script>`).join("\n")}
${extra}
${extraScripts || ""}
${init}
</body>
</html>`;
}

function adminShellHtml(meta, rel, preserve) {
  const root = depthToRoot(rel);
  const attrs = [`data-live="1"`, `data-area="admin"`, `data-route="${meta.route}"`];
  const scripts = [
    "/assets/os.js?v=2",
    "/superadmin-admin-shell.js?v=20",
    "/js/ds-theme.js?v=2",
    "/js/ds-status.js?v=1",
    "/js/ds-format.js?v=1",
    "/dma-ui.js?v=10",
    "/assets/os-live.js?v=3",
  ];
  const preserveBlock = preserve
    ? `<div id="os-live-preserve" hidden>${preserve.html}</div>`
    : "";
  let initBody = preserve && preserve.scripts ? preserve.scripts : "";
  initBody = initBody.replace(/if\s*\(\s*!DmaDoctorShell\.initStaticPage\([^)]+\)\)\s*return;?/g, "if(!window.DmaApp||!DmaApp.requireAuth())return;");
  initBody = initBody.replace(/if\s*\(\s*!DmaAdminShell\.initStaticPage\([^)]+\)\)\s*return;?/g, "if(!window.DmaAdminShell||!DmaAdminShell.requireAuth())return;");
  const init = initBody ? `<script>window.__OS_LIVE_INIT__=function(){${initBody}};</script>` : "";
  const extra = ((preserve && preserve.srcScripts) || [])
    .map((s) => `<script src="${s}"></script>`)
    .join("\n");

  return `<!doctype html>
<html lang="en" class="sa-static os-live">
<head>
<meta charset="utf-8">
${THEME_BOOT}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#14967F">
<meta name="robots" content="noindex, nofollow">
<title>${meta.title || "Control Center"} · Clinicos</title>
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${ASSETS}/os.css?v=2">
<link rel="stylesheet" href="${ASSETS}/os-live.css?v=4">
<link rel="stylesheet" href="/dma-design-system.css?v=61">
<link rel="stylesheet" href="/superadmin-theme.css?v=20">
<link rel="stylesheet" href="/dma-doctor-pages.css?v=10">
</head>
<body ${attrs.join(" ")}>
<div id="app"></div>
${preserveBlock}
${scripts.map((s) => `<script src="${s}"></script>`).join("\n")}
${extra}
${init}
</body>
</html>`;
}

function publicProtoHtml(rel, route, area) {
  const root = depthToRoot(rel);
  const isAuth = /login|register|forgot|reset|accept-invite|verify-email/.test(route);
  const scripts = [`${ASSETS}/os.js?v=2`, `${ASSETS}/site.js?v=2`];
  if (isAuth) {
    scripts.push("/portal.js?v=9", `${ASSETS}/os-auth-live.js?v=2`);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#14967F">
<title>Clinicos</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${ASSETS}/os.css?v=1">
</head>
<body data-root="" data-area="${area}" data-route="${route}">
<div id="app"></div>
${scripts.map((s) => `<script src="${s}"></script>`).join("\n")}
</body>
</html>`;
}

function routeFromRel(rel) {
  if (rel === "index.html") return "index";
  return rel.replace(/\/index\.html$/, "");
}

function areaFromRel(rel) {
  if (rel.startsWith("dashboard/")) return "clinic";
  if (rel.startsWith("superadmin/")) return "admin";
  return "public";
}

function mapSuperadmin(rel) {
  const route = routeFromRel(rel);
  return { route, title: route.split("/").pop() || "Overview" };
}

const protoFiles = [];
walkHtml(PROTO, PROTO, protoFiles);

let written = 0;
for (const rel of protoFiles) {
  if (SKIP_PROTO.has(rel) && !rel.includes("/")) continue;
  const target = path.join(ROOT, rel);
  const area = areaFromRel(rel);

  if (ROUTE_PAGE[rel]) {
    const meta = ROUTE_PAGE[rel];
    const preserve = meta.preserve ? extractPreserve(target) : null;
    let extra = "";
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      clinicShellHtml(meta, rel, preserve, extra)
    );
    written++;
    continue;
  }

  if (area === "clinic" && rel.startsWith("dashboard/")) {
    const route = routeFromRel(rel);
    const m = extractPreserve(target);
    const pageMatch = m.html.match(/data-page="([^"]+)"/);
    const meta = {
      route,
      page: pageMatch ? pageMatch[1] : undefined,
      title: route.split("/").pop(),
      preserve: m.html.length > 40,
    };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, clinicShellHtml(meta, rel, meta.preserve ? m : null));
    written++;
    continue;
  }

  if (area === "admin") {
    const meta = mapSuperadmin(rel);
    const preserve = extractPreserve(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, adminShellHtml(meta, rel, preserve.html ? preserve : null));
    written++;
    continue;
  }

  /* register/* uses live os-register wizard — do not overwrite */
  if (rel.startsWith("register/")) continue;

  const route = routeFromRel(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, publicProtoHtml(rel, route, "public"));
  written++;
}

fs.writeFileSync(
  path.join(ROOT, "index.html"),
  publicProtoHtml("index.html", "index", "public").replace(
    "<title>Clinicos</title>",
    "<title>Clinicos — Run your clinic without the paperwork</title>\n<meta name=\"description\" content=\"Appointments, patients, consultations, WhatsApp, and your AI receptionist — connected in one clinic workspace.\" />\n<link rel=\"icon\" href=\"/favicon.svg\">"
  )
);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const DIST = path.join(ROOT, "clinicos-api", "dist", "public");
["superadmin/clinics/detail/index.html"].forEach(function (rel) {
  const target = path.join(ROOT, rel);
  if (!fs.existsSync(target)) return;
  const meta = { route: "superadmin/clinics/detail", title: "Organization" };
  const preserve = extractPreserve(target);
  fs.writeFileSync(
    target,
    adminShellHtml(meta, rel, preserve.html ? preserve : null)
  );
  written++;
});

copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));

function mirrorHtml(rel) {
  const src = path.join(ROOT, rel);
  const dest = path.join(DIST, rel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const rel of protoFiles) {
  if (rel === "index.html" && !rel.includes("/")) continue;
  mirrorHtml(rel);
}
mirrorHtml("index.html");

console.log("Prototype integration: wrote", written, "HTML shells; home theme -> light; assets synced to dist/public");
