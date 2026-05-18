# TBC Classic Leveling BiS — Implementation Plan

## Goal

SPA. User picks class, spec, level. App returns best-in-slot gear per equipment slot with source info. Scope: TBC Classic, levels 1–70.

## Stack

- Bun + TypeScript strict
- SQLite shipped as static asset, queried in-browser via sql.js
- React + Vite SPA, static build, no backend in production
- Raw SQL, no ORM (schema is 2 tables)
- Tailwind + shadcn/ui

## Data Pipeline (build-time)

Source: `github.com/thatsmybis/burning-crusade-item-db` (MySQL dump, includes Classic data).

Steps:
1. Convert MySQL dump to ephemeral SQLite.
2. Project into the normalized schema below. Drop unused columns.
3. Compute denormalized `item_sources` rows from loot/vendor/quest tables.
4. Prune: drop poor/common quality items unless they have stats or are quest rewards.
5. Emit `tbc.sqlite` to `ui/public/`. Target <10MB.

## Schema

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  quality INTEGER NOT NULL,        -- 0..5
  item_level INTEGER NOT NULL,
  required_level INTEGER NOT NULL,
  slot INTEGER NOT NULL,           -- inventory_type
  subclass INTEGER NOT NULL,       -- weapon/armor subtype
  class_mask INTEGER NOT NULL,     -- bitmask of allowed classes
  stats_json TEXT NOT NULL,        -- {stam:8, str:6, crit_rating:14, ...}
  weapon_min_dmg REAL,
  weapon_max_dmg REAL,
  weapon_speed REAL,
  expansion INTEGER NOT NULL       -- 1=vanilla, 2=tbc
);

CREATE TABLE item_sources (
  item_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,       -- 'drop'|'quest'|'vendor'|'craft'|'pvp'
  source_name TEXT NOT NULL,       -- "Hellfire Ramparts: Watchkeeper Gargolmar"
  source_zone TEXT,
  source_min_level INTEGER,        -- min level to reasonably acquire
  drop_chance REAL,
  vendor_cost_copper INTEGER,
  quest_choice_group INTEGER,      -- same value = mutually exclusive
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX idx_items_slot_req ON items(slot, required_level);
CREATE INDEX idx_sources_item ON item_sources(item_id);
CREATE INDEX idx_sources_min ON item_sources(source_min_level);
```

## Stat Weights

`core/weights.ts` — single source of truth, hand-curated, named exports.

```ts
type LevelBucket = '1-19' | '20-39' | '40-59' | '60-70';

export const weights: Record<ClassName, Record<Spec, Record<LevelBucket, StatWeights>>>;
```

Specs to cover:
- warrior: arms, fury, prot
- rogue: combat
- mage: frost, fire
- warlock: affliction, destro
- priest: shadow, disc
- hunter: bm
- shaman: enh, ele, resto
- druid: feral, balance, resto
- paladin: ret, prot, holy

AP = 1.0 baseline for physical DPS. Other stats relative. Spellpower = 1.0 baseline for casters. Values are unnormalized; only relative magnitude matters.

## Scoring Engine

```ts
// core/score.ts
export function scoreItem(item: Item, weights: StatWeights): number;
export function scoreWeaponPair(mh: Item, oh: Item, weights: StatWeights): number;

// core/select.ts
export function bestPerSlot(args: {
  items: Item[];
  weights: StatWeights;
  charLevel: number;
  charClass: ClassName;
}): Record<Slot, RankedItem[]>;
```

Filters applied inside `bestPerSlot`:
- `required_level <= charLevel`
- `class_mask` matches `charClass`
- at least one source with `source_min_level <= charLevel`

Rules:
- Two-handed weapons compete with MH+OH pairs in the same weapon bucket.
- Quest choice groups: surface as alternatives in one slot, not duplicates.
- Return top 3 per slot.

## Selection Semantics (decided, not a question)

"Best at level X" = item is equippable now AND obtainable now from at least one source. No level-46 dungeon drops in a level-22 list.

## API (in-browser)

```ts
// ui/src/db.ts
export async function loadDb(): Promise<Database>;
export function queryItemsForSlot(db: Database, slot: Slot, charLevel: number, charClass: ClassName): Item[];
```

Read-only. No mutations.

## UI

Single page. Three regions:
1. Header: class picker (icons), spec picker, level slider 1–70.
2. Body: paper-doll, 16 slots. Each slot shows top recommendation; click expands top-3.
3. Drawer: selected item details — stats, all sources with zone/boss/chance/cost.

State: URL params (`?class=rogue&spec=combat&level=22`). Shareable. No router needed.

Tooltips: Wowhead-style, quality-colored names, stat lines.

## Phases

**P0 — Data spike**
- Clone thatsmybis TBC repo.
- Write ingestion script. Output `tbc.sqlite`.
- Smoke test: query head slot, req_level ≤ 22, class_mask includes rogue → sane results.

**P1 — Scoring**
- Define `Stats` type covering every stat present in items.
- Write rogue/combat weights, all four buckets.
- Implement `scoreItem` + `bestPerSlot`.
- CLI test: `bun run score --class=rogue --spec=combat --level=22` prints top 3 per slot.

**P2 — UI scaffold**
- Vite + React + Tailwind.
- Pickers wired to URL params.
- Paper-doll renders top per slot.

**P3 — Sources + tooltips**
- Slot click → top-3 expand.
- Item click → details drawer.
- Wowhead-style tooltips.

**P4 — Coverage**
- Fill remaining spec weights.
- Weapon pair scoring for dual-wield.
- Quest choice grouping in UI.

## Non-Goals

- No DPS simulation. Weighted-sum only.
- No L70 raid BiS. Phase BiS lists exist elsewhere.
- No PvP gear weights.
- No talent picker.
- No accounts, saves, comments. URL params are persistence.

## Build & Run

```bash
bun install
bun run data:build      # produces ui/public/tbc.sqlite
bun run ui:dev          # vite dev server
bun run ui:build        # static bundle to ui/dist
```
