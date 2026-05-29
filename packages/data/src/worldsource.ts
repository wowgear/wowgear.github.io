import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALLIANCE_RACE_MASK, HORDE_RACE_MASK } from '@wowgear/core/types';
import { parseDumpSql, rowToObject, type ParsedTable } from './dump.js';
import type { ProjectedSource } from './project.js';
import { loadFactionTemplate, vendorRaceMask, type FactionAllow } from './factiontemplate.js';

const FACTION_EXCLUSIVE_MAPS: Record<number, number> = {
  449: ALLIANCE_RACE_MASK,
  450: HORDE_RACE_MASK,
};

const TABLES = new Set([
  'creature_template',
  'creature_loot_template',
  'npc_vendor',
  'quest_template',
  'gameobject_template',
  'gameobject_loot_template',
  'reference_loot_template',
  'creature',
  'game_event',
  'game_event_creature',
  'game_event_creature_data',
  'game_event_quest',
  'instance_template',
  'instance_encounters',
  'skinning_loot_template',
  'fishing_loot_template',
  'prospecting_loot_template',
  'disenchant_loot_template',
  'item_loot_template',
]);

interface CreatureInfo {
  name: string;
  minLevel: number;
  maxLevel: number;
  faction: number;
}

interface QuestInfo {
  title: string;
  minLevel: number;
  questLevel: number;
  method: number;
}

interface GameObjectInfo {
  name: string;
  type: number;
  data1: number;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: string | number | null | undefined): string {
  return v == null ? '' : String(v);
}

function buildIndex<T>(t: ParsedTable, key: string, map: (o: Record<string, string | number | null>) => T): Map<number, T> {
  const out = new Map<number, T>();
  for (const row of t.rows) {
    const o = rowToObject(t, row);
    const id = num(o[key]);
    if (id <= 0) continue;
    out.set(id, map(o));
  }
  return out;
}

interface LootRow {
  entry: number;
  item: number;
  chance: number;
  mincountOrRef: number;
}

function readLoot(t: ParsedTable): LootRow[] {
  const out: LootRow[] = [];
  for (const row of t.rows) {
    const o = rowToObject(t, row);
    out.push({
      entry: num(o.entry),
      item: num(o.item),
      chance: num(o.ChanceOrQuestChance),
      mincountOrRef: num(o.mincountOrRef),
    });
  }
  return out;
}

// mangos loot rows with mincountOrRef < 0 are references into reference_loot_template
// (the row's `item` holds the ref id, not a real item). Resolve refs (nested) to item ids.
function buildReferenceMap(refTable: ParsedTable | undefined): Map<number, number[]> {
  const resolved = new Map<number, number[]>();
  if (!refTable) return resolved;
  const byEntry = new Map<number, LootRow[]>();
  for (const r of readLoot(refTable)) {
    const list = byEntry.get(r.entry);
    if (list) list.push(r);
    else byEntry.set(r.entry, [r]);
  }
  const resolving = new Set<number>();
  const resolve = (entry: number): number[] => {
    const cached = resolved.get(entry);
    if (cached) return cached;
    if (resolving.has(entry)) return [];
    resolving.add(entry);
    const items: number[] = [];
    for (const r of byEntry.get(entry) ?? []) {
      if (r.mincountOrRef < 0) { for (const x of resolve(-r.mincountOrRef)) items.push(x); }
      else if (r.item > 0) items.push(r.item);
    }
    resolving.delete(entry);
    resolved.set(entry, items);
    return items;
  };
  for (const entry of byEntry.keys()) resolve(entry);
  return resolved;
}

function lootItems(r: LootRow, refMap: Map<number, number[]>): number[] {
  if (r.mincountOrRef < 0) return refMap.get(-r.mincountOrRef) ?? [];
  return r.item > 0 ? [r.item] : [];
}

// Shared reference loot tables are referenced by many creatures, so the same item gets
// hundreds of sources. Keep the lowest-level few per item (dedup by source name+type).
const MAX_SOURCES_PER_ITEM = 12;
function capPerItem(all: ProjectedSource[]): ProjectedSource[] {
  const byItem = new Map<number, ProjectedSource[]>();
  for (const s of all) {
    const list = byItem.get(s.item_id);
    if (list) list.push(s);
    else byItem.set(s.item_id, [s]);
  }
  const out: ProjectedSource[] = [];
  for (const list of byItem.values()) {
    const byName = new Map<string, ProjectedSource>();
    for (const s of list) {
      const key = `${s.source_type}|${s.source_name}`;
      const ex = byName.get(key);
      if (!ex || (s.source_min_level ?? 9999) < (ex.source_min_level ?? 9999)) byName.set(key, s);
    }
    const uniq = [...byName.values()].sort((a, b) => (a.source_min_level ?? 9999) - (b.source_min_level ?? 9999));
    for (let i = 0; i < uniq.length && i < MAX_SOURCES_PER_ITEM; i++) out.push(uniq[i]!);
  }
  return out;
}

function levelLabel(min: number, max: number): string {
  if (min <= 0 && max <= 0) return '';
  if (min === max) return `Lvl ${min}`;
  return `Lvl ${min}-${max}`;
}

function appropriateLevel(min: number, max: number): number {
  if (min <= 0) return max > 0 ? max : 1;
  if (max <= 0) return min;
  return Math.max(1, Math.min(70, Math.max(min, Math.round((min + max) / 2))));
}

export interface WorldSources {
  sources: ProjectedSource[];
  itemsCovered: Set<number>;
}

function buildHolidaySets(tables: Map<string, ParsedTable>): {
  holidayEntries: Set<number>;
  holidayQuests: Set<number>;
} {
  const gameEvent = tables.get('game_event');
  const gameEventCreature = tables.get('game_event_creature');
  const gameEventCreatureData = tables.get('game_event_creature_data');
  const gameEventQuest = tables.get('game_event_quest');
  const creature = tables.get('creature');

  const holidayEvents = new Set<number>();
  if (gameEvent) {
    for (const row of gameEvent.rows) {
      const o = rowToObject(gameEvent, row);
      const entry = num(o.entry);
      const holiday = num(o.holiday);
      const desc = str(o.description);
      if (holiday === 0) continue;
      if (/call to arms/i.test(desc)) continue;
      holidayEvents.add(entry);
    }
  }
  console.log(`[world] ${holidayEvents.size} holiday events`);

  const holidayGuids = new Set<number>();
  if (gameEventCreature) {
    for (const row of gameEventCreature.rows) {
      const o = rowToObject(gameEventCreature, row);
      const guid = num(o.guid);
      const event = num(o.event);
      if (event > 0 && holidayEvents.has(event)) holidayGuids.add(guid);
    }
  }

  const holidayEntries = new Set<number>();
  if (gameEventCreatureData) {
    for (const row of gameEventCreatureData.rows) {
      const o = rowToObject(gameEventCreatureData, row);
      const event = num(o.event);
      const entryOverride = num(o.entry_id);
      if (event > 0 && entryOverride > 0 && holidayEvents.has(event)) {
        holidayEntries.add(entryOverride);
      }
    }
  }

  if (creature && holidayGuids.size > 0) {
    const guidToEntry = new Map<number, number>();
    const entryToGuids = new Map<number, number[]>();
    for (const row of creature.rows) {
      const o = rowToObject(creature, row);
      const guid = num(o.guid);
      const id = num(o.id);
      if (guid <= 0 || id <= 0) continue;
      guidToEntry.set(guid, id);
      const list = entryToGuids.get(id);
      if (list) list.push(guid);
      else entryToGuids.set(id, [guid]);
    }
    for (const [entry, guids] of entryToGuids) {
      if (guids.every((g) => holidayGuids.has(g))) holidayEntries.add(entry);
    }
  }
  console.log(`[world] ${holidayEntries.size} creature entries are holiday-only`);

  const holidayQuests = new Set<number>();
  if (gameEventQuest) {
    for (const row of gameEventQuest.rows) {
      const o = rowToObject(gameEventQuest, row);
      const quest = num(o.quest);
      const event = num(o.event);
      if (holidayEvents.has(event)) holidayQuests.add(quest);
    }
  }

  const questTemplate = tables.get('quest_template');
  if (questTemplate && holidayQuests.size > 0) {
    const holidaySorts = new Set<number>();
    for (const row of questTemplate.rows) {
      const o = rowToObject(questTemplate, row);
      if (!holidayQuests.has(num(o.entry))) continue;
      const sort = num(o.ZoneOrSort);
      if (sort < 0) holidaySorts.add(sort);
    }
    for (const row of questTemplate.rows) {
      const o = rowToObject(questTemplate, row);
      const sort = num(o.ZoneOrSort);
      if (sort < 0 && holidaySorts.has(sort)) holidayQuests.add(num(o.entry));
    }
    console.log(`[world] holiday quest sorts: ${[...holidaySorts].join(', ')}`);
  }
  console.log(`[world] ${holidayQuests.size} holiday quests`);

  return { holidayEntries, holidayQuests };
}

export function readWorldSources(path: string, knownItems: Set<number>, itemReqLevel: Map<number, number>, wagoDir?: string | null): WorldSources {
  console.log(`[world] reading ${path}`);
  const sql = readFileSync(path, 'utf8');
  console.log(`[world] parsing (${(sql.length / 1024 / 1024).toFixed(1)} MB)`);
  const t0 = performance.now();
  const tables = parseDumpSql(sql, TABLES);
  console.log(`[world] parsed in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  const creatureTemplate = tables.get('creature_template');
  const creatureLoot = tables.get('creature_loot_template');
  const npcVendor = tables.get('npc_vendor');
  const questTemplate = tables.get('quest_template');
  const instanceTemplate = tables.get('instance_template');
  const creatureSpawn = tables.get('creature');

  const creatures = creatureTemplate
    ? buildIndex<CreatureInfo>(creatureTemplate, 'Entry', (o) => ({
        name: str(o.Name),
        minLevel: num(o.MinLevel),
        maxLevel: num(o.MaxLevel),
        faction: num(o.Faction ?? o.faction_A ?? o.faction),
      }))
    : new Map();
  console.log(`[world] ${creatures.size} creatures`);

  const factionAllow: FactionAllow = wagoDir
    ? loadFactionTemplate(join(wagoDir, 'FactionTemplate.csv'))
    : new Map();
  if (factionAllow.size > 0) console.log(`[world] FactionTemplate loaded: ${factionAllow.size} entries`);

  const instanceMaps = new Set<number>();
  if (instanceTemplate) {
    for (const row of instanceTemplate.rows) {
      const o = rowToObject(instanceTemplate, row);
      instanceMaps.add(num(o.map));
    }
  }
  console.log(`[world] ${instanceMaps.size} instance maps`);

  const dungeonCreatures = new Set<number>();
  const creatureMapMask = new Map<number, number>();
  if (creatureSpawn) {
    for (const row of creatureSpawn.rows) {
      const o = rowToObject(creatureSpawn, row);
      const id = num(o.id);
      const map = num(o.map);
      if (instanceMaps.has(map)) dungeonCreatures.add(id);
      const mapMask = FACTION_EXCLUSIVE_MAPS[map];
      if (mapMask) creatureMapMask.set(id, mapMask);
    }
  }

  const instanceEncounters = tables.get('instance_encounters');
  if (instanceEncounters) {
    for (const row of instanceEncounters.rows) {
      const o = rowToObject(instanceEncounters, row);
      if (num(o.creditType) === 0) {
        const creditEntry = num(o.creditEntry);
        if (creditEntry > 0) dungeonCreatures.add(creditEntry);
      }
    }
  }
  console.log(`[world] ${dungeonCreatures.size} dungeon/instance creature entries, ${creatureMapMask.size} faction-exclusive-map spawns`);

  const { holidayEntries, holidayQuests } = buildHolidaySets(tables);

  const out: ProjectedSource[] = [];
  const itemsCovered = new Set<number>();

  const refMap = buildReferenceMap(tables.get('reference_loot_template'));

  if (creatureLoot) {
    const rows = readLoot(creatureLoot);
    let added = 0;
    for (const r of rows) {
      const c = creatures.get(r.entry);
      if (!c || !c.name) continue;
      const items = lootItems(r, refMap);
      if (items.length === 0) continue;
      const label = levelLabel(c.minLevel, c.maxLevel);
      const isHoliday = holidayEntries.has(r.entry);
      const isDungeon = dungeonCreatures.has(r.entry);
      const stype: ProjectedSource['source_type'] = isHoliday
        ? 'holiday'
        : isDungeon ? 'dungeon' : 'drop';
      const name = label ? `${c.name} (${label})` : c.name;
      const minLevel = appropriateLevel(c.minLevel, c.maxLevel);
      const raceMask = creatureMapMask.get(r.entry) ?? vendorRaceMask(factionAllow, c.faction);
      const chance = r.mincountOrRef < 0 ? null : (r.chance > 0 && r.chance <= 100 ? r.chance / 100 : null);
      for (const item of items) {
        if (!knownItems.has(item)) continue;
        out.push({
          item_id: item,
          source_type: stype,
          source_name: name,
          source_zone: null,
          source_min_level: minLevel,
          drop_chance: chance,
          vendor_cost_copper: null,
          quest_choice_group: null,
          race_mask: raceMask,
        });
        itemsCovered.add(item);
        added++;
      }
    }
    console.log(`[world] ${rows.length} creature_loot rows → ${added} creature sources`);
  }

  const gameobjectLoot = tables.get('gameobject_loot_template');
  if (gameobjectLoot) {
    const goTemplate = tables.get('gameobject_template');
    const goNames = new Map<number, string>();
    if (goTemplate) {
      for (const row of goTemplate.rows) {
        const o = rowToObject(goTemplate, row);
        const id = num(o.entry);
        if (id > 0) goNames.set(id, str(o.name));
      }
    }
    let added = 0;
    for (const r of readLoot(gameobjectLoot)) {
      const items = lootItems(r, refMap);
      if (items.length === 0) continue;
      const name = goNames.get(r.entry) || `Object #${r.entry}`;
      for (const item of items) {
        if (!knownItems.has(item)) continue;
        out.push({
          item_id: item,
          source_type: 'drop',
          source_name: name,
          source_zone: null,
          source_min_level: itemReqLevel.get(item) ?? 1,
          drop_chance: null,
          vendor_cost_copper: null,
          quest_choice_group: null,
          race_mask: 0,
        });
        itemsCovered.add(item);
        added++;
      }
    }
    console.log(`[world] ${added} gameobject (chest/object) sources`);
  }

  const itemLoot = tables.get('item_loot_template');
  if (itemLoot) {
    let added = 0;
    for (const r of readLoot(itemLoot)) {
      for (const item of lootItems(r, refMap)) {
        if (!knownItems.has(item)) continue;
        out.push({
          item_id: item,
          source_type: 'drop',
          source_name: 'Contained in another item',
          source_zone: null,
          source_min_level: itemReqLevel.get(item) ?? 1,
          drop_chance: null,
          vendor_cost_copper: null,
          quest_choice_group: null,
          race_mask: 0,
        });
        itemsCovered.add(item);
        added++;
      }
    }
    console.log(`[world] ${added} item-container sources`);
  }

  if (npcVendor) {
    let added = 0;
    for (const row of npcVendor.rows) {
      const o = rowToObject(npcVendor, row);
      const vendor = num(o.entry);
      const item = num(o.item);
      if (!knownItems.has(item)) continue;
      const c = creatures.get(vendor);
      const name = c?.name ?? `Vendor #${vendor}`;
      const isHoliday = holidayEntries.has(vendor);
      out.push({
        item_id: item,
        source_type: isHoliday ? 'holiday' : 'vendor',
        source_name: name,
        source_zone: null,
        source_min_level: c ? appropriateLevel(c.minLevel, c.maxLevel) : 1,
        drop_chance: null,
        vendor_cost_copper: null,
        quest_choice_group: null,
        race_mask: creatureMapMask.get(vendor) ?? (c ? vendorRaceMask(factionAllow, c.faction) : 0),
      });
      itemsCovered.add(item);
      added++;
    }
    console.log(`[world] ${added} vendor sources`);
  }

  if (questTemplate) {
    const quests = buildIndex<QuestInfo>(questTemplate, 'entry', (o) => ({
      title: str(o.Title),
      minLevel: num(o.MinLevel),
      questLevel: num(o.QuestLevel),
      method: num(o.Method),
    }));

    let added = 0;
    for (const row of questTemplate.rows) {
      const o = rowToObject(questTemplate, row);
      const questId = num(o.entry);
      const q = quests.get(questId);
      if (!q || !q.title) continue;
      if (q.method !== 2) continue;
      const fromQuestLevel = q.questLevel > 0 ? q.questLevel - 5 : 0;
      const minLevel = Math.max(1, Math.max(q.minLevel, fromQuestLevel));
      const choiceItems = new Set<number>();
      for (let i = 1; i <= 6; i++) {
        const it = num(o[`RewChoiceItemId${i}`]);
        if (it > 0) choiceItems.add(it);
      }
      const fixedItems = new Set<number>();
      for (let i = 1; i <= 4; i++) {
        const it = num(o[`RewItemId${i}`]);
        if (it > 0) fixedItems.add(it);
      }

      const choiceGroup = choiceItems.size > 0 ? questId : null;
      const isHoliday = holidayQuests.has(questId);
      const questType: ProjectedSource['source_type'] = isHoliday ? 'holiday' : 'quest';
      const requiredRaces = num(o.RequiredRaces);
      const questRaceMask = requiredRaces > 0 ? requiredRaces : 0;
      for (const item of choiceItems) {
        if (!knownItems.has(item)) continue;
        out.push({
          item_id: item,
          source_type: questType,
          source_name: `Quest: ${q.title} (Lvl ${q.questLevel || minLevel})`,
          source_zone: null,
          source_min_level: minLevel,
          drop_chance: null,
          vendor_cost_copper: null,
          quest_choice_group: choiceGroup,
          race_mask: questRaceMask,
        });
        itemsCovered.add(item);
        added++;
      }
      for (const item of fixedItems) {
        if (!knownItems.has(item)) continue;
        out.push({
          item_id: item,
          source_type: questType,
          source_name: `Quest: ${q.title} (Lvl ${q.questLevel || minLevel})`,
          source_zone: null,
          source_min_level: minLevel,
          drop_chance: null,
          vendor_cost_copper: null,
          quest_choice_group: null,
          race_mask: questRaceMask,
        });
        itemsCovered.add(item);
        added++;
      }
    }
    console.log(`[world] ${added} quest reward sources`);
  }

  const PROFESSION_TABLES: ReadonlyArray<[string, string]> = [
    ['skinning_loot_template', 'Skinning'],
    ['fishing_loot_template', 'Fishing'],
    ['prospecting_loot_template', 'Prospecting'],
    ['disenchant_loot_template', 'Disenchanting'],
  ];
  for (const [tableName, label] of PROFESSION_TABLES) {
    const t = tables.get(tableName);
    if (!t) continue;
    let added = 0;
    for (const row of t.rows) {
      const o = rowToObject(t, row);
      const item = num(o.item);
      if (!knownItems.has(item)) continue;
      const chance = num(o.ChanceOrQuestChance);
      out.push({
        item_id: item,
        source_type: 'profession',
        source_name: label,
        source_zone: null,
        source_min_level: 1,
        drop_chance: chance > 0 && chance <= 100 ? chance / 100 : null,
        vendor_cost_copper: null,
        quest_choice_group: null,
        race_mask: 0,
      });
      itemsCovered.add(item);
      added++;
    }
    console.log(`[world] ${added} ${label.toLowerCase()} sources`);
  }

  const capped = capPerItem(out);
  console.log(`[world] ${out.length} raw sources -> ${capped.length} after cap (max ${MAX_SOURCES_PER_ITEM}/item), covering ${itemsCovered.size} items`);
  return { sources: capped, itemsCovered };
}
