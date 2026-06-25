import type { ParsedTable } from './dump.js';
import { rowToObject } from './dump.js';

export interface ProjectedItem {
  id: number;
  name: string;
  quality: number;
  item_level: number;
  required_level: number;
  required_honor_rank: number;
  slot: number;
  subclass: number;
  class_mask: number;
  race_mask: number;
  stats_json: string;
  weapon_min_dmg: number | null;
  weapon_max_dmg: number | null;
  weapon_speed: number | null;
  expansion: 1 | 2;
  flags: number;
  duration: number;
}

const ITEM_FLAG_CONJURED = 0x2;
const ITEM_FLAG_DEPRECATED = 0x10;

export interface ProjectedSource {
  item_id: number;
  source_type: 'drop' | 'dungeon' | 'quest' | 'vendor' | 'profession' | 'craft' | 'pvp' | 'raid' | 'holiday';
  source_name: string;
  source_zone: string | null;
  source_min_level: number | null;
  drop_chance: number | null;
  vendor_cost_copper: number | null;
  quest_choice_group: number | null;
  source_entity_kind?: 'npc' | 'object' | 'quest' | 'item' | null;
  source_entity_id?: number | null;
  race_mask: number;
}

const STAT_TYPE_MAP: Record<number, string> = {
  3: 'agi',
  4: 'str',
  5: 'int',
  6: 'spi',
  7: 'sta',
  12: 'defense_rating',
  13: 'dodge_rating',
  14: 'parry_rating',
  15: 'block_rating',
  16: 'hit_rating',
  17: 'hit_rating',
  18: 'spell_hit_rating',
  19: 'crit_rating',
  20: 'crit_rating',
  21: 'spell_crit_rating',
  28: 'haste_rating',
  29: 'haste_rating',
  30: 'spell_haste_rating',
  31: 'hit_rating',
  32: 'crit_rating',
  35: 'resilience',
  36: 'haste_rating',
  37: 'expertise_rating',
  38: 'ap',
  39: 'rap',
  40: 'ap',
  41: 'sp_healing',
  42: 'spellpower',
  43: 'mp5',
  44: 'armor_pen',
  45: 'spellpower',
  47: 'spell_penetration',
  48: 'block_value',
};

const RES_MAP: Record<string, string> = {
  arcane_res: 'res_arcane',
  fire_res: 'res_fire',
  frost_res: 'res_frost',
  nature_res: 'res_nature',
  shadow_res: 'res_shadow',
  holy_res: 'res_holy',
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | number | null | undefined): string {
  return v == null ? '' : String(v);
}

export function projectItems(items: ParsedTable, expansionMinPatch = 2): ProjectedItem[] {
  const out: ProjectedItem[] = [];
  for (const row of items.rows) {
    const r = rowToObject(items, row);
    const id = num(r.entry ?? r.id);
    if (id <= 0) continue;
    const itemLevel = num(r.ItemLevel ?? r.itemlevel);
    const requiredLevel = num(r.RequiredLevel ?? r.requiredlevel);
    const quality = num(r.Quality ?? r.quality);
    const inv = num(r.InventoryType ?? r.inventorytype);
    const allowableClass = num(r.AllowableClass ?? r.allowableclass);
    const allowableRace = num(r.AllowableRace ?? r.allowablerace);
    const subclass = num(r.subclass);
    const expansion = expansionMinPatch >= 2 && itemLevel >= 90 ? 2 : 1;

    const stats: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      const t = num(r[`stat_type${i}`]);
      const v = num(r[`stat_value${i}`]);
      if (t > 0 && v !== 0) {
        const key = STAT_TYPE_MAP[t];
        if (key) stats[key] = (stats[key] ?? 0) + v;
      }
    }
    for (const [src, dst] of Object.entries(RES_MAP)) {
      const v = num(r[src]);
      if (v !== 0) stats[dst] = v;
    }
    const armor = num(r.armor);
    if (armor !== 0) stats.armor = armor;

    const wmin = nullableNum(r.dmg_min1);
    const wmax = nullableNum(r.dmg_max1);
    const delayMs = nullableNum(r.delay);
    const speed = delayMs != null && delayMs > 0 ? delayMs / 1000 : null;

    const flags = num(r.Flags ?? r.flags);
    const duration = num(r.Duration ?? r.duration);
    const honorRank = num(r.requiredhonorrank ?? r.RequiredHonorRank);

    out.push({
      id,
      name: str(r.name),
      quality,
      item_level: itemLevel,
      required_level: requiredLevel,
      required_honor_rank: honorRank,
      slot: inv,
      subclass,
      class_mask: allowableClass < 0 ? 0 : allowableClass,
      race_mask: allowableRace < 0 ? 0 : allowableRace,
      stats_json: JSON.stringify(stats),
      weapon_min_dmg: wmin,
      weapon_max_dmg: wmax,
      weapon_speed: speed,
      expansion,
      flags,
      duration,
    });
  }
  return out;
}

export function shouldKeepItem(it: ProjectedItem): boolean {
  if (it.name === '') return false;
  if ((it.flags & ITEM_FLAG_CONJURED) !== 0) return false;
  if ((it.flags & ITEM_FLAG_DEPRECATED) !== 0) return false;
  if (it.duration > 0) return false;
  if (it.quality >= 2) return true;
  if (it.slot === 0) return false;
  try {
    const stats = JSON.parse(it.stats_json) as Record<string, number>;
    if (Object.keys(stats).some((k) => k !== 'armor' && !k.startsWith('res_'))) return true;
  } catch {}
  return false;
}
