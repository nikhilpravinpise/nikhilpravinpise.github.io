// Service worker: offline support for the terminal site.
// - app shell + generated fallback: cache-first
// - data/*.json: network-first (fresh data when online, last-seen offline)
// Bump CACHE_VERSION whenever the precache list changes materially.

const CACHE_VERSION = "npp-v3.0.2";

const SHELL = [
  "./",
  "index.html",
  "404.html",
  "manifest.webmanifest",
  "assets/styles.css",
  "assets/app.js",
  "assets/profile.js",
  "assets/terminal.js",
  "assets/commands.js",
  "assets/contributions.js",
  "assets/repos.js",
  "assets/theme.js",
  "assets/matrix.js",
  "assets/lib/stats.js",
  "assets/fallback.js",
  "assets/og-image.png",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isData(url) {
  // regenerated daily - must not go stale inside a fixed-version cache
  return (
    url.origin === location.origin &&
    (/\/data\/.*\.json$/.test(url.pathname) || url.pathname.endsWith("/assets/fallback.js"))
  );
}

// Local dev (localhost/127.x) goes network-first for EVERYTHING so edited
// files are never served stale; cache still backs an offline reload, which
// is what makes localhost a faithful offline test bench.
const DEV = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);

async function networkFirst(e) {
  try {
    const res = await fetch(e.request);
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)));
    return res;
  } catch (_err) {
    const cached = await caches.match(e.request, {
      ignoreSearch: new URL(e.request.url).pathname === "/",
    });
    if (cached) return cached;
    if (e.request.mode === "navigate") {
      const home = await caches.match("./");
      if (home) return home; // serve the app offline for any route
    }
    throw _err;
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (DEV || isData(url)) {
    e.respondWith(networkFirst(e));
    return;
  }

  // shell + assets: cache-first
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname === "/" }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)));
        return res;
      });
    }),
  );
});
