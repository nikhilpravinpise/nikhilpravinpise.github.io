#!/usr/bin/env node
// Real-browser smoke check using a locally installed Chrome/Edge via
// puppeteer-core (devDependency - no browser download). Verifies:
//   - page boots with zero console errors / page errors / failed requests
//   - every registered command runs and produces output
//   - deep links work
//   - mobile viewport (390px) has no horizontal page overflow
//   - screenshots land in docs/screens/ (pass --shots <dir> to change)
//
//   node scripts/browser-check.js [--shots outdir] [--url http://localhost:8000]
/* global window, document */ // referenced inside page.evaluate callbacks

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const SHOTS = flag("--shots", "docs/screens");
const URL_ARG = flag("--url", null);

/* ------------------------- zero-dep static server ------------------------- */
function serve(root) {
  const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = path.normalize(path.join(root, p === "/" ? "index.html" : p));
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/html" });
          fs.createReadStream(path.join(root, "404.html")).pipe(res);
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(buf);
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function findBrowser() {
  const c = [
    process.env.OG_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error("no Chrome/Edge binary found - set OG_BROWSER");
}

const results = [];
function check(name, ok, detail = "") {
  results.push([name, ok, detail]);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  - " + detail : ""}`);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  let server = null;
  let base = URL_ARG;
  if (!base) {
    server = await serve(process.cwd());
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const errors = [];
  const failedReqs = [];
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => failedReqs.push(`${r.url()} ${r.failure()?.errorText}`));

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(SHOTS, "desktop-home.png") });

  check("page boots", errors.length === 0, errors.join("; "));

  // every visible command produces output without errors
  const commands = await page.evaluate(() =>
    window.__app.commands.registry.filter((c) => !c.hidden).map((c) => c.name),
  );
  for (const cmd of commands) {
    const before = await page.evaluate(() => document.querySelectorAll("#term .line").length);
    await page.type("#cmdInput", cmd);
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 120));
    const after = await page.evaluate(() => document.querySelectorAll("#term .line").length);
    check(`command '${cmd}'`, after > before || cmd === "clear");
    if (["contributions", "neofetch", "graph", "repos", "help"].includes(cmd)) {
      await page.screenshot({ path: path.join(SHOTS, `cmd-${cmd}.png`) });
    }
  }

  // deep link
  await page.goto(`${base}/?cmd=contributions`, { waitUntil: "networkidle0" });
  const hasHeatmap = await page.evaluate(() => !!document.querySelector(".heatmap"));
  check("deep link ?cmd=contributions renders heatmap", hasHeatmap);

  // mobile: no horizontal document overflow
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(`${base}/?cmd=contributions`, { waitUntil: "networkidle0" });
  const overflow = await page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      window.innerWidth,
  );
  check("mobile: no horizontal page overflow", overflow <= 0, `scrollW excess=${overflow}`);
  const snapped = await page.evaluate(() => {
    const w = document.querySelector(".heatmap-wrap");
    return w ? w.scrollWidth - w.clientWidth - w.scrollLeft < 8 : false;
  });
  check("mobile: heatmap snapped to most recent weeks", snapped);
  await page.screenshot({ path: path.join(SHOTS, "mobile-contributions.png") });

  // themes apply without errors
  for (const t of ["light", "amber", "synthwave", "dark"]) {
    await page.evaluate((id) => window.__app.commands.run(`theme ${id}`), t);
    const applied = await page.evaluate(() => document.documentElement.dataset.theme);
    check(`theme ${t}`, applied === t);
  }
  await page.screenshot({ path: path.join(SHOTS, "desktop-final.png") });

  check("zero console/page errors", errors.length === 0, errors.slice(0, 3).join("; "));
  check("zero failed requests", failedReqs.length === 0, failedReqs.slice(0, 3).join("; "));

  await browser.close();
  if (server) server.close();

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
