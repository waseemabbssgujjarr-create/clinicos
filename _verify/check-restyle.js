const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

(async () => {
  const base = process.env.BASE || "http://127.0.0.1:64261";
  const out = path.join(__dirname, "restyle");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const results = {};

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(base + "/", { waitUntil: "networkidle" });
  results.heading = await mobile.evaluate(() => {
    const h = document.querySelector(".dma-h-display");
    const p = document.querySelector(".lede");
    const hs = h ? getComputedStyle(h) : {};
    const ps = p ? getComputedStyle(p) : {};
    return {
      headingFont: hs.fontFamily,
      headingColor: hs.color,
      headingWeight: hs.fontWeight,
      bodyFont: ps.fontFamily,
      bodyColor: ps.color,
      text: h ? h.innerText.replace(/\s+/g, " ").slice(0, 80) : null,
    };
  });
  await mobile.screenshot({ path: path.join(out, "landing-390.png") });

  await mobile.click("#dma-pub-toggle");
  await mobile.waitForTimeout(300);
  results.menu = await mobile.evaluate(() => {
    const link = document.querySelector(".dma-pub-nav.is-open .dma-pub-links a");
    const logo = document.querySelector(".dma-pub-nav.is-open .dma-pub-menu-brand .dma-pub-logo");
    const panel = document.querySelector(".dma-pub-nav.is-open .dma-pub-links");
    const drop = document.querySelector(".dma-pub-nav.is-open .dma-pub-drop");
    const ls = link ? getComputedStyle(link) : {};
    const os = logo ? getComputedStyle(logo) : {};
    const ps = panel ? getComputedStyle(panel) : {};
    const ds = drop ? getComputedStyle(drop) : {};
    function lum(c) {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
    }
    return {
      panelBg: ps.backgroundColor,
      linkColor: ls.color,
      linkFill: ls.webkitTextFillColor,
      linkLum: lum(ls.color),
      logoColor: os.color,
      logoLum: lum(os.color),
      dropColor: ds.color,
      linkText: link ? link.innerText : null,
      logoText: logo ? logo.innerText : null,
    };
  });
  await mobile.screenshot({ path: path.join(out, "menu-open-390.png") });

  await mobile.goto(base + "/doctor-login/", { waitUntil: "networkidle" });
  results.login = await mobile.evaluate(() => {
    const h = document.querySelector("h1, h2");
    const label = document.querySelector("label");
    const body = getComputedStyle(document.body);
    const hs = h ? getComputedStyle(h) : {};
    const ls = label ? getComputedStyle(label) : {};
    return {
      bodyBg: body.backgroundColor,
      bodyColor: body.color,
      headingFont: hs.fontFamily,
      headingColor: hs.color,
      labelFont: ls.fontFamily,
      headingText: h ? h.innerText.slice(0, 60) : null,
    };
  });
  await mobile.screenshot({ path: path.join(out, "login-390.png") });

  const dash = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await dash.addInitScript(() => {
    localStorage.setItem("token", "verify");
    localStorage.setItem("clinicos-store", JSON.stringify({
      state: { user: { role: "OWNER", name: "Verify Clinic", email: "a@b.c" }, token: "verify" },
      version: 0
    }));
  });
  await dash.goto(base + "/dashboard/patients/", { waitUntil: "networkidle" });
  results.dashboard = await dash.evaluate(() => {
    const h = document.querySelector(".doc-topbar h1, h1");
    const nav = document.querySelector(".doc-nav a");
    const tabs = document.querySelector(".ds-workspace-tabs");
    const body = getComputedStyle(document.body);
    const hs = h ? getComputedStyle(h) : {};
    const ns = nav ? getComputedStyle(nav) : {};
    return {
      url: location.pathname,
      htmlClass: document.documentElement.className,
      bodyBg: body.backgroundColor,
      headingFont: hs.fontFamily,
      headingColor: hs.color,
      headingText: h ? h.innerText.slice(0, 60) : null,
      navFont: ns.fontFamily,
      navColor: ns.color,
      navCount: document.querySelectorAll(".doc-nav a").length,
      groups: Array.from(document.querySelectorAll(".doc-nav-section")).map((el) => el.textContent),
      hasTabs: !!tabs,
    };
  });
  await dash.screenshot({ path: path.join(out, "dashboard.png") });

  results.loginInput = await mobile.evaluate(() => {
    const input = document.querySelector('input[type="email"], input[type="password"]');
    const cs = input ? getComputedStyle(input) : {};
    return { bg: cs.backgroundColor, color: cs.color, fill: cs.webkitTextFillColor };
  });

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
