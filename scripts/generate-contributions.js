#!/usr/bin/env node
// Regenerates data/contributions.json from the GitHub GraphQL contribution
// calendar. Run by .github/workflows/update-contributions.yml on a daily
// cron, or manually with: CONTRIB_PAT=... node scripts/generate-contributions.js

const USERNAME = "nikhilpravinpise";
const TOKEN = process.env.CONTRIB_PAT || process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("Missing CONTRIB_PAT (or GITHUB_TOKEN) env var");
  process.exit(1);
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

async function main() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const days = calendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));

  const activeDays = days.filter((d) => d.count > 0);

  // longest / current streaks over consecutive-day runs with count > 0
  let longest = { length: 0, start: null, end: null };
  let current = { length: 0, start: null, end: null };
  let runStart = null;
  let runLen = 0;

  days.forEach((d, i) => {
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
  });

  // current streak = trailing run ending at the last day with count > 0
  let lastActiveIdx = -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) { lastActiveIdx = i; break; }
  }
  if (lastActiveIdx >= 0) {
    let len = 0;
    let start = days[lastActiveIdx].date;
    for (let i = lastActiveIdx; i >= 0 && days[i].count > 0; i--) {
      len += 1;
      start = days[i].date;
    }
    current = { length: len, start, end: days[lastActiveIdx].date };
  }

  const bestDay = days.reduce(
    (best, d) => (d.count > best.count ? d : best),
    { date: days[0]?.date ?? null, count: 0 }
  );

  const monthlyMap = new Map();
  days.forEach((d) => {
    const month = d.date.slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + d.count);
  });
  const monthly = Array.from(monthlyMap, ([month, total]) => ({ month, total }));

  const output = {
    username: USERNAME,
    generated_at: new Date().toISOString(),
    range: { start: days[0]?.date ?? null, end: days[days.length - 1]?.date ?? null },
    total_contributions: calendar.totalContributions,
    active_days: activeDays.length,
    avg_per_active_day: activeDays.length
      ? Math.round((calendar.totalContributions / activeDays.length) * 10) / 10
      : 0,
    current_streak: current,
    longest_streak: longest,
    best_day: bestDay,
    monthly,
    days,
  };

  const fs = await import("node:fs");
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/contributions.json", JSON.stringify(output));
  console.log(`Wrote data/contributions.json (${output.total_contributions} contributions, ${days.length} days)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
