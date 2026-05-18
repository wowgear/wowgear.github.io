import type { ClassName, LevelBucket, Spec, StatWeights } from './types.js';

type SpecWeights = Record<LevelBucket, StatWeights>;

const ROGUE_COMBAT: SpecWeights = {
  '1-19': {
    agi: 1.3, str: 0.7, sta: 0.1, ap: 1.0, crit_rating: 1.0,
    weapon_dps: 6.0,
  },
  '20-39': {
    agi: 1.4, str: 0.6, sta: 0.1, ap: 1.0,
    crit_rating: 1.0, hit_rating: 1.1,
    weapon_dps: 7.5,
  },
  '40-59': {
    agi: 1.5, str: 0.5, sta: 0.1, ap: 1.0,
    crit_rating: 1.2, hit_rating: 1.3, haste_rating: 0.8,
    weapon_dps: 9.0,
  },
  '60-70': {
    agi: 1.6, str: 0.4, sta: 0.05, ap: 1.0,
    crit_rating: 1.3, hit_rating: 1.4, haste_rating: 0.9,
    expertise_rating: 1.1, armor_pen: 0.7,
    weapon_dps: 10.0,
  },
};

const WAR_BASE = (mul: number): StatWeights => ({
  str: 1.0 * mul, agi: 0.6 * mul, sta: 0.3,
  ap: 0.5 * mul,
  hit_rating: 1.2 * mul, crit_rating: 0.9 * mul,
  haste_rating: 0.7 * mul, expertise_rating: 1.0 * mul,
  armor_pen: 0.6 * mul,
  weapon_dps: 6.5 * mul,
});

const WARRIOR_ARMS: SpecWeights = {
  '1-19': WAR_BASE(0.7),
  '20-39': WAR_BASE(0.85),
  '40-59': WAR_BASE(0.95),
  '60-70': WAR_BASE(1.0),
};

const WARRIOR_FURY: SpecWeights = {
  '1-19':  { ...WAR_BASE(0.7), haste_rating: 0.8 },
  '20-39': { ...WAR_BASE(0.85), haste_rating: 0.9 },
  '40-59': { ...WAR_BASE(0.95), haste_rating: 1.0 },
  '60-70': { ...WAR_BASE(1.0), haste_rating: 1.1, weapon_dps: 7.5 },
};

const WARRIOR_PROT: SpecWeights = {
  '1-19':  { sta: 1.2, str: 0.6, agi: 0.4, defense_rating: 1.0, dodge_rating: 0.9, parry_rating: 0.8, block_rating: 0.7, block_value: 0.6, armor: 0.1 },
  '20-39': { sta: 1.3, str: 0.6, agi: 0.5, defense_rating: 1.1, dodge_rating: 1.0, parry_rating: 0.9, block_rating: 0.8, block_value: 0.7, armor: 0.12, hit_rating: 0.5, expertise_rating: 0.8 },
  '40-59': { sta: 1.4, str: 0.7, agi: 0.6, defense_rating: 1.2, dodge_rating: 1.1, parry_rating: 1.0, block_rating: 0.9, block_value: 0.8, armor: 0.15, hit_rating: 0.7, expertise_rating: 1.0 },
  '60-70': { sta: 1.5, str: 0.8, agi: 0.7, defense_rating: 1.4, dodge_rating: 1.3, parry_rating: 1.2, block_rating: 1.1, block_value: 0.9, armor: 0.2, hit_rating: 0.9, expertise_rating: 1.2 },
};

const HUNTER_BM: SpecWeights = {
  '1-19':  { agi: 1.2, sta: 0.2, int: 0.3, rap: 1.0, crit_rating: 0.9, weapon_dps: 5.5 },
  '20-39': { agi: 1.3, sta: 0.2, int: 0.3, rap: 1.0, hit_rating: 1.1, crit_rating: 1.0, weapon_dps: 7.0 },
  '40-59': { agi: 1.4, sta: 0.2, int: 0.3, rap: 1.0, hit_rating: 1.3, crit_rating: 1.1, haste_rating: 0.7, weapon_dps: 8.5 },
  '60-70': { agi: 1.5, sta: 0.2, int: 0.3, rap: 1.0, hit_rating: 1.4, crit_rating: 1.2, haste_rating: 0.8, armor_pen: 0.5, weapon_dps: 10.0 },
};

const CASTER_DPS = (mul: number, school?: keyof StatWeights): SpecWeights => {
  const make = (factor: number): StatWeights => {
    const w: StatWeights = {
      int: 0.4 * factor, sta: 0.2, spi: 0.1,
      spellpower: 1.0 * factor,
      spell_hit_rating: 1.4 * factor,
      spell_crit_rating: 1.0 * factor,
      spell_haste_rating: 1.1 * factor,
      spell_penetration: 0.3 * factor,
      mp5: 0.3 * factor,
    };
    if (school) (w as Record<string, number>)[school] = 1.05 * factor;
    return w;
  };
  return {
    '1-19':  make(0.6 * mul),
    '20-39': make(0.8 * mul),
    '40-59': make(0.95 * mul),
    '60-70': make(1.0 * mul),
  };
};

const MAGE_FROST  = CASTER_DPS(1.0, 'sp_frost');
const MAGE_FIRE   = CASTER_DPS(1.0, 'sp_fire');
const LOCK_AFF    = CASTER_DPS(1.0, 'sp_shadow');
const LOCK_DESTRO = CASTER_DPS(1.0, 'sp_fire');
const PRIEST_SHADOW = CASTER_DPS(1.0, 'sp_shadow');
const SHAMAN_ELE  = CASTER_DPS(1.0, 'sp_nature');
const DRUID_BAL   = CASTER_DPS(1.0, 'sp_arcane');

const HEALER = (mul: number): SpecWeights => {
  const make = (factor: number): StatWeights => ({
    int: 0.6 * factor, sta: 0.2, spi: 0.5 * factor,
    sp_healing: 1.0 * factor,
    spell_crit_rating: 0.8 * factor,
    spell_haste_rating: 1.0 * factor,
    mp5: 1.1 * factor,
  });
  return {
    '1-19':  make(0.6 * mul),
    '20-39': make(0.8 * mul),
    '40-59': make(0.95 * mul),
    '60-70': make(1.0 * mul),
  };
};

const PRIEST_DISC = HEALER(1.0);
const SHAMAN_RESTO = HEALER(1.0);
const DRUID_RESTO = HEALER(1.0);
const PALADIN_HOLY = HEALER(1.0);

const SHAMAN_ENH: SpecWeights = {
  '1-19':  { str: 0.6, agi: 1.2, int: 0.3, sta: 0.2, ap: 1.0, crit_rating: 0.9, weapon_dps: 5.5 },
  '20-39': { str: 0.6, agi: 1.3, int: 0.3, sta: 0.2, ap: 1.0, hit_rating: 1.1, crit_rating: 1.0, weapon_dps: 7.0 },
  '40-59': { str: 0.6, agi: 1.4, int: 0.3, sta: 0.2, ap: 1.0, hit_rating: 1.3, crit_rating: 1.1, haste_rating: 0.9, weapon_dps: 8.5 },
  '60-70': { str: 0.6, agi: 1.5, int: 0.3, sta: 0.2, ap: 1.0, hit_rating: 1.4, crit_rating: 1.2, haste_rating: 1.0, expertise_rating: 1.0, weapon_dps: 10.0 },
};

const DRUID_FERAL = (mul: number): StatWeights => ({
  agi: 1.2 * mul, str: 0.8 * mul, sta: 0.3,
  ap: 1.0 * mul,
  crit_rating: 1.0 * mul, hit_rating: 1.2 * mul,
  expertise_rating: 0.9 * mul, armor_pen: 0.5 * mul,
  weapon_dps: 0.0,
});

const DRUID_FERAL_WEIGHTS: SpecWeights = {
  '1-19':  DRUID_FERAL(0.7),
  '20-39': DRUID_FERAL(0.85),
  '40-59': DRUID_FERAL(0.95),
  '60-70': DRUID_FERAL(1.0),
};

const PALADIN_RET: SpecWeights = {
  '1-19':  { str: 1.0, agi: 0.4, sta: 0.2, int: 0.3, ap: 0.5, crit_rating: 0.9, hit_rating: 1.1, weapon_dps: 7.0 },
  '20-39': { str: 1.1, agi: 0.4, sta: 0.2, int: 0.3, ap: 0.5, crit_rating: 1.0, hit_rating: 1.2, weapon_dps: 8.0 },
  '40-59': { str: 1.2, agi: 0.4, sta: 0.2, int: 0.3, ap: 0.5, crit_rating: 1.1, hit_rating: 1.3, haste_rating: 0.8, weapon_dps: 9.0 },
  '60-70': { str: 1.3, agi: 0.4, sta: 0.2, int: 0.3, ap: 0.5, crit_rating: 1.2, hit_rating: 1.4, haste_rating: 0.9, expertise_rating: 1.0, weapon_dps: 10.0 },
};

const PALADIN_PROT: SpecWeights = WARRIOR_PROT;

export const weights: Record<ClassName, Partial<Record<Spec, SpecWeights>>> = {
  rogue:   { combat: ROGUE_COMBAT },
  warrior: { arms: WARRIOR_ARMS, fury: WARRIOR_FURY, prot: WARRIOR_PROT },
  hunter:  { bm: HUNTER_BM },
  mage:    { frost: MAGE_FROST, fire: MAGE_FIRE },
  warlock: { affliction: LOCK_AFF, destro: LOCK_DESTRO },
  priest:  { shadow: PRIEST_SHADOW, disc: PRIEST_DISC },
  shaman:  { enh: SHAMAN_ENH, ele: SHAMAN_ELE, resto: SHAMAN_RESTO },
  druid:   { feral: DRUID_FERAL_WEIGHTS, balance: DRUID_BAL, resto: DRUID_RESTO },
  paladin: { ret: PALADIN_RET, prot: PALADIN_PROT, holy: PALADIN_HOLY },
};

export function weightsFor(cls: ClassName, spec: Spec, bucket: LevelBucket): StatWeights {
  const sw = weights[cls]?.[spec];
  if (!sw) throw new Error(`No weights for ${cls}/${spec}`);
  return sw[bucket];
}
