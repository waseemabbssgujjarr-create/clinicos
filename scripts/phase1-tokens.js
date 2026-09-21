/**
 * Phase 1 CSS surgery: complete --ds-* dark remaps, AA teal fills,
 * scope the forced-dark IQPigeon-blue overlay to [data-theme="dark"],
 * drop Inter from the bundle, header 64 / sidebar 240.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "..", "dma-design-system.css");
let css = fs.readFileSync(file, "utf8");

css = css.replace(
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap");',
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800&display=swap");'
);

css = css.replace(
  /--ds-font: "Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/,
  '--ds-font: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
);
css = css.replace(
  /--ds-font-display: Montserrat, "Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/,
  '--ds-font-display: Montserrat, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
);

css = css.replace(/Inter, -apple-system/g, "-apple-system");
css = css.replace(/"Plus Jakarta Sans", Inter,/g, '"Plus Jakarta Sans",');
css = css.replace(/font-family: Inter,/g, 'font-family: var(--ds-font),');

if (!css.includes("--ds-primary-fill:")) {
  css = css.replace(
    "--ds-primary-hover:  #0E7A68;",
    `--ds-primary-hover:  #0E7A68;
  --ds-primary-fill:   #0E7A68; /* AA vs white ~5.3:1 — do not fill with #14967F */
  --ds-on-primary:     #FFFFFF;
  --ds-link:           #0B6456;`
  );
}

css = css.replace("--ds-h-header: 56px;", "--ds-h-header: 64px;");
css = css.replace("--ds-sidebar:  220px;", "--ds-sidebar:  240px;");

if (!css.includes("--ds-r-card-sm:")) {
  css = css.replace("--ds-r-card:    16px;", "--ds-r-card:    16px;\n  --ds-r-card-sm: 14px;");
}

if (!css.includes("--text-display:")) {
  css = css.replace(
    "--ds-title: 1.375rem;",
    `--ds-title: 1.375rem;
  --text-display: 1.875rem;
  --text-title: 1.25rem;
  --text-subtitle: 1rem;
  --text-kpi: 1.875rem;
  --ds-h-display: 1.875rem;`
  );
}

if (!css.includes("--sa-sidebar-bg: var(--ds-nav)")) {
  css = css.replace("--sa-sidebar-bg: #191919;", "--sa-sidebar-bg: var(--ds-nav);");
}

const darkBlock = `html[data-theme="dark"] {
  color-scheme: dark;
  --ds-primary:        #3DB8A3;
  --ds-primary-hover:  #5CC9B8;
  --ds-primary-active: #14967F;
  --ds-primary-fill:   #0E7A68;
  --ds-on-primary:     #FFFFFF;
  --ds-link:           #5CC9B8;
  --ds-primary-soft:   rgba(61, 184, 163, 0.16);
  --ds-primary-glow:   rgba(61, 184, 163, 0.28);
  --ds-bg:             #0B1220;
  --ds-bg-clinic:      #0B1220;
  --ds-bg-2:           #121C2A;
  --ds-surface:        #12202C;
  --ds-surface-2:      #182830;
  --ds-surface-section:#0F1A24;
  --ds-surface-hover:  #1A2A36;
  --ds-elevated:       #1A2C38;
  --ds-text:           #F1F5F9;
  --ds-text-2:         #E2E8F0;
  --ds-text-3:         #CBD5E1;
  --ds-muted:          #94A3B8;
  --ds-faint:          #64748B;
  --ds-border:         rgba(148, 163, 184, 0.14);
  --ds-border-2:       rgba(148, 163, 184, 0.26);
  --ds-mint:           rgba(14, 122, 104, 0.18);
  --ds-mint-deep:      rgba(14, 122, 104, 0.28);
  --ds-aqua:           #0A1518;
  --ds-yellow-soft:    rgba(250, 208, 105, 0.12);
  --ds-nav:            #0B6456;
  --ds-nav-text:       #FFFFFF;
  --ds-nav-muted:      rgba(255, 255, 255, 0.72);
  --ds-nav-faint:      rgba(255, 255, 255, 0.52);
  --ds-nav-hover:      rgba(20, 150, 127, 0.16);
  --ds-nav-active:     rgba(20, 150, 127, 0.28);
  --ds-shadow-xs:      0 0 0 1px var(--ds-border);
  --ds-shadow-sm:      0 0 0 1px var(--ds-border);
  --ds-shadow-md:      0 0 0 1px var(--ds-border-2);
  --ds-focus:          0 0 0 3px rgba(61, 184, 163, 0.35);
  --ds-grad-primary:   linear-gradient(135deg, #0E7A68 0%, #0B6456 100%);
  --bg:            var(--ds-bg);
  --bg-2:          var(--ds-bg-2);
  --surface:       var(--ds-surface);
  --surface-2:     var(--ds-surface-2);
  --surface-3:     var(--ds-surface-hover);
  --sidebar-bg:    var(--ds-nav);
  --text-1:        var(--ds-text);
  --text-2:        var(--ds-text-2);
  --text-3:        var(--ds-text-3);
  --muted:         var(--ds-muted);
  --faint:         var(--ds-faint);
  --placeholder:   var(--ds-faint);
  --border:        var(--ds-border);
  --border-2:      var(--ds-border-2);
  --sidebar-text:  var(--ds-nav-muted);
  --sidebar-hover: var(--ds-nav-hover);
  --sidebar-act:   var(--ds-nav-active);
  --doc-bg:        var(--ds-bg);
  --doc-surface:   var(--ds-surface);
  --doc-surface-2: var(--ds-surface-2);
  --doc-text:      var(--ds-text);
  --doc-muted:     var(--ds-muted);
  --doc-border:    var(--ds-border);
  --doc-border-2:  var(--ds-border-2);
  --doc-sidebar:   var(--ds-nav);
  --sa-main-bg:    var(--ds-bg);
  --sa-card-bg:    var(--ds-surface);
  --sa-text:       var(--ds-text);
  --sa-muted:      var(--ds-muted);
  --sa-sidebar-bg: var(--ds-nav);
  --sa-input-bg:   var(--ds-surface-2);
  --sa-input-border: var(--ds-border-2);
  --cos-bg:        var(--ds-bg);
  --cos-surface:   var(--ds-surface);
  --cos-text:      var(--ds-text);
  --cos-muted:     var(--ds-muted);
  --cos-border:    var(--ds-border);
}`;

css = css.replace(
  /html\[data-theme="dark"\] \{[\s\S]*?color-scheme: dark;\n\}/,
  darkBlock
);

const marker = "html.doc-static,\nhtml.sa-static,\nhtml.dma-world-auth,\nhtml.dma-world-public {";
const markerCrlf = marker.replace(/\n/g, "\r\n");
const idx = css.indexOf(marker) >= 0 ? css.indexOf(marker) : css.indexOf(markerCrlf);
if (idx < 0) {
  console.error("Could not find forced-dark token remap block");
  process.exit(1);
}

const landingMark = "/* ═══════════════════════════════════════════════════════════\n   LANDING PRODUCT OS";
const landingMarkCrlf = landingMark.replace(/\n/g, "\r\n");
let land = css.indexOf(landingMark, idx);
if (land < 0) land = css.indexOf(landingMarkCrlf, idx);
if (land < 0) {
  console.error("Could not find LANDING PRODUCT OS marker");
  process.exit(1);
}

let head = css.slice(0, idx);
let overlay = css.slice(idx, land);
const tail = css.slice(land);

overlay = overlay.replace(/html\.dma-world-auth\[data-theme="dark"\]/g, "html.dma-world-auth.__ds-auth-never-dark");
overlay = overlay.replace(/html\.dma-world-auth body\.portal-page/g, "html.__ds-skip-auth body.portal-page");
overlay = overlay.replace(/html\.dma-world-auth body/g, "html.__ds-skip-auth body");
overlay = overlay.replace(/html\.dma-world-auth h1/g, "html.__ds-skip-auth h1");
overlay = overlay.replace(/html\.dma-world-auth h2/g, "html.__ds-skip-auth h2");
overlay = overlay.replace(/html\.dma-world-auth h3/g, "html.__ds-skip-auth h3");
overlay = overlay.replace(/html\.dma-world-auth input/g, "html.__ds-skip-auth input");
overlay = overlay.replace(/html\.dma-world-auth select/g, "html.__ds-skip-auth select");
overlay = overlay.replace(/html\.dma-world-auth textarea/g, "html.__ds-skip-auth textarea");
overlay = overlay.replace(/html\.dma-world-auth \.dma-btn-primary/g, "html.__ds-skip-auth .dma-btn-primary");
overlay = overlay.replace(/html\.dma-world-auth \.btn\.btn-primary/g, "html.__ds-skip-auth .btn.btn-primary");
overlay = overlay.replace(/html\.dma-world-auth,/g, "/* auth stays light */");
overlay = overlay.replace(/html\.dma-world-auth\s*\{/g, "html.__ds-skip-auth {");

function prefixOnce(block, cls) {
  const re = new RegExp(cls.replace(".", "\\.") + "(?!\\[)", "g");
  return block.replace(re, cls + '[data-theme="dark"]');
}

overlay = prefixOnce(overlay, "html.doc-static");
overlay = prefixOnce(overlay, "html.sa-static");

overlay = overlay.replace(/#2563EB/g, "#0E7A68");
overlay = overlay.replace(/#276AFC/g, "#0B6456");
overlay = overlay.replace(/#1D4ED8/g, "#0B6456");
overlay = overlay.replace(/#3B7BFF/g, "#14967F");
overlay = overlay.replace(/rgba\(37,\s*99,\s*235/g, "rgba(14, 122, 104");
overlay = overlay.replace(/rgba\(37,\s*117,\s*252/g, "rgba(14, 122, 104");
overlay = overlay.replace(/rgba\(37,\s*101,\s*252/g, "rgba(14, 122, 104");

overlay = overlay.replace(/--ds-nav: #141C2B;/g, "--ds-nav: #0B6456;");
overlay = overlay.replace(/--doc-sidebar: #141C2B;/g, "--doc-sidebar: #0B6456;");
overlay = overlay.replace(/--sa-sidebar-bg: #141C2B;/g, "--sa-sidebar-bg: #0B6456;");
overlay = overlay.replace(
  /html\.doc-static\[data-theme="dark"\] \.doc-sidebar,\s*html\.doc-static\[data-theme="dark"\] \.doc-sidebar-backdrop,\s*html\.sa-static\[data-theme="dark"\] \.sa-sidebar \{[\s\S]*?\}/,
  `html.doc-static[data-theme="dark"] .doc-sidebar,
html.doc-static[data-theme="dark"] .doc-sidebar-backdrop,
html.sa-static[data-theme="dark"] .sa-sidebar {
  background: #0B6456 !important;
  color: #F8FBFF !important;
  border-color: rgba(255,255,255,0.12) !important;
}`
);

const lock = `
/* ═══════════════════════════════════════════════════════════
   PHASE 1 TOKEN LOCK — AA teal fills, type, pills, reduced motion
   ═══════════════════════════════════════════════════════════ */
:root {
  --ds-primary-fill: #0E7A68;
  --ds-on-primary: #FFFFFF;
  --ds-link: #0B6456;
}
a { color: var(--ds-link, var(--ds-primary-active)); }
.ds-num, .ds-kpi, .dma-kpi strong, [data-kpi] {
  font-family: var(--ds-font);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
h1, h2, h3, .ds-h-display, .dma-h-display, .doc-topbar h1, .ds-work-header h1 {
  font-family: var(--ds-font-display);
}
body, button, input, select, textarea {
  font-family: var(--ds-font);
  font-size: max(14px, var(--ds-body));
}
.ds-hint, .dma-hint, small, .ds-caption {
  font-size: max(12px, var(--ds-caption));
}
.ds-btn-primary,
.dma-btn-primary,
.sa-btn-primary {
  background: var(--ds-primary-fill) !important;
  color: var(--ds-on-primary) !important;
  -webkit-text-fill-color: var(--ds-on-primary) !important;
  border-color: var(--ds-primary-fill) !important;
  box-shadow: none !important;
  background-image: none !important;
}
.ds-btn-primary:hover:not(:disabled),
.dma-btn-primary:hover:not(:disabled),
.sa-btn-primary:hover:not(:disabled) {
  background: var(--ds-primary-active) !important;
  border-color: var(--ds-primary-active) !important;
}
.ds-pill-ok { background: rgba(21, 128, 61, 0.12); color: #15803D; }
.ds-pill-warn { background: rgba(180, 83, 9, 0.12); color: #B45309; }
.ds-pill-danger { background: rgba(220, 38, 38, 0.12); color: #B91C1C; }
.ds-pill-info { background: var(--ds-primary-soft); color: var(--ds-primary-active); }
.ds-pill-neutral { background: var(--ds-surface-2); color: var(--ds-muted); }
html[data-theme="dark"] .ds-pill-ok { color: #4ADE80; background: rgba(21,128,61,.2); }
html[data-theme="dark"] .ds-pill-warn { color: #FBBF24; background: rgba(180,83,9,.2); }
html[data-theme="dark"] .ds-pill-danger { color: #F87171; background: rgba(220,38,38,.2); }
html[data-theme="dark"] .ds-pill-info { color: var(--ds-primary); }
.ds-empty, .ds-error, .ds-loading { text-align: center; padding: var(--ds-space-8) var(--ds-space-4); }
.ds-empty h2, .ds-error h2 { font-family: var(--ds-font-display); font-size: var(--text-title); margin: 0 0 8px; }
.ds-empty p, .ds-error p { color: var(--ds-muted); margin: 0; }
.ds-skel { height: 12px; border-radius: 8px; background: linear-gradient(90deg, var(--ds-surface-2), var(--ds-surface-hover), var(--ds-surface-2)); background-size: 200% 100%; animation: ds-skel 1.2s ease infinite; }
@keyframes ds-skel { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  .ds-skel { animation: none; }
}
html.dma-world-auth { color-scheme: light; }
html.dma-world-auth[data-theme="dark"] { color-scheme: light; }
`;

css = head + overlay + tail;
if (!css.includes("PHASE 1 TOKEN LOCK")) {
  css += lock;
}

fs.writeFileSync(file, css);
console.log("Patched dma-design-system.css", css.length, "chars");
