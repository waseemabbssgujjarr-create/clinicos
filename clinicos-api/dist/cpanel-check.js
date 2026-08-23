"use strict";
/**
 * cPanel health check — run via Run JS script → cpanel-setup
 * Does NOT need prisma generate on server (client is pre-bundled in generated/prisma).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'cpanel-check.log');

function log(msg) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

const checks = [
  ['dist/app.js', path.join(root, 'dist/app.js')],
  ['generated/prisma', path.join(root, 'generated/prisma/index.js')],
  ['package.json', path.join(root, 'package.json')],
  ['prisma/schema.prisma', path.join(root, 'prisma/schema.prisma')],
];

let ok = true;
for (const [name, p] of checks) {
  const exists = fs.existsSync(p);
  log((exists ? 'OK' : 'MISSING') + ': ' + name);
  if (!exists) ok = false;
}

try {
  const { PrismaClient } = require(path.join(root, 'generated/prisma'));
  log('PrismaClient loaded OK');
} catch (err) {
  log('PrismaClient FAILED: ' + (err.message || err));
  ok = false;
}

if (!ok) process.exit(1);
log('All checks passed — no server-side prisma generate needed.');
