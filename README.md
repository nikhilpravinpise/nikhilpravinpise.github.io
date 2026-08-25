# nikhilpravinpise.github.io

An interactive, terminal-styled GitHub profile page, live at [nikhilpravinpise.github.io](https://nikhilpravinpise.github.io).

Type commands into a fake terminal to explore who I am - no build step, no framework, just a single `index.html`.

## Commands

```
help            available commands
whoami          who is this guy anyway (alias: about)
experience      work / research history
skills          tech stack
projects        things I've shipped (alias: ls)
contributions   live GitHub contribution heatmap
streak          current / longest streak
contact         how to reach me
photo           github avatar
open            open portfolio / github / linkedin in a new tab
matrix          toggle a little fun
banner          reprint the ASCII banner
clear           clear the terminal
```

## How it works

- `index.html` is the entire site - rendered client-side, no build step.
- The contribution heatmap fetches [`data/contributions.json`](data/contributions.json) at load time, falling back to a baked-in snapshot if that fetch fails (offline, CORS hiccup, etc). The daily workflow refreshes that snapshot inside `index.html` too, so the fallback never goes stale.
- [`scripts/generate-contributions.js`](scripts/generate-contributions.js) queries the GitHub GraphQL `contributionsCollection` API and computes totals, streaks, and a day-by-day breakdown.
- [`.github/workflows/update-contributions.yml`](.github/workflows/update-contributions.yml) runs that script daily (and on manual dispatch) and commits the refreshed `data/contributions.json`, so the heatmap and streak stats stay current without any manual upkeep.

## Local dev

No build step - just serve the file and open it:

```sh
npx serve .
```

To regenerate the contribution data locally:

```sh
CONTRIB_PAT=<a token with read:user scope> node scripts/generate-contributions.js
```
