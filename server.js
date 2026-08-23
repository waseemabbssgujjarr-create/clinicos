"use strict";
/**
 * cPanel startup — site root: clinicos.aderalabs.com/server.js
 * Uses only Node built-ins for test (no npm needed to boot).
 */
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'clinicos-api', 'logs', 'root-server.log');

function log(msg) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

log('=== root server.js boot ===');
log('node=' + process.version);
log('cwd=' + process.cwd());
log('PORT=' + (process.env.PORT || 'NOT SET'));

// TEST — zero npm deps (http/fs/path only)
require('./clinicos-api/server.js');

// FULL API (after test works + npm install at site root):
// require('dotenv').config({ path: path.join(__dirname, 'clinicos-api', '.env') });
// require('./clinicos-api/dist/bootstrap.js');
