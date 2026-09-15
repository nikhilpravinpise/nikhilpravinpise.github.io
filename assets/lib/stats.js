// Pure contribution math shared by the data pipeline (scripts/) and the
// frontend (assets/). No I/O, no globals, no DOM - safe to import anywhere.

/** @typedef {{date: string, count: number}} Day */

/**
 * Longest and current streaks over consecutive-day runs with count > 0.
 * "Current" is the trailing run that ends today or yesterday (index-wise),
 * matching how GitHub's own streak behaves.
 */
export function computeStreaks(days) {
  let longest = { length: 0, start: null, end: null };
  let runStart = null;
  let runLen = 0;

  for (const d of days) {
    if (d.count > 0) {
      if (runLen === 0) runStart = d.date;
      runLen += 1;
      if (runLen > longest.length) {
        longest = { length: runLen, start: runStart, end: d.date };
      }
    } else {
      runLen = 0;
      runStart = null;
    }
  }

  let lastActiveIdx = -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) { lastActiveIdx = i; break; }
  }
  const daysSinceLastActive = days.length - 1 - lastActiveIdx;
  let current = { length: 0, start: null, end: null };
  if (lastActiveIdx >= 0 && daysSinceLastActive <= 1) {
    let len = 0;
    let start = days[lastActiveIdx].date;
    for (let i = lastActiveIdx; i >= 0 && days[i].count > 0; i--) {
      len += 1;
      start = days[i].date;
    }
    current = { length: len, start, end: days[lastActiveIdx].date };
  }

  return { longest, current };
}

/** Day with the most contributions; first wins on ties. Null date when all zero. */
export function bestDay(days) {
  const best = days.reduce(
    (b, d) => (d.count > b.count ? d : b),
    { date: days[0] ? days[0].date : null, count: 0 },
  );
  return best.count > 0 ? { date: best.date, count: best.count } : { date: null, count: 0 };
}

/** [{month: "YYYY-MM", total: n}] in chronological order. */
export function monthlyTotals(days) {
  const map = new Map();
  for (const d of days) {
    const month = d.date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + d.count);
  }
  return Array.from(map, ([month, total]) => ({ month, total }));
}

/**
 * Intensity thresholds derived from the user's own distribution (like
 * GitHub's quartile bucketing), so every palette level is reachable.
 * Returns 4 ascending cutoffs that partition active counts into 5 bands.
 */
export function quantileThresholds(days) {
  const active = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (active.length === 0) return [1, 2, 3, 4];
  const q = (p) => active[Math.floor(p * (active.length - 1))];
  const t = [q(0.25), q(0.5), q(0.75), q(0.9)];
  // strictly increasing so each level is a non-empty band
  for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1] + 1);
  return t;
}

/** Map a day count to palette level 0-5 given the 4 quantile cutoffs. */
export function levelFor(count, thresholds) {
  if (count <= 0) return 0;
  let level = 1;
  for (const t of thresholds) if (count > t) level += 1;
  return Math.min(level, 5);
}

/** Build the contributions.json document from raw calendar days. */
export function summarize(username, totalContributions, days, generatedAt) {
  const activeDays = days.filter((d) => d.count > 0).length;
  const { longest, current } = computeStreaks(days);
  return {
    username,
    generated_at: generatedAt,
    range: {
      start: days[0] ? days[0].date : null,
      end: days[days.length - 1] ? days[days.length - 1].date : null,
    },
    total_contributions: totalContributions,
    active_days: activeDays,
    avg_per_active_day: activeDays
      ? Math.round((totalContributions / activeDays) * 10) / 10
      : 0,
    current_streak: current,
    longest_streak: longest,
    best_day: bestDay(days),
    monthly: monthlyTotals(days),
    days,
  };
}

/** "3d ago" / "2mo ago" style relative time for repo listings. */
export function relativeTime(isoDate, now = Date.now()) {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
