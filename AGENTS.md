# Agent notes

Terminal-style GitHub Pages site. Vanilla HTML/CSS/JS, zero build step, zero runtime dependencies.

## Commands

- `npm run dev` - zero-dep static server on :8000 (ES modules need http; `file://` won't work)
- `npm test` - node:test + jsdom suite in `test/`
- `npm run lint` / `npm run lint:fix`
- `npm run validate` - validates `data/*.json` and `assets/fallback.js` parity
- `npm run check:links` - network link check (needs internet; LinkedIn warn-only)
- `npm run sync` - regenerate data + fallback (needs `CONTRIB_PAT` or `GITHUB_TOKEN`)
- `npm run og` - regenerate OG image + icons (needs Chrome/Edge; `OG_BROWSER` overrides)
- `npm run check` - lint + test + validate in one shot

## Architecture rules

- **`assets/app.js` is the only module allowed to touch the DOM at import time.** Every other module exports factories/functions. This is what makes the jsdom test bootstrap work - don't break it.
- **`assets/profile.js` is the single source of truth** for all content and URLs. `assets/commands.js` is the single source of truth for the command list. `help` output, tab completion, the README command table, footer links and `<noscript>` content are all asserted against them in `test/consistency.test.js` - add a command in one place, the tests tell you what else to update.
- **Shared pure logic lives in `assets/lib/stats.js`** and is imported by both the browser and `scripts/` (Node). Keep it free of I/O, DOM, `process`, and implicit clocks.
- **`assets/fallback.js` is generated** by `scripts/sync-github-data.js`. Never hand-edit; `npm run validate` checks it mirrors `data/*.json` byte-for-byte.
- **`sw.js` precache must cover every file in `assets/`** plus the core documents. Add an asset -> update `SHELL` and bump `CACHE_VERSION`. Enforced by tests + `check:links`.
- **Escape before `innerHTML`.** All dynamic output goes through `terminal.js`'s `line()` which sets `innerHTML` - user input must pass `escapeHtml()` first. `test/security.test.js` counts innerHTML sinks.
- **Heatmap accessibility**: one roving tab stop + arrow-key nav; don't give cells individual `tabindex="0"`.

## Gotchas

- `git log` is full of `chore: refresh contribution data` - that's the daily workflow, not you.
- jsdom can't do canvas 2d, `matchMedia`, or `window.open`; the test bootstrap stubs them in `test/helpers/dom.js`.
- The `--matrix-fade` CSS var holds `"r,g,b"` channels (no `rgba()` wrapper) because canvas `fillStyle` needs the alpha composed in JS.
- Themes are pure CSS custom-property sets keyed off `<html data-theme>`. Heatmap cells use `data-level` attributes - never inline colors - so they retheme automatically.
