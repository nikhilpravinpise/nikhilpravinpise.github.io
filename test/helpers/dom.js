// jsdom bootstrap: loads the REAL index.html, installs browser globals,
// stubs what jsdom lacks (matchMedia, clipboard, open), then imports the
// real assets/app.js so tests exercise the actual boot path.

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
let importCounter = 0;

export function indexHtml() {
  return fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
}

function makeMatchMedia({ reducedMotion = false, wide = true } = {}) {
  return (query) => ({
    matches: query.includes("prefers-reduced-motion")
      ? reducedMotion
      : query.includes("prefers-color-scheme")
        ? false
        : query.includes("min-width")
          ? wide
          : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
}

/**
 * Boots the app in jsdom and resolves after loadData+boot finish.
 * opts: { url, reducedMotion, wide, fetchImpl, clipboard }
 * Returns { window, document, term, input, app }.
 */
export async function bootApp(opts = {}) {
  const {
    url = "https://nikhilpravinpise.github.io/",
    reducedMotion = false,
    wide = true,
    fetchImpl,
    clipboard = [],
  } = opts;

  const virtualConsole = new VirtualConsole();
  // jsdom can't do canvas 2d or window.open - swallow those, keep the rest
  virtualConsole.on("jsdomError", (e) => {
    if (!/not implemented/i.test(e.message)) console.error(e);
  });

  const dom = new JSDOM(indexHtml(), {
    url,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;

  window.matchMedia = makeMatchMedia({ reducedMotion, wide });
  window.open = () => null;
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async (t) => clipboard.push(t) },
    configurable: true,
  });

  const g = globalThis;
  const prev = {
    window: g.window, document: g.document, localStorage: g.localStorage,
    location: g.location, history: g.history, matchMedia: g.matchMedia,
    getComputedStyle: g.getComputedStyle,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
    fetch: g.fetch, open: g.open, navigator: g.navigator,
  };

  g.window = window;
  g.document = window.document;
  g.localStorage = window.localStorage;
  g.location = window.location;
  g.history = window.history;
  g.matchMedia = window.matchMedia;
  g.getComputedStyle = window.getComputedStyle.bind(window);
  g.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  g.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  g.open = window.open;
  g.fetch = fetchImpl || defaultFetch;
  try {
    Object.defineProperty(g, "navigator", { value: window.navigator, configurable: true });
  } catch (_e) {
    /* node navigator is fine - has no serviceWorker so SW path skips */
  }

  await import(`../../assets/app.js?t=${++importCounter}`);
  await window.__appReady;

  const term = window.document.getElementById("term");
  const input = window.document.getElementById("cmdInput");

  return {
    dom,
    window,
    document: window.document,
    term,
    input,
    app: window.__app,
    clipboard,
    /** restore globals (call in test teardown if leaking matters) */
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete g[k];
        else {
          try {
            g[k] = v;
          } catch (_e) {
            // getter-only globals (e.g. navigator) need defineProperty
            Object.defineProperty(g, k, { value: v, configurable: true });
          }
        }
      }
    },
  };
}

/** Default fetch: serves fixture JSON for data/*.json, 404 for the rest. */
import { CONTRIBUTIONS_FIXTURE, REPOS_FIXTURE } from "./fixtures.js";
async function defaultFetch(url) {
  const u = String(url);
  if (u.includes("contributions.json")) {
    return { ok: true, status: 200, json: async () => CONTRIBUTIONS_FIXTURE };
  }
  if (u.includes("repos.json")) {
    return { ok: true, status: 200, json: async () => REPOS_FIXTURE };
  }
  return { ok: false, status: 404, json: async () => ({}) };
}

/** Simulate a keypress on the input element. */
export function key(input, window, key, extra = {}) {
  input.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true, ...extra }),
  );
}

/** Type a command into the input and press Enter. */
export function typeCommand(input, window, text) {
  input.value = text;
  key(input, window, "Enter");
}

/** All rendered line texts in the terminal. */
export function termText(term) {
  return [...term.querySelectorAll(".line")].map((l) => l.textContent);
}
