/**
 * Inject no-flash theme boot, Jakarta+Montserrat font links, foundation scripts.
 * Root HTML only (not iqpigeon, _next, clinicos-api, e2e-ui, node_modules).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["iqpigeon", "_next", "clinicos-api", "e2e-ui", "node_modules", ".git", "docs", "scripts"]);

const BOOT = `<script>(function(){try{var r=document.documentElement;var c=r.className||"";var t;if(/\\bdma-world-auth\\b/.test(c))t="light";else if(/\\bdma-world-public\\b/.test(c))t="dark";else{t=localStorage.getItem("dma-theme");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}r.setAttribute("data-theme",t);}catch(e){}})();</script>`;

const FONT = `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap`;

const FOUNDATION = [
  '<script src="/js/ds-theme.js?v=1"></script>',
  '<script src="/js/ds-status.js?v=1"></script>',
  '<script src="/js/ds-format.js?v=1"></script>',
  '<script src="/js/ds-permissions.js?v=1"></script>',
  '<script src="/js/ds-icons.js?v=1"></script>',
].join("\n  ");

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
}

const files = [];
walk(ROOT, files);

let changed = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const orig = html;

  html = html.replace(/href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+"/g, 'href="' + FONT + '"');

  html = html.replace(/dma-design-system\.css\?v=\d+/g, "dma-design-system.css?v=60");
  html = html.replace(/dashboard-doctor-shell\.css\?v=\d+/g, "dashboard-doctor-shell.css?v=22");
  html = html.replace(/superadmin-theme\.css\?v=\d+/g, "superadmin-theme.css?v=17");

  if (!html.includes("dma-theme") && /<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, "<head$1>\n  " + BOOT);
  }

  const isApp = /doc-static|sa-static/.test(html);
  if (isApp && !html.includes("/js/ds-theme.js")) {
    html = html.replace(
      /(<link rel="stylesheet" href="\/dma-design-system\.css[^"]*"\s*\/?>)/,
      "$1\n  " + FOUNDATION
    );
    if (!html.includes("/js/ds-theme.js")) {
      html = html.replace("</head>", "  " + FOUNDATION + "\n</head>");
    }
  }

  if (html !== orig) {
    fs.writeFileSync(file, html);
    changed++;
  }
}

console.log("Updated", changed, "of", files.length, "HTML files");
