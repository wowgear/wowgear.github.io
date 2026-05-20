import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectedSource } from './project.js';

const SPELL_EFFECT_CREATE_ITEM = 24;
const SPELL_EFFECT_CREATE_ITEM_2 = 157;

const PROFESSION_NAMES: ReadonlySet<string> = new Set([
  'Alchemy', 'Blacksmithing', 'Cooking', 'Enchanting', 'Engineering',
  'First Aid', 'Fishing', 'Herbalism', 'Inscription', 'Jewelcrafting',
  'Leatherworking', 'Mining', 'Skinning', 'Tailoring',
]);

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = parseLine(lines[0]!);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') continue;
    const cols = parseLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) row[header[j]!] = cols[j] ?? '';
    out.push(row);
  }
  return out;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; continue; }
      if (c === '"') { inQ = true; continue; }
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function readWagoCraftSources(dir: string, knownItems: Set<number>): ProjectedSource[] {
  const t0 = performance.now();

  const skillLine = parseCSV(readFileSync(join(dir, 'SkillLine.csv'), 'utf8'));
  const professionSkillIds = new Set<number>();
  const skillIdToName = new Map<number, string>();
  for (const r of skillLine) {
    const name = r.DisplayName_lang ?? '';
    if (PROFESSION_NAMES.has(name)) {
      const id = Number(r.ID);
      professionSkillIds.add(id);
      skillIdToName.set(id, name);
    }
  }

  const sla = parseCSV(readFileSync(join(dir, 'SkillLineAbility.csv'), 'utf8'));
  const spellToSkill = new Map<number, number>();
  const spellToRank = new Map<number, number>();
  for (const r of sla) {
    const sid = Number(r.SkillLine);
    if (!professionSkillIds.has(sid)) continue;
    const spell = Number(r.Spell);
    if (!spell) continue;
    spellToSkill.set(spell, sid);
    const rank = Number(r.MinSkillLineRank);
    if (Number.isFinite(rank)) spellToRank.set(spell, rank);
  }

  const sn = parseCSV(readFileSync(join(dir, 'SpellName.csv'), 'utf8'));
  const spellName = new Map<number, string>();
  for (const r of sn) {
    const id = Number(r.ID);
    const name = r.Name_lang ?? '';
    if (id && name) spellName.set(id, name);
  }

  const se = parseCSV(readFileSync(join(dir, 'SpellEffect.csv'), 'utf8'));
  const out: ProjectedSource[] = [];
  let kept = 0;
  for (const r of se) {
    const effect = Number(r.Effect);
    if (effect !== SPELL_EFFECT_CREATE_ITEM && effect !== SPELL_EFFECT_CREATE_ITEM_2) continue;
    const item = Number(r.EffectItemType);
    if (!item || !knownItems.has(item)) continue;
    const spell = Number(r.SpellID);
    const skillId = spellToSkill.get(spell);
    if (!skillId) continue;
    const profession = skillIdToName.get(skillId) ?? '';
    const name = spellName.get(spell) ?? `Spell ${spell}`;
    out.push({
      item_id: item,
      source_type: 'profession',
      source_name: `${profession}: ${name}`,
      source_zone: null,
      source_min_level: 1,
      drop_chance: null,
      vendor_cost_copper: null,
      quest_choice_group: null,
    });
    kept++;
  }
  console.log(`[wago] ${kept} profession sources from ${dir} in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  return out;
}
