const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "landing-pass");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:4173";

function shot(page, name, opts) {
  return page.screenshot({ path: path.join(OUT, name), ...opts });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const report = { console: [], pageErrors: [], brokenImgs: [], ctas: {}, notes: [] };

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on("console", (m) => { if (m.type() === "error") report.console.push("d: " + m.text()); });
  desktop.on("pageerror", (e) => report.pageErrors.push("d: " + e.message));
  desktop.on("response", (res) => {
    const u = res.url();
    if (/\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/i.test(u) && res.status() >= 400) {
      report.brokenImgs.push(res.status() + " " + u);
    }
  });

  await desktop.goto(BASE + "/", { waitUntil: "networkidle" });
  await desktop.waitForSelector("h1");
  await desktop.waitForTimeout(400);

  report.h1 = (await desktop.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
  report.navOneRow = await desktop.evaluate(() => {
    const nav = document.querySelector(".dma-pub-nav");
    if (!nav) return "missing";
    return nav.scrollHeight <= nav.clientHeight + 6 ? "one-row" : "wrapped h=" + nav.scrollHeight;
  });
  report.heroMin = await desktop.evaluate(() => getComputedStyle(document.querySelector(".dma-lp-hero")).minHeight);
  report.radiusSample = await desktop.evaluate(() => {
    const btn = document.querySelector(".dma-lp-hero .dma-btn-primary");
    const frame = document.querySelector(".dma-os-frame");
    return {
      btn: btn ? getComputedStyle(btn).borderRadius : null,
      frame: frame ? getComputedStyle(frame).borderRadius : null
    };
  });
  report.hipaaOnPage = await desktop.evaluate(() => /HIPAA|SOC\s*2|ISO\s*27001/i.test(document.body.innerText));
  report.imgs = await desktop.evaluate(() => {
    return [...document.images].map((img) => ({
      src: img.getAttribute("src"),
      complete: img.complete,
      w: img.naturalWidth,
      h: img.naturalHeight,
      vis: img.offsetParent !== null || img.getClientRects().length > 0
    }));
  });

  await shot(desktop, "01-hero.png");
  await shot(desktop, "02-nav.png", { clip: { x: 0, y: 0, width: 1440, height: 72 } });

  async function sectionShot(sel, file) {
    const loc = desktop.locator(sel).first();
    await loc.scrollIntoViewIfNeeded();
    await desktop.waitForTimeout(180);
    await loc.screenshot({ path: path.join(OUT, file) });
  }

  await sectionShot("#problem", "03-problem.png");
  await sectionShot("#platform", "04-showcase.png");
  await sectionShot("#clinic-crm", "05-whatsapp.png");
  await sectionShot("#ai-receptionist", "06-ai.png");
  await sectionShot("#patients-view", "07-patients.png");
  await sectionShot("#clinical", "08-consult.png");

  await desktop.locator("#analytics").scrollIntoViewIfNeeded();
  await desktop.waitForTimeout(150);
  const a = await desktop.locator("#analytics").boundingBox();
  const t = await desktop.locator("#trust").boundingBox();
  if (a && t) {
    await desktop.screenshot({
      path: path.join(OUT, "09-analytics-trust.png"),
      clip: {
        x: 0,
        y: Math.max(0, a.y - 8),
        width: 1440,
        height: Math.min(900, t.y + t.height - a.y + 24)
      }
    });
  } else {
    await sectionShot("#trust", "09-analytics-trust.png");
  }

  await desktop.locator(".dma-cta-band").last().scrollIntoViewIfNeeded();
  await desktop.waitForTimeout(150);
  const cta = await desktop.locator(".dma-cta-band").last().boundingBox();
  const foot = await desktop.locator("#dma-public-footer").boundingBox();
  const copy = desktop.locator(".dma-pub-copy");
  report.copyright = (await copy.innerText()).trim();
  if (cta && foot) {
    const top = Math.max(0, cta.y - 12);
    const bottom = Math.min(900, (foot.y - cta.y) + foot.height + 24);
    await desktop.screenshot({
      path: path.join(OUT, "10-cta-footer.png"),
      clip: { x: 0, y: top, width: 1440, height: Math.min(880, foot.y + foot.height - top + 8) }
    });
  } else {
    await desktop.locator("#dma-public-footer").screenshot({ path: path.join(OUT, "10-cta-footer.png") });
  }

  // Hover nav + primary button
  await desktop.goto(BASE + "/", { waitUntil: "networkidle" });
  await desktop.locator(".dma-pub-links a").first().hover();
  await desktop.waitForTimeout(120);
  await shot(desktop, "11-nav-hover.png", { clip: { x: 0, y: 0, width: 1440, height: 72 } });
  await desktop.locator(".dma-lp-hero .dma-btn-primary").hover();
  await desktop.waitForTimeout(120);
  await shot(desktop, "12-cta-hover.png", { clip: { x: 40, y: 280, width: 520, height: 160 } });

  // Demo placeholder
  await desktop.locator("[data-dma-demo]").first().click();
  await desktop.waitForTimeout(250);
  report.demoOpen = await desktop.locator("#dma-demo-dialog").evaluate((el) => el.open === true || el.hasAttribute("open"));
  const video = await desktop.locator("#dma-demo-dialog video, #dma-demo-dialog iframe").count();
  report.demoPlayingMedia = video > 0;
  await shot(desktop, "13-demo-placeholder.png");
  await desktop.locator("[data-dma-demo-close]").click();

  // CTA click tests (don't need full register form — confirm navigation)
  async function clickGoes(sel, expectPath) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.locator(sel).first().click();
    await page.waitForTimeout(600);
    const url = page.url();
    const ok = url.indexOf(expectPath) !== -1;
    report.ctas[sel + " -> " + expectPath] = { url, ok };
    await page.close();
    return ok;
  }
  await clickGoes(".dma-lp-hero a.dma-btn-primary", "/register");
  await clickGoes(".dma-pub-cta a.dma-btn-ghost", "/doctor-login");
  await clickGoes(".dma-cta-band a[href='/contact/']", "/contact");

  // Hash
  await desktop.goto(BASE + "/#pricing", { waitUntil: "networkidle" });
  await desktop.waitForTimeout(350);
  report.hashPricing = await desktop.evaluate(() => {
    const el = document.getElementById("pricing");
    const r = el.getBoundingClientRect();
    return { url: location.href, inView: r.top < innerHeight && r.bottom > 0, bg: getComputedStyle(document.body).backgroundColor };
  });

  // Mobile 390
  const m390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  m390.on("console", (m) => { if (m.type() === "error") report.console.push("m390: " + m.text()); });
  await m390.goto(BASE + "/", { waitUntil: "networkidle" });
  await m390.waitForTimeout(300);
  report.m390 = {
    logoInHeader: await m390.locator("#dma-pub-nav > .dma-pub-logo").isVisible(),
    dock: await m390.locator(".dma-pub-dock a").count(),
    overflow: await m390.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1),
    heroMin: await m390.evaluate(() => getComputedStyle(document.querySelector(".dma-lp-hero")).minHeight),
    waCols: await m390.evaluate(() => {
      const wa = document.querySelector(".dma-os-wa");
      if (!wa) return null;
      const cs = getComputedStyle(wa);
      const list = document.querySelector(".dma-os-wa-list");
      const ctx = document.querySelector(".dma-os-wa-ctx");
      return {
        cols: cs.gridTemplateColumns,
        listDisplay: list ? getComputedStyle(list).display : null,
        ctxDisplay: ctx ? getComputedStyle(ctx).display : null
      };
    }),
    footerCols: await m390.evaluate(() => getComputedStyle(document.querySelector(".dma-pub-foot")).gridTemplateColumns),
    startH: await m390.locator(".dma-lp-hero a.dma-btn-primary").evaluate((el) => el.getBoundingClientRect().height)
  };
  await shot(m390, "m390-hero.png");
  await m390.locator("#platform").scrollIntoViewIfNeeded();
  await m390.waitForTimeout(150);
  await m390.locator("#platform").screenshot({ path: path.join(OUT, "m390-showcase.png") });
  await m390.locator("#clinic-crm").scrollIntoViewIfNeeded();
  await m390.waitForTimeout(150);
  await m390.locator("#clinic-crm").screenshot({ path: path.join(OUT, "m390-whatsapp.png") });
  await m390.locator("#dma-public-footer").scrollIntoViewIfNeeded();
  await m390.waitForTimeout(150);
  await m390.locator("#dma-public-footer").screenshot({ path: path.join(OUT, "m390-footer.png") });
  await m390.evaluate(() => window.scrollTo(0, 0));
  await m390.locator("#dma-pub-toggle").click();
  await m390.waitForTimeout(250);
  await shot(m390, "m390-menu.png");

  // Mobile 320
  const m320 = await browser.newPage({ viewport: { width: 320, height: 700 } });
  m320.on("console", (m) => { if (m.type() === "error") report.console.push("m320: " + m.text()); });
  await m320.goto(BASE + "/", { waitUntil: "networkidle" });
  await m320.waitForTimeout(300);
  report.m320overflow = await m320.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1);
  await shot(m320, "m320-hero.png");

  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
  report.files = files;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
