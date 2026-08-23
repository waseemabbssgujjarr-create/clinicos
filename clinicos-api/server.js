"use strict";
/**
 * cPanel startup — TCP mode via Cron (Passenger bypass)
 * Set env PORT=3001 in cPanel, run via Cron Job every 5 minutes.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname);
const logFile = path.join(root, 'logs', 'minimal.log');

function log(msg) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

log('=== server.js boot ===');
log('node=' + process.version);
log('cwd=' + process.cwd());
log('PORT=' + (process.env.PORT || 'NOT SET'));

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Node.js is running on cPanel',
    path: req.url,
    port: process.env.PORT,
  }));
});

const portEnv = process.env.PORT;
if (portEnv && String(portEnv).startsWith('/')) {
  server.listen(portEnv, () => log('passenger socket: ' + portEnv));
} else {
  const port = parseInt(String(portEnv || '3001'), 10);
  server.listen(port, '127.0.0.1', () => log('tcp 127.0.0.1:' + port));
}

server.on('error', (err) => {
  log('LISTEN ERROR: ' + (err.stack || err));
});
