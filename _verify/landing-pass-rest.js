const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "landing-pass");
const BASE = "http://127.0.0.1:4173";
const shot = (page, name, opts) => page.screenshot({ path: path.join(OUT, name), ...opts });

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const report = { console: [], ctas: {}, brokenImgs: [] };

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on("console", (m) => { if (m.type() === "error") report.console.push("d: " + m.text()); });
  desktop.on("pageerror", (e) => report.console.push("d-page: " + e.message));
  desktop.on("response", (res) => {
    if (/\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/i.test(res.url()) && res.status() >= 400) {
      report.brokenImgs.push(res.status() + " " + res.url());
    }
  });
  await desktop.goto(BASE + "/", { waitUntil: "networkidle" });
  await desktop.waitForSelector("h1");

  report.h1 = (await desktop.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
  report.copyright = (await desktop.locator(".dma-pub-copy").innerText()).trim();
  report.navOneRow = await desktop.evaluate(() => {
    const nav = document.querySelector(".dma-pub-nav");
    return nav.scrollHeight <= nav.clientHeight + 6 ? "one-row" : "wrapped";
  });
  report.radius = await desktop.evaluate(() => ({
    btn: getComputedStyle(document.querySelector(".dma-lp-hero .dma-btn-primary")).borderRadius,
    frame: getComputedStyle(document.querySelector(".dma-os-frame")).borderRadius,
    card: getComputedStyle(document.querySelector(".dma-lp-card")).borderRadius
  }));
  report.hipaa = /HIPAA|SOC\s*2|ISO 27001/i.test(await desktop.locator("body").innerText());
  report.imgs = await desktop.evaluate(() => [...document.images].map((i) => ({
    src: i.getAttribute("src"), complete: i.complete, nw: i.naturalWidth, broken: i.complete && i.naturalWidth === 0
  })));

  await desktop.locator(".dma-pub-links > li:not(.dma-pub-dd):not(.dma-pub-menu-brand) > a").first().hover();
  await desktop.waitForTimeout(150);
  await shot(desktop, "11-nav-hover.png", { clip: { x: 0, y: 0, width: 1440, height: 72 } });
  await desktop.locator(".dma-lp-hero a.dma-btn-primary").hover();
  await desktop.waitForTimeout(150);
  await shot(desktop, "12-cta-hover.png", { clip: { x: 32, y: 250, width: 560, height: 180 } });

  await desktop.locator("[data-dma-demo]").click();
  await desktop.waitForTimeout(250);
  report.demoOpen = await desktop.locator("#dma-demo-dialog").evaluate((el) => !!el.open);
  report.demoHasVideo = (await desktop.locator("#dma-demo-dialog video, #dma-demo-dialog iframe").count()) > 0;
  await shot(desktop, "13-demo-placeholder.png");
  await desktop.locator("[data-dma-demo-close]").click();

  async function cta(sel, expectPath) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await p.locator(sel).first().click();
    await p.waitForTimeout(800);
    const url = p.url();
    report.ctas[sel] = { url, ok: url.includes(expectPath) };
    await p.close();
  }
  await cta(".dma-lp-hero a.dma-btn-primary", "/register");
  await cta(".dma-pub-cta a.dma-btn-ghost", "/doctor-login");
  await cta(".dma-cta-band a[href='/contact/']", "/contact");

  await desktop.goto(BASE + "/pricing/", { waitUntil: "networkidle" });
  await desktop.waitForTimeout(400);
  report.pricing = { url: desktop.url(), bg: await desktop.evaluate(() => getComputedStyle(document.body).backgroundColor) };

  const m390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  m390.on("console", (m) => { if (m.type() === "error") report.console.push("m390: " + m.text()); });
  await m390.goto(BASE + "/", { waitUntil: "networkidle" });
  await m390.waitForTimeout(300);
  report.m390 = {
    headerLogo: await m390.locator("#dma-pub-nav > .dma-pub-logo").isVisible(),
    dock: await m390.locator(".dma-pub-dock a").count(),
    overflow: await m390.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1),
    heroMin: await m390.evaluate(() => getComputedStyle(document.querySelector(".dma-lp-hero")).minHeight),
    waList: await m390.evaluate(() => {
      const list = document.querySelector(".dma-os-wa-list");
      const ctx = document.querySelector(".dma-os-wa-ctx");
      return { list: list && getComputedStyle(list).display, ctx: ctx && getComputedStyle(ctx).display };
    }),
    footerGrid: await m390.evaluate(() => getComputedStyle(document.querySelector(".dma-pub-foot")).gridTemplateColumns),
    ctaH: Math.round(await m390.locator(".dma-lp-hero a.dma-btn-primary").evaluate((el) => el.getBoundingClientRect().height))
  };
  await shot(m390, "m390-hero.png");
  await m390.locator("#platform").screenshot({ path: path.join(OUT, "m390-showcase.png") });
  await m390.locator("#clinic-crm").screenshot({ path: path.join(OUT, "m390-whatsapp.png") });
  await m390.locator("#dma-public-footer").screenshot({ path: path.join(OUT, "m390-footer.png") });
  await m390.evaluate(() => window.scrollTo(0, 0));
  await m390.locator("#dma-pub-toggle").click();
  await m390.waitForTimeout(280);
  await shot(m390, "m390-menu.png");

  const m320 = await browser.newPage({ viewport: { width: 320, height: 700 } });
  m320.on("console", (m) => { if (m.type() === "error") report.console.push("m320: " + m.text()); });
  await m320.goto(BASE + "/", { waitUntil: "networkidle" });
  await m320.waitForTimeout(300);
  report.m320overflow = await m320.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1);
  await shot(m320, "m320-hero.png");

  report.files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
