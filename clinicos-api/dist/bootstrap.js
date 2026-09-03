"use strict";
/**
 * cPanel startup bootstrap — logs errors to logs/startup.log
 * Set Application startup file to: dist/bootstrap.js
 *
 * CRITICAL (CloudLinux LVE / low memory):
 * - Listen on PORT ASAP — never block on SMTP verify or Prisma DDL.
 * - PlatformSetting + SMTP checks run AFTER app load, fire-and-forget, with timeouts.
 * - SMTP/DB failures must not crash the process so /api can stay up.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'startup.log');

function log(msg) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) { /* ignore */ }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT: ' + (err && err.stack ? err.stack : err));
  // Do not rethrow — Prisma engine panics / SMTP crashes must not kill the API mid-flight
  // if the HTTP server already started. Process may still be unstable; keepalive will restart.
});

process.on('unhandledRejection', (err) => {
  log('UNHANDLED REJECTION: ' + String(err && err.stack ? err.stack : err));
});

// Vendor bcryptjs (server npm may not have it installed)
const vendorBcrypt = path.join(root, 'vendor', 'bcryptjs', 'index.js');
if (fs.existsSync(vendorBcrypt)) {
  const Module = require('module');
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'bcryptjs') return vendorBcrypt;
    return origResolve.call(this, request, parent, isMain, options);
  };
  log('bcryptjs vendor shim loaded');
}

function parseEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFromFile(envPath, { override = false } = {}) {
  const parsed = parseEnvFile(envPath);
  for (const [key, val] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) process.env[key] = val;
  }
}

function preferLoopbackHost(url) {
  // Prisma + Node on cPanel often fail intermittently with "localhost" (IPv6 ::1);
  // PHP mysqli usually uses 127.0.0.1 successfully. Normalize at boot.
  if (!url || typeof url !== 'string') return url;
  return url.replace(/@(localhost|\[::1\])(?=:\d+)/i, '@127.0.0.1');
}

function ensureConnectionLimit(url) {
  // CloudLinux LVE: many Prisma connections → fork/OOM / P1001. Cap pool when unset.
  if (!url || typeof url !== 'string') return url;
  if (/[?&]connection_limit=/i.test(url)) return url;
  const extra = 'connection_limit=1&connect_timeout=10';
  return url.includes('?') ? url + '&' + extra : url + '?' + extra;
}

function loadEnv() {
  const envPath = path.join(root, '.env');
  const fileEnv = parseEnvFile(envPath);
  try {
    require('dotenv').config({ path: envPath });
    log('dotenv loaded');
  } catch (e) {
    log('dotenv missing — built-in .env loader used (run npm install in clinicos-api)');
    loadEnvFromFile(envPath);
  }
  // .env wins for DATABASE_URL (stale cPanel Node App env often causes intermittent auth/DB failures)
  if (fileEnv.DATABASE_URL) {
    const prevUser = (process.env.DATABASE_URL || '').match(/^mysql:\/\/([^:/]+):/);
    const fileUser = fileEnv.DATABASE_URL.match(/^mysql:\/\/([^:/]+):/);
    process.env.DATABASE_URL = fileEnv.DATABASE_URL;
    log(
      'DATABASE_URL from .env (overrides process env)' +
        (prevUser && fileUser && prevUser[1] !== fileUser[1]
          ? ` was=${prevUser[1]} now=${fileUser[1]}`
          : '')
    );
  }
  // Strip accidental quotes left by some dotenv/cPanel exports
  for (const key of Object.keys(process.env)) {
    const val = process.env[key];
    if (typeof val !== 'string') continue;
    const t = val.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      process.env[key] = t.slice(1, -1);
    }
  }
  if (process.env.DATABASE_URL) {
    const before = process.env.DATABASE_URL;
    process.env.DATABASE_URL = preferLoopbackHost(before);
    if (process.env.DATABASE_URL !== before) {
      log('DATABASE_URL host rewritten localhost/::1 → 127.0.0.1 (Prisma/cPanel)');
    }
    const beforeLimit = process.env.DATABASE_URL;
    process.env.DATABASE_URL = ensureConnectionLimit(beforeLimit);
    if (process.env.DATABASE_URL !== beforeLimit) {
      log('DATABASE_URL appended connection_limit=1&connect_timeout=10 (LVE-safe)');
    }
  }
}

async function deferredBootWork() {
  // Soft PlatformSetting load (SELECT; ensureTable is soft-fail inside service)
  try {
    const platformConfig = require('./services/platform-config.service');
    const r = await withTimeout(
      platformConfig.applyFromDatabase({ skipEnsureTable: true }),
      8000,
      'PlatformSetting applyFromDatabase'
    );
    log('PlatformSetting applied=' + r.applied + '/' + r.total + ' (deferred)');
  } catch (e) {
    log('PlatformSetting deferred error (non-fatal): ' + String(e && e.message ? e.message : e));
  }

  // Ensure correct branding — overwrite any leftover ClinicOS / MediCore / old-platform values
  if (!process.env.APP_NAME || /ClinicOS|MediCore|clinicos/i.test(process.env.APP_NAME)) {
    process.env.APP_NAME = 'Doctors My Agency';
  }
  // Overwrite stale domain fallbacks from previous deployments
  if (!process.env.APP_URL
    || /aderalabs|workee\.online|clinicos\.workee/i.test(process.env.APP_URL)) {
    process.env.APP_URL = 'https://doctorsmyagency.com';
    log('APP_URL reset to doctorsmyagency.com (stale domain detected)');
  }
  if (!process.env.FRONTEND_URL
    || /aderalabs|workee\.online|clinicos\.workee/i.test(process.env.FRONTEND_URL)) {
    process.env.FRONTEND_URL = process.env.APP_URL;
  }

  try {
    const emailSvc = require('./services/email.service');
    if (typeof emailSvc.sanitizeSmtpEnv === 'function') emailSvc.sanitizeSmtpEnv();
  } catch (_) {}

    log('AI_ENGINE=' + (process.env.AI_PROVIDER ? 'configured (' + process.env.AI_PROVIDER + ')' : 'default(deepseek)'));
    log('AI_READY=' + (process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY ? 'yes' : 'no'));
    // Log the effective model name so PlatformSetting overrides are visible at boot.
    // Never log the API key — only the model name and provider.
    try {
      const aiClient = require('./lib/ai-client');
      const effectiveSettings = aiClient.getAISettings();
      log('AI_MODEL_EFFECTIVE=' + effectiveSettings.model + ' (provider=' + effectiveSettings.provider + ')');
      const rawEnvModel = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || '(not set)';
      if (rawEnvModel !== effectiveSettings.model) {
        log('AI_MODEL_WARN: env/DB value "' + rawEnvModel + '" was sanitised to "' + effectiveSettings.model + '"');
      }
    } catch (_e) {
      log('AI_MODEL_EFFECTIVE: could not resolve (ai-client not yet loaded)');
    }
    log('SMTP configured=' + Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
    log('APP_URL=' + (process.env.APP_URL || 'unset'));
    log('APP_NAME=' + (process.env.APP_NAME || 'Doctors My Agency'));

    // META_ENCRYPTION_KEY is mandatory for WhatsApp token storage.
    // The app starts regardless — but log a prominent warning if missing.
    const encKey = (process.env.META_ENCRYPTION_KEY || '').trim();
    if (!encKey || encKey.length < 16) {
      log('WARN: META_ENCRYPTION_KEY is not configured or too short. WhatsApp connections cannot be saved until this is set in Hostinger Environment Variables or Superadmin → Integrations. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    } else {
      log('META_ENCRYPTION_KEY: configured (' + encKey.length + ' chars)');
    }

  // SMTP verify: off by default on boot (SKIP_SMTP_VERIFY=0 to enable). Never block listen.
  const skipSmtp =
    process.env.SKIP_SMTP_VERIFY !== '0' &&
    process.env.SKIP_SMTP_VERIFY !== 'false';
  if (skipSmtp) {
    log('SMTP verify: skipped on boot (set SKIP_SMTP_VERIFY=0 to enable deferred verify)');
    return;
  }

  try {
    const { verifyEmailTransport } = require('./services/email.service');
    const smtp = await withTimeout(verifyEmailTransport({ boot: true }), 5000, 'SMTP verify');
    log('SMTP verify (deferred): ' + (smtp.ok ? 'OK' : smtp.error));
  } catch (e) {
    log('SMTP verify deferred error (non-fatal): ' + String(e && e.message ? e.message : e));
  }
}

(async () => {
  try {
    log('Bootstrap starting...');
    log('NODE_ENV=' + (process.env.NODE_ENV || 'unset'));
    log('PORT=' + (process.env.PORT || 'unset'));
    log('NODE_OPTIONS=' + (process.env.NODE_OPTIONS || 'unset'));
    loadEnv();
    log('DATABASE_URL set=' + Boolean(process.env.DATABASE_URL));
    if (process.env.DATABASE_URL) {
      const u = process.env.DATABASE_URL.match(/^mysql:\/\/([^:/]+):/);
      const host = process.env.DATABASE_URL.match(/@([^:/]+):\d+/);
      log('DATABASE_URL user=' + (u ? u[1] : '?'));
      log('DATABASE_URL host=' + (host ? host[1] : '?'));
    }

    // Light sanitize only — no DB, no SMTP network
    try {
      const emailSvc = require('./services/email.service');
      if (typeof emailSvc.sanitizeSmtpEnv === 'function') emailSvc.sanitizeSmtpEnv();
    } catch (_) {}

    // LISTEN FIRST — require app before any Prisma/SMTP network work
    require('./app.js');
    log('App loaded OK (listen-first); deferring PlatformSetting + SMTP');

    // Fire-and-forget background boot work — never await before listen
    setImmediate(() => {
      deferredBootWork().catch((e) => {
        log('deferredBootWork error (non-fatal): ' + String(e && e.message ? e.message : e));
      });
    });
  } catch (err) {
    log('BOOT FAILED: ' + (err.stack || err));
    // Still do not exit hard if possible — throw only when app never loaded
    throw err;
  }
})();
