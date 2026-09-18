const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:8765/?v=45", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "hero-desktop.png" });

  const cats = await page.locator(".dma-faq-cat").count();
  const faqHeadings = await page.locator("#faqs h2, #faqs h3").count();
  const questions = await page.locator(".dma-faq-q").count();
  await page.locator("#faqs").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "faq-desktop.png" });

  const first = page.locator(".dma-faq-q").first();
  const second = page.locator(".dma-faq-q").nth(1);
  await first.click();
  await page.waitForTimeout(150);
  const firstOpen = await first.getAttribute("aria-expanded");
  await second.click();
  await page.waitForTimeout(150);
  const firstAfter = await first.getAttribute("aria-expanded");
  const secondOpen = await second.getAttribute("aria-expanded");
  await page.screenshot({ path: "faq-open-desktop.png" });

  await page.locator("#dma-public-footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const footerText = await page.locator("#dma-public-footer").innerText();
  await page.locator("#dma-public-footer").screenshot({ path: "footer-desktop.png" });

  const heroHasFloat = await page.locator(".dma-lp-float-chat").count();
  const heroHasGrad = await page.locator(".dma-lp-grad").count();
  const blobs = await page.locator(".dma-lp-blob").count();
  const h1Lh = await page.locator(".dma-lp-hero h1").evaluate((el) => getComputedStyle(el).lineHeight);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:8765/?v=45", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "hero-390.png" });

  await page.goto("http://127.0.0.1:8765/dashboard/ai/?v=8", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const dashUrl = page.url();
  await page.screenshot({ path: "dashboard-ai.png" });

  console.log(JSON.stringify({
    cats,
    faqHeadings,
    questions,
    firstOpen,
    firstAfter,
    secondOpen,
    heroHasFloat,
    heroHasGrad,
    blobs,
    h1Lh,
    footerHasCopyright: footerText.includes("© Clinicos · Doctors My Agency · 2026"),
    footerHasBlurb: footerText.includes("Run your clinic without the paperwork"),
    footerHasFacts: footerText.includes("There is no public doctor directory"),
    dashUrl
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
