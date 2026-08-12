import { resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import {
  bestPerSlot,
  bucketForLevel,
  DISPLAY_SLOTS,
  SLOT,
  weightsFor,
  type ClassName,
  type Expansion,
  type Item,
  type ItemSource,
  type Spec,
} from '../index.js';

interface Args {
  expansion: Expansion;
  cls: ClassName;
  spec: Spec;
  level: number;
  db: string;
  raid: boolean;
  pvp: boolean;
  holiday: boolean;
}

interface GearRow {
  item_id: number;
  name: string;
  quality: number;
  item_level: number;
  required_level: number;
  required_skill: number;
  required_skill_rank: number;
  slot: number;
  subclass: number;
  class_mask: number;
  race_mask: number;
  stats_json: string;
  weapon_min_dmg: number | null;
  weapon_max_dmg: number | null;
  weapon_speed: number | null;
  source_type: ItemSource['source_type'];
  source_name: string;
  source_zone: string | null;
  min_player_level_alliance: number | null;
  min_player_level_horde: number | null;
  drop_chance: number | null;
  vendor_cost_copper: number | null;
  quest_choice_group: number | null;
  source_entity_kind: ItemSource['source_entity_kind'];
  source_entity_id: number | null;
}

const SLOT_NAMES: Record<number, string> = {
  [SLOT.Head]: 'Head',
  [SLOT.Neck]: 'Neck',
  [SLOT.Shoulder]: 'Shoulder',
  [SLOT.Back]: 'Back',
  [SLOT.Chest]: 'Chest',
  [SLOT.Wrist]: 'Wrist',
  [SLOT.Hands]: 'Hands',
  [SLOT.Waist]: 'Waist',
  [SLOT.Legs]: 'Legs',
  [SLOT.Feet]: 'Feet',
  [SLOT.Finger]: 'Finger',
  [SLOT.Trinket]: 'Trinket',
  [SLOT.MainHand]: 'Main Hand',
  [SLOT.OffHand]: 'Off Hand',
  [SLOT.Ranged]: 'Ranged',
};

const BOOLEAN_FLAGS = new Set(['raid', 'pvp', 'holiday']);

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) continue;
    const equals = argument.indexOf('=');
    if (equals > 0) {
      values.set(argument.slice(2, equals), argument.slice(equals + 1));
      continue;
    }
    const name = argument.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags.add(name);
      continue;
    }
    values.set(name, argv[index + 1] ?? '');
    index++;
  }
  const expansion = (values.get('expansion') ?? 'tbc') as Expansion;
  const database = values.get('db')
    ? resolve(values.get('db')!)
    : resolve(import.meta.dir, `../../../../apps/ui/public/${expansion}.sqlite`);
  return {
    expansion,
    cls: (values.get('class') ?? 'rogue') as ClassName,
    spec: (values.get('spec') ?? 'combat') as Spec,
    level: Number(values.get('level') ?? '22'),
    db: database,
    raid: flags.has('raid'),
    pvp: flags.has('pvp'),
    holiday: flags.has('holiday'),
  };
}

function enabledSource(row: GearRow, args: Args): boolean {
  if (row.source_type === 'raid' && !args.raid) return false;
  if (row.source_type === 'pvp' && !args.pvp) return false;
  if (row.source_type === 'holiday' && !args.holiday) return false;
  return true;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const database = new Database(args.db, { readonly: true });
  const rows = database.prepare('SELECT * FROM gear').all() as GearRow[];
  const items = new Map<number, Item>();
  const sources = new Map<number, ItemSource[]>();
  for (const row of rows) {
    if (!enabledSource(row, args)) continue;
    if (!items.has(row.item_id)) {
      items.set(row.item_id, {
        id: row.item_id,
        name: row.name,
        quality: row.quality,
        item_level: row.item_level,
        required_level: row.required_level,
        required_skill: row.required_skill,
        required_skill_rank: row.required_skill_rank,
        slot: row.slot as Item['slot'],
        subclass: row.subclass,
        class_mask: row.class_mask,
        stats: JSON.parse(row.stats_json),
        weapon_min_dmg: row.weapon_min_dmg,
        weapon_max_dmg: row.weapon_max_dmg,
        weapon_speed: row.weapon_speed,
      });
    }
    const source: ItemSource = {
      item_id: row.item_id,
      source_type: row.source_type,
      source_name: row.source_name,
      source_zone: row.source_zone,
      min_player_level_alliance: row.min_player_level_alliance,
      min_player_level_horde: row.min_player_level_horde,
      drop_chance: row.drop_chance,
      vendor_cost_copper: row.vendor_cost_copper,
      quest_choice_group: row.quest_choice_group,
      source_entity_kind: row.source_entity_kind,
      source_entity_id: row.source_entity_id,
      race_mask: row.race_mask,
    };
    const itemSources = sources.get(row.item_id);
    if (itemSources) itemSources.push(source);
    else sources.set(row.item_id, [source]);
  }

  const weights = weightsFor(args.expansion, args.cls, args.spec, bucketForLevel(args.level));
  const result = bestPerSlot({
    items: [...items.values()],
    sources,
    weights,
    charLevel: args.level,
    charClass: args.cls,
    faction: 'any',
  });
  const filters = [args.raid && 'raid', args.pvp && 'pvp', args.holiday && 'holiday'].filter(Boolean).join('+') || 'no raid/pvp/holiday';
  console.log(`\n${args.cls}/${args.spec} level ${args.level} - bucket ${bucketForLevel(args.level)} (${filters})\n`);
  for (const slot of DISPLAY_SLOTS) {
    const ranked = result[slot] ?? [];
    console.log(`[${SLOT_NAMES[slot] ?? slot}]`);
    if (ranked.length === 0) {
      console.log('  (none)');
      continue;
    }
    for (const entry of ranked) {
      const stats = Object.entries(entry.item.stats).map(([key, value]) => `${key}+${value}`).join(' ');
      console.log(`  ${entry.score.toFixed(1).padStart(6)}  ${entry.item.name}  [${stats}]`);
    }
  }
  database.close();
}

main();
