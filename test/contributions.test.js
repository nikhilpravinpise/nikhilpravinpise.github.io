import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStreaks,
  bestDay,
  monthlyTotals,
  quantileThresholds,
  levelFor,
  summarize,
  relativeTime,
} from "../assets/lib/stats.js";
import { CONTRIBUTIONS_FIXTURE } from "./helpers/fixtures.js";

const D = (date, count) => ({ date, count });

test("computeStreaks: empty input", () => {
  const { longest, current } = computeStreaks([]);
  assert.equal(longest.length, 0);
  assert.equal(current.length, 0);
  assert.equal(longest.start, null);
  assert.equal(current.end, null);
});

test("computeStreaks: all-zero year", () => {
  const days = [D("2026-01-01", 0), D("2026-01-02", 0), D("2026-01-03", 0)];
  const { longest, current } = computeStreaks(days);
  assert.equal(longest.length, 0);
  assert.equal(current.length, 0);
});

test("computeStreaks: single active day at the end is current", () => {
  const days = [D("2026-01-01", 0), D("2026-01-02", 0), D("2026-01-03", 3)];
  const { longest, current } = computeStreaks(days);
  assert.equal(current.length, 1);
  assert.equal(current.start, "2026-01-03");
  assert.equal(longest.length, 1);
});

test("computeStreaks: streak ending yesterday still counts as current", () => {
  const days = [
    D("2026-01-01", 0),
    D("2026-01-02", 2),
    D("2026-01-03", 5),
    D("2026-01-04", 0), // today, nothing yet
  ];
  const { current } = computeStreaks(days);
  assert.equal(current.length, 2);
  assert.equal(current.end, "2026-01-03");
});

test("computeStreaks: streak ending 2+ days ago is not current", () => {
  const days = [
    D("2026-01-01", 2),
    D("2026-01-02", 5),
    D("2026-01-03", 0),
    D("2026-01-04", 0),
  ];
  const { longest, current } = computeStreaks(days);
  assert.equal(current.length, 0);
  assert.equal(longest.length, 2);
});

test("computeStreaks: longest can be earlier than current run", () => {
  const days = [
    D("2026-01-01", 1), D("2026-01-02", 1), D("2026-01-03", 1), D("2026-01-04", 1),
    D("2026-01-05", 0),
    D("2026-01-06", 2), D("2026-01-07", 2),
  ];
  const { longest, current } = computeStreaks(days);
  assert.equal(longest.length, 4);
  assert.equal(longest.start, "2026-01-01");
  assert.equal(current.length, 2);
});

test("bestDay: first wins on ties; null when all zero", () => {
  assert.deepEqual(bestDay([]), { date: null, count: 0 });
  assert.deepEqual(bestDay([D("2026-01-01", 0)]), { date: null, count: 0 });
  const tie = bestDay([D("2026-01-01", 9), D("2026-01-02", 9), D("2026-01-03", 1)]);
  assert.equal(tie.date, "2026-01-01");
});

test("monthlyTotals: aggregates and orders across a year boundary", () => {
  const days = [
    D("2025-12-30", 5), D("2025-12-31", 1),
    D("2026-01-01", 2), D("2026-01-02", 3),
  ];
  assert.deepEqual(monthlyTotals(days), [
    { month: "2025-12", total: 6 },
    { month: "2026-01", total: 5 },
  ]);
  assert.deepEqual(monthlyTotals([]), []);
});

test("quantileThresholds: degenerate inputs", () => {
  assert.deepEqual(quantileThresholds([]), [1, 2, 3, 4]);
  // flat distribution: thresholds still strictly increasing so bands are real
  const flat = quantileThresholds([D("2026-01-01", 5), D("2026-01-02", 5)]);
  for (let i = 1; i < flat.length; i++) assert.ok(flat[i] > flat[i - 1]);
});

test("quantileThresholds + levelFor: spread maps to all levels", () => {
  const days = [];
  for (let i = 1; i <= 100; i++) days.push(D(`2026-01-01`, i)); // dates irrelevant here
  const t = quantileThresholds(days);
  assert.equal(levelFor(0, t), 0);
  assert.equal(levelFor(1, t), 1);
  assert.equal(levelFor(100, t), 5);
  // every level is reachable in a spread distribution
  const seen = new Set(days.map((d) => levelFor(d.count, t)));
  for (const lvl of [0, 1, 2, 3, 4, 5]) {
    if (lvl === 0) continue; // no zero days in this set
    assert.ok(seen.has(lvl), `level ${lvl} unreachable`);
  }
});

test("levelFor: zero and negative counts are level 0", () => {
  const t = [1, 2, 3, 4, 5];
  assert.equal(levelFor(0, t), 0);
  assert.equal(levelFor(-3, t), 0);
});

test("summarize: shape, rounding, and derived fields", () => {
  const days = [D("2026-01-01", 1), D("2026-01-02", 0), D("2026-01-03", 4)];
  const doc = summarize("u", 5, days, "2026-01-03T00:00:00Z");
  assert.equal(doc.username, "u");
  assert.equal(doc.generated_at, "2026-01-03T00:00:00Z");
  assert.deepEqual(doc.range, { start: "2026-01-01", end: "2026-01-03" });
  assert.equal(doc.total_contributions, 5);
  assert.equal(doc.active_days, 2);
  assert.equal(doc.avg_per_active_day, 2.5);
  assert.equal(doc.days.length, 3);
});

test("summarize: avg_per_active_day rounds to one decimal", () => {
  const days = [D("2026-01-01", 1), D("2026-01-02", 1), D("2026-01-03", 1), D("2026-01-04", 0)];
  const doc = summarize("u", 17, days, "x"); // 17/3 = 5.66... -> 5.7
  assert.equal(doc.avg_per_active_day, 5.7);
});

test("relativeTime: today/yesterday/days/months/years/invalid", () => {
  const now = Date.parse("2026-09-15T12:00:00Z");
  assert.equal(relativeTime("2026-09-15T01:00:00Z", now), "today");
  assert.equal(relativeTime("2026-09-14T12:00:00Z", now), "yesterday");
  assert.equal(relativeTime("2026-09-12T00:00:00Z", now), "3d ago");
  assert.equal(relativeTime("2026-07-15T00:00:00Z", now), "2mo ago");
  assert.equal(relativeTime("2021-08-11T00:00:00Z", now), "5y ago");
  assert.equal(relativeTime("not-a-date", now), "");
});

test("fixture is self-consistent: current=8d, longest=14d, best=40", () => {
  assert.equal(CONTRIBUTIONS_FIXTURE.current_streak.length, 8);
  assert.equal(CONTRIBUTIONS_FIXTURE.longest_streak.length, 14);
  assert.equal(CONTRIBUTIONS_FIXTURE.best_day.count, 40);
  assert.equal(CONTRIBUTIONS_FIXTURE.best_day.date, "2026-08-17");
  assert.equal(CONTRIBUTIONS_FIXTURE.days.length, 367);
});
