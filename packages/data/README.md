# @wowgear/data

Builds the per-expansion SQLite databases the SPA queries in the browser
(`apps/ui/public/vanilla.sqlite`, `tbc.sqlite`, `wotlk.sqlite`).

The pipeline reads three kinds of upstream data, projects them into a small
normalized schema (`items` + `item_sources`), and writes one SQLite file per
expansion. None of the upstream data is committed; you fetch it into a scratch
dir, then run the build.

## 1. Data sources

| Source | Repo / site | Used for |
| --- | --- | --- |
| cmangos world DBs | `github.com/cmangos/{classic,tbc,wotlk}-db` | items (fallback), creature/vendor/quest sources, instance maps, instance encounters, holiday events, gathering-profession loot |
| thatsmybis (TBC only) | `github.com/thatsmybis/burning-crusade-item-db` | TBC raid boss -> item mapping, and the raw mangos `items` table used as the TBC item dump |
| wago.tools DBC exports | `https://wago.tools` | item stats (`ItemSparse` + `Item`), crafting recipes (`Spell` + `SpellEffect` + `SkillLineAbility` + `SkillLine`), faction templates (`FactionTemplate`) |

Item stats come from wago when present (modern Classic-accurate); cmangos is the
fallback if no wago `ItemSparse.csv` is found for that expansion. Server-side
data that does not exist in client DBCs (vendors, quests, world/dungeon drops)
always comes from cmangos.

### Pinned wago builds

The DBC snapshots are version-pinned to the latest build of each Classic
re-release. Bump these when a new patch ships.

| Expansion | Product | Build |
| --- | --- | --- |
| vanilla | Classic Era | `1.15.8.67156` |
| tbc | TBC Classic | `2.5.4.44833` |
| wotlk | WotLK Classic | `3.4.5.63697` |

Latest builds per product: `curl -s https://wago.tools/api/builds | ...`

## 2. Fetch the data

Everything lands under `/tmp/agents/` (what the `build:*` scripts expect).
`/tmp` is ephemeral, so re-run this after a reboot.

```bash
mkdir -p /tmp/agents && cd /tmp/agents

# --- cmangos world DBs (clone + decompress the Full_DB gz) ---
git clone --depth=1 https://github.com/cmangos/classic-db.git
git clone --depth=1 https://github.com/cmangos/tbc-db.git
git clone --depth=1 https://github.com/cmangos/wotlk-db.git
gunzip -k classic-db/Full_DB/ClassicDB_*.sql.gz
gunzip -k tbc-db/Full_DB/TBCDB_*.sql.gz
gunzip -k wotlk-db/Full_DB/WoTLKDB_*.sql.gz

# --- thatsmybis (TBC items + raid sources) ---
git clone --depth=1 https://github.com/thatsmybis/burning-crusade-item-db.git

# --- wago.tools DBC CSVs ---
declare -A BUILDS=( [vanilla]=1.15.8.67156 [tbc]=2.5.4.44833 [wotlk]=3.4.5.63697 )
TABLES=(ItemSparse Item Spell SpellEffect SpellName SkillLineAbility SkillLine FactionTemplate)
for exp in "${!BUILDS[@]}"; do
  mkdir -p "wago/$exp"
  for t in "${TABLES[@]}"; do
    curl -sS -o "wago/$exp/$t.csv" \
      "https://wago.tools/db2/$t/csv?build=${BUILDS[$exp]}"
  done
done
```

The exact cmangos dump filenames are referenced in `package.json`; if a repo
ships a newer dump version, update the `--world` / `--dump` paths there.

## 3. Build the databases

```bash
pnpm --filter @wowgear/data build:all      # all three
pnpm --filter @wowgear/data build:vanilla  # one at a time
pnpm --filter @wowgear/data build:tbc
pnpm --filter @wowgear/data build:wotlk
```

Each writes `apps/ui/public/<expansion>.sqlite`. The build logs how many items
and sources it produced and how each source type was classified.

Custom invocation:

```bash
bun run src/cli/build.ts \
  --expansion=<vanilla|tbc|wotlk> \
  [--wago   <dir with ItemSparse.csv, Item.csv, Spell*.csv, SkillLine*.csv, FactionTemplate.csv>] \
  [--world  <cmangos Full_DB .sql>] \
  [--dump   <items-only .sql, e.g. thatsmybis unmodified.sql>] \
  [--thatsmybis <dir with insert_*.sql>] \
  [--out    apps/ui/public/<expansion>.sqlite]
```

A self-contained dev fixture (16 hand-written items, no downloads) is available
for UI work without the full pipeline:

```bash
pnpm --filter @wowgear/data fixture   # writes apps/ui/public/tbc.sqlite
```

## 4. How the data is used

The build produces two tables per DB:

- `items` - id, name, quality, item_level, required_level, slot, subclass,
  `class_mask`, `race_mask`, `stats_json`, weapon damage/speed, flags.
- `item_sources` - one row per way to obtain an item: `source_type`
  (`drop` / `dungeon` / `quest` / `vendor` / `profession` / `raid` / `pvp` /
  `holiday`), `source_name`, `source_min_level`, `drop_chance`,
  `vendor_cost_copper`, `quest_choice_group`, `race_mask`.

The SPA (`apps/ui`) fetches `/<expansion>.sqlite`, loads it with sql.js in the
browser, and `@wowgear/core` ranks items per slot:

- `weights.ts` - hand-curated stat weights per class/spec/level bucket.
- `score.ts` - weighted-sum item score (+ weapon DPS term).
- `select.ts` - `bestPerSlot` filters by equippability (level, class mask,
  race mask vs faction, weapon/armor proficiency) and obtainability (a source
  whose `source_min_level <= level` and whose `race_mask` allows the faction),
  then returns the top items per slot.

Source filters (drop/dungeon/quest/vendor/profession/raid/pvp/holiday) and the
faction toggle in the UI map directly onto `source_type` and `race_mask`.

## 5. Refreshing

1. Check for newer Classic builds (`https://wago.tools/api/builds`).
2. Update the build numbers in section 1, the `BUILDS` map in section 2, and
   re-run the fetch.
3. If a cmangos repo ships a renamed Full_DB dump, update the `--world`/`--dump`
   paths in `package.json`.
4. `pnpm --filter @wowgear/data build:all`, then commit the regenerated
   `apps/ui/public/*.sqlite`.
