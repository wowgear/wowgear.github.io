export interface ProjectedItem {
  id: number;
  name: string;
  quality: number;
  item_level: number;
  required_level: number;
  required_skill: number;
  required_skill_rank: number;
  profession_min_level_alliance: number | null;
  profession_min_level_horde: number | null;
  slot: number;
  subclass: number;
  class_mask: number;
  race_mask: number;
  stats_json: string;
  weapon_min_dmg: number | null;
  weapon_max_dmg: number | null;
  weapon_speed: number | null;
  flags: number;
  duration: number;
}

export type ProjectedSourceType =
  | 'drop'
  | 'dungeon'
  | 'quest'
  | 'vendor'
  | 'profession'
  | 'pvp'
  | 'raid'
  | 'holiday';

export interface ProjectedSource {
  item_id: number;
  source_type: ProjectedSourceType;
  source_name: string;
  source_zone: string | null;
  min_player_level_alliance: number | null;
  min_player_level_horde: number | null;
  drop_chance: number | null;
  vendor_cost_copper: number | null;
  quest_choice_group: number | null;
  source_entity_kind?: 'npc' | 'object' | 'quest' | 'item' | null;
  source_entity_id?: number | null;
  race_mask: number;
}

const ITEM_FLAG_CONJURED = 0x2;
const ITEM_FLAG_DEPRECATED = 0x10;

export function shouldKeepItem(item: ProjectedItem): boolean {
  if (item.name === '') return false;
  if ((item.flags & ITEM_FLAG_CONJURED) !== 0) return false;
  if ((item.flags & ITEM_FLAG_DEPRECATED) !== 0) return false;
  if (item.duration > 0) return false;
  if (item.quality >= 2) return true;
  if (item.slot === 0) return false;
  try {
    const stats = JSON.parse(item.stats_json) as Record<string, number>;
    return Object.keys(stats).some((key) => key !== 'armor' && !key.startsWith('res_'));
  } catch {
    return false;
  }
}
