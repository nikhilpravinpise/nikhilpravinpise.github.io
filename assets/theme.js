// Theme switching. Themes are pure CSS custom-property sets selected via
// <html data-theme="...">; this module only owns persistence and choice.

export const THEMES = [
  { id: "dark", label: "github dark (default)" },
  { id: "light", label: "github light" },
  { id: "amber", label: "amber phosphor" },
  { id: "synthwave", label: "synthwave" },
];

const KEY = "npp:theme";
const IDS = THEMES.map((t) => t.id);

function storageGet() {
  try {
    return localStorage.getItem(KEY);
  } catch (_e) {
    return null; // storage blocked (private mode etc.)
  }
}

function storageSet(v) {
  try {
    localStorage.setItem(KEY, v);
  } catch (_e) {
    /* non-fatal */
  }
}

export function getTheme() {
  return document.documentElement.dataset.theme || "dark";
}

export function applyTheme(id, { persist = true } = {}) {
  const next = IDS.includes(id) ? id : "dark";
  document.documentElement.dataset.theme = next;
  if (persist) storageSet(next);
  return next;
}

export function cycleTheme() {
  const i = IDS.indexOf(getTheme());
  return applyTheme(IDS[(i + 1) % IDS.length]);
}

/** Called once at boot: stored theme wins, else follow OS preference. */
export function initTheme() {
  const stored = storageGet();
  if (stored && IDS.includes(stored)) return applyTheme(stored, { persist: false });
  const prefersLight =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: light)").matches;
  return applyTheme(prefersLight ? "light" : "dark", { persist: false });
}
