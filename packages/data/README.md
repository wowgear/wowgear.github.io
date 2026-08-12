# @wowgear/data

Builds the per-expansion SQLite databases queried by the browser application:
`apps/ui/public/vanilla.sqlite`, `tbc.sqlite`, and `wotlk.sqlite`.

The build reads Wago client tables and All The Things acquisition data, resolves
every supported item-source path, and writes one denormalized `gear` row per
path. Runtime queries do not join tables or traverse quest/container graphs.

## Data sources

| Source | Pinned version | Used for |
| --- | --- | --- |
| Wago client tables | Vanilla `1.15.8.67156`, TBC `2.5.6.68775`, WotLK `3.4.5.63697` | item identity, requirements, stats, equip effects, and item faction masks |
| All The Things | commit `b90391c0ae7c3f8b730eeb874a0926e168a07d89` | quests, containers, professions, vendors, drops, instances, raids, PvP, holidays, and faction restrictions |

The maintained tables in `professiongates.ts` convert profession skill ranks to
minimum player levels for each expansion. `sourcegates.ts` records verified
level gates that ATT represents through game behavior instead of a numeric
`lvl` field, such as the level-70 Old Man Barlo fishing dailies.

## Fetch

All build inputs live under `/tmp/agents/` and are not committed.

```bash
mkdir -p /tmp/agents/wago/vanilla /tmp/agents/wago/tbc /tmp/agents/wago/wotlk

for table in Item ItemSparse ItemEffect SpellEffect; do
  curl --fail --silent --show-error \
    "https://wago.tools/db2/$table/csv?build=1.15.8.67156" \
    --output "/tmp/agents/wago/vanilla/$table.csv"
  curl --fail --silent --show-error \
    "https://wago.tools/db2/$table/csv?build=2.5.6.68775" \
    --output "/tmp/agents/wago/tbc/$table.csv"
  curl --fail --silent --show-error \
    "https://wago.tools/db2/$table/csv?build=3.4.5.63697" \
    --output "/tmp/agents/wago/wotlk/$table.csv"
done

curl --fail --location --silent --show-error \
  "https://github.com/DFortun81/AllTheThings/archive/b90391c0ae7c3f8b730eeb874a0926e168a07d89.tar.gz" \
  --output /tmp/agents/AllTheThings-b90391c0ae7c3f8b730eeb874a0926e168a07d89.tar.gz
tar -xzf /tmp/agents/AllTheThings-b90391c0ae7c3f8b730eeb874a0926e168a07d89.tar.gz \
  -C /tmp/agents
```

## Build

```bash
pnpm --filter @wowgear/data build:all
pnpm --filter @wowgear/data build:vanilla
pnpm --filter @wowgear/data build:tbc
pnpm --filter @wowgear/data build:wotlk
```

Custom invocation:

```bash
bun run src/cli/build.ts \
  --expansion=<vanilla|tbc|wotlk> \
  --wago=<directory> \
  --att=<AllTheThings-directory> \
  --out=<sqlite-path>
```

The resulting database contains one table:

- `gear` - item fields, source fields, faction mask, and fully resolved
  `min_player_level_alliance` and `min_player_level_horde` for one acquisition
  path.

The resolved minimum is the maximum of the item's equip level, profession rank
gate, and all source-path gates. An unavailable faction is stored as `NULL`.
The UI reads `gear` once, groups rows by `item_id`, applies source filters, and
passes the resulting flat item/source maps to `@wowgear/core`.

A self-contained fixture remains available for UI development:

```bash
pnpm --filter @wowgear/data fixture
```
