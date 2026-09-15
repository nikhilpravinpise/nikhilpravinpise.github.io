// Service worker: offline support for the terminal site.
// - app shell + generated fallback: cache-first
// - data/*.json: network-first (fresh data when online, last-seen offline)
// Bump CACHE_VERSION whenever the precache list changes materially.

const CACHE_VERSION = "npp-v3.0.1";

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

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (isData(url)) {
    // fresh first, cached when offline
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }

  // shell + assets: cache-first
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname === "/" }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
          return res;
        }),
    ),
  );
});
