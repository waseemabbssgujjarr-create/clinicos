const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "lp-pass");
fs.mkdirSync(out, { recursive: true });

const WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1600];
const HASHES = ["#platform", "#solutions", "#pricing", "#clinic-crm", "#ai-receptionist", "#clinical", "#patient-experience", "#for-clinics"];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const results = [];
  const consoleErrs = [];

  async function checkOverflow(page, label) {
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const extra = [];
      const max = Math.max(doc.scrollWidth, body.scrollWidth);
      if (max > window.innerWidth + 1) extra.push("doc=" + max + " vw=" + window.innerWidth);
      return extra;
    });
    results.push({ label, overflow });
    return overflow;
  }

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on("pageerror", (e) => consoleErrs.push("pageerror " + e.message));
  desktop.on("console", (msg) => { if (msg.type() === "error") consoleErrs.push("console " + msg.text()); });
  await desktop.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await desktop.waitForSelector(".dma-lp-hero h1");
  await desktop.screenshot({ path: path.join(out, "hero-1440.png"), fullPage: false });
  const h1 = await desktop.locator("h1").first().innerText();
  const footer = await desktop.locator(".dma-pub-copy").innerText();
  const navWrap = await desktop.evaluate(() => {
    const nav = document.querySelector(".dma-pub-nav");
    if (!nav) return "no-nav";
    return nav.scrollHeight <= nav.clientHeight + 8 ? "one-row" : "wrapped:" + nav.scrollHeight;
  });
  const startHref = await desktop.locator(".dma-lp-hero a.dma-btn-primary").getAttribute("href");
  const loginHref = await desktop.locator(".dma-pub-cta a").first().getAttribute("href");
  await checkOverflow(desktop, "1440-home");

  await desktop.locator("[data-dma-demo]").first().click();
  await desktop.waitForTimeout(200);
  const demoOpen = await desktop.locator("#dma-demo-dialog").evaluate((el) => el.open === true || el.hasAttribute("open"));
  await desktop.screenshot({ path: path.join(out, "demo-1440.png") });
  await desktop.locator("[data-dma-demo-close]").click();
  await desktop.waitForTimeout(150);

  for (const hash of HASHES) {
    await desktop.goto("http://127.0.0.1:4173/" + hash, { waitUntil: "networkidle" });
    await desktop.waitForTimeout(200);
    const id = hash.slice(1);
    const visible = await desktop.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return "missing";
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0 ? "in-view" : "offscreen top=" + Math.round(r.top);
    }, id);
    results.push({ hash, visible });
  }

  await desktop.goto("http://127.0.0.1:4173/pricing/", { waitUntil: "networkidle" });
  await desktop.waitForTimeout(400);
  results.push({ pricingUrl: desktop.url(), bg: await desktop.evaluate(() => getComputedStyle(document.body).backgroundColor) });
  await desktop.screenshot({ path: path.join(out, "pricing-1440.png"), fullPage: false });

  await desktop.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  for (const sel of ["#platform", "#clinic-crm", "#ai-receptionist", "#clinical", "#analytics", "#trust", "#pricing", ".dma-cta-band"]) {
    await desktop.locator(sel).first().scrollIntoViewIfNeeded();
    await desktop.waitForTimeout(80);
  }
  await desktop.screenshot({ path: path.join(out, "full-1440.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (e) => consoleErrs.push("m-pageerror " + e.message));
  mobile.on("console", (msg) => { if (msg.type() === "error") consoleErrs.push("m-console " + msg.text()); });
  await mobile.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  const logoVisible = await mobile.locator("#dma-pub-nav > .dma-pub-logo").isVisible();
  const heroMin = await mobile.evaluate(() => getComputedStyle(document.querySelector(".dma-lp-hero")).minHeight);
  const dock = await mobile.locator(".dma-pub-dock a").count();
  await checkOverflow(mobile, "390-home");
  await mobile.screenshot({ path: path.join(out, "hero-390.png") });
  await mobile.locator("#dma-pub-toggle").click();
  await mobile.waitForTimeout(250);
  await mobile.screenshot({ path: path.join(out, "menu-390.png") });
  await mobile.locator("#dma-pub-toggle").click();
  await mobile.locator("#platform").scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(out, "showcase-390.png") });
  await mobile.locator("#clinic-crm").scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(out, "wa-390.png") });
  await mobile.locator("#ai-receptionist").scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(out, "ai-390.png") });
  await mobile.locator(".dma-cta-band").last().scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(out, "cta-390.png") });
  await mobile.locator("#dma-public-footer").scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(out, "footer-390.png") });

  for (const w of WIDTHS) {
    const p = await browser.newPage({ viewport: { width: w, height: w < 768 ? 740 : 900 } });
    await p.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector("h1");
    const ov = await checkOverflow(p, "w" + w);
    await p.close();
    if (ov.length) results.push({ width: w, overflow: ov });
  }

  console.log(JSON.stringify({
    h1,
    footer,
    navWrap,
    startHref,
    loginHref,
    demoOpen,
    logoVisibleMobile: logoVisible,
    heroMin,
    dock,
    consoleErrs,
    results
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
