// Entry point - the only module allowed to touch the DOM at import time.
// Everything else exports functions; this file wires them to the page.

import { PROFILE, BANNER, BANNER_SM } from "./profile.js";
import { createTerminal } from "./terminal.js";
import { createCommands } from "./commands.js";
import { createMatrix } from "./matrix.js";
import { initTheme, applyTheme, cycleTheme, getTheme } from "./theme.js";
import { loadContributions, renderStats } from "./contributions.js";
import { loadRepos } from "./repos.js";

const HISTORY_KEY = "npp:history";

const bannerArt = document.getElementById("bannerArt");
const bannerArtSm = document.getElementById("bannerArtSm");
const termEl = document.getElementById("term");
const input = document.getElementById("cmdInput");
const tooltip = document.getElementById("tooltip");

if (bannerArt) bannerArt.textContent = BANNER;
if (bannerArtSm) bannerArtSm.textContent = BANNER_SM;

const term = createTerminal(termEl);
const matrix = createMatrix(document.getElementById("matrixCanvas"));

const state = {
  data: null,
  dataIsFallback: false,
  reposDoc: null,
  history: loadHistory(),
  historyIndex: 0,
  historyDraft: "",
};
state.historyIndex = state.history.length;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-100).map(String) : [];
  } catch (_e) {
    return [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch (_e) {
    /* storage blocked - non-fatal */
  }
}

function printHome() {
  term.line(`<span class="out-green">connected to github.com/${PROFILE.handle}</span>`);
  term.line(`<span class="out-dim">type 'help' or tap any chip above to explore</span>`);
  term.blank();

  const statsWrap = document.createElement("div");
  statsWrap.className = "line";
  statsWrap.innerHTML = `<div class="stats" id="statsBox"></div>`;
  term.el.appendChild(statsWrap);
  renderStats(state);

  term.blank();
}

const env = {
  tooltip,
  reducedMotion: () =>
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  toggleMatrix: () => matrix.toggle(),
  getTheme,
  setTheme: (id) => applyTheme(id),
  cycleTheme,
  printHome,
  persistHistory,
  openWindow: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  copyText: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_e) {
      return false;
    }
  },
  // keep the address bar shareable: every run updates #command
  syncHash: (name) => {
    try {
      history.replaceState(null, "", `#${encodeURIComponent(name)}`);
    } catch (_e) {
      /* history API unavailable */
    }
  },
};

const commands = createCommands({ term, state, env });
window.__app = { state, commands }; // debug/test hook

/* ------------------------------ input handling ------------------------------ */

function completeTab() {
  const val = input.value;
  const trimmedStart = val.trimStart();
  if (!trimmedStart) return;
  const parts = trimmedStart.split(/\s+/);
  if (parts.length === 1) {
    const prefix = parts[0].toLowerCase();
    const matches = commands.completions.filter((c) => c.startsWith(prefix));
    if (matches.length === 1) {
      input.value = matches[0] + " ";
    } else if (matches.length > 1) {
      term.echo(val);
      term.line(`<span class="out-dim">${matches.join("  ")}</span>`);
    }
  } else if (parts.length === 2) {
    const subs = commands.subArgs[parts[0].toLowerCase()];
    if (!subs) return;
    const prefix = parts[1].toLowerCase();
    const matches = subs.filter((t) => t.startsWith(prefix));
    if (matches.length === 1) {
      input.value = `${parts[0]} ${matches[0]} `;
    } else if (matches.length > 1) {
      term.echo(val);
      term.line(`<span class="out-dim">${matches.join("  ")}</span>`);
    }
  }
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = input.value;
    input.value = "";
    commands.run(val);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (state.history.length === 0) return;
    if (state.historyIndex === state.history.length) {
      state.historyDraft = input.value;
    }
    if (state.historyIndex > 0) state.historyIndex--;
    input.value = state.history[state.historyIndex];
    input.setSelectionRange(input.value.length, input.value.length);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (state.history.length === 0) return;
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      input.value = state.history[state.historyIndex];
    } else if (state.historyIndex === state.history.length - 1) {
      state.historyIndex = state.history.length;
      input.value = state.historyDraft;
    }
    input.setSelectionRange(input.value.length, input.value.length);
  } else if (e.key === "Tab") {
    e.preventDefault();
    completeTab();
  } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    commands.run("clear");
  } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
    e.preventDefault();
    term.echo(`${input.value}^C`);
    input.value = "";
  } else if (e.ctrlKey && e.key.toLowerCase() === "u") {
    e.preventDefault();
    input.value = "";
  }
});

// clicking empty space focuses the input (desktop only, and not while
// the user is selecting text)
document.addEventListener("click", (e) => {
  if (e.target.closest("a, button, input, .cell, kbd, .chip")) return;
  if (window.getSelection() && window.getSelection().toString().length > 0) return;
  if (matchMedia("(min-width: 768px)").matches) input.focus();
});

const inputRow = document.querySelector(".input-row");
if (inputRow) inputRow.addEventListener("click", () => input.focus());

// scroll-affordance fades on the terminal pane (scrollbar is hidden)
const termWrap = document.getElementById("termWrap");
function updateScrollHints() {
  if (!termWrap) return;
  termWrap.classList.toggle("can-scroll-up", termEl.scrollTop > 8);
  termWrap.classList.toggle(
    "can-scroll-down",
    termEl.scrollHeight - termEl.scrollTop - termEl.clientHeight > 8,
  );
}
termEl.addEventListener("scroll", updateScrollHints, { passive: true });
window.addEventListener("resize", updateScrollHints);

const quickBox = document.getElementById("quickActions");
if (quickBox) {
  quickBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cmd = btn.getAttribute("data-cmd");
    if (cmd) commands.run(cmd);
  });
}

/* ------------------------------ deep links ------------------------------ */

function deepLinkCommand() {
  const fromQuery = new URLSearchParams(location.search).get("cmd");
  let fromHash;
  try {
    fromHash = decodeURIComponent(location.hash || "").replace(/^#\/?/, "");
  } catch (_e) {
    // malformed percent-encoding (e.g. #%E0%A4%A) - not a valid deep link
    return null;
  }
  const raw = (fromQuery || fromHash || "").trim();
  if (!raw || raw.length > 60 || !/^[\w][\w -]*$/i.test(raw)) return null;
  const name = raw.split(/\s+/)[0].toLowerCase();
  return commands.byName.has(name) ? raw : null;
}

window.addEventListener("hashchange", () => {
  const cmd = deepLinkCommand();
  if (cmd) commands.run(cmd);
});

/* ------------------------------ boot ------------------------------ */

async function boot() {
  initTheme();
  printHome();
  // whoami is the boot greeting, not user input - it must not rewrite the
  // address bar or it would clobber a #hash deep link before we read it.
  commands.run("whoami", { syncHash: false });
  if (matchMedia("(min-width: 768px)").matches) input.focus();

  await Promise.all([loadContributions(state), loadRepos(state)]);
  renderStats(state);

  // deep links run after data so ?cmd=contributions renders, not "loading..."
  const deep = deepLinkCommand();
  if (deep && deep.toLowerCase() !== "whoami") commands.run(deep);
  updateScrollHints();
}

// offline support: real cached data, not just the baked snapshot
if (
  typeof navigator !== "undefined" &&
  navigator.serviceWorker &&
  location.hostname.endsWith("github.io")
) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

window.__appReady = boot();
