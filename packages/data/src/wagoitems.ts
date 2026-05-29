import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectedItem } from './project.js';
import { readEquipAuraStats } from './itemauras.js';

const ITEM_FLAG_CONJURED = 0x2;
const ITEM_FLAG_DEPRECATED = 0x10;
const ITEM_FLAG_PVP_REWARD = 0x1000;

const STAT_TYPE_MAP: Record<number, string> = {
  3: 'agi', 4: 'str', 5: 'int', 6: 'spi', 7: 'sta',
  12: 'defense_rating', 13: 'dodge_rating', 14: 'parry_rating', 15: 'block_rating',
  16: 'hit_rating', 17: 'hit_rating', 18: 'spell_hit_rating',
  19: 'crit_rating', 20: 'crit_rating', 21: 'spell_crit_rating',
  28: 'haste_rating', 29: 'haste_rating', 30: 'spell_haste_rating',
  31: 'hit_rating', 32: 'crit_rating', 35: 'resilience',
  36: 'haste_rating', 37: 'expertise_rating',
  38: 'ap', 39: 'rap', 40: 'ap', 41: 'sp_healing', 42: 'spellpower',
  43: 'mp5', 44: 'armor_pen', 45: 'spellpower', 47: 'spell_penetration', 48: 'block_value',
};

// ItemSparse Resistances_0 is armor (physical); 1..6 are the magic-school resistances.
const RESISTANCE_BY_INDEX = ['armor', 'res_holy', 'res_fire', 'res_nature', 'res_frost', 'res_shadow', 'res_arcane'];

function readLine(buf: string, start: number): { line: string; next: number } {
  let i = start;
  let q = false;
  while (i < buf.length) {
    const c = buf[i]!;
    if (c === '"') q = !q;
    else if (!q && (c === '\n' || c === '\r')) {
      const line = buf.slice(start, i);
      let next = i + 1;
      if (c === '\r' && buf[next] === '\n') next++;
      return { line, next };
    }
    i++;
  }
  return { line: buf.slice(start, i), next: i };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { q = false; continue; }
      cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; continue; }
      if (c === '"') { q = true; continue; }
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

interface RowReader {
  index: Map<string, number>;
  num(cols: string[], col: string): number;
  str(cols: string[], col: string): string;
}

function makeReader(header: string[]): RowReader {
  const index = new Map<string, number>();
  for (let i = 0; i < header.length; i++) index.set(header[i]!, i);
  return {
    index,
    num(cols, col) {
      const i = index.get(col);
      if (i == null) return 0;
      const v = cols[i];
      if (v == null || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    },
    str(cols, col) {
      const i = index.get(col);
      if (i == null) return '';
      return cols[i] ?? '';
    },
  };
}

interface ItemMeta {
  classId: number;
  subclassId: number;
}

function loadItemTable(path: string): Map<number, ItemMeta> {
  const buf = readFileSync(path, 'utf8');
  const first = readLine(buf, 0);
  const header = splitCsv(first.line);
  const reader = makeReader(header);
  const out = new Map<number, ItemMeta>();
  let pos = first.next;
  while (pos < buf.length) {
    const { line, next } = readLine(buf, pos);
    pos = next;
    if (line === '') continue;
    const cols = splitCsv(line);
    const id = reader.num(cols, 'ID');
    if (!id) continue;
    out.set(id, {
      classId: reader.num(cols, 'ClassID'),
      subclassId: reader.num(cols, 'SubclassID'),
    });
  }
  return out;
}

export function readWagoItems(dir: string): ProjectedItem[] {
  const itemsByClass = loadItemTable(join(dir, 'Item.csv'));

  const buf = readFileSync(join(dir, 'ItemSparse.csv'), 'utf8');
  const first = readLine(buf, 0);
  const header = splitCsv(first.line);
  const reader = makeReader(header);
  const auraStats = readEquipAuraStats(dir);

  const out: ProjectedItem[] = [];
  let pos = first.next;
  while (pos < buf.length) {
    const { line, next } = readLine(buf, pos);
    pos = next;
    if (line === '') continue;
    const cols = splitCsv(line);
    const id = reader.num(cols, 'ID');
    if (!id) continue;

    const flags0 = reader.num(cols, 'Flags_0');
    if ((flags0 & ITEM_FLAG_CONJURED) !== 0) continue;
    if ((flags0 & ITEM_FLAG_DEPRECATED) !== 0) continue;

    const duration = reader.num(cols, 'DurationInInventory');
    if (duration > 0) continue;

    const name = reader.str(cols, 'Display_lang');
    if (!name) continue;

    const itemLevel = reader.num(cols, 'ItemLevel');
    const requiredLevel = reader.num(cols, 'RequiredLevel');
    const quality = reader.num(cols, 'OverallQualityID');
    const slot = reader.num(cols, 'InventoryType');
    const allowableClass = reader.num(cols, 'AllowableClass');
    const allowableRace = reader.num(cols, 'AllowableRace');
    const requiredPvpRank = reader.num(cols, 'RequiredPVPRank');
    const isPvp = (flags0 & ITEM_FLAG_PVP_REWARD) !== 0;

    const itemMeta = itemsByClass.get(id);
    const subclass = itemMeta?.subclassId ?? 0;

    const stats: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      const t = reader.num(cols, `StatModifier_bonusStat_${i}`);
      const v = reader.num(cols, `StatModifier_bonusAmount_${i}`);
      if (t > 0 && v !== 0) {
        const key = STAT_TYPE_MAP[t];
        if (key) stats[key] = (stats[key] ?? 0) + v;
      }
    }

    for (let ri = 0; ri <= 6; ri++) {
      const rv = reader.num(cols, `Resistances_${ri}`);
      if (rv !== 0) { const rk = RESISTANCE_BY_INDEX[ri]!; stats[rk] = (stats[rk] ?? 0) + rv; }
    }

    const extra = auraStats.get(id) as Record<string, number> | undefined;
    if (extra) for (const k of Object.keys(extra)) stats[k] = (stats[k] ?? 0) + extra[k]!;

    const wmin = reader.num(cols, 'MinDamage_0');
    const wmax = reader.num(cols, 'MaxDamage_0');
    const delayMs = reader.num(cols, 'ItemDelay');
    const speed = delayMs > 0 ? delayMs / 1000 : null;

    out.push({
      id,
      name,
      quality,
      item_level: itemLevel,
      required_level: requiredLevel,
      required_honor_rank: requiredPvpRank > 0 ? requiredPvpRank : (isPvp ? 1 : 0),
      slot,
      subclass,
      class_mask: allowableClass < 0 ? 0 : allowableClass,
      race_mask: allowableRace < 0 ? 0 : allowableRace,
      stats_json: JSON.stringify(stats),
      weapon_min_dmg: wmin > 0 ? wmin : null,
      weapon_max_dmg: wmax > 0 ? wmax : null,
      weapon_speed: speed,
      expansion: 1,
      flags: flags0,
      duration,
    });
  }
  return out;
}
