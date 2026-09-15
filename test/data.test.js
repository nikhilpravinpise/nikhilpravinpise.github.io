import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateContributions,
  validateRepos,
} from "../scripts/validate-data.js";

const realContrib = JSON.parse(fs.readFileSync("data/contributions.json", "utf8"));
const realRepos = JSON.parse(fs.readFileSync("data/repos.json", "utf8"));

function base() {
  return {
    username: "u",
    generated_at: "2026-01-03T00:00:00Z",
    range: { start: "2026-01-01", end: "2026-01-03" },
    total_contributions: 6,
    active_days: 2,
    avg_per_active_day: 3,
    current_streak: { length: 1, start: "2026-01-03", end: "2026-01-03" },
    longest_streak: { length: 1, start: "2026-01-01", end: "2026-01-01" },
    best_day: { date: "2026-01-03", count: 5 },
    monthly: [{ month: "2026-01", total: 6 }],
    days: [
      { date: "2026-01-01", count: 1 },
      { date: "2026-01-02", count: 0 },
      { date: "2026-01-03", count: 5 },
    ],
  };
}

test("validateContributions: real file is clean", () => {
  assert.deepEqual(validateContributions(realContrib), []);
});

test("validateRepos: real file is clean", () => {
  assert.deepEqual(validateRepos(realRepos), []);
});

test("validateContributions: valid minimal doc passes", () => {
  assert.deepEqual(validateContributions(base()), []);
});

test("validateContributions: rejects missing keys", () => {
  const bad = base();
  delete bad.days;
  const issues = validateContributions(bad);
  assert.ok(issues.some((i) => i.includes("days")));
});

test("validateContributions: rejects non-contiguous days", () => {
  const bad = base();
  bad.days.splice(1, 0, { date: "2026-01-02", count: 0 }); // duplicate date
  const issues = validateContributions(bad);
  assert.ok(issues.some((i) => i.includes("contiguous")), issues.join());
});

test("validateContributions: rejects wrong totals", () => {
  const bad = base();
  bad.total_contributions = 999;
  assert.ok(validateContributions(bad).some((i) => i.includes("total_contributions")));
  const bad2 = base();
  bad2.active_days = 42;
  assert.ok(validateContributions(bad2).some((i) => i.includes("active_days")));
});

test("validateContributions: rejects a fabricated streak", () => {
  const bad = base();
  bad.longest_streak = { length: 3, start: "2026-01-01", end: "2026-01-03" };
  assert.ok(validateContributions(bad).some((i) => i.includes("longest_streak")));
});

test("validateContributions: rejects future generated_at", () => {
  const bad = base();
  bad.generated_at = "2999-01-01T00:00:00Z";
  assert.ok(validateContributions(bad).some((i) => i.includes("future")));
});

test("validateRepos: catches malformed entries", () => {
  const good = { username: "u", generated_at: "2026-01-01T00:00:00Z", repos: [] };
  assert.deepEqual(validateRepos(good), []);
  const bad = { ...good, repos: [{ name: "x", url: "http://insecure", stars: -1 }] };
  const issues = validateRepos(bad);
  assert.ok(issues.some((i) => i.includes("url")));
  assert.ok(issues.some((i) => i.includes("stars")));
});

test("fallback snapshot mirrors live data exactly", async () => {
  const fallback = await import("../assets/fallback.js");
  assert.deepEqual(fallback.contributions, realContrib);
  assert.deepEqual(fallback.repos, realRepos);
});
