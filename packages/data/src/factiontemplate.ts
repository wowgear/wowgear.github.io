import { existsSync, readFileSync } from 'node:fs';
import { ALLIANCE_RACE_MASK, HORDE_RACE_MASK } from '@wowgear/core/types';

const FACTION_GROUP_PLAYER = 1;
const FACTION_GROUP_ALLIANCE = 2;
const FACTION_GROUP_HORDE = 4;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const h = parseLine(lines[0]!);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') continue;
    const cols = parseLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < h.length; j++) row[h[j]!] = cols[j] ?? '';
    out.push(row);
  }
  return out;
}

function parseLine(line: string): string[] {
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

export type FactionAllow = Map<number, number>;

export function loadFactionTemplate(csvPath: string): FactionAllow {
  if (!existsSync(csvPath)) {
    console.warn(`[faction] FactionTemplate.csv not found at ${csvPath}`);
    return new Map();
  }
  const rows = parseCSV(readFileSync(csvPath, 'utf8'));
  const out = new Map<number, number>();
  for (const r of rows) {
    const id = Number(r.ID);
    if (!id) continue;
    const friend = Number(r.FriendGroup) | 0;
    const enemy = Number(r.EnemyGroup) | 0;
    const anyPlayer = (friend & FACTION_GROUP_PLAYER) !== 0;
    const friendlyAlliance = anyPlayer || (friend & FACTION_GROUP_ALLIANCE) !== 0;
    const friendlyHorde = anyPlayer || (friend & FACTION_GROUP_HORDE) !== 0;
    const hostileAlliance = (enemy & FACTION_GROUP_ALLIANCE) !== 0;
    const hostileHorde = (enemy & FACTION_GROUP_HORDE) !== 0;
    const canAlliance = friendlyAlliance && !hostileAlliance;
    const canHorde = friendlyHorde && !hostileHorde;
    let mask = 0;
    if (canAlliance) mask |= ALLIANCE_RACE_MASK;
    if (canHorde) mask |= HORDE_RACE_MASK;
    out.set(id, mask);
  }
  return out;
}

const BOTH = ALLIANCE_RACE_MASK | HORDE_RACE_MASK;

export function vendorRaceMask(allow: FactionAllow, factionId: number): number {
  if (factionId <= 0) return 0;
  const mask = allow.get(factionId);
  if (mask == null) return 0;
  if (mask === 0) return 0;
  if (mask === BOTH) return 0;
  return mask;
}
