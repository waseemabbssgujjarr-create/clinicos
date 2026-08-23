#!/usr/bin/env node
/**
 * prisma-db-check.js — same DATABASE_URL as the Node API; prove Prisma can reach MySQL.
 *
 * Usage (cPanel Terminal, digitals account):
 *   cd /home/digitals/clinicos.workee.online/clinicos-api
 *   # activate nodevenv first (same as force-start), then:
 *   node prisma-db-check.js
 *
 * Exit 0 = OK, exit 1 = fail.
 *
 * IMPORTANT: workee production must use digitals_clinicuser / digitals_clinicdb.
 * If you see cognitom_* / clinicos.aderalabs.com paths, you are on the OLD site — stop.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const envPath = path.join(root, '.env');

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function preferLoopbackHost(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/@(localhost|\[::1\])(?=:\d+)/i, '@127.0.0.1');
}

function ensureConnectionLimit(url) {
  if (!url || typeof url !== 'string') return url;
  if (/[?&]connection_limit=/i.test(url)) return url;
  const extra = 'connection_limit=1&connect_timeout=10';
  return url.includes('?') ? `${url}&${extra}` : `${url}?${extra}`;
}

function maskUrl(url) {
  if (!url) return '(empty)';
  return String(url).replace(/:([^:@/]+)@/, ':***@');
}

function parseMysqlUrl(url) {
  const m = String(url || '').match(
    /^mysql:\/\/([^:/]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/i
  );
  if (!m) return null;
  return {
    user: decodeURIComponent(m[1]),
    host: m[3],
    port: m[4],
    db: decodeURIComponent(m[5]),
    query: m[6] || '',
  };
}

(async () => {
  const fileEnv = parseEnvFile(envPath);
  // Prefer .env over stale cPanel process env (same as bootstrap.js)
  let databaseUrl = fileEnv.DATABASE_URL || process.env.DATABASE_URL || '';
  databaseUrl = preferLoopbackHost(databaseUrl);
  databaseUrl = ensureConnectionLimit(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;

  const parsed = parseMysqlUrl(databaseUrl);
  const report = {
    ok: false,
    env_file: envPath,
    env_exists: fs.existsSync(envPath),
    database_url_masked: maskUrl(databaseUrl),
    user: parsed ? parsed.user : null,
    host: parsed ? parsed.host : null,
    port: parsed ? parsed.port : null,
    db: parsed ? parsed.db : null,
    query: parsed ? parsed.query : null,
  };

  if (!databaseUrl) {
    report.error = 'DATABASE_URL missing (.env and process.env)';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  if (!parsed) {
    report.error =
      'Could not parse DATABASE_URL — check mysql://user:pass@host:port/db (encode special chars in password)';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  if (/cognitom|aderalabs/i.test(databaseUrl) || /cognitom/i.test(parsed.user)) {
    report.warn =
      'OLD SITE CREDENTIALS DETECTED (cognitom / aderalabs). Correct workee DB is digitals_clinicuser / digitals_clinicdb. Do NOT point workee at cognitos DB.';
  } else if (parsed.user !== 'digitals_clinicuser' || parsed.db !== 'digitals_clinicdb') {
    report.warn = `Expected digitals_clinicuser / digitals_clinicdb — got ${parsed.user} / ${parsed.db}`;
  }

  let prisma;
  try {
    const { PrismaClient } = require(path.join(root, 'generated', 'prisma'));
    prisma = new PrismaClient({ log: ['error'] });
  } catch (e) {
    report.error =
      'Cannot load Prisma client (run: npx prisma generate). ' +
      String(e && e.message ? e.message : e);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    let clinicCount = null;
    try {
      clinicCount = await prisma.clinic.count();
    } catch (e) {
      report.clinic_count_error = String(e && e.message ? e.message : e);
    }
    report.ok = true;
    report.select1 = 'ok';
    report.clinic_count = clinicCount;
    report.message = 'Prisma connected successfully';
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (e) {
    report.ok = false;
    report.error = String(e && e.message ? e.message : e);
    report.code = e && e.code ? e.code : undefined;
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_) {
      /* ignore */
    }
  }
})();
