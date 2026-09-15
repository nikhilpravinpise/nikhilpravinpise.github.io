#!/usr/bin/env node
// Zero-dependency static dev server. `npm run dev`, then open the URL.
// ES modules require http(s), so file:// double-clicking is not supported.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (_e) {
    res.writeHead(400).end("bad request");
    return;
  }
  const file = path.normalize(path.join(ROOT, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      const notFound = path.join(ROOT, "404.html");
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(notFound).pipe(res);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}/`);
});
