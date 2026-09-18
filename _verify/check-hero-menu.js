const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

(async () => {
  const base = process.env.BASE || "http://127.0.0.1:4173";
  const out = path.join(__dirname, "restyle");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = { base };

  await page.goto(base + "/?v=47", { waitUntil: "networkidle" });
  results.hero = await page.evaluate(() => {
    const hero = document.querySelector(".dma-lp-hero");
    const stage = document.querySelector(".dma-lp-hero-stage");
    const chat = document.querySelector(".dma-lp-float-chat");
    const wa = document.querySelector(".dma-lp-float-wa");
    const appt = document.querySelector(".dma-lp-float-appt");
    const header = document.querySelector("#dma-public-header");
    const logo = document.querySelector("#dma-pub-nav > .dma-pub-logo");
    const hs = hero ? getComputedStyle(hero) : {};
    const ss = stage ? getComputedStyle(stage) : {};
    const cs = chat ? getComputedStyle(chat) : {};
    function box(el) { return el ? el.getBoundingClientRect() : null; }
    return {
      heroMinH: hs.minHeight,
      heroH: hero ? Math.round(hero.getBoundingClientRect().height) : null,
      heroPad: hs.paddingTop + " / " + hs.paddingBottom,
      stageMinH: ss.minHeight,
      stageDisplay: ss.display,
      stageGap: ss.gap,
      chatPos: cs.position,
      chatW: chat ? Math.round(chat.getBoundingClientRect().width) : null,
      gutter: getComputedStyle(document.querySelector(".dma-pub-wrap")).paddingLeft,
      headerLogoVisible: logo ? getComputedStyle(logo).display !== "none" : null,
      headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
      boxes: {
        copy: box(document.querySelector(".dma-lp-hero-copy")),
        chat: box(chat),
        wa: box(wa),
        appt: box(appt),
        platform: box(document.querySelector("#platform")),
      },
    };
  });
  await page.screenshot({ path: path.join(out, "hero-390.png"), fullPage: false });

  await page.click("#dma-pub-toggle");
  await page.waitForTimeout(250);
  results.menu = await page.evaluate(() => {
    const panel = document.querySelector(".dma-pub-nav.is-open .dma-pub-links");
    const item = document.querySelector(".dma-pub-nav.is-open .dma-pub-links a");
    const ps = panel ? getComputedStyle(panel) : {};
    const is = item ? getComputedStyle(item) : {};
    const r = panel ? panel.getBoundingClientRect() : {};
    return {
      width: Math.round(r.width || 0),
      left: Math.round(r.left || 0),
      radius: ps.borderRadius,
      bg: ps.backgroundColor,
      color: is.color,
      maxWidth: ps.maxWidth,
    };
  });
  const platform = page.locator("#dma-pub-links button.dma-pub-drop").first();
  await platform.hover();
  await page.waitForTimeout(80);
  results.menuHover = await platform.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color };
  });
  await page.screenshot({ path: path.join(out, "menu-open-390.png") });
  await page.click("#dma-pub-toggle");

  results.dockIdle = await page.evaluate(() => {
    const a = document.querySelector(".dma-pub-dock a[href='#solutions']") || document.querySelector(".dma-pub-dock a");
    const s = a ? getComputedStyle(a) : {};
    return { color: s.color, bg: s.backgroundColor, text: a ? a.innerText : null };
  });
  const dockSol = page.locator(".dma-pub-dock a").filter({ hasText: "Solutions" }).first();
  await dockSol.hover();
  await page.waitForTimeout(80);
  results.dockHover = await dockSol.evaluate((el) => {
    const s = getComputedStyle(el);
    const svg = el.querySelector("svg");
    const ss = svg ? getComputedStyle(svg) : {};
    return { color: s.color, bg: s.backgroundColor, stroke: ss.stroke };
  });
  await page.screenshot({ path: path.join(out, "dock-hover-390.png") });

  await page.goto(base + "/doctor-login/", { waitUntil: "networkidle" });
  results.doctorLogin = {
    title: await page.title(),
    heading: await page.locator("h1, h2").first().innerText().catch(() => null),
  };
  await page.screenshot({ path: path.join(out, "login-390.png") });

  const loginRes = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "support@clinicos.aderalabs.com", password: "DmaTest2026!" }),
      });
      const text = await r.text();
      return { status: r.status, ok: r.ok, body: text.slice(0, 180) };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  });
  results.clinicLoginApi = loginRes;

  await page.goto(base + "/superadmin/login/", { waitUntil: "networkidle" });
  results.adminLoginPage = {
    url: page.url(),
    title: await page.title(),
    heading: await page.locator("h1, h2").first().innerText().catch(() => null),
  };
  const adminRes = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/superadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@doctorsmyagency.com", password: "DmaAdmin2026!" }),
      });
      const text = await r.text();
      return { status: r.status, ok: r.ok, body: text.slice(0, 180) };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  });
  results.adminLoginApi = adminRes;
  await page.screenshot({ path: path.join(out, "admin-login.png") });

  await page.goto(base + "/admin-login/", { waitUntil: "networkidle" });
  results.adminLoginAlt = { url: page.url(), title: await page.title() };

  await page.goto(base + "/dashboard/", { waitUntil: "domcontentloaded" });
  results.dashboardUnauth = { url: page.url() };
  await page.goto(base + "/superadmin/", { waitUntil: "domcontentloaded" });
  results.superadminUnauth = { url: page.url() };

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
