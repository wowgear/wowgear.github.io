import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { loadDumpDir, parseDumpSql, rowToObject } from '../dump.js';
import { projectItems, shouldKeepItem, type ProjectedSource } from '../project.js';
import { createSchema } from '../schema.js';
import { readWorldSources } from '../worldsource.js';

function parseArgs(argv: string[]): { dump: string; thatsmybis: string | null; world: string | null; out: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) args.set(a.slice(2, eq), a.slice(eq + 1));
      else { args.set(a.slice(2), argv[i + 1] ?? ''); i++; }
    }
  }
  const dump = args.get('dump');
  const defOut = resolve(import.meta.dir, '../../../../apps/ui/public/tbc.sqlite');
  const out = args.get('out') ? resolve(args.get('out')!) : defOut;
  const thatsmybis = args.get('thatsmybis') ?? null;
  const world = args.get('world') ?? null;
  if (!dump) {
    console.error('Usage: bun run build.ts --dump <unmodified.sql|dir> [--world <cmangos-world.sql>] [--thatsmybis <dir>] [--out apps/ui/public/tbc.sqlite]');
    process.exit(1);
  }
  return { dump, thatsmybis, world, out };
}

interface ItemMeta {
  name: string;
  required_level: number;
  item_level: number;
  quality: number;
}

function isVanillaRaidLoot(id: number, itemLevel: number, quality: number): boolean {
  if (id >= 24000) return false;
  if (quality >= 4 && itemLevel >= 64) return true;
  if (quality === 3 && itemLevel >= 80) return true;
  return false;
}

function isTbcRaidLoot(id: number, itemLevel: number, quality: number): boolean {
  return id >= 24000 && quality >= 4 && itemLevel >= 115;
}

const PVP_NAME_PATTERNS: RegExp[] = [
  /^(Hateful|Merciless|Vengeful|Brutal|Gladiator's|Veteran's|Champion's) /,
  /^(High Warlord's|Warlord's|General's|Lieutenant General's|Centurion's|Legionnaire's|Stone Guard's|Blood Guard's|Senior Sergeant's|First Sergeant's|Sergeant's|Sergeant Major's|Sergeant) /,
  /^(Grand Marshal's|Field Marshal's|Marshal's|Knight-Captain's|Lieutenant Commander's|Knight-Lieutenant's|Knight's|Knight Champion's|Knight-Captain) /,
];

function isPvpLoot(name: string): boolean {
  return PVP_NAME_PATTERNS.some((re) => re.test(name));
}

const SYNTHETIC_HOLIDAY_PATTERNS: RegExp[] = [
  /\bBrewfest\b/i,
  /\bWinter Veil\b/i,
  /\bHallow's End\b/i,
  /\bMidsummer\b/i,
  /\bNoblegarden\b/i,
  /\bLunar Festival\b/i,
  /\bChildren's Week\b/i,
  /\bLove is in the Air\b/i,
];


function syntheticSources(items: Map<number, ItemMeta>): ProjectedSource[] {
  const out: ProjectedSource[] = [];
  for (const [id, meta] of items) {
    const isTbc = id >= 24000;
    const fromIlvl = isTbc
      ? meta.item_level - 25
      : meta.item_level <= 92 ? meta.item_level - 8 : meta.item_level - 22;
    const base = meta.required_level > 0 ? meta.required_level : fromIlvl;
    const min = Math.min(70, Math.max(1, base));

    const pvp = isPvpLoot(meta.name);
    const raid = !pvp && (isVanillaRaidLoot(id, meta.item_level, meta.quality) || isTbcRaidLoot(id, meta.item_level, meta.quality));

    const sourceType: ProjectedSource['source_type'] = pvp ? 'pvp' : raid ? 'raid' : 'drop';
    const sourceName = pvp
      ? 'PvP reward'
      : raid
        ? (id >= 24000 ? 'TBC raid' : 'Vanilla 40-man raid')
        : 'World / dungeon / quest';

    out.push({
      item_id: id,
      source_type: sourceType,
      source_name: sourceName,
      source_zone: null,
      source_min_level: min,
      drop_chance: null,
      vendor_cost_copper: null,
      quest_choice_group: null,
    });
  }
  return out;
}

interface RaidSourceRow {
  id: number;
  name: string;
  instance_id: number;
}
interface InstanceRow {
  id: number;
  name: string;
}

function readThatsmybisSources(dir: string, knownItems: Set<number>): ProjectedSource[] {
  const instancesSql = readFileSync(join(dir, 'insert_instances.sql'), 'utf8');
  const sourcesSql = readFileSync(join(dir, 'insert_item_sources.sql'), 'utf8');
  const mappingSql = readFileSync(join(dir, 'insert_item_item_sources.sql'), 'utf8');

  const instTables = parseDumpSql(instancesSql);
  const srcTables = parseDumpSql(sourcesSql);
  const mapTables = parseDumpSql(mappingSql);

  const instTable = instTables.get('instances');
  const srcTable = srcTables.get('item_sources');
  const mapTable = mapTables.get('item_item_sources');
  if (!instTable || !srcTable || !mapTable) return [];

  if (!instTable.columns.length) instTable.columns = ['name','short_name','slug','order','created_at'];
  if (!srcTable.columns.length)  srcTable.columns  = ['name','slug','instance_id','npc_id','object_id','order','created_at'];
  if (!mapTable.columns.length)  mapTable.columns  = ['item_source_id','item_id','created_at'];

  const instances = new Map<number, InstanceRow>();
  instTable.rows.forEach((r, i) => {
    const o = rowToObject(instTable, r);
    instances.set(i + 9, { id: i + 9, name: String(o.name ?? '') });
  });

  const SOURCE_ID_OFFSET = 84;
  const sources = new Map<number, RaidSourceRow>();
  srcTable.rows.forEach((r, i) => {
    const o = rowToObject(srcTable, r);
    const id = i + SOURCE_ID_OFFSET;
    sources.set(id, { id, name: String(o.name ?? ''), instance_id: Number(o.instance_id ?? 0) });
  });

  const out: ProjectedSource[] = [];
  for (const row of mapTable.rows) {
    const o = rowToObject(mapTable, row);
    const srcId = Number(o.item_source_id);
    const itemId = Number(o.item_id);
    if (!knownItems.has(itemId)) continue;
    const src = sources.get(srcId);
    if (!src) continue;
    const inst = instances.get(src.instance_id);
    out.push({
      item_id: itemId,
      source_type: 'raid',
      source_name: inst ? `${inst.name}: ${src.name}` : src.name,
      source_zone: inst?.name ?? null,
      source_min_level: 70,
      drop_chance: null,
      vendor_cost_copper: null,
      quest_choice_group: null,
    });
  }
  return out;
}

function main(): void {
  const { dump, thatsmybis, world, out } = parseArgs(process.argv.slice(2));

  console.log(`[ingest] loading dump from ${dump}`);
  const tables = loadDumpDir(dump);
  const itemTable = tables.get('items') ?? tables.get('item_template');
  if (!itemTable) {
    console.error(`[ingest] no 'items' or 'item_template' table found. Found: ${[...tables.keys()].join(', ')}`);
    process.exit(2);
  }

  console.log(`[ingest] parsed ${itemTable.rows.length} item rows`);
  const items = projectItems(itemTable).filter(shouldKeepItem);
  console.log(`[ingest] keeping ${items.length} items after prune`);

  const itemMeta = new Map<number, ItemMeta>();
  for (const it of items) itemMeta.set(it.id, { name: it.name, required_level: it.required_level, item_level: it.item_level, quality: it.quality });

  const knownItems = new Set(itemMeta.keys());
  const sources: ProjectedSource[] = [];
  let realSourceItems = new Set<number>();

  if (world) {
    const path = resolve(world);
    if (!existsSync(path)) {
      console.warn(`[ingest] world DB not found: ${path}`);
    } else {
      const ws = readWorldSources(path, knownItems);
      sources.push(...ws.sources);
      realSourceItems = ws.itemsCovered;
    }
  }

  let synthetic = 0;
  for (const [id, meta] of itemMeta) {
    if (realSourceItems.has(id)) continue;
    sources.push(...syntheticSources(new Map([[id, meta]])));
    synthetic++;
  }
  console.log(`[ingest] ${synthetic} items received synthetic sources (no world data)`);

  if (thatsmybis) {
    const dir = resolve(thatsmybis);
    if (!existsSync(dir)) {
      console.warn(`[ingest] thatsmybis dir not found: ${dir}`);
    } else {
      const raidSources = readThatsmybisSources(dir, knownItems);
      sources.push(...raidSources);
      console.log(`[ingest] added ${raidSources.length} raid sources from thatsmybis`);
    }
  }

  let reclassifiedRaid = 0;
  let reclassifiedPvp = 0;
  let reclassifiedHoliday = 0;
  const itemHasRealSource = new Set(realSourceItems);
  for (const s of sources) {
    if (s.source_type === 'raid' || s.source_type === 'pvp' || s.source_type === 'holiday') continue;
    const meta = itemMeta.get(s.item_id);
    if (!meta) continue;
    if (isPvpLoot(meta.name)) {
      s.source_type = 'pvp';
      reclassifiedPvp++;
      continue;
    }
    if (isVanillaRaidLoot(s.item_id, meta.item_level, meta.quality) || isTbcRaidLoot(s.item_id, meta.item_level, meta.quality)) {
      s.source_type = 'raid';
      reclassifiedRaid++;
      continue;
    }
    if (!itemHasRealSource.has(s.item_id) && SYNTHETIC_HOLIDAY_PATTERNS.some((re) => re.test(meta.name))) {
      s.source_type = 'holiday';
      reclassifiedHoliday++;
    }
  }
  console.log(`[ingest] reclassified ${reclassifiedRaid} sources as raid, ${reclassifiedPvp} as pvp, ${reclassifiedHoliday} as holiday (synthetic fallback)`);

  mkdirSync(dirname(out), { recursive: true });
  const db = new Database(out, { create: true });
  db.exec('DROP TABLE IF EXISTS items; DROP TABLE IF EXISTS item_sources;');
  createSchema(db);

  const insItem = db.prepare(`
    INSERT INTO items (id, name, quality, item_level, required_level, slot, subclass, class_mask, stats_json, weapon_min_dmg, weapon_max_dmg, weapon_speed, expansion)
    VALUES ($id, $name, $quality, $item_level, $required_level, $slot, $subclass, $class_mask, $stats_json, $weapon_min_dmg, $weapon_max_dmg, $weapon_speed, $expansion)
  `);
  const insertItems = db.transaction((rows: typeof items) => {
    for (const r of rows) insItem.run({
      $id: r.id, $name: r.name, $quality: r.quality, $item_level: r.item_level,
      $required_level: r.required_level, $slot: r.slot, $subclass: r.subclass,
      $class_mask: r.class_mask, $stats_json: r.stats_json,
      $weapon_min_dmg: r.weapon_min_dmg, $weapon_max_dmg: r.weapon_max_dmg,
      $weapon_speed: r.weapon_speed, $expansion: r.expansion,
    });
  });
  insertItems(items);

  const insSrc = db.prepare(`
    INSERT INTO item_sources (item_id, source_type, source_name, source_zone, source_min_level, drop_chance, vendor_cost_copper, quest_choice_group)
    VALUES ($item_id, $source_type, $source_name, $source_zone, $source_min_level, $drop_chance, $vendor_cost_copper, $quest_choice_group)
  `);
  const insertSrc = db.transaction((rows: ProjectedSource[]) => {
    for (const r of rows) insSrc.run({
      $item_id: r.item_id, $source_type: r.source_type, $source_name: r.source_name,
      $source_zone: r.source_zone, $source_min_level: r.source_min_level,
      $drop_chance: r.drop_chance, $vendor_cost_copper: r.vendor_cost_copper,
      $quest_choice_group: r.quest_choice_group,
    });
  });
  insertSrc(sources);

  db.exec('VACUUM;');
  db.close();
  console.log(`[ingest] wrote ${items.length} items + ${sources.length} sources to ${out}`);
}

main();
