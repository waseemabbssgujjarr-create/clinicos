"use strict";
/**
 * cPanel setup — run via Node.js App → Run JS script → cpanel-setup
 * Generates Prisma client after npm install.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'cpanel-setup.log');

function log(msg) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

try {
  log('Starting cPanel setup...');
  log('CWD: ' + root);
  execSync('npx prisma generate', { cwd: root, stdio: 'pipe', env: process.env });
  log('Prisma generate completed successfully.');
} catch (err) {
  log('SETUP FAILED: ' + (err.stderr?.toString() || err.message || err));
  process.exit(1);
}
