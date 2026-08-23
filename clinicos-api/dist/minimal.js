"use strict";
/**
 * MINIMAL test — zero dependencies, no npm needed.
 * cPanel startup file: dist/minimal.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const logFile = path.join(root, 'logs', 'minimal.log');

function log(msg) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

log('=== minimal.js boot ===');
log('node=' + process.version);
log('cwd=' + process.cwd());
log('PORT=' + (process.env.PORT || 'NOT SET'));
log('NODE_ENV=' + (process.env.NODE_ENV || 'unset'));

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Node.js is running on cPanel',
    path: req.url,
    port: process.env.PORT,
  }));
});

const listenTarget = process.env.PORT;
if (!listenTarget) {
  log('FATAL: process.env.PORT not set — delete any PORT= env var and RESTART app');
  // Do not exit — some hosts set PORT late; try fallback for logging only
  server.listen(3001, '127.0.0.1', () => log('fallback listen 127.0.0.1:3001'));
} else {
  server.listen(listenTarget, () => log('listening on ' + listenTarget));
}

server.on('error', (err) => {
  log('LISTEN ERROR: ' + (err.stack || err));
});
