import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Stats } from '@wowgear/core/types';

const APPLY_AURA = 6;
const TRIGGER_ON_EQUIP = 1;

const AURA_MOD_STAT = 29;
const AURA_MOD_SKILL = 30;
const AURA_MOD_PARRY_PERCENT = 47;
const AURA_MOD_DODGE_PERCENT = 49;
const AURA_MOD_BLOCK_PERCENT = 51;
const AURA_MOD_POWER_REGEN = 85;
const AURA_MOD_ATTACK_POWER = 99;
const AURA_MOD_RANGED_ATTACK_POWER = 124;
const AURA_MOD_DAMAGE_DONE = 13;
const AURA_MOD_HEALING_DONE = 135;
const AURA_MOD_CRIT_PERCENT = 52;
const AURA_MOD_SPELL_CRIT_CHANCE = 57;
const AURA_MOD_HIT_CHANCE = 54;
const AURA_MOD_SPELL_HIT_CHANCE = 55;
const SKILL_DEFENSE = 95;
const STAT_INDEX_KEY: (keyof Stats)[] = ['str', 'agi', 'sta', 'int', 'spi'];

const POWER_MANA = 0;
const SCHOOL_MASK_MAGIC = 0x7e; // holy|fire|nature|frost|shadow|arcane
const SCHOOL_KEY: Record<number, keyof Stats> = {
  2: 'sp_holy', 4: 'sp_fire', 8: 'sp_nature', 16: 'sp_frost', 32: 'sp_shadow', 64: 'sp_arcane',
};

function damageKey(schoolMask: number): keyof Stats | null {
  const magic = schoolMask & SCHOOL_MASK_MAGIC;
  if (magic === 0) return null;
  if ((magic & (magic - 1)) === 0) return SCHOOL_KEY[magic] ?? 'spellpower';
  return 'spellpower';
}

interface AuraEffect {
  aura: number;
  value: number;
  misc: number;
}

// In vanilla/TBC, +spell damage and +healing are independent stats (healing gear carries
// more healing than damage). They are emitted separately; no spec weights both, so a unified
// "+N damage and healing" item contributes to a DPS caster (spellpower) and a healer (sp_healing)
// without double-counting within a single build.
function auraStatKey(e: AuraEffect): keyof Stats | null {
  switch (e.aura) {
    case AURA_MOD_DAMAGE_DONE: return damageKey(e.misc);
    case AURA_MOD_HEALING_DONE: return 'sp_healing';
    case AURA_MOD_ATTACK_POWER: return 'ap';
    case AURA_MOD_RANGED_ATTACK_POWER: return 'rap';
    case AURA_MOD_POWER_REGEN: return e.misc === POWER_MANA ? 'mp5' : null;
    case AURA_MOD_CRIT_PERCENT: return 'crit_pct';
    case AURA_MOD_SPELL_CRIT_CHANCE: return 'spell_crit_pct';
    case AURA_MOD_HIT_CHANCE: return 'hit_pct';
    case AURA_MOD_SPELL_HIT_CHANCE: return 'spell_hit_pct';
    case AURA_MOD_DODGE_PERCENT: return 'dodge_pct';
    case AURA_MOD_PARRY_PERCENT: return 'parry_pct';
    case AURA_MOD_BLOCK_PERCENT: return 'block_pct';
    case AURA_MOD_SKILL: return e.misc === SKILL_DEFENSE ? 'defense_skill' : null;
    default: return null;
  }
}

function addPrimaryStat(stats: Record<string, number>, misc: number, value: number): void {
  if (misc === -1) {
    for (const k of STAT_INDEX_KEY) stats[k] = (stats[k] ?? 0) + value;
    return;
  }
  const k = STAT_INDEX_KEY[misc];
  if (k) stats[k] = (stats[k] ?? 0) + value;
}

interface Csv {
  idx: Map<string, number>;
  rows: string[][];
}

function readCsv(path: string): Csv {
  const buf = readFileSync(path, 'utf8');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let q = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]!;
    if (q) {
      if (c === '"' && buf[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && buf[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  const idx = new Map<string, number>();
  header.forEach((h, i) => idx.set(h, i));
  return { idx, rows };
}

function col(csv: Csv, name: string): number {
  const i = csv.idx.get(name);
  if (i == null) throw new Error(`column ${name} missing in CSV`);
  return i;
}

export function readEquipAuraStats(wagoDir: string): Map<number, Partial<Stats>> {
  const out = new Map<number, Record<string, number>>();
  const itemEffectPath = join(wagoDir, 'ItemEffect.csv');
  const spellEffectPath = join(wagoDir, 'SpellEffect.csv');
  if (!existsSync(itemEffectPath) || !existsSync(spellEffectPath)) {
    console.warn(`[auras] ItemEffect.csv or SpellEffect.csv missing in ${wagoDir}; skipping aura stats`);
    return out;
  }

  const se = readCsv(spellEffectPath);
  const seSpell = col(se, 'SpellID');
  const seEffect = col(se, 'Effect');
  const seAura = col(se, 'EffectAura');
  const seBase = col(se, 'EffectBasePoints');
  const seDie = col(se, 'EffectDieSides');
  const seMisc = col(se, 'EffectMiscValue_0');

  const bySpell = new Map<number, AuraEffect[]>();
  for (const r of se.rows) {
    if (Number(r[seEffect]) !== APPLY_AURA) continue;
    const sid = Number(r[seSpell]);
    if (!sid) continue;
    const e: AuraEffect = { aura: Number(r[seAura]), value: Number(r[seBase]) + Number(r[seDie]), misc: Number(r[seMisc]) };
    const list = bySpell.get(sid);
    if (list) list.push(e);
    else bySpell.set(sid, [e]);
  }

  const ie = readCsv(itemEffectPath);
  const ieParent = col(ie, 'ParentItemID');
  const ieSpell = col(ie, 'SpellID');
  const ieTrigger = col(ie, 'TriggerType');

  for (const r of ie.rows) {
    if (Number(r[ieTrigger]) !== TRIGGER_ON_EQUIP) continue;
    const item = Number(r[ieParent]);
    if (!item) continue;
    const effects = bySpell.get(Number(r[ieSpell]));
    if (!effects) continue;
    let stats = out.get(item);
    for (const e of effects) {
      if (e.value === 0) continue;
      if (e.aura === AURA_MOD_STAT) {
        if (!stats) { stats = {}; out.set(item, stats); }
        addPrimaryStat(stats, e.misc, e.value);
        continue;
      }
      const key = auraStatKey(e);
      if (!key) continue;
      if (!stats) { stats = {}; out.set(item, stats); }
      stats[key] = (stats[key] ?? 0) + e.value;
    }
  }

  return out as Map<number, Partial<Stats>>;
}
