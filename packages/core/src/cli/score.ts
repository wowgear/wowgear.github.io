import { resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import {
  bestPerSlot,
  bucketForLevel,
  DISPLAY_SLOTS,
  SLOT,
  weightsFor,
  type ClassName,
  type Item,
  type ItemSource,
  type Spec,
} from '../index.js';

interface Args {
  cls: ClassName;
  spec: Spec;
  level: number;
  db: string;
  raid: boolean;
  pvp: boolean;
  holiday: boolean;
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
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { map.set(a.slice(2, eq), a.slice(eq + 1)); continue; }
    const name = a.slice(2);
    if (BOOLEAN_FLAGS.has(name)) { flags.add(name); continue; }
    map.set(name, argv[i + 1] ?? '');
    i++;
  }
  const cls = (map.get('class') ?? 'rogue') as ClassName;
  const spec = (map.get('spec') ?? 'combat') as Spec;
  const level = Number(map.get('level') ?? '22');
  const defDb = resolve(import.meta.dir, '../../../../apps/ui/public/tbc.sqlite');
  const db = map.get('db') ? resolve(map.get('db')!) : defDb;
  return {
    cls, spec, level, db,
    raid: flags.has('raid'),
    pvp: flags.has('pvp'),
    holiday: flags.has('holiday'),
  };
}

function main(): void {
  const { cls, spec, level, db: dbPath, raid, pvp, holiday } = parseArgs(process.argv.slice(2));
  const db = new Database(dbPath, { readonly: true });

  const rawItems = db.prepare('SELECT * FROM items').all() as Array<{
    id: number; name: string; quality: number; item_level: number; required_level: number;
    slot: number; subclass: number; class_mask: number; stats_json: string;
    weapon_min_dmg: number | null; weapon_max_dmg: number | null; weapon_speed: number | null;
    expansion: number;
  }>;

  const items: Item[] = rawItems.map((r) => ({
    ...r,
    slot: r.slot as Item['slot'],
    stats: JSON.parse(r.stats_json),
    expansion: (r.expansion === 2 ? 2 : 1) as Item['expansion'],
  }));

  const sources = new Map<number, ItemSource[]>();
  const rawSrc = db.prepare('SELECT * FROM item_sources').all() as ItemSource[];
  for (const s of rawSrc) {
    if (s.source_type === 'raid' && !raid) continue;
    if (s.source_type === 'pvp' && !pvp) continue;
    if (s.source_type === 'holiday' && !holiday) continue;
    const list = sources.get(s.item_id);
    if (list) list.push(s);
    else sources.set(s.item_id, [s]);
  }

  const w = weightsFor(cls, spec, bucketForLevel(level));
  const result = bestPerSlot({ items, sources, weights: w, charLevel: level, charClass: cls });

  const filterDesc = [raid && 'raid', pvp && 'pvp', holiday && 'holiday'].filter(Boolean).join('+') || 'no raid/pvp/holiday';
  console.log(`\n${cls}/${spec} level ${level} — bucket ${bucketForLevel(level)} (${filterDesc})\n`);
  for (const slot of DISPLAY_SLOTS) {
    const list = result[slot] ?? [];
    console.log(`[${SLOT_NAMES[slot] ?? slot}]`);
    if (list.length === 0) { console.log('  (none)'); continue; }
    for (const r of list) {
      const stats = Object.entries(r.item.stats).map(([k, v]) => `${k}+${v}`).join(' ');
      console.log(`  ${r.score.toFixed(1).padStart(6)}  ${r.item.name}  [${stats}]`);
    }
  }
  db.close();
}

main();
