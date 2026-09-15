// `repos` command: top public repositories, refreshed daily into
// data/repos.json by the contribution workflow. Falls back to the baked-in
// snapshot in assets/fallback.js when the fetch fails.

import { escapeHtml } from "./terminal.js";
import { relativeTime } from "./lib/stats.js";

export const REPOS_URL = "./data/repos.json";

export async function loadRepos(state) {
  try {
    const res = await fetch(REPOS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("bad status " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.repos)) throw new Error("bad payload");
    state.reposDoc = json;
  } catch (_e) {
    const fallback = await import("./fallback.js");
    state.reposDoc = fallback.repos;
  }
  return state.reposDoc;
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

export function renderRepos(state, term, now = Date.now()) {
  const doc = state.reposDoc;
  if (!doc) {
    term.line(`<span class="out-dim">loading repository data...</span>`);
    return;
  }
  term.line(
    `<span class="out-dim">top public repositories · updated ${escapeHtml(doc.generated_at.slice(0, 10))}</span>`,
  );
  for (const r of doc.repos) {
    const stars = r.stars > 0 ? ` ★${r.stars}` : "";
    const color = HEX_COLOR.test(r.language_color || "") ? r.language_color : "var(--muted)";
    const lang = r.language
      ? ` <span class="lang-dot" style="color:${color}">●</span> ${escapeHtml(r.language)}`
      : "";
    const when = r.pushed_at ? ` · ${escapeHtml(relativeTime(r.pushed_at, now))}` : "";
    term.line(
      `<span class="out-cmd">&gt; ${escapeHtml(r.name)}</span>` +
        `<span class="out-dim">${stars}${lang}${when}</span>`,
    );
    if (r.description) term.line(`  <span class="out-dim">${escapeHtml(r.description)}</span>`);
    term.line(
      `  <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.url)}</a>`,
    );
  }
}
