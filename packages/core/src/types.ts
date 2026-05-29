export type ClassName =
  | 'warrior'
  | 'paladin'
  | 'hunter'
  | 'rogue'
  | 'priest'
  | 'deathknight'
  | 'shaman'
  | 'mage'
  | 'warlock'
  | 'druid';

export type Spec =
  | 'arms' | 'fury' | 'prot'
  | 'combat' | 'subtlety'
  | 'frost' | 'fire'
  | 'affliction' | 'destro'
  | 'shadow' | 'disc' | 'holy'
  | 'bm'
  | 'enh' | 'ele' | 'resto'
  | 'feral' | 'balance'
  | 'ret'
  | 'blood' | 'unholy';

export type LevelBucket = '1-19' | '20-39' | '40-59' | '60-70' | '70-80';

export type Expansion = 'vanilla' | 'tbc' | 'wotlk';

export const CLASS_MASK: Record<ClassName, number> = {
  warrior:     1 << 0,
  paladin:     1 << 1,
  hunter:      1 << 2,
  rogue:       1 << 3,
  priest:      1 << 4,
  deathknight: 1 << 5,
  shaman:      1 << 6,
  mage:        1 << 7,
  warlock:     1 << 8,
  // 1<<9 = monk, post-MoP
  druid:       1 << 10,
};

export const SPEC_BY_CLASS: Record<ClassName, readonly Spec[]> = {
  warrior:     ['arms', 'fury', 'prot'],
  paladin:     ['ret', 'prot', 'holy'],
  hunter:      ['bm'],
  rogue:       ['combat', 'subtlety'],
  priest:      ['shadow', 'disc'],
  deathknight: ['blood', 'frost', 'unholy'],
  shaman:      ['enh', 'ele', 'resto'],
  mage:        ['frost', 'fire'],
  warlock:     ['affliction', 'destro'],
  druid:       ['feral', 'balance', 'resto'],
};

export const CLASS_MIN_LEVEL: Partial<Record<ClassName, number>> = {
  deathknight: 55,
};

export type Faction = 'any' | 'alliance' | 'horde';

export const RACE_BIT = {
  Human:    1 << 0,
  Orc:      1 << 1,
  Dwarf:    1 << 2,
  NightElf: 1 << 3,
  Undead:   1 << 4,
  Tauren:   1 << 5,
  Gnome:    1 << 6,
  Troll:    1 << 7,
  Goblin:   1 << 8,
  BloodElf: 1 << 9,
  Draenei:  1 << 10,
  Worgen:   1 << 11,
} as const;

export const ALLIANCE_RACE_MASK =
  RACE_BIT.Human | RACE_BIT.Dwarf | RACE_BIT.NightElf | RACE_BIT.Gnome |
  RACE_BIT.Draenei | RACE_BIT.Worgen;

export const HORDE_RACE_MASK =
  RACE_BIT.Orc | RACE_BIT.Undead | RACE_BIT.Tauren | RACE_BIT.Troll |
  RACE_BIT.BloodElf | RACE_BIT.Goblin;

export function factionRaceMask(f: Faction): number {
  if (f === 'alliance') return ALLIANCE_RACE_MASK;
  if (f === 'horde') return HORDE_RACE_MASK;
  return ALLIANCE_RACE_MASK | HORDE_RACE_MASK;
}

export function raceMaskAllows(raceMask: number, faction: Faction): boolean {
  if (raceMask === 0) return true;
  if (faction === 'any') return true;
  return (raceMask & factionRaceMask(faction)) !== 0;
}

export const SLOT = {
  Head: 1,
  Neck: 2,
  Shoulder: 3,
  Body: 4,
  Chest: 5,
  Waist: 6,
  Legs: 7,
  Feet: 8,
  Wrist: 9,
  Hands: 10,
  Finger: 11,
  Trinket: 12,
  Weapon: 13,
  Shield: 14,
  Ranged: 15,
  Back: 16,
  TwoHand: 17,
  Bag: 18,
  Tabard: 19,
  Robe: 20,
  MainHand: 21,
  OffHand: 22,
  Holdable: 23,
  Ammo: 24,
  Thrown: 25,
  RangedRight: 26,
  Quiver: 27,
  Relic: 28,
} as const;

export type Slot = (typeof SLOT)[keyof typeof SLOT];

export const WEAPON_SUBCLASS = {
  Axe1H: 0, Axe2H: 1, Bow: 2, Gun: 3, Mace1H: 4, Mace2H: 5,
  Polearm: 6, Sword1H: 7, Sword2H: 8, Staff: 10,
  Fist: 13, Misc: 14, Dagger: 15, Thrown: 16, Crossbow: 18, Wand: 19,
} as const;

const W = WEAPON_SUBCLASS;

export const ALLOWED_WEAPON_SUBCLASS: Record<ClassName, ReadonlySet<number>> = {
  warrior:     new Set([W.Axe1H, W.Axe2H, W.Bow, W.Gun, W.Mace1H, W.Mace2H, W.Polearm, W.Sword1H, W.Sword2H, W.Staff, W.Fist, W.Dagger, W.Thrown, W.Crossbow, W.Misc]),
  paladin:     new Set([W.Axe1H, W.Axe2H, W.Mace1H, W.Mace2H, W.Polearm, W.Sword1H, W.Sword2H, W.Misc]),
  hunter:      new Set([W.Axe1H, W.Axe2H, W.Bow, W.Gun, W.Polearm, W.Sword1H, W.Sword2H, W.Staff, W.Fist, W.Dagger, W.Crossbow, W.Thrown, W.Misc]),
  rogue:       new Set([W.Bow, W.Crossbow, W.Dagger, W.Fist, W.Gun, W.Mace1H, W.Sword1H, W.Thrown, W.Misc]),
  priest:      new Set([W.Mace1H, W.Staff, W.Wand, W.Dagger, W.Misc]),
  deathknight: new Set([W.Axe1H, W.Axe2H, W.Mace1H, W.Mace2H, W.Polearm, W.Sword1H, W.Sword2H, W.Misc]),
  shaman:      new Set([W.Axe1H, W.Axe2H, W.Mace1H, W.Mace2H, W.Staff, W.Fist, W.Dagger, W.Misc]),
  mage:        new Set([W.Sword1H, W.Staff, W.Wand, W.Dagger, W.Misc]),
  warlock:     new Set([W.Sword1H, W.Staff, W.Wand, W.Dagger, W.Misc]),
  druid:       new Set([W.Mace1H, W.Mace2H, W.Polearm, W.Staff, W.Fist, W.Dagger, W.Misc]),
};

export const WEAPON_SLOTS: ReadonlySet<number> = new Set([
  13, 17, 21, 25, 26,
]);

export const ARMOR_SUBCLASS = {
  Misc: 0, Cloth: 1, Leather: 2, Mail: 3, Plate: 4,
  Buckler: 5, Shield: 6, Libram: 7, Idol: 8, Totem: 9, Sigil: 10,
} as const;

const A = ARMOR_SUBCLASS;

export const ARMOR_SLOTS: ReadonlySet<number> = new Set([
  1, 3, 5, 6, 7, 8, 9, 10, 16, 20,
]);

export function allowedArmorSubclass(cls: ClassName, level: number): ReadonlySet<number> {
  switch (cls) {
    case 'warrior':
    case 'paladin':
      return level >= 40
        ? new Set([A.Misc, A.Cloth, A.Leather, A.Mail, A.Plate])
        : new Set([A.Misc, A.Cloth, A.Leather, A.Mail]);
    case 'deathknight':
      return new Set([A.Misc, A.Cloth, A.Leather, A.Mail, A.Plate]);
    case 'hunter':
    case 'shaman':
      return level >= 40
        ? new Set([A.Misc, A.Cloth, A.Leather, A.Mail])
        : new Set([A.Misc, A.Cloth, A.Leather]);
    case 'rogue':
    case 'druid':
      return new Set([A.Misc, A.Cloth, A.Leather]);
    case 'mage':
    case 'priest':
    case 'warlock':
      return new Set([A.Misc, A.Cloth]);
  }
}

export const SHIELD_CLASSES: ReadonlySet<ClassName> = new Set(['warrior', 'paladin', 'shaman']);
export const RELIC_BY_CLASS: Partial<Record<ClassName, number>> = {
  paladin: A.Libram,
  druid: A.Idol,
  shaman: A.Totem,
  deathknight: A.Sigil,
};

export const DISPLAY_SLOTS = [
  SLOT.Head, SLOT.Neck, SLOT.Shoulder, SLOT.Back,
  SLOT.Chest, SLOT.Wrist, SLOT.Hands, SLOT.Waist,
  SLOT.Legs, SLOT.Feet, SLOT.Finger, SLOT.Trinket,
  SLOT.MainHand, SLOT.OffHand, SLOT.Ranged,
] as const;

export interface Stats {
  // primary
  str?: number; agi?: number; sta?: number; int?: number; spi?: number;
  // melee/ranged
  ap?: number; rap?: number;
  hit_rating?: number; crit_rating?: number; haste_rating?: number;
  expertise_rating?: number; armor_pen?: number;
  // vanilla flat percentages (pre-2.0 rating system); distinct unit from *_rating
  crit_pct?: number; hit_pct?: number; spell_crit_pct?: number; spell_hit_pct?: number;
  dodge_pct?: number; parry_pct?: number; block_pct?: number; defense_skill?: number;
  // caster
  spellpower?: number;
  sp_arcane?: number; sp_fire?: number; sp_frost?: number;
  sp_nature?: number; sp_shadow?: number; sp_holy?: number;
  sp_healing?: number;
  spell_hit_rating?: number; spell_crit_rating?: number; spell_haste_rating?: number;
  spell_penetration?: number;
  mp5?: number;
  // defensive
  armor?: number; defense_rating?: number;
  dodge_rating?: number; parry_rating?: number;
  block_rating?: number; block_value?: number;
  resilience?: number;
  // resistances
  res_arcane?: number; res_fire?: number; res_frost?: number;
  res_nature?: number; res_shadow?: number;
}

export type StatKey = keyof Stats;

export interface StatWeights extends Stats {
  weapon_dps?: number;
}

export interface Item {
  id: number;
  name: string;
  quality: number;
  item_level: number;
  required_level: number;
  slot: Slot;
  subclass: number;
  class_mask: number;
  race_mask: number;
  stats: Stats;
  weapon_min_dmg: number | null;
  weapon_max_dmg: number | null;
  weapon_speed: number | null;
  expansion: 1 | 2;
}

export interface ItemSource {
  item_id: number;
  source_type: 'drop' | 'dungeon' | 'quest' | 'vendor' | 'profession' | 'craft' | 'pvp' | 'raid' | 'holiday';
  source_name: string;
  source_zone: string | null;
  source_min_level: number | null;
  drop_chance: number | null;
  vendor_cost_copper: number | null;
  quest_choice_group: number | null;
  race_mask: number;
}

export interface RankedItem {
  item: Item;
  score: number;
  sources: ItemSource[];
}

export function bucketForLevel(level: number): LevelBucket {
  if (level <= 19) return '1-19';
  if (level <= 39) return '20-39';
  if (level <= 59) return '40-59';
  if (level <= 70) return '60-70';
  return '70-80';
}
