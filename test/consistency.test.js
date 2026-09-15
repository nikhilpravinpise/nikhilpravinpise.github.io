// Consistency tests: the class of bugs where the same fact is written in
// four places and one copy drifts. These tests make the docs and markup
// enforce the code, not the other way around.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { bootApp, indexHtml, termText } from "./helpers/dom.js";
import { PROFILE } from "../assets/profile.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let ctx;
before(async () => {
  ctx = await bootApp();
});
after(() => ctx.restore());

test("help lists every visible command exactly once", () => {
  ctx.term.innerHTML = "";
  ctx.app.commands.run("help");
  const text = termText(ctx.term).join("\n");
  for (const c of ctx.app.commands.registry) {
    if (c.hidden) {
      // hidden commands must NOT be listed by their canonical name alone
      continue;
    }
    assert.ok(text.includes(c.name), `help missing ${c.name}`);
    assert.ok(text.includes(c.summary), `help missing summary for ${c.name}`);
  }
});

test("tab completions exactly cover visible names + aliases", () => {
  const expected = ctx.app.commands.registry
    .filter((c) => !c.hidden)
    .flatMap((c) => [c.name, ...(c.aliases || [])])
    .sort();
  assert.deepEqual([...ctx.app.commands.completions].sort(), expected);
  // and every completion resolves back to a real command
  for (const c of ctx.app.commands.completions) {
    assert.ok(ctx.app.commands.byName.has(c), `completion ${c} resolves nowhere`);
  }
});

test("README command table covers every visible command", () => {
  const readme = read("README.md");
  for (const c of ctx.app.commands.registry) {
    if (c.hidden) continue;
    const row = new RegExp(`\\|\\s*\`?${c.name}\`?\\s*\\|`);
    assert.ok(row.test(readme), `README missing command row for '${c.name}'`);
  }
});

test("every quick-action chip maps to a real command", () => {
  const chips = [...ctx.document.querySelectorAll(".chip[data-cmd]")].map((c) =>
    c.getAttribute("data-cmd"),
  );
  for (const cmd of chips) {
    assert.ok(ctx.app.commands.byName.has(cmd), `chip '${cmd}' has no command`);
  }
});

test("footer links match profile.js", () => {
  const footer = ctx.document.querySelector("footer");
  const hrefs = [...footer.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const url of Object.values(PROFILE.links)) {
    assert.ok(hrefs.includes(url), `footer missing ${url}`);
  }
  assert.ok(hrefs.includes(`mailto:${PROFILE.email}`), "footer missing mailto");
});

test("<noscript> carries the real bio and links", () => {
  const dom = new JSDOM(indexHtml());
  const ns = dom.window.document.querySelector("noscript");
  assert.ok(ns, "no <noscript> block");
  const text = ns.textContent;
  assert.ok(text.includes("DJSCE"), "noscript missing bio");
  assert.ok(text.includes("IIT Guwahati"), "noscript missing role");
  const hrefs = [...ns.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const url of Object.values(PROFILE.links)) {
    assert.ok(hrefs.includes(url), `noscript missing ${url}`);
  }
  assert.ok(hrefs.includes(`mailto:${PROFILE.email}`));
});

test("JSON-LD Person is valid and consistent with profile", () => {
  const dom = new JSDOM(indexHtml());
  const ld = dom.window.document.querySelector('script[type="application/ld+json"]');
  assert.ok(ld, "no JSON-LD block");
  const data = JSON.parse(ld.textContent);
  assert.equal(data["@type"], "Person");
  assert.equal(data.name, PROFILE.name);
  assert.equal(data.url, PROFILE.site);
  for (const same of data.sameAs) {
    assert.ok(Object.values(PROFILE.links).includes(same), `sameAs ${same} not in profile links`);
  }
});

test("agent version matches package.json version", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(PROFILE.version, pkg.version);
  assert.ok(PROFILE.agent.includes(`v${pkg.version.split(".").slice(0, 2).join(".")}`),
    `agent string '${PROFILE.agent}' doesn't match version ${pkg.version}`);
  // the visible agent-bar label must match too
  assert.ok(indexHtml().includes(PROFILE.agent));
});

test("index.html has no inline scripts or styles left", () => {
  const dom = new JSDOM(indexHtml());
  const doc = dom.window.document;
  for (const s of doc.querySelectorAll("script")) {
    assert.equal(s.getAttribute("type"), s.textContent.trim() ? "application/ld+json" : "module");
  }
  assert.equal(doc.querySelectorAll("style").length, 0, "inline <style> block remains");
});

test("sw.js precaches every shipped asset and core file", () => {
  const sw = read("sw.js");
  const assetFiles = fs
    .readdirSync(path.join(ROOT, "assets"), { recursive: true })
    .map((f) => `assets/${String(f).replace(/\\/g, "/")}`)
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
  for (const f of assetFiles) {
    assert.ok(sw.includes(`"${f}"`), `sw.js missing ${f}`);
  }
  for (const f of ["index.html", "404.html", "manifest.webmanifest"]) {
    assert.ok(sw.includes(`"${f}"`), `sw.js missing ${f}`);
  }
});

test("og:image and icons referenced in markup exist on disk", () => {
  for (const f of ["assets/og-image.png", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png"]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing - run npm run og`);
  }
  assert.ok(indexHtml().includes("assets/og-image.png"));
  assert.ok(indexHtml().includes("assets/icon-180.png"));
});

test("manifest references existing icons", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)), `manifest icon ${icon.src} missing`);
  }
});

test("prompt string is consistent everywhere", () => {
  const html = indexHtml();
  assert.ok(html.includes(PROFILE.prompt), "input row prompt diverged");
  assert.ok(html.includes(PROFILE.agent), "agent-bar diverged");
});
