import type { Database, SqlJsStatic } from 'sql.js';
import type { Item, ItemSource } from '@wowgear/core';

const SQLJS_VERSION = '1.14.1';
const SQLJS_CDN = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist`;

declare global {
  interface Window {
    initSqlJs: ((config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>) | undefined;
  }
}

let dbPromise: Promise<Database> | null = null;

export function loadDb(): Promise<Database> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

function loadSqlJsScript(): Promise<void> {
  if (typeof window.initSqlJs === 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${SQLJS_CDN}/sql-wasm.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load sql.js script'));
    document.head.appendChild(s);
  });
}

async function open(): Promise<Database> {
  await loadSqlJsScript();
  if (!window.initSqlJs) throw new Error('initSqlJs missing after script load');
  const SQL = await window.initSqlJs({
    locateFile: (file) => `${SQLJS_CDN}/${file}`,
  });
  const res = await fetch('/tbc.sqlite');
  if (!res.ok) throw new Error(`failed to fetch /tbc.sqlite: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return new SQL.Database(buf);
}

export interface DbBundle {
  items: Item[];
  sources: Map<number, ItemSource[]>;
}

export function loadAll(db: Database): DbBundle {
  const items: Item[] = [];
  const itemsRes = db.exec('SELECT * FROM items');
  if (itemsRes[0]) {
    const cols = itemsRes[0].columns;
    for (const row of itemsRes[0].values) {
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      items.push({
        id: obj.id as number,
        name: obj.name as string,
        quality: obj.quality as number,
        item_level: obj.item_level as number,
        required_level: obj.required_level as number,
        slot: obj.slot as Item['slot'],
        subclass: obj.subclass as number,
        class_mask: obj.class_mask as number,
        stats: JSON.parse(obj.stats_json as string),
        weapon_min_dmg: obj.weapon_min_dmg as number | null,
        weapon_max_dmg: obj.weapon_max_dmg as number | null,
        weapon_speed: obj.weapon_speed as number | null,
        expansion: (obj.expansion === 2 ? 2 : 1) as Item['expansion'],
      });
    }
  }

  const sources = new Map<number, ItemSource[]>();
  const srcRes = db.exec('SELECT * FROM item_sources');
  if (srcRes[0]) {
    const cols = srcRes[0].columns;
    for (const row of srcRes[0].values) {
      const obj: Record<string, unknown> = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      const s: ItemSource = {
        item_id: obj.item_id as number,
        source_type: obj.source_type as ItemSource['source_type'],
        source_name: obj.source_name as string,
        source_zone: obj.source_zone as string | null,
        source_min_level: obj.source_min_level as number | null,
        drop_chance: obj.drop_chance as number | null,
        vendor_cost_copper: obj.vendor_cost_copper as number | null,
        quest_choice_group: obj.quest_choice_group as number | null,
      };
      const list = sources.get(s.item_id);
      if (list) list.push(s);
      else sources.set(s.item_id, [s]);
    }
  }
  return { items, sources };
}
