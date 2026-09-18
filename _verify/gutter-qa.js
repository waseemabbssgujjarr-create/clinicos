const { chromium } = require("playwright-core");
const path = require("path");
const out = path.join(__dirname, "landing-pass");

function box(el) {
  return el.evaluate((n) => {
    const r = n.getBoundingClientRect();
    const s = getComputedStyle(n);
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      pos: s.position,
      gap: s.gap,
      pad: s.padding,
      display: s.display,
      cols: s.gridTemplateColumns,
    };
  });
}

function overlap(a, b) {
  return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173/?v=57", { waitUntil: "networkidle", timeout: 25000 });
  await page.waitForTimeout(500);

  const h1 = await page.locator(".dma-lp-hero h1").innerText();
  const floats = page.locator(".dma-lp-float");
  const floatCount = await floats.count();
  const dash = await box(page.locator(".dma-os-hero-frame"));
  const extras = await box(page.locator(".dma-lp-hero-extras"));
  const floatBoxes = [];
  for (let i = 0; i < floatCount; i++) floatBoxes.push(await box(floats.nth(i)));
  const overlapsDash = floatBoxes.map((f) => overlap(dash, f));
  const overlapsEach = [];
  for (let i = 0; i < floatBoxes.length; i++) {
    for (let j = i + 1; j < floatBoxes.length; j++) {
      if (overlap(floatBoxes[i], floatBoxes[j])) overlapsEach.push([i, j]);
    }
  }
  const hero = await box(page.locator(".dma-lp-hero"));
  const wrap = await box(page.locator(".dma-lp-hero-grid"));

  await page.locator(".dma-lp-hero").screenshot({ path: path.join(out, "fix-hero-1440.png") });

  await page.locator("#problem").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const pain = await box(page.locator(".dma-lp-pain"));
  const cards = page.locator(".dma-lp-pain .dma-lp-card");
  const cardN = await cards.count();
  const cardBoxes = [];
  for (let i = 0; i < cardN; i++) cardBoxes.push(await box(cards.nth(i)));
  const cardTouches = [];
  for (let i = 0; i < cardBoxes.length; i++) {
    for (let j = i + 1; j < cardBoxes.length; j++) {
      const a = cardBoxes[i], b = cardBoxes[j];
      const gx = Math.max(0, Math.max(a.x, b.x) < Math.min(a.right, b.right) ? 0 : Math.min(Math.abs(a.right - b.x), Math.abs(b.right - a.x)));
      const gy = Math.max(0, Math.max(a.y, b.y) < Math.min(a.bottom, b.bottom) ? 0 : Math.min(Math.abs(a.bottom - b.y), Math.abs(b.bottom - a.y)));
      const touching = overlap(a, b) || (Math.abs(a.bottom - b.y) < 2 && Math.max(a.x, b.x) < Math.min(a.right, b.right)) || (Math.abs(a.right - b.x) < 2 && Math.max(a.y, b.y) < Math.min(a.bottom, b.bottom));
      if (touching) cardTouches.push({ i, j, gx, gy });
    }
  }
  await page.locator("#problem").screenshot({ path: path.join(out, "fix-problem-1440.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/?v=57", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const hero390 = await box(page.locator(".dma-lp-hero"));
  const float390 = [];
  const f390n = await page.locator(".dma-lp-float").count();
  for (let i = 0; i < f390n; i++) float390.push(await box(page.locator(".dma-lp-float").nth(i)));
  const dash390 = await box(page.locator(".dma-os-hero-frame"));
  const ov390 = float390.map((f) => overlap(dash390, f));
  await page.locator(".dma-lp-hero").screenshot({ path: path.join(out, "fix-hero-390.png") });
  await page.locator("#problem").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const pain390 = await box(page.locator(".dma-lp-pain"));
  await page.locator("#problem").screenshot({ path: path.join(out, "fix-problem-390.png") });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:4173/dashboard/?v=21", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(700);
  const dashUrl = page.url();
  const dashPad = await page.locator(".doc-main").evaluate((n) => {
    if (!n) return null;
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return { pad: s.padding, x: Math.round(r.x), w: Math.round(r.width), bg: s.backgroundColor };
  }).catch(() => null);
  await page.screenshot({ path: path.join(out, "fix-dashboard-home.png") });

  await page.goto("http://127.0.0.1:4173/superadmin/?v=16", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(700);
  const saUrl = page.url();
  const saPad = await page.locator(".sa-main").evaluate((n) => {
    if (!n) return null;
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return { pad: s.padding, x: Math.round(r.x), w: Math.round(r.width), bg: s.backgroundColor };
  }).catch(() => null);
  await page.screenshot({ path: path.join(out, "fix-superadmin.png") });

  console.log(JSON.stringify({
    h1,
    floatCount,
    dash,
    extras,
    floatBoxes,
    overlapsDash,
    overlapsEach,
    wrapGutterLeft: wrap.x,
    heroH: hero.h,
    pain,
    cardN,
    cardBoxes: cardBoxes.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, pad: c.pad, right: c.right, bottom: c.bottom })),
    cardTouches,
    painGap: pain.gap,
    painCols: pain.cols,
    hero390H: hero390.h,
    ov390,
    float390pos: float390.map((f) => f.pos),
    dashUrl,
    dashPad,
    saUrl,
    saPad,
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
