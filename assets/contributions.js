// Contribution data loading and rendering: stat cards, the labelled
// heatmap, and the `graph` ASCII chart. Data comes from
// data/contributions.json, with assets/fallback.js dynamic-imported only
// when the fetch fails (so the snapshot costs nothing on the happy path).

import { quantileThresholds, levelFor } from "./lib/stats.js";

export const LIVE_DATA_URL = "./data/contributions.json";

export async function loadContributions(state) {
  try {
    const res = await fetch(LIVE_DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("bad status " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.days)) throw new Error("bad payload");
    state.data = json;
  } catch (_e) {
    const fallback = await import("./fallback.js");
    state.data = fallback.contributions;
    state.dataIsFallback = true;
  }
  return state.data;
}

/* ---------------------------------------------------------------------- */
const REDUCED_MOTION = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// rAF can be unavailable (teardown in tests, exotic embeds) - degrade to a
// timeout so nothing ever throws inside a scheduled callback.
const raf = (cb) =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(cb)
    : setTimeout(cb, 16);

function countUp(el, target, suffix) {
  if (REDUCED_MOTION()) {
    el.textContent = target.toLocaleString() + (suffix || "");
    return;
  }
  const dur = 900;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = val.toLocaleString() + (suffix || "");
    if (p < 1) raf(tick);
  }
  raf(tick);
}

export function renderStats(state) {
  const box = document.getElementById("statsBox");
  if (!box || !state.data) return;
  const d = state.data;
  const stats = [
    ["total", d.total_contributions, "contributions"],
    ["current", d.current_streak.length, "day streak"],
    ["longest", d.longest_streak.length, "day best streak"],
    ["best", d.best_day.count, "in one day"],
  ];
  box.innerHTML = "";
  stats.forEach(([key, val, label]) => {
    const card = document.createElement("div");
    card.className = "stat";
    card.innerHTML = `<div class="num" data-key="${key}">0</div><div class="lbl">${label}</div>`;
    box.appendChild(card);
    countUp(card.querySelector(".num"), val);
  });
}

/* ---------------------------------------------------------------------- */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/**
 * Group flat days into week columns (Sun..Sat rows). Returns
 * { columns, navCellsOrder } where each column is a 7-slot array that may
 * contain null padding cells.
 */
export function buildColumns(days) {
  const first = new Date(days[0].date + "T00:00:00");
  const cols = [];
  let col = new Array(first.getDay()).fill(null);
  for (const d of days) {
    const weekday = new Date(d.date + "T00:00:00").getDay();
    while (col.length < weekday) col.push(null);
    col.push(d);
    if (col.length === 7) { cols.push(col); col = []; }
  }
  if (col.length) {
    while (col.length < 7) col.push(null);
    cols.push(col);
  }
  return cols;
}

/**
 * Returns Map<columnIndex, monthLabel>. A column is labeled when it contains
 * the 1st of a month; the first column always gets a label even when the
 * range starts mid-month (GitHub does the same for the leading partial month).
 */
export function monthLabels(columns) {
  const labels = new Map();
  columns.forEach((col, ci) => {
    const firstOfMonth = col.find((d) => d && d.date.endsWith("-01"));
    if (firstOfMonth) {
      labels.set(ci, MONTHS[Number(firstOfMonth.date.slice(5, 7)) - 1]);
    }
  });
  if (!labels.has(0)) {
    const firstDay = columns[0] && columns[0].find((d) => d);
    if (firstDay) labels.set(0, MONTHS[Number(firstDay.date.slice(5, 7)) - 1]);
  }
  return labels;
}

/**
 * Build the full heatmap widget: month labels on top, weekday labels on
 * the side, cells with roving tabindex + arrow-key navigation, legend.
 * `tooltipEl` is the shared floating tooltip element.
 */
export function buildHeatmap(data, tooltipEl) {
  const days = data.days;
  const columns = buildColumns(days);
  const thresholds = quantileThresholds(days);
  const labels = monthLabels(columns);

  const wrap = document.createElement("div");
  wrap.className = "heatmap-wrap";

  const hm = document.createElement("div");
  hm.className = "hm";

  // month label row, aligned over week columns via the same 12px pitch
  const monthsRow = document.createElement("div");
  monthsRow.className = "hm-months";
  monthsRow.setAttribute("aria-hidden", "true");
  monthsRow.style.gridTemplateColumns = `repeat(${columns.length}, 10px)`;
  for (const [ci, name] of labels) {
    const span = document.createElement("span");
    span.style.gridColumnStart = String(ci + 1);
    span.textContent = name;
    monthsRow.appendChild(span);
  }

  // weekday label column (Mon/Wed/Fri like github's)
  const side = document.createElement("div");
  side.className = "hm-side";
  side.setAttribute("aria-hidden", "true");
  WEEKDAY_LABELS.forEach((t) => {
    const s = document.createElement("span");
    s.textContent = t;
    side.appendChild(s);
  });

  // the cell grid itself
  const grid = document.createElement("div");
  grid.className = "heatmap";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "contribution calendar");
  grid.setAttribute("aria-readonly", "true");

  const navCells = []; // real (non-padding) cells in DOM order
  columns.forEach((column) => {
    column.forEach((d) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (!d) {
        cell.style.background = "transparent";
        cell.setAttribute("aria-hidden", "true");
      } else {
        const tip = `${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}`;
        cell.dataset.level = String(levelFor(d.count, thresholds));
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", tip);
        cell.tabIndex = navCells.length === 0 ? 0 : -1;
        navCells.push(cell);

        const showTip = (e) => {
          tooltipEl.textContent = tip;
          tooltipEl.style.display = "block";
          const rect = cell.getBoundingClientRect();
          const clientX = e.clientX !== undefined ? e.clientX : rect.left + 5;
          const clientY = e.clientY !== undefined ? e.clientY : rect.top + 5;
          const x = Math.min(clientX + 14, window.innerWidth - tooltipEl.offsetWidth - 8);
          const y = Math.min(clientY + 14, window.innerHeight - tooltipEl.offsetHeight - 8);
          tooltipEl.style.left = Math.max(0, x) + "px";
          tooltipEl.style.top = Math.max(0, y) + "px";
        };
        const hideTip = () => { tooltipEl.style.display = "none"; };
        let tapTimer = null;
        cell.addEventListener("pointermove", showTip);
        cell.addEventListener("pointerdown", showTip);
        cell.addEventListener("pointerleave", () => { clearTimeout(tapTimer); hideTip(); });
        cell.addEventListener("pointerup", (e) => {
          if (e.pointerType === "mouse") return; // mouse keeps hover behavior
          clearTimeout(tapTimer);
          tapTimer = setTimeout(hideTip, 1500); // touch: let a tap be readable
        });
        cell.addEventListener("focus", showTip);
        cell.addEventListener("blur", hideTip);
      }
      grid.appendChild(cell);
    });
  });

  // roving tabindex + arrow navigation: one tab stop for ~370 cells.
  // DOM order is column-major (down a week), so arrows map:
  //   Down = +1 day, Up = -1 day, Right = +7 (next week), Left = -7.
  grid.addEventListener("keydown", (e) => {
    const idx = navCells.indexOf(document.activeElement);
    if (idx === -1) return;
    const moves = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 7, ArrowLeft: -7 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = navCells[idx + moves[e.key]];
    if (!next) return;
    navCells[idx].tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });

  hm.appendChild(monthsRow);
  hm.appendChild(side);
  hm.appendChild(grid);
  wrap.appendChild(hm);

  const legend = document.createElement("div");
  legend.className = "legend";
  const less = document.createElement("span");
  less.textContent = "less";
  legend.appendChild(less);
  for (let i = 0; i <= 5; i++) {
    const c = document.createElement("span");
    c.className = "cell";
    c.dataset.level = String(i);
    c.setAttribute("aria-hidden", "true");
    legend.appendChild(c);
    legend.appendChild(document.createTextNode(" "));
  }
  const more = document.createElement("span");
  more.textContent = "more";
  legend.appendChild(more);
  wrap.appendChild(legend);

  return wrap;
}

/** Snap an attached heatmap wrap to its right edge (most recent weeks). */
export function scrollHeatmapToEnd(wrap) {
  const snap = () => {
    if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = wrap.scrollWidth;
  };
  snap(); // works once attached; rAF covers late layout too
  raf(snap);
}

/* ---------------------------------------------------------------------- */
const BAR = "█";
const GRAPH_WIDTH = 38;

/** ASCII bar chart of monthly totals; returns an array of line strings. */
export function buildGraph(data) {
  const monthly = data.monthly || [];
  const max = Math.max(1, ...monthly.map((m) => m.total));
  const rows = monthly.map(({ month, total }) => {
    const len = total === 0 ? 0 : Math.max(1, Math.round((total / max) * GRAPH_WIDTH));
    return `${month}  <span class="out-green">${BAR.repeat(len)}</span> <span class="out-dim">${total}</span>`;
  });
  return rows;
}
