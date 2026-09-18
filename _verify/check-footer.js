const { chromium } = require("playwright-core");
const path = require("path");
(async () => {
  const base = "http://127.0.0.1:4173";
  const out = path.join(__dirname, "restyle");
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + "/?v=48", { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const foot = document.querySelector(".dma-pub-foot");
    const brand = document.querySelector(".dma-pub-foot-brand");
    const cols = [...document.querySelectorAll(".dma-pub-foot-col")];
    const fs = foot ? getComputedStyle(foot) : {};
    const copy = document.querySelector(".dma-pub-copy");
    function box(el) { return el ? el.getBoundingClientRect() : null; }
    const cb = cols.map((c) => {
      const b = c.getBoundingClientRect();
      return { text: c.querySelector("strong")?.innerText, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    });
    const sameRow = cb.length === 3 && Math.abs(cb[0].y - cb[1].y) < 8 && Math.abs(cb[1].y - cb[2].y) < 8;
    const hero = document.querySelector(".dma-lp-hero");
    const stage = document.querySelector(".dma-lp-hero-stage");
    const chat = document.querySelector(".dma-lp-float-chat");
    return {
      footCols: fs.gridTemplateColumns,
      footGap: fs.gap,
      brandFull: brand && foot ? Math.abs(brand.getBoundingClientRect().width - (foot.getBoundingClientRect().width)) < 4 : null,
      cols: cb,
      threeOnOneRow: sameRow,
      copy: copy ? copy.innerText : null,
      heroMinH: hero ? getComputedStyle(hero).minHeight : null,
      stageMinH: stage ? getComputedStyle(stage).minHeight : null,
      chatPos: chat ? getComputedStyle(chat).position : null,
      boxes: { copy: box(document.querySelector(".dma-lp-hero-copy")), chat: box(chat), platform: box(document.querySelector("#platform")) },
    };
  });
  await page.locator("#dma-public-footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, "footer-390.png") });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "hero-390.png") });
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
