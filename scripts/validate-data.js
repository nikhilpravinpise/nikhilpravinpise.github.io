#!/usr/bin/env node
// Validates data/contributions.json + data/repos.json and checks that
// assets/fallback.js mirrors them exactly. Runs after `npm run sync` and in
// CI, so a corrupt write or a stale fallback can never reach production.
// Pure validation functions are exported for unit tests.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { computeStreaks, monthlyTotals, bestDay } from "../assets/lib/stats.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function dayGap(a, b) {
  return (new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / MS_PER_DAY;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateContributions(doc) {
  const issues = [];
  if (!isObject(doc)) return ["document is not an object"];

  const need = [
    "username", "generated_at", "range", "total_contributions",
    "active_days", "avg_per_active_day", "current_streak",
    "longest_streak", "best_day", "monthly", "days",
  ];
  for (const k of need) if (!(k in doc)) issues.push(`missing key: ${k}`);
  if (issues.length) return issues;

  if (typeof doc.username !== "string" || !doc.username) {
    issues.push("username must be a non-empty string");
  }
  if (Number.isNaN(Date.parse(doc.generated_at))) {
    issues.push("generated_at is not a valid ISO timestamp");
  } else if (Date.parse(doc.generated_at) > Date.now() + MS_PER_DAY) {
    issues.push("generated_at is in the future");
  }

  const { days } = doc;
  if (!Array.isArray(days) || days.length === 0) {
    issues.push("days must be a non-empty array");
    return issues;
  }
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!isObject(d) || !ISO_DATE.test(d.date || "") || !Number.isInteger(d.count) || d.count < 0) {
      issues.push(`days[${i}] malformed: ${JSON.stringify(d)}`);
      continue;
    }
    if (i > 0 && dayGap(days[i - 1].date, d.date) !== 1) {
      issues.push(`days not contiguous at index ${i}: ${days[i - 1].date} -> ${d.date}`);
    }
  }

  if (isObject(doc.range)) {
    if (doc.range.start !== days[0].date) issues.push("range.start does not match days[0]");
    if (doc.range.end !== days[days.length - 1].date) issues.push("range.end does not match last day");
  } else {
    issues.push("range is not an object");
  }

  const sum = days.reduce((s, d) => s + d.count, 0);
  if (doc.total_contributions !== sum) {
    issues.push(`total_contributions ${doc.total_contributions} != sum of days ${sum}`);
  }
  const active = days.filter((d) => d.count > 0).length;
  if (doc.active_days !== active) {
    issues.push(`active_days ${doc.active_days} != counted ${active}`);
  }

  // Recompute streaks/monthly/best-day from the raw days and compare.
  const { longest, current } = computeStreaks(days);
  if (JSON.stringify(longest) !== JSON.stringify(doc.longest_streak)) {
    issues.push(`longest_streak mismatch: stored ${JSON.stringify(doc.longest_streak)} computed ${JSON.stringify(longest)}`);
  }
  if (JSON.stringify(current) !== JSON.stringify(doc.current_streak)) {
    issues.push(`current_streak mismatch: stored ${JSON.stringify(doc.current_streak)} computed ${JSON.stringify(current)}`);
  }
  if (JSON.stringify(bestDay(days)) !== JSON.stringify(doc.best_day)) {
    issues.push("best_day mismatch");
  }
  if (JSON.stringify(monthlyTotals(days)) !== JSON.stringify(doc.monthly)) {
    issues.push("monthly totals do not reconcile with days");
  }

  for (const s of ["current_streak", "longest_streak"]) {
    const st = doc[s];
    if (!isObject(st) || !Number.isInteger(st.length) || st.length < 0) {
      issues.push(`${s} malformed`);
    }
  }
  return issues;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateRepos(doc) {
  const issues = [];
  if (!isObject(doc)) return ["document is not an object"];
  if (!Array.isArray(doc.repos)) {
    issues.push("repos must be an array");
    return issues;
  }
  if (Number.isNaN(Date.parse(doc.generated_at))) {
    issues.push("generated_at is not a valid ISO timestamp");
  }
  doc.repos.forEach((r, i) => {
    if (!isObject(r) || typeof r.name !== "string" || !r.name) {
      issues.push(`repos[${i}] missing name`);
      return;
    }
    if (typeof r.url !== "string" || !r.url.startsWith("https://")) {
      issues.push(`repos[${i}] ${r.name}: url must be https`);
    }
    if (!Number.isInteger(r.stars) || r.stars < 0) {
      issues.push(`repos[${i}] ${r.name}: stars must be a non-negative integer`);
    }
    if (r.pushed_at && Number.isNaN(Date.parse(r.pushed_at))) {
      issues.push(`repos[${i}] ${r.name}: pushed_at not a valid timestamp`);
    }
  });
  return issues;
}

async function main() {
  let failed = false;
  const report = (label, issues) => {
    if (issues.length === 0) {
      console.log(`OK  ${label}`);
    } else {
      failed = true;
      for (const i of issues) console.error(`FAIL ${label}: ${i}`);
    }
  };

  const contributions = JSON.parse(fs.readFileSync("data/contributions.json", "utf8"));
  report("data/contributions.json", validateContributions(contributions));

  const repos = JSON.parse(fs.readFileSync("data/repos.json", "utf8"));
  report("data/repos.json", validateRepos(repos));

  // The offline snapshot must mirror the live files byte-for-byte as data.
  try {
    const fallback = await import("../assets/fallback.js");
    if (JSON.stringify(fallback.contributions) !== JSON.stringify(contributions)) {
      report("assets/fallback.js", ["contributions snapshot differs from data/contributions.json"]);
    } else if (JSON.stringify(fallback.repos) !== JSON.stringify(repos)) {
      report("assets/fallback.js", ["repos snapshot differs from data/repos.json"]);
    } else {
      console.log("OK  assets/fallback.js mirrors live data");
    }
  } catch (e) {
    report("assets/fallback.js", [`cannot import: ${e.message}`]);
  }

  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
