import type { Database, SqlJsStatic } from 'sql.js';
import type { Item, ItemSource } from '@wowgear/core';
import type { Expansion } from './urlState.js';

const SQLJS_VERSION = '1.14.1';
const SQLJS_CDN = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist`;

declare global {
  interface Window {
    initSqlJs: ((config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>) | undefined;
  }
}

const dbCache = new Map<Expansion, Promise<Database>>();

export function loadDb(expansion: Expansion): Promise<Database> {
  const cached = dbCache.get(expansion);
  if (cached) return cached;
  const database = open(expansion);
  dbCache.set(expansion, database);
  return database;
}

function loadSqlJsScript(): Promise<void> {
  if (typeof window.initSqlJs === 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${SQLJS_CDN}/sql-wasm.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('failed to load sql.js script'));
    document.head.appendChild(script);
  });
}

async function open(expansion: Expansion): Promise<Database> {
  await loadSqlJsScript();
  if (!window.initSqlJs) throw new Error('initSqlJs missing after script load');
  const SQL = await window.initSqlJs({
    locateFile: (file) => `${SQLJS_CDN}/${file}`,
  });
  const url = `/${expansion}.sqlite`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to fetch ${url}: ${response.status}`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  return new SQL.Database(buffer);
}

export interface DbBundle {
  items: Item[];
  sources: Map<number, ItemSource[]>;
}

function rowObject(columns: string[], values: unknown[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (let index = 0; index < columns.length; index++) row[columns[index]!] = values[index];
  return row;
}

export function loadAll(database: Database): DbBundle {
  const result = database.exec('SELECT * FROM gear');
  const items = new Map<number, Item>();
  const sources = new Map<number, ItemSource[]>();
  if (!result[0]) return { items: [], sources };

  for (const values of result[0].values) {
    const row = rowObject(result[0].columns, values);
    const itemId = row.item_id as number;
    if (!items.has(itemId)) {
      items.set(itemId, {
        id: itemId,
        name: row.name as string,
        quality: row.quality as number,
        item_level: row.item_level as number,
        required_level: row.required_level as number,
        required_skill: row.required_skill as number,
        required_skill_rank: row.required_skill_rank as number,
        slot: row.slot as Item['slot'],
        subclass: row.subclass as number,
        class_mask: row.class_mask as number,
        stats: JSON.parse(row.stats_json as string),
        weapon_min_dmg: row.weapon_min_dmg as number | null,
        weapon_max_dmg: row.weapon_max_dmg as number | null,
        weapon_speed: row.weapon_speed as number | null,
      });
    }
    const source: ItemSource = {
      item_id: itemId,
      source_type: row.source_type as ItemSource['source_type'],
      source_name: row.source_name as string,
      source_zone: row.source_zone as string | null,
      min_player_level_alliance: row.min_player_level_alliance as number | null,
      min_player_level_horde: row.min_player_level_horde as number | null,
      drop_chance: row.drop_chance as number | null,
      vendor_cost_copper: row.vendor_cost_copper as number | null,
      quest_choice_group: row.quest_choice_group as number | null,
      source_entity_kind: (row.source_entity_kind as ItemSource['source_entity_kind'] | undefined) ?? null,
      source_entity_id: (row.source_entity_id as number | null | undefined) ?? null,
      race_mask: (row.race_mask as number | null) ?? 0,
    };
    const itemSources = sources.get(itemId);
    if (itemSources) itemSources.push(source);
    else sources.set(itemId, [source]);
  }

  return { items: [...items.values()], sources };
}
