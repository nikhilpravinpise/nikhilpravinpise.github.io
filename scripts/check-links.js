#!/usr/bin/env node
// Link + asset checker. Scans markup, docs, manifest and sw.js for
// (a) external URLs -> HEAD/GET checked over the network
// (b) local file references -> verified on disk
// (c) sw.js precache <-> assets/ directory cross-check, both directions.
// Zero dependencies; run with `npm run check:links`.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function listJs(dir, prefix) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...listJs(path.join(dir, ent.name), `${prefix}${ent.name}/`));
    else if (ent.name.endsWith(".js")) out.push(prefix + ent.name);
  }
  return out;
}

const SCAN_FILES = [
  "index.html",
  "404.html",
  "README.md",
  "AGENTS.md",
  "manifest.webmanifest",
  "sw.js",
  ...listJs(path.join(ROOT, "assets"), "assets/"),
];

// hosts/paths that are not user-facing links or reject bots
const IGNORE_URLS = [
  /^http:\/\/x\//, // dev-server URL parser base
  /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/|$)/, // local dev URLs in docs
  /^https:\/\/api\.github\.com\//, // POST-only GraphQL endpoint
  /^https:\/\/github\.com\/cli\//, // gh cli metadata strings
  /^https:\/\/schema\.org/, // JSON-LD context identifier, not a link
  /^https:\/\/www\.w3\.org/, // SVG namespace identifier
  /^http:\/\/www\.sitemaps\.org/, // sitemap namespace identifier
];
// endpoints that return odd statuses to non-browsers (bot detection)
const WARN_ONLY = [/^https:\/\/(www\.)?linkedin\.com\//];

const URL_RE = /https?:\/\/[^\s"'<>)\]`]+/g;
const LOCAL_REF_RE = /(?:href|src)="((?!https?:|mailto:|data:|#|\/)[^"]+)"/g;

function collectUrls() {
  const found = new Map(); // url -> [files]
  for (const file of SCAN_FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of text.matchAll(URL_RE)) {
      const url = m[0].replace(/[.,;]+$/, ""); // trailing punctuation
      if (IGNORE_URLS.some((re) => re.test(url))) continue;
      if (!found.has(url)) found.set(url, []);
      found.get(url).push(file);
    }
  }
  return found;
}

function collectLocalRefs() {
  const found = new Map();
  for (const file of SCAN_FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of text.matchAll(LOCAL_REF_RE)) {
      const ref = m[1].replace(/[?#].*$/, "");
      // skip template-literal/interpolated refs like href="${url}"
      if (ref.includes("${") || ref.includes("}")) continue;
      if (!found.has(ref)) found.set(ref, []);
      found.get(ref).push(file);
    }
  }
  // sw.js precache entries are bare strings like "assets/app.js"
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\]/);
  if (shell) {
    for (const m of shell[1].matchAll(/"([^"]+)"/g)) {
      const ref = m[1] === "./" ? "index.html" : m[1];
      if (!found.has(ref)) found.set(ref, []);
      found.get(ref).push("sw.js:SHELL");
    }
  }
  // markdown links/images: [text](target) and ![alt](target)
  for (const file of SCAN_FILES.filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const ref = m[1].replace(/[?#].*$/, "");
      if (/^(https?:|mailto:|#|\/)/.test(ref) || ref === "") continue;
      if (!found.has(ref)) found.set(ref, []);
      found.get(ref).push(`${file}:md`);
    }
  }
  return found;
}

async function checkUrl(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "repo-link-checker" },
      });
      if (res.status < 400) return { ok: true, status: res.status };
      if (method === "HEAD" && (res.status === 405 || res.status === 501)) continue;
      return { ok: false, status: res.status };
    } catch (e) {
      if (method === "HEAD") continue;
      return { ok: false, status: e.name === "TimeoutError" ? "timeout" : e.message };
    }
  }
  return { ok: false, status: "unreachable" };
}

async function main() {
  let failures = 0;
  const warnings = [];

  // local refs first - no network needed
  const localRefs = collectLocalRefs();
  for (const [ref, files] of [...localRefs.entries()].sort()) {
    const target = path.join(ROOT, ref);
    const exists = fs.existsSync(target) || fs.existsSync(target + ".html");
    if (exists) {
      console.log(`OK   ${ref}  <- ${[...new Set(files)].join(", ")}`);
    } else {
      failures++;
      console.log(`FAIL ${ref}  missing on disk  <- ${[...new Set(files)].join(", ")}`);
    }
  }

  // every asset the SW precaches must exist, and every shipped asset should
  // be precached (skip generated/fallback? no - they are precached too)
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const shell = new Set(
    [...sw.matchAll(/"((?:assets|data|404\.html|manifest\.webmanifest|index\.html|\.\/)[^"]*)"/g)].map(
      (m) => m[1],
    ),
  );
  for (const f of fs.readdirSync(path.join(ROOT, "assets"), { recursive: true })) {
    const rel = `assets/${String(f).replace(/\\/g, "/")}`;
    if (fs.statSync(path.join(ROOT, rel)).isFile() && !shell.has(rel)) {
      failures++;
      console.log(`FAIL ${rel} exists but is not in sw.js SHELL precache`);
    }
  }

  // external urls
  const urls = collectUrls();
  console.log(`\nchecking ${urls.size} external urls...`);
  const entries = [...urls.entries()];
  const CONCURRENCY = 5;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(([url]) => checkUrl(url)));
    batch.forEach(([url, files], j) => {
      const r = results[j];
      const suffix = `${r.status}  <- ${[...new Set(files)].join(", ")}`;
      if (r.ok) {
        console.log(`OK   ${url}  ${suffix}`);
      } else if (WARN_ONLY.some((re) => re.test(url))) {
        warnings.push(`${url} (${r.status})`);
        console.log(`WARN ${url}  ${suffix} (bot-blocked endpoint, tolerated)`);
      } else {
        failures++;
        console.log(`FAIL ${url}  ${suffix}`);
      }
    });
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s): ${warnings.join("; ")}`);
  }
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
