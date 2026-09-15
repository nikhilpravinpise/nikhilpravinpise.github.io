// Deterministic fixture data for DOM tests. Dates are real and contiguous:
// 371 days ending 2026-09-15, with a known streak structure:
//   - an 8-day active run ending at 2026-09-14 (=> current streak 8)
//   - a 14-day run in June 2026 (=> longest streak 14)
//   - a 5-day zero gap between 2026-08-20 and 2026-08-24
//   - best day 2026-08-17 with 40 contributions

import { summarize } from "../../assets/lib/stats.js";

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function makeDays() {
  const days = [];
  const end = "2026-09-14"; // last day will be appended as zero (2026-09-15)
  const start = addDays(end, -365);
  for (let i = 0; i <= 365; i++) {
    const date = addDays(start, i);
    let count = 0;
    if (date >= "2026-06-01" && date <= "2026-06-14") count = 6; // longest run
    else if (date >= "2026-08-10" && date <= "2026-08-19") count = 10;
    else if (date >= "2026-09-07" && date <= "2026-09-14") count = 4; // current run
    else if (i % 9 === 0) count = (i % 5) + 1; // scattered activity
    if (date === "2026-08-17") count = 40; // best day inside the Aug run
    days.push({ date, count });
  }
  days.push({ date: "2026-09-15", count: 0 });
  return days;
}

const _days = makeDays();

export const CONTRIBUTIONS_FIXTURE = summarize(
  "nikhilpravinpise",
  _days.reduce((s, d) => s + d.count, 0),
  _days,
  "2026-09-15T08:40:18.787Z",
);

export const REPOS_FIXTURE = {
  username: "nikhilpravinpise",
  generated_at: "2026-09-15T08:40:18.787Z",
  user_created_at: "2021-08-11T07:03:03Z",
  repos: [
    {
      name: "FixtureRepo",
      description: "A repo used by the test suite",
      url: "https://github.com/nikhilpravinpise/FixtureRepo",
      stars: 7,
      forks: 1,
      archived: false,
      pushed_at: "2026-09-12T14:45:42Z",
      language: "Python",
      language_color: "#3572A5",
    },
    {
      name: "NoLangRepo",
      description: "",
      url: "https://github.com/nikhilpravinpise/NoLangRepo",
      stars: 0,
      forks: 0,
      archived: false,
      pushed_at: "2026-09-10T00:00:00Z",
      language: null,
      language_color: null,
    },
  ],
};

export { iso, addDays };
