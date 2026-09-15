// The command registry - single source of truth. help output, tab
// completion, the README command table and the consistency tests all
// derive from this list, so docs can never drift from behavior.

import { PROFILE, BANNER } from "./profile.js";
import { escapeHtml } from "./terminal.js";
import { buildHeatmap, buildGraph, scrollHeatmapToEnd } from "./contributions.js";
import { renderRepos } from "./repos.js";
import { THEMES } from "./theme.js";

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const NEOFETCH_ART = [
  "  ╭──────────────────╮",
  "  │ ●  ●  ●          │",
  "  │                  │",
  "  │  ~/portfolio ▌   │",
  "  │                  │",
  "  ╰──────────────────╯",
];

export function createCommands(ctx) {
  const { term, state, env } = ctx;
  const { line } = term;

  const registry = [
    {
      name: "help",
      summary: "available commands",
      run() {
        line(`<span class="out-white">available commands:</span>`);
        for (const c of registry) {
          if (c.hidden) continue;
          const names = [c.name, ...(c.aliases || [])].join(", ");
          line(
            `  <span class="out-cmd">${names.padEnd(20)}</span><span class="out-dim">${escapeHtml(c.summary)}</span>`,
          );
        }
      },
    },
    {
      name: "whoami",
      aliases: ["about"],
      summary: "who is this guy anyway",
      run() {
        line(`<span class="out-white">${escapeHtml(PROFILE.whoami[0])}</span>`);
        for (const l of PROFILE.whoami.slice(1)) {
          line(`<span class="out-dim">${escapeHtml(l)}</span>`);
        }
      },
    },
    {
      name: "experience",
      summary: "work and research history",
      run() {
        for (const [d, r, c] of PROFILE.experience) {
          line(
            `<span class="out-green">${d.padEnd(17)}</span><span class="out-white">${r.padEnd(28)}</span><span class="out-dim">${escapeHtml(c)}</span>`,
          );
        }
      },
    },
    {
      name: "skills",
      summary: "technical stack and tools",
      run() {
        for (const [k, v] of PROFILE.skills) {
          line(`<span class="out-cmd">${k.padEnd(12)}</span> ${escapeHtml(v)}`);
        }
      },
    },
    {
      name: "projects",
      aliases: ["ls"],
      summary: "things I have shipped",
      run() {
        for (const [n, d, url] of PROFILE.projects) {
          line(`<span class="out-cmd">&gt; ${escapeHtml(n)}</span>`);
          line(`  <span class="out-dim">${escapeHtml(d)}</span>`);
          line(
            `  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`,
          );
        }
        line(`<span class="out-dim">more repos: type 'repos' for the live top list</span>`);
      },
    },
    {
      name: "repos",
      summary: "top public repositories (live)",
      run() {
        renderRepos(state, term);
      },
    },
    {
      name: "contributions",
      summary: "live GitHub contribution heatmap",
      run() {
        if (!state.data) {
          line(`<span class="out-dim">${state.dataError ? "contribution data unavailable - check connection" : "loading contribution data..."}</span>`);
          return;
        }
        const d = state.data;
        line(
          `<span class="out-dim">${d.total_contributions.toLocaleString()} contributions · ${escapeHtml(d.range.start)} -&gt; ${escapeHtml(d.range.end)}${state.dataIsFallback ? " · offline snapshot" : ""}</span>`,
        );
        const heatmap = buildHeatmap(d, env.tooltip);
        term.append(heatmap);
        scrollHeatmapToEnd(heatmap);
        line(`<span class="out-dim">hover or arrow-key a cell for the exact date and count</span>`);
      },
    },
    {
      name: "streak",
      summary: "current, longest, and active stats",
      run() {
        if (!state.data) {
          line(`<span class="out-dim">${state.dataError ? "contribution data unavailable - check connection" : "loading contribution data..."}</span>`);
          return;
        }
        const d = state.data;
        line(`<span class="out-green">current streak:</span>  ${d.current_streak.length} days (${escapeHtml(d.current_streak.start || "none")} -&gt; ${escapeHtml(d.current_streak.end || "none")})`);
        line(`<span class="out-green">longest streak:</span>  ${d.longest_streak.length} days (${escapeHtml(d.longest_streak.start || "none")} -&gt; ${escapeHtml(d.longest_streak.end || "none")})`);
        line(`<span class="out-green">best day:</span>       ${d.best_day.count} contributions${d.best_day.count > 0 ? " on " + escapeHtml(d.best_day.date) : ""}`);
        line(`<span class="out-green">active days:</span>    ${d.active_days || 0} days (${d.avg_per_active_day || 0} avg / active day)`);
        line(`<span class="out-green">total:</span>          ${d.total_contributions.toLocaleString()} contributions since ${escapeHtml(d.range.start)}`);
      },
    },
    {
      name: "graph",
      summary: "monthly contribution bar chart",
      run() {
        if (!state.data) {
          line(`<span class="out-dim">${state.dataError ? "contribution data unavailable - check connection" : "loading contribution data..."}</span>`);
          return;
        }
        line(`<span class="out-white">monthly contributions</span>`);
        for (const row of buildGraph(state.data)) line(row);
      },
    },
    {
      name: "contact",
      summary: "portfolio, linkedin, github, email",
      run() {
        const l = PROFILE.links;
        line(`<span class="out-white">portfolio</span>  <a href="${escapeHtml(l.portfolio)}" target="_blank" rel="noopener noreferrer">nikhilpise.tech</a>`);
        line(`<span class="out-white">resume   </span>  <a href="${escapeHtml(l.resume)}" target="_blank" rel="noopener noreferrer">Google Drive Resume</a>`);
        line(`<span class="out-white">linkedin </span>  <a href="${escapeHtml(l.linkedin)}" target="_blank" rel="noopener noreferrer">linkedin.com/in/nikhil-pravin-pise</a>`);
        line(`<span class="out-white">github   </span>  <a href="${escapeHtml(l.github)}" target="_blank" rel="noopener noreferrer">github.com/nikhilpravinpise</a>`);
        line(`<span class="out-white">email    </span>  <a href="mailto:${escapeHtml(PROFILE.email)}">${escapeHtml(PROFILE.email)}</a>`);
      },
    },
    {
      name: "resume",
      summary: "open Google Drive resume in new tab",
      run() {
        const url = PROFILE.links.resume;
        line(`<span class="out-dim">opening resume in new tab...</span>`);
        line(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
        env.openWindow(url);
      },
    },
    {
      name: "open",
      summary: "open portfolio, linkedin, github, or resume",
      usage: "open [portfolio|resume|linkedin|github]",
      run(args) {
        const target = (args[0] || "").toLowerCase();
        const url = PROFILE.links[target];
        if (url) {
          line(`<span class="out-dim">opening ${escapeHtml(target)}...</span>`);
          env.openWindow(url);
        } else {
          line(`<span class="out-dim">usage: ${this.usage}</span>`);
        }
      },
    },
    {
      name: "copy",
      summary: "copy email or a link to the clipboard",
      usage: "copy [email|portfolio|resume|linkedin|github]",
      async run(args) {
        const target = (args[0] || "email").toLowerCase();
        const text = target === "email" ? PROFILE.email : PROFILE.links[target];
        if (!text) {
          line(`<span class="out-dim">usage: ${this.usage}</span>`);
          return;
        }
        const ok = await env.copyText(text);
        line(
          ok
            ? `<span class="out-green">copied</span> <span class="out-dim">${escapeHtml(text)}</span>`
            : `<span class="out-dim">clipboard unavailable - here it is: ${escapeHtml(text)}</span>`,
        );
      },
    },
    {
      name: "photo",
      summary: "github avatar",
      run() {
        const img = document.createElement("img");
        img.src = PROFILE.avatar;
        img.width = 200;
        img.height = 200;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        img.style.border = "1px solid var(--frame)";
        img.alt = "github avatar";
        img.onerror = () => {
          line(`<span class="out-dim">could not load avatar image</span>`);
        };
        term.append(img);
      },
    },
    {
      name: "neofetch",
      summary: "system info, but for me",
      run() {
        const d = state.data;
        const uptimeDays = state.reposDoc && state.reposDoc.user_created_at
          ? Math.max(0, Math.floor((Date.now() - Date.parse(state.reposDoc.user_created_at)) / 86_400_000))
          : null;
        const info = [
          [`${PROFILE.handle}@${PROFILE.host}`, "white"],
          ["─".repeat(PROFILE.prompt.length), "dim"],
          ["OS", `${PROFILE.agent} (github pages)`],
          ["Host", "nikhilpravinpise.github.io"],
          ["Uptime", uptimeDays !== null ? `${uptimeDays.toLocaleString()} days on github` : "unknown"],
          ["Shell", PROFILE.system.shell],
          ["Editor", PROFILE.system.editor],
          ["Location", PROFILE.system.location],
          ["Languages", "Python · TypeScript · Dart · C++"],
          ["Contributions", d ? `${d.total_contributions.toLocaleString()} in the last year` : state.dataError ? "unavailable" : "loading..."],
          ["Streak", d ? `${d.current_streak.length}d current · ${d.longest_streak.length}d best` : state.dataError ? "unavailable" : "loading..."],
        ];
        const artW = Math.max(...NEOFETCH_ART.map((l) => l.length)) + 4;
        const rows = Math.max(NEOFETCH_ART.length, info.length);
        for (let i = 0; i < rows; i++) {
          const art = (NEOFETCH_ART[i] || "").padEnd(artW);
          const item = info[i];
          let right = "";
          if (item) {
            if (item.length === 2 && item[1] === "white") {
              right = `<span class="out-white">${escapeHtml(item[0])}</span>`;
            } else if (item.length === 2 && item[1] === "dim") {
              right = `<span class="out-dim">${escapeHtml(item[0])}</span>`;
            } else {
              right = `<span class="out-cmd">${escapeHtml(item[0])}</span><span class="out-dim">:</span> ${escapeHtml(item[1])}`;
            }
          }
          line(`<span class="out-green">${escapeHtml(art)}</span>${right}`);
        }
      },
    },
    {
      name: "theme",
      summary: "switch color theme (dark, light, amber, synthwave)",
      usage: "theme [dark|light|amber|synthwave]",
      run(args) {
        const target = (args[0] || "").toLowerCase();
        if (!target) {
          for (const t of THEMES) {
            const cur = env.getTheme() === t.id ? "  &lt;- current" : "";
            line(`  <span class="out-cmd">${t.id.padEnd(10)}</span><span class="out-dim">${escapeHtml(t.label)}${cur}</span>`);
          }
          line(`<span class="out-dim">usage: ${this.usage}</span>`);
          return;
        }
        if (!THEMES.some((t) => t.id === target)) {
          line(`<span class="out-dim">unknown theme '${escapeHtml(target)}' - ${this.usage}</span>`);
          return;
        }
        env.setTheme(target);
        line(`<span class="out-green">theme set to ${escapeHtml(target)}</span><span class="out-dim"> (persisted in localStorage)</span>`);
      },
    },
    {
      name: "matrix",
      summary: "toggle matrix digital rain",
      run() {
        if (env.reducedMotion()) {
          line(`<span class="out-dim">matrix mode is disabled while reduced motion is on</span>`);
          return;
        }
        const on = env.toggleMatrix();
        line(`<span class="out-dim">${on ? "matrix mode on -- type 'matrix' again to turn it off" : "back to normal"}</span>`);
      },
    },
    {
      name: "banner",
      summary: "reprint ASCII banner art",
      run() {
        line(`<pre class="out-green" style="margin:0;font-size:9px;line-height:1.3">${escapeHtml(BANNER)}</pre>`);
      },
    },
    {
      name: "history",
      summary: "list session command history (-c clears)",
      usage: "history [-c]",
      run(args) {
        if (args[0] === "-c" || args[0] === "clear") {
          state.history.length = 0;
          env.persistHistory();
          line(`<span class="out-dim">history cleared</span>`);
          return;
        }
        if (state.history.length === 0) {
          line(`<span class="out-dim">no commands in history</span>`);
          return;
        }
        state.history.forEach((c, i) =>
          line(`  <span class="out-dim">${String(i + 1).padStart(3, " ")}</span>  <span class="out-white">${escapeHtml(c)}</span>`),
        );
      },
    },
    {
      name: "clear",
      summary: "clear terminal screen (hotkey: Ctrl+L)",
      run() {
        term.clear();
        env.printHome();
      },
    },
    /* ------------------------------ easter eggs ------------------------------ */
    {
      name: "sudo",
      hidden: true,
      run() {
        line(`<span class="out-yellow">[sudo] password for nikhil:</span> <span class="out-dim">nice try. this is a static site.</span>`);
      },
    },
    {
      name: "exit",
      aliases: ["quit", "logout"],
      hidden: true,
      run() {
        line(`<span class="out-dim">there is no escape. only terminal.</span>`);
      },
    },
    {
      name: "date",
      hidden: true,
      run() {
        line(`<span class="out-dim">${escapeHtml(new Date().toString())}</span>`);
      },
    },
    {
      name: "echo",
      hidden: true,
      usage: "echo [text]",
      run(args) {
        line(`<span class="out-white">${escapeHtml(args.join(" "))}</span>`);
      },
    },
    {
      name: "vim",
      aliases: ["emacs", "nano"],
      hidden: true,
      run() {
        line(`<span class="out-dim">no. this is a portfolio, not an editor war.</span>`);
      },
    },
  ];

  const byName = new Map();
  for (const c of registry) {
    byName.set(c.name, c);
    for (const a of c.aliases || []) byName.set(a, c);
  }

  // Tab completion: every visible name + alias, no hidden commands.
  const completions = [
    ...new Set(
      registry.flatMap((c) => (c.hidden ? [] : [c.name, ...(c.aliases || [])])),
    ),
  ];

  // Sub-argument completion targets per command.
  const subArgs = {
    open: Object.keys(PROFILE.links),
    copy: ["email", ...Object.keys(PROFILE.links)],
    theme: THEMES.map((t) => t.id),
    history: ["-c"],
  };

  function run(raw, opts = {}) {
    const { syncHash = true } = opts;
    const trimmed = raw.trim();
    term.echo(trimmed);
    if (!trimmed) return;

    if (state.history[state.history.length - 1] !== trimmed) {
      state.history.push(trimmed);
      if (state.history.length > 100) state.history.shift();
      env.persistHistory();
    }
    state.historyIndex = state.history.length;
    state.historyDraft = "";

    const [cmd, ...args] = trimmed.split(/\s+/);
    const key = cmd.toLowerCase();
    const entry = byName.get(key);
    if (entry) {
      const result = entry.run(args);
      if (syncHash) env.syncHash(trimmed);
      // async commands (copy) must never surface as unhandled rejections
      if (result && typeof result.catch === "function") {
        return result.catch((e) => {
          line(`<span class="out-dim">${escapeHtml(String(e && e.message || e))}</span>`);
        });
      }
      return result;
    } else {
      const suggestion = [...byName.keys()]
        .map((n) => [n, levenshtein(key, n)])
        .filter(([, d]) => d <= 2)
        .sort((a, b) => a[1] - b[1])[0];
      line(
        suggestion
          ? `<span class="out-dim">command not found: ${escapeHtml(cmd)} - did you mean '${suggestion[0]}'?</span>`
          : `<span class="out-dim">command not found: ${escapeHtml(cmd)} - type 'help'</span>`,
      );
    }
  }

  return { registry, byName, completions, subArgs, run };
}
