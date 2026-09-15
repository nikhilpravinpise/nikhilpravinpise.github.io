#!/usr/bin/env node
// Generates assets/og-image.png (1200x630) and the icon set
// (icon-180/192/512) by screenshotting HTML templates with a headless
// Chrome/Edge binary that is already installed on the machine.
// Stats in the OG image are injected from data/contributions.json and the
// heatmap strip is drawn from the last 26 real weeks, so re-running this
// keeps the preview honest. `npm run og`.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { levelFor, quantileThresholds } from "../assets/lib/stats.js";

const ROOT = process.cwd();

function findBrowser() {
  if (process.env.OG_BROWSER && fs.existsSync(process.env.OG_BROWSER)) {
    return process.env.OG_BROWSER;
  }
  const candidates = [];
  if (process.platform === "win32") {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pfx = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const la = process.env.LOCALAPPDATA || "";
    for (const base of [pf, pfx, la]) {
      candidates.push(
        path.join(base, "Google/Chrome/Application/chrome.exe"),
        path.join(base, "Microsoft/Edge/Application/msedge.exe"),
        path.join(base, "Chromium/Application/chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      candidates.push(`/usr/bin/${bin}`, `/usr/local/bin/${bin}`, `/snap/bin/${bin}`);
    }
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(
    "No Chrome/Edge binary found. Set OG_BROWSER=/path/to/browser and retry.",
  );
}

function render(browser, htmlPath, outPath, width, height) {
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      `--screenshot=${path.resolve(outPath)}`,
      `file:///${path.resolve(htmlPath).replace(/\\/g, "/")}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`wrote ${outPath} (${width}x${height}, ${kb} KB)`);
}

function heatmapStrip(days) {
  // last ~26 weeks as tiny cells, real levels from the real data
  const take = days.slice(-26 * 7);
  const thresholds = quantileThresholds(days);
  return take
    .map((d) => `<div class="cell${d.count ? ` l${levelFor(d.count, thresholds)}` : ""}"></div>`)
    .join("");
}

function main() {
  const browser = findBrowser();
  console.log(`using browser: ${browser}`);

  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/contributions.json"), "utf8"));

  const ogHtml = fs
    .readFileSync(path.join(ROOT, "scripts/og-template.html"), "utf8")
    .replace("{{TOTAL}}", data.total_contributions.toLocaleString())
    .replace("{{STREAK}}", String(data.current_streak.length))
    .replace("{{LONGEST}}", String(data.longest_streak.length))
    .replace("{{BEST}}", String(data.best_day.count))
    .replace("{{HEATMAP}}", heatmapStrip(data.days));

  const ogRender = path.join(ROOT, "scripts/.og-render.html");
  fs.writeFileSync(ogRender, ogHtml);
  try {
    render(browser, ogRender, "assets/og-image.png", 1200, 630);
  } finally {
    fs.rmSync(ogRender, { force: true });
  }

  const iconTemplate = path.join(ROOT, "scripts/icon-template.html");
  for (const size of [180, 192, 512]) {
    render(browser, iconTemplate, `assets/icon-${size}.png`, size, size);
  }
}

main();
