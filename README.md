# Wowgear

Best-in-slot **leveling** gear for World of Warcraft Classic, The Burning Crusade, and Wrath of the Lich King.

Pick a class, spec, and level, and the app shows the top-ranked items for each equipment slot that you can both *equip* and *obtain* at that level - with their sources (drop, dungeon, quest, vendor, profession, raid, PvP, holiday), drop rates, and quest info.

Live: **https://wowgear.github.io/**

It is a fully static single-page app: the entire item database ships as a SQLite file that is queried in the browser. There is no backend.

---

## Features

- Three expansions: Classic/Vanilla (1-60), TBC (1-70), WotLK (1-80).
- All ten classes including Death Knight (WotLK only), with per-spec stat weighting.
- Level-aware: only items equippable *and* obtainable at the chosen level are shown.
- Faction filter (Alliance / Horde / any) using race and faction-template masks.
- Source-type filters (drop, dungeon, quest, vendor, profession, raid, PvP, holiday).
- Shareable state: the full configuration lives in the URL (e.g. `?expansion=tbc&class=rogue&spec=combat&level=40`).
- Wowhead-linked item tooltips and source lookups, per expansion.

---

## How it works

```
build time (Bun)                          run time (browser)
----------------                          ------------------
external game DBs ─┐                       fetch /<exp>.sqlite
  cmangos world    ├─> @wowgear/data ──>   sql.js (WASM) loads it
  wago DBC CSVs    │   build.ts            loadAll() -> items + sources in memory
  thatsmybis raid ─┘   |                   @wowgear/core scores + ranks per slot
                       v                   React paper-doll renders top picks
            apps/ui/public/<exp>.sqlite
```

At build time, `@wowgear/data` ingests external game-data dumps, normalizes them into a two-table schema (`items`, `item_sources`), prunes junk, derives where each item comes from, and emits one SQLite file per expansion into `apps/ui/public/`.

At run time, the UI loads `sql.js` (WASM SQLite) from a CDN, fetches the chosen `.sqlite` asset once, reads every row into memory, and calls `@wowgear/core` to compute the per-slot rankings. All "best at level X" logic is pure and client-side.

---

## Repository layout

This is a pnpm + TypeScript monorepo with three workspace members.

| Package | Role |
| --- | --- |
| `packages/core` | Dependency-free domain model, hand-curated stat weights, and the scoring/selection engine. Also exposes a `score` CLI. |
| `packages/data` | Build-time ingestion CLI (Bun). Parses external dumps and emits per-expansion SQLite files. |
| `apps/ui` | React + Vite SPA. Loads SQLite in the browser via `sql.js` and renders the paper-doll. |

Key files:

- `packages/core/src/types.ts` - data model + WoW domain constants (class/race/slot/subclass masks).
- `packages/core/src/weights.ts` - `StatWeights` per class/spec/level-bucket; `weightsFor()`.
- `packages/core/src/score.ts`, `select.ts` - `scoreItem()` and `bestPerSlot()`.
- `packages/data/src/cli/build.ts` - ingestion entry point.
- `apps/ui/src/db.ts` - in-browser SQLite loader; `apps/ui/src/urlState.ts` - URL-as-state.

---

## Stack

- **TypeScript** (strict, ES2022, bundler resolution).
- **Bun** - runtime for the `data` and `core` CLIs (uses `bun:sqlite`).
- **React 18 + Vite 5 + Tailwind 3** for the UI.
- **sql.js** (WASM SQLite) - runs the database in the browser.
- **pnpm 10** workspace; **Node 22** for the UI build in CI.
- Deployed to **GitHub Pages** via GitHub Actions.

---

## Prerequisites

- [pnpm](https://pnpm.io/) 10 (`packageManager` is pinned to `pnpm@10.33.0`; `corepack enable` will provide it).
- Node.js 22 (for the UI dev server and build).
- [Bun](https://bun.sh/) - only needed to rebuild the databases or run the `score` CLI; not required to run the UI against the committed `.sqlite` files.

```bash
pnpm install
```

---

## Running the UI

```bash
pnpm ui:dev      # Vite dev server on http://localhost:5173
pnpm ui:build    # static bundle -> apps/ui/dist
```

The committed `apps/ui/public/{vanilla,tbc,wotlk}.sqlite` files are all the UI needs, so `ui:dev` works on a fresh clone without rebuilding any data.

---

## Rebuilding the databases

> The build scripts read external datasets that are **not committed** to this repo. You only need this if you are refreshing the game data; the committed `.sqlite` files are otherwise sufficient.

```bash
pnpm --filter @wowgear/data build:vanilla
pnpm --filter @wowgear/data build:tbc
pnpm --filter @wowgear/data build:wotlk
pnpm --filter @wowgear/data build:all   # all three
```

Each script invokes `src/cli/build.ts` with hard-coded source paths under `/tmp/agents/`. The generic form is:

```bash
bun run packages/data/src/cli/build.ts \
  --expansion=<vanilla|tbc|wotlk> \
  --world <cmangos-world.sql> \
  [--wago <wago-dbc-csv-dir>] \
  [--dump <items.sql>] \
  [--thatsmybis <dir>] \
  [--out <path>]            # defaults to apps/ui/public/<expansion>.sqlite
```

### Data sources

These are fetched by hand into `/tmp/agents/` (ephemeral; re-fetch as needed). There is currently no committed fetch script - **adding one is the main open task for build reproducibility.**

| Path | Source | How obtained |
| --- | --- | --- |
| `/tmp/agents/{classic,tbc,wotlk}-db/` | cmangos world DBs (`github.com/cmangos/{classic,tbc,wotlk}-db`) | `git clone --depth=1`, then `gunzip Full_DB/*.sql.gz` |
| `/tmp/agents/burning-crusade-item-db/` | `github.com/thatsmybis/burning-crusade-item-db` | `git clone` (TBC raid boss -> item mapping only) |
| `/tmp/agents/wago/<exp>/*.csv` | [wago.tools](https://wago.tools) DBC exports | `curl 'https://wago.tools/db2/<Table>/csv?build=<build>'` |

Pinned wago builds (bump these when a new Classic patch ships): vanilla `1.15.8.67156`, tbc `2.5.4.44833`, wotlk `3.4.5.63697`.

---

## Scoring model

Recommendations are a **weighted sum**, not a simulation.

- `scoreItem(item, weights)` sums each stat times its weight, plus a weapon-DPS term (`(min+max)/2 / speed * weapon_dps`).
- Weights live in `packages/core/src/weights.ts`, indexed by expansion, class, spec, and level bucket (`1-19` ... `70-80`). TBC/WotLK use combat-rating keys; the vanilla set is derived from them into flat-percentage keys (`crit_pct`, `hit_pct`, ...) because vanilla items predate the rating system. Hand-curated and unnormalized - only relative magnitude matters.
- `bestPerSlot()` filters to items that are **equippable** (level, class, race/faction, armor/weapon subclass) and **obtainable** (at least one source reachable at the current level and faction), groups inventory slots into display slots (e.g. main-hand competes with two-handers), dedupes quest-choice alternatives, and returns the top 3 per slot.

"Best at level X" means equippable now **and** obtainable now - no level-46 dungeon drops in a level-22 list.

### `score` CLI

Prints rankings to the terminal (uses `bun:sqlite` directly against a built `.sqlite`):

```bash
pnpm score -- --class=rogue --spec=combat --level=40 [--raid] [--pvp] [--holiday]
```

---

## State and links

All character state is encoded in the URL query string, so any configuration is a shareable, bookmarkable link. There is no router and no stored state. Invalid combinations are clamped on parse (level caps per expansion, spec validity per class, class availability per expansion - e.g. Death Knight is WotLK-only).

---

## Deployment

`.github/workflows/pages.yml` builds `@wowgear/ui` on Node 22 with pnpm and publishes `apps/ui/dist` to GitHub Pages on every push to `master`. All third-party actions are pinned to commit SHAs.

---

## Notes for contributors

- **No tests or lint yet.** The `test` scripts (`bun test`) and the root `lint` script are placeholders; there are currently no test files and sub-packages define no `lint` script.
- **`Item.expansion` (`1 | 2`) is vestigial.** It is parsed and stored but never read - all real expansion logic keys off the active DB file / the `expansion` URL param. Do not rely on it.
- **The `source_type` union has a dead member, `'craft'`.** The real ingestion pipeline never emits it - crafted items are tagged `'profession'`. Only `packages/data/src/cli/fixture.ts` produces `'craft'`, and the UI has no filter for it (just a leftover sort-order entry). The eight types listed above are the ones that actually appear in the shipped databases.
- The data pipeline's SQL/CSV parsers in `packages/data/src` are hand-written (no external parser dependency); they target the specific shapes of the cmangos and wago dumps.

---

## Non-goals

No DPS simulation (weighted-sum only), no endgame raid BiS lists, no talent calculator, and no accounts or saved profiles - URL params are the only persistence.
