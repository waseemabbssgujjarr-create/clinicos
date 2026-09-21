/**
 * Apache-style static server for repo-root HTML (directory → index.html).
 * Does not start the API or touch the database.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.UI_HARNESS_PORT || 8765);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json",
};

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

function resolveFile(urlPath) {
  const abs = safeJoin(urlPath);
  if (!abs) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, "index.html");
    if (fs.existsSync(idx)) return idx;
  }
  if (!path.extname(abs)) {
    const withHtml = abs + ".html";
    if (fs.existsSync(withHtml)) return withHtml;
    const idx = path.join(abs, "index.html");
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function start(port) {
  const listenPort = port || PORT;
  const server = http.createServer(function (req, res) {
    const u = new URL(req.url || "/", "http://127.0.0.1");
    if (u.pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, static: true }));
      return;
    }
    const file = resolveFile(u.pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(function (resolve) {
    server.listen(listenPort, "127.0.0.1", function () {
      resolve({ server, port: listenPort, origin: "http://127.0.0.1:" + listenPort });
    });
  });
}

if (require.main === module) {
  start().then(function (s) {
    console.log("Static server " + s.origin);
  });
}

module.exports = { start, ROOT, PORT };
