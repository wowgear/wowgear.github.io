import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { CLASS_MASK, SLOT } from '@wowgear/core/types';
import { createSchema } from '../schema.js';
import type { ProjectedItem, ProjectedSource } from '../project.js';

const ALL_CLASSES = Object.values(CLASS_MASK).reduce((a, b) => a | b, 0);
const PHYS_DPS = CLASS_MASK.warrior | CLASS_MASK.paladin | CLASS_MASK.hunter | CLASS_MASK.rogue | CLASS_MASK.shaman | CLASS_MASK.druid;
const LEATHER = CLASS_MASK.rogue | CLASS_MASK.druid;

interface FixtureItem extends Omit<ProjectedItem, 'stats_json' | 'flags' | 'duration'> {
  stats: Record<string, number>;
  sources: Omit<ProjectedSource, 'item_id'>[];
}

const items: FixtureItem[] = [
  {
    id: 10000, name: 'Cured Leather Helm', quality: 2, item_level: 22, required_level: 17,
    slot: SLOT.Head, subclass: 2, class_mask: LEATHER,
    stats: { agi: 7, sta: 6 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'The Stockade: Bazil Thredd', source_zone: 'Stormwind Stockade', source_min_level: 22, drop_chance: 0.18, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10001, name: 'Wolf Bite Necklace', quality: 2, item_level: 20, required_level: 15,
    slot: SLOT.Neck, subclass: 0, class_mask: 0,
    stats: { agi: 4, sta: 3, crit_rating: 2 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'quest', source_name: 'Bounty on Murlocs', source_zone: 'Westfall', source_min_level: 15, drop_chance: null, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10002, name: 'Shadowfang', quality: 3, item_level: 25, required_level: 18,
    slot: SLOT.MainHand, subclass: 7, class_mask: PHYS_DPS,
    stats: { agi: 4, crit_rating: 4 }, weapon_min_dmg: 26, weapon_max_dmg: 49, weapon_speed: 1.8, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Shadowfang Keep: Wolf Master Nandos', source_zone: 'Shadowfang Keep', source_min_level: 20, drop_chance: 0.22, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10003, name: 'Assassin\'s Blade', quality: 2, item_level: 22, required_level: 19,
    slot: SLOT.OffHand, subclass: 15, class_mask: CLASS_MASK.rogue,
    stats: { agi: 3 }, weapon_min_dmg: 17, weapon_max_dmg: 32, weapon_speed: 1.5, expansion: 1,
    sources: [{ source_type: 'vendor', source_name: 'Pierce Shackleton', source_zone: 'Stormwind', source_min_level: 1, drop_chance: null, vendor_cost_copper: 4500, quest_choice_group: null }],
  },
  {
    id: 10004, name: 'Leather Jerkin', quality: 2, item_level: 21, required_level: 17,
    slot: SLOT.Chest, subclass: 2, class_mask: LEATHER,
    stats: { agi: 8, sta: 6 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'craft', source_name: 'Leatherworking', source_zone: null, source_min_level: 17, drop_chance: null, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10005, name: 'Stalker Pauldrons', quality: 2, item_level: 22, required_level: 18,
    slot: SLOT.Shoulder, subclass: 2, class_mask: LEATHER,
    stats: { agi: 6, sta: 4, str: 2 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Razorfen Kraul: Charlga Razorflank', source_zone: 'Razorfen Kraul', source_min_level: 25, drop_chance: 0.15, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10006, name: 'Cloak of the Brotherhood', quality: 2, item_level: 20, required_level: 16,
    slot: SLOT.Back, subclass: 0, class_mask: 0,
    stats: { agi: 5, sta: 3 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'quest', source_name: 'The Defias Brotherhood', source_zone: 'Westfall', source_min_level: 16, drop_chance: null, vendor_cost_copper: null, quest_choice_group: 1 }],
  },
  {
    id: 10007, name: 'Bracers of Cunning', quality: 2, item_level: 20, required_level: 15,
    slot: SLOT.Wrist, subclass: 2, class_mask: LEATHER,
    stats: { agi: 5, sta: 2 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Defias Pillager', source_zone: 'Westfall', source_min_level: 14, drop_chance: 0.04, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10008, name: 'Gloves of the Fang', quality: 3, item_level: 23, required_level: 18,
    slot: SLOT.Hands, subclass: 2, class_mask: LEATHER,
    stats: { agi: 9, sta: 4 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Wailing Caverns: Lord Pythas', source_zone: 'Wailing Caverns', source_min_level: 18, drop_chance: 0.12, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10009, name: 'Belt of the Stalker', quality: 2, item_level: 21, required_level: 17,
    slot: SLOT.Waist, subclass: 2, class_mask: LEATHER,
    stats: { agi: 6, sta: 3 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'vendor', source_name: 'Outfitter Eric', source_zone: 'Ironforge', source_min_level: 1, drop_chance: null, vendor_cost_copper: 3800, quest_choice_group: null }],
  },
  {
    id: 10010, name: 'Stalker Leggings', quality: 2, item_level: 22, required_level: 18,
    slot: SLOT.Legs, subclass: 2, class_mask: LEATHER,
    stats: { agi: 8, sta: 5 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Razorfen Kraul', source_zone: 'Razorfen Kraul', source_min_level: 25, drop_chance: 0.08, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10011, name: 'Soft Leather Boots', quality: 2, item_level: 20, required_level: 16,
    slot: SLOT.Feet, subclass: 2, class_mask: LEATHER,
    stats: { agi: 7, sta: 2 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'craft', source_name: 'Leatherworking', source_zone: null, source_min_level: 16, drop_chance: null, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10012, name: 'Tiger Hunter Ring', quality: 2, item_level: 22, required_level: 17,
    slot: SLOT.Finger, subclass: 0, class_mask: 0,
    stats: { agi: 4, crit_rating: 2 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'quest', source_name: 'Tiger Mastery', source_zone: 'Stranglethorn Vale', source_min_level: 20, drop_chance: null, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10013, name: 'Lifestone Pendant', quality: 3, item_level: 22, required_level: 18,
    slot: SLOT.Trinket, subclass: 0, class_mask: 0,
    stats: { agi: 3, sta: 8 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'drop', source_name: 'Blackfathom Deeps: Aku\'mai', source_zone: 'Blackfathom Deeps', source_min_level: 22, drop_chance: 0.10, vendor_cost_copper: null, quest_choice_group: null }],
  },
  {
    id: 10014, name: 'Heavy Crossbow', quality: 2, item_level: 22, required_level: 18,
    slot: SLOT.Ranged, subclass: 18, class_mask: ALL_CLASSES,
    stats: { agi: 3 }, weapon_min_dmg: 24, weapon_max_dmg: 41, weapon_speed: 3.2, expansion: 1,
    sources: [{ source_type: 'vendor', source_name: 'Bowyer Randel', source_zone: 'Stormwind', source_min_level: 1, drop_chance: null, vendor_cost_copper: 8200, quest_choice_group: null }],
  },
  {
    id: 10015, name: 'Footpad\'s Cloak', quality: 2, item_level: 20, required_level: 16,
    slot: SLOT.Back, subclass: 0, class_mask: 0,
    stats: { agi: 6 }, weapon_min_dmg: null, weapon_max_dmg: null, weapon_speed: null, expansion: 1,
    sources: [{ source_type: 'quest', source_name: 'The Defias Brotherhood', source_zone: 'Westfall', source_min_level: 16, drop_chance: null, vendor_cost_copper: null, quest_choice_group: 1 }],
  },
];

function main(): void {
  const def = resolve(import.meta.dir, '../../../../apps/ui/public/tbc.sqlite');
  const out = process.argv[2] ? resolve(process.argv[2]) : def;
  mkdirSync(dirname(out), { recursive: true });
  const db = new Database(out, { create: true });
  db.exec('DROP TABLE IF EXISTS items; DROP TABLE IF EXISTS item_sources;');
  createSchema(db);

  const insItem = db.prepare(`
    INSERT INTO items (id, name, quality, item_level, required_level, slot, subclass, class_mask, stats_json, weapon_min_dmg, weapon_max_dmg, weapon_speed, expansion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insSrc = db.prepare(`
    INSERT INTO item_sources (item_id, source_type, source_name, source_zone, source_min_level, drop_chance, vendor_cost_copper, quest_choice_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const it of items) {
      insItem.run(
        it.id, it.name, it.quality, it.item_level, it.required_level, it.slot, it.subclass, it.class_mask,
        JSON.stringify(it.stats), it.weapon_min_dmg, it.weapon_max_dmg, it.weapon_speed, it.expansion,
      );
      for (const s of it.sources) {
        insSrc.run(
          it.id, s.source_type, s.source_name, s.source_zone, s.source_min_level,
          s.drop_chance, s.vendor_cost_copper, s.quest_choice_group,
        );
      }
    }
  });
  tx();
  db.exec('VACUUM;');
  db.close();
  console.log(`[fixture] wrote ${items.length} items to ${out}`);
}

main();
