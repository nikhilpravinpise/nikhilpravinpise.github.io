import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bootApp } from "./helpers/dom.js";
import { buildColumns, monthLabels } from "../assets/contributions.js";
import { quantileThresholds, levelFor } from "../assets/lib/stats.js";

let ctx;
before(async () => {
  ctx = await bootApp();
  ctx.app.commands.run("contributions");
});
after(() => ctx.restore());

function grid() {
  return ctx.term.querySelector(".heatmap");
}

test("grid renders one cell per day plus leading/trailing padding", () => {
  const days = ctx.app.state.data.days;
  const cells = grid().querySelectorAll(".cell");
  const firstWeekday = new Date(days[0].date + "T00:00:00").getDay();
  const lastWeekday = new Date(days[days.length - 1].date + "T00:00:00").getDay();
  const expected = days.length + firstWeekday + (6 - lastWeekday);
  assert.equal(cells.length, expected);
});

test("padding cells are aria-hidden and unthemed", () => {
  const pad = [...grid().querySelectorAll(".cell[aria-hidden='true']")];
  assert.ok(pad.length > 0);
  for (const c of pad) assert.equal(c.dataset.level, undefined);
});

test("exactly one tab stop across ~370 cells (roving tabindex)", () => {
  const focusables = grid().querySelectorAll('[tabindex="0"]');
  assert.equal(focusables.length, 1);
  const total = grid().querySelectorAll("[tabindex]").length;
  assert.ok(total > 300);
});

test("arrow keys move focus and move the roving tab stop", () => {
  const cells = [...grid().querySelectorAll(".cell[tabindex]")];
  const start = cells.find((c) => c.tabIndex === 0);
  start.focus();
  assert.equal(ctx.document.activeElement, start);

  grid().dispatchEvent(
    new ctx.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  const afterDown = ctx.document.activeElement;
  assert.notEqual(afterDown, start);
  assert.equal(afterDown.tabIndex, 0);
  assert.equal(start.tabIndex, -1);

  grid().dispatchEvent(
    new ctx.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  const afterRight = ctx.document.activeElement;
  // Right = next week = +7 in column-major order
  const nav = cells.filter((c) => c.getAttribute("aria-hidden") !== "true" && c.hasAttribute("tabindex"));
  const i0 = nav.indexOf(start);
  assert.equal(nav.indexOf(afterRight), i0 + 1 + 7);
});

test("month labels appear above the week containing the 1st", () => {
  const months = [...ctx.term.querySelectorAll(".hm-months span")].map((s) => s.textContent);
  assert.ok(months.includes("Sep"), months.join(","));
  assert.ok(months.includes("Aug"), months.join(","));
  assert.ok(months.includes("Jun"), months.join(","));
  // 13 months in the fixture range
  assert.equal(months.length, 13);
});

test("weekday labels show Mon/Wed/Fri like GitHub", () => {
  const side = [...ctx.term.querySelectorAll(".hm-side span")].map((s) => s.textContent);
  assert.deepEqual(side, ["", "Mon", "", "Wed", "", "Fri", ""]);
});

test("every palette level is reachable on the real dataset", () => {
  const real = JSON.parse(fs.readFileSync("data/contributions.json", "utf8"));
  const t = quantileThresholds(real.days);
  const used = new Set(real.days.map((d) => levelFor(d.count, t)));
  for (let lvl = 1; lvl <= 5; lvl++) {
    assert.ok(used.has(lvl), `level ${lvl} never used on real data`);
  }
});

test("focus shows a tooltip with date and count", () => {
  const cell = grid().querySelector('.cell[tabindex="0"]');
  const tip = ctx.document.getElementById("tooltip");
  cell.dispatchEvent(new ctx.window.FocusEvent("focus"));
  assert.equal(tip.style.display, "block");
  assert.match(tip.textContent, /^\d{4}-\d{2}-\d{2}: \d+ contribution/);
  cell.dispatchEvent(new ctx.window.FocusEvent("blur"));
  assert.equal(tip.style.display, "none");
});

test("legend has six swatches and less/more text", () => {
  const legend = ctx.term.querySelector(".legend");
  assert.equal(legend.querySelectorAll(".cell").length, 6);
  assert.match(legend.textContent, /less\s+more/);
});

test("buildColumns: first column pads to the first day's weekday", () => {
  // 2025-09-14 was a Sunday (getDay()=0) -> no padding
  const cols = buildColumns([{ date: "2025-09-14", count: 1 }]);
  assert.equal(cols[0][0].date, "2025-09-14");
  // 2025-09-15 was a Monday -> one pad before it
  const cols2 = buildColumns([{ date: "2025-09-15", count: 1 }]);
  assert.equal(cols2[0][0], null);
  assert.equal(cols2[0][1].date, "2025-09-15");
});

test("monthLabels: maps the column containing a 1st", () => {
  const cols = buildColumns([
    { date: "2025-09-28", count: 1 }, { date: "2025-09-29", count: 1 },
    { date: "2025-09-30", count: 1 }, { date: "2025-10-01", count: 1 },
    { date: "2025-10-02", count: 1 },
  ]);
  const labels = monthLabels(cols);
  assert.equal(labels.get(0), "Oct"); // the week containing Oct 1
});
