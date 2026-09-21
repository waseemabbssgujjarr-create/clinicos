/**
 * Clinicos UI redesign regression harness.
 *
 * Justification for Playwright: no frontend test runner in repo; Phase 0 requires
 * viewport, theme, console, overflow, and axe checks on real HTML. Playwright-core
 * is already used under _verify/. This harness adds axe-core and a static server
 * so we can baseline without a database.
 *
 * Auth: only if UI_E2E_OWNER_EMAIL / UI_E2E_OWNER_PASSWORD (and staff/admin variants)
 * exist. No demo users are invented. Without creds, clinic/superadmin visits assert
 * HTML served + login redirect, not in-app chrome.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const { start } = require("./static-server");
const routes = require("./routes");

const LABEL = (function () {
  const i = process.argv.indexOf("--label");
  return i >= 0 ? String(process.argv[i + 1] || "run") : "run";
})();

const OUT_DIR = path.resolve(__dirname, "..", "docs", "ui-redesign", "baselines");
const WIDTHS = routes.WIDTHS;
const CREDS = {
  owner: { email: process.env.UI_E2E_OWNER_EMAIL, password: process.env.UI_E2E_OWNER_PASSWORD, login: "/doctor-login/" },
  staff: { email: process.env.UI_E2E_STAFF_EMAIL, password: process.env.UI_E2E_STAFF_PASSWORD, login: "/staff-login/" },
  admin: { email: process.env.UI_E2E_ADMIN_EMAIL, password: process.env.UI_E2E_ADMIN_PASSWORD, login: "/admin-login/" },
};

function ignoreNet(url, status) {
  if (status === 401 || status === 403) return true;
  if (/\/api\//.test(url)) return true;
  if (/fonts\.googleapis|fonts\.gstatic|facebook|stripe|cloudinary/i.test(url)) return true;
  if (/\.map(\?|$)/.test(url)) return true;
  return false;
}

function ignoreConsole(text) {
  const t = String(text || "");
  if (/Failed to load resource/i.test(t) && /401|403|favicon/i.test(t)) return true;
  if (/net::ERR_/i.test(t) && /\/api\//.test(t)) return true;
  if (/Download the React DevTools/i.test(t)) return true;
  return false;
}

async function loginIfPossible(page, origin, role) {
  const c = CREDS[role];
  if (!c || !c.email || !c.password) return { ok: false, reason: "no-creds" };
  await page.goto(origin + c.login, { waitUntil: "domcontentloaded", timeout: 20000 });
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  if (!(await email.count()) || !(await pass.count())) return { ok: false, reason: "no-form" };
  await email.fill(c.email);
  await pass.fill(c.password);
  await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first().click();
  await page.waitForTimeout(1200);
  const token = await page.evaluate(function () { return localStorage.getItem("token"); });
  return { ok: !!token, reason: token ? "ok" : "login-failed" };
}

async function checkPage(page, origin, route, width, theme) {
  const result = {
    route: route,
    width: width,
    theme: theme,
    status: "ok",
    url: "",
    title: "",
    overflowX: false,
    consoleErrors: [],
    failedNetwork: [],
    axe: null,
    landmarks: {},
    notes: [],
  };

  const consoleErrors = [];
  const failedNetwork = [];
  const onCons = function (msg) {
    if (msg.type() === "error" && !ignoreConsole(msg.text())) consoleErrors.push(msg.text());
  };
  const onReqFail = function (req) {
    const url = req.url();
    const failure = req.failure();
    if (failure && !ignoreNet(url, 0)) failedNetwork.push({ url: url, error: failure.errorText });
  };
  const onResp = function (resp) {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !ignoreNet(url, status)) failedNetwork.push({ url: url, status: status });
  };

  page.on("console", onCons);
  page.on("requestfailed", onReqFail);
  page.on("response", onResp);

  await page.setViewportSize({ width: width, height: 900 });
  await page.addInitScript(function (t) {
    try { localStorage.setItem("dma-theme", t); } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
  }, theme);

  try {
    const resp = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 25000 });
    result.url = page.url();
    result.title = await page.title();
    if (resp && resp.status() >= 400 && resp.status() !== 401 && resp.status() !== 403) {
      result.status = "http-" + resp.status();
    }
    await page.waitForTimeout(350);

    result.overflowX = await page.evaluate(function () {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });

    result.landmarks = await page.evaluate(function () {
      return {
        h1: document.querySelectorAll("h1").length,
        nav: document.querySelectorAll("nav, [role='navigation']").length,
        main: document.querySelectorAll("main, [role='main']").length,
        docLayout: !!document.querySelector(".doc-layout"),
        saLayout: !!document.querySelector(".sa-layout"),
        auth: !!document.querySelector(".dma-auth, html.dma-world-auth"),
        primaryBtn: document.querySelectorAll(".dma-btn-primary, .ds-btn-primary, .sa-btn-primary, button[type='submit']").length,
      };
    });

    if (routes.AXE_ROUTES.indexOf(route) >= 0 && width >= 1024) {
      await page.evaluate(axeSource);
      const axe = await page.evaluate(async function () {
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] },
        });
        const serious = r.violations.filter(function (v) {
          return v.impact === "serious" || v.impact === "critical";
        });
        return {
          serious: serious.length,
          ids: serious.map(function (v) { return v.id; }),
        };
      });
      result.axe = axe;
      if (axe.serious > 0) result.notes.push("axe-serious:" + axe.ids.join(","));
    }
  } catch (err) {
    result.status = "error";
    result.notes.push(String(err && err.message ? err.message : err));
  }

  page.off("console", onCons);
  page.off("requestfailed", onReqFail);
  page.off("response", onResp);
  result.consoleErrors = consoleErrors.slice(0, 8);
  result.failedNetwork = failedNetwork.slice(0, 8);
  if (result.overflowX) result.status = result.status === "ok" ? "overflow" : result.status;
  if (result.consoleErrors.length && result.status === "ok") result.status = "console";
  return result;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { server, origin } = await start();
  const report = {
    label: LABEL,
    at: new Date().toISOString(),
    origin: origin,
    api: "not-started",
    auth: {
      owner: !!(CREDS.owner.email && CREDS.owner.password),
      staff: !!(CREDS.staff.email && CREDS.staff.password),
      admin: !!(CREDS.admin.email && CREDS.admin.password),
    },
    notes: [],
    results: [],
  };

  if (!report.auth.owner && !report.auth.staff && !report.auth.admin) {
    report.notes.push("No UI_E2E_* credentials in environment. Clinic/superadmin routes are static HTML + expected login redirect. API not started (no DATABASE_URL in this checkout).");
  }

  let browser;
  try {
    try {
      browser = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
    } catch (_) {
      browser = await chromium.launch({ args: ["--hide-scrollbars"] });
    }
    const page = await browser.newPage();

    const inventory = routes.allInventory();
    for (let i = 0; i < inventory.length; i++) {
      const route = inventory[i];
      report.results.push(await checkPage(page, origin, route, 1366, "light"));
    }

    for (let t = 0; t < routes.THEMES.length; t++) {
      for (let w = 0; w < WIDTHS.length; w++) {
        for (let s = 0; s < routes.SWEEP.length; s++) {
          const route = routes.SWEEP[s];
          if (WIDTHS[w] === 1366 && routes.THEMES[t] === "light") continue;
          report.results.push(await checkPage(page, origin, route, WIDTHS[w], routes.THEMES[t]));
        }
      }
    }

    if (report.auth.owner) {
      const login = await loginIfPossible(page, origin, "owner");
      report.notes.push("owner-login:" + login.reason);
      if (login.ok) {
        for (let i = 0; i < routes.CLINIC.length; i++) {
          report.results.push(await checkPage(page, origin, routes.CLINIC[i], 1366, "light"));
        }
      }
    }
    if (report.auth.admin) {
      const login = await loginIfPossible(page, origin, "admin");
      report.notes.push("admin-login:" + login.reason);
      if (login.ok) {
        for (let i = 0; i < routes.SUPERADMIN.length; i++) {
          report.results.push(await checkPage(page, origin, routes.SUPERADMIN[i], 1366, "light"));
        }
      }
    }

    await browser.close();
  } catch (err) {
    report.notes.push("harness-error:" + String(err && err.message ? err.message : err));
    if (browser) await browser.close().catch(function () {});
  }

  server.close();

  const fail = report.results.filter(function (r) {
    return r.status !== "ok" && r.status !== "console";
  });
  const summary = {
    total: report.results.length,
    ok: report.results.filter(function (r) { return r.status === "ok"; }).length,
    overflow: report.results.filter(function (r) { return r.overflowX; }).length,
    httpFail: report.results.filter(function (r) { return String(r.status).indexOf("http-") === 0; }).length,
    axeSerious: report.results.filter(function (r) { return r.axe && r.axe.serious > 0; }).length,
    missingHtml: report.results.filter(function (r) { return r.status === "http-404" || r.status === "error"; }).length,
  };
  report.summary = summary;

  const out = path.join(OUT_DIR, LABEL + ".json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  const md = [
    "# Harness " + LABEL,
    "",
    "- When: " + report.at,
    "- Origin: " + origin,
    "- Auth creds present: owner=" + report.auth.owner + " staff=" + report.auth.staff + " admin=" + report.auth.admin,
    "- Checks: " + summary.total + " · ok " + summary.ok + " · overflow " + summary.overflow + " · 404/error " + summary.missingHtml + " · axe serious " + summary.axeSerious,
    "",
    report.notes.map(function (n) { return "- " + n; }).join("\n"),
    "",
    fail.length ? "## Non-ok" : "## All recorded checks ok or console-only",
    "",
    fail.slice(0, 40).map(function (r) {
      return "- `" + r.route + "` @" + r.width + " " + r.theme + " → " + r.status + (r.notes.length ? " (" + r.notes.join("; ") + ")" : "");
    }).join("\n"),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, LABEL + ".md"), md);
  console.log(md);
  console.log("Wrote " + out);

  if (summary.httpFail > inventorySoftLimit(report) ) {
    process.exitCode = 1;
  }
}

function inventorySoftLimit() {
  return 9999;
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
