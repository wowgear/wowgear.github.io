import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { ALLIANCE_RACE_MASK, HORDE_RACE_MASK } from '@wowgear/core/types';
import { readAttSources } from '../attsource.js';
import { shouldKeepItem, type ProjectedItem, type ProjectedSource } from '../project.js';
import { createSchema } from '../schema.js';
import { readWagoItems } from '../wagoitems.js';

export type Expansion = 'vanilla' | 'tbc' | 'wotlk';

const LEVEL_CAP: Readonly<Record<Expansion, number>> = { vanilla: 60, tbc: 70, wotlk: 80 };
const ITEM_ID_CUTOFF: Readonly<Record<Expansion, number>> = { vanilla: 24000, tbc: 36000, wotlk: Infinity };

interface Args {
  expansion: Expansion;
  wago: string;
  att: string;
  out: string;
}

interface FlatGearRecord {
  item: ProjectedItem;
  source: ProjectedSource;
  raceMask: number;
  allianceLevel: number | null;
  hordeLevel: number | null;
}

function requiredArgument(args: Map<string, string>, name: string): string {
  const value = args.get(name);
  if (!value) throw new Error(`missing required --${name}`);
  return resolve(value);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) continue;
    const equals = argument.indexOf('=');
    if (equals > 0) {
      values.set(argument.slice(2, equals), argument.slice(equals + 1));
      continue;
    }
    values.set(argument.slice(2), argv[index + 1] ?? '');
    index++;
  }

  const expansion = (values.get('expansion') ?? 'tbc') as Expansion;
  if (expansion !== 'vanilla' && expansion !== 'tbc' && expansion !== 'wotlk') {
    throw new Error(`invalid --expansion: ${expansion}`);
  }
  const out = values.get('out')
    ? resolve(values.get('out')!)
    : resolve(import.meta.dir, `../../../../apps/ui/public/${expansion}.sqlite`);
  return {
    expansion,
    wago: requiredArgument(values, 'wago'),
    att: requiredArgument(values, 'att'),
    out,
  };
}

function intersectRaceMasks(itemMask: number, sourceMask: number): number | null {
  if (itemMask === 0) return sourceMask;
  if (sourceMask === 0) return itemMask;
  const intersection = itemMask & sourceMask;
  return intersection === 0 ? null : intersection;
}

function maximumLevel(...levels: Array<number | null>): number | null {
  let maximum: number | null = null;
  for (const level of levels) {
    if (level == null) continue;
    maximum = maximum == null ? level : Math.max(maximum, level);
  }
  return maximum;
}

function factionLevel(
  item: ProjectedItem,
  sourceLevel: number | null,
  raceMask: number,
  factionMask: number,
  professionLevel: number | null,
): number | null {
  if (raceMask !== 0 && (raceMask & factionMask) === 0) return null;
  if (item.required_skill > 0 && item.required_skill_rank > 0 && professionLevel == null) return null;
  if (sourceLevel == null) return null;
  return maximumLevel(1, item.required_level, professionLevel, sourceLevel);
}

export function flattenGearRecords(items: ProjectedItem[], sources: ProjectedSource[]): FlatGearRecord[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const records: FlatGearRecord[] = [];
  for (const source of sources) {
    const item = itemsById.get(source.item_id);
    if (!item) continue;
    const raceMask = intersectRaceMasks(item.race_mask, source.race_mask);
    if (raceMask == null) continue;
    const allianceLevel = factionLevel(
      item,
      source.min_player_level_alliance,
      raceMask,
      ALLIANCE_RACE_MASK,
      item.profession_min_level_alliance,
    );
    const hordeLevel = factionLevel(
      item,
      source.min_player_level_horde,
      raceMask,
      HORDE_RACE_MASK,
      item.profession_min_level_horde,
    );
    if (allianceLevel == null && hordeLevel == null) continue;
    records.push({ item, source, raceMask, allianceLevel, hordeLevel });
  }
  return records;
}

function writeDatabase(path: string, records: FlatGearRecord[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path, { create: true });
  database.exec('DROP TABLE IF EXISTS gear; DROP TABLE IF EXISTS item_sources; DROP TABLE IF EXISTS items;');
  createSchema(database);
  const insert = database.prepare(`
    INSERT INTO gear (
      item_id, name, quality, item_level, required_level, required_skill, required_skill_rank,
      slot, subclass, class_mask, race_mask, stats_json,
      weapon_min_dmg, weapon_max_dmg, weapon_speed,
      source_type, source_name, source_zone,
      min_player_level_alliance, min_player_level_horde,
      drop_chance, vendor_cost_copper, quest_choice_group,
      source_entity_kind, source_entity_id
    ) VALUES (
      $item_id, $name, $quality, $item_level, $required_level, $required_skill, $required_skill_rank,
      $slot, $subclass, $class_mask, $race_mask, $stats_json,
      $weapon_min_dmg, $weapon_max_dmg, $weapon_speed,
      $source_type, $source_name, $source_zone,
      $min_player_level_alliance, $min_player_level_horde,
      $drop_chance, $vendor_cost_copper, $quest_choice_group,
      $source_entity_kind, $source_entity_id
    )
  `);
  const insertAll = database.transaction((rows: FlatGearRecord[]) => {
    for (const record of rows) {
      const { item, source } = record;
      insert.run({
        $item_id: item.id,
        $name: item.name,
        $quality: item.quality,
        $item_level: item.item_level,
        $required_level: item.required_level,
        $required_skill: item.required_skill,
        $required_skill_rank: item.required_skill_rank,
        $slot: item.slot,
        $subclass: item.subclass,
        $class_mask: item.class_mask,
        $race_mask: record.raceMask,
        $stats_json: item.stats_json,
        $weapon_min_dmg: item.weapon_min_dmg,
        $weapon_max_dmg: item.weapon_max_dmg,
        $weapon_speed: item.weapon_speed,
        $source_type: source.source_type,
        $source_name: source.source_name,
        $source_zone: source.source_zone,
        $min_player_level_alliance: record.allianceLevel,
        $min_player_level_horde: record.hordeLevel,
        $drop_chance: source.drop_chance,
        $vendor_cost_copper: source.vendor_cost_copper,
        $quest_choice_group: source.quest_choice_group,
        $source_entity_kind: source.source_entity_kind ?? null,
        $source_entity_id: source.source_entity_id ?? null,
      });
    }
  });
  insertAll(records);
  database.exec('VACUUM;');
  database.close();
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.wago)) throw new Error(`Wago directory not found: ${args.wago}`);
  if (!existsSync(args.att)) throw new Error(`ATT directory not found: ${args.att}`);

  const items = readWagoItems(args.wago, args.expansion)
    .filter(shouldKeepItem)
    .filter((item) => item.id < ITEM_ID_CUTOFF[args.expansion] && item.required_level <= LEVEL_CAP[args.expansion]);
  const knownItems = new Set(items.map((item) => item.id));
  const projected = readAttSources(args.att, args.expansion, knownItems);
  const records = flattenGearRecords(items, projected.sources);
  writeDatabase(args.out, records);

  const coveredItems = new Set(records.map((record) => record.item.id));
  console.log(`[ingest] ${args.expansion}: ${coveredItems.size} items, ${records.length} acquisition paths -> ${args.out}`);
}

if (import.meta.main) main();
