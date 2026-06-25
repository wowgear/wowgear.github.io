import type { Database } from 'bun:sqlite';

export const SCHEMA_SQL = `
CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  quality INTEGER NOT NULL,
  item_level INTEGER NOT NULL,
  required_level INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  subclass INTEGER NOT NULL,
  class_mask INTEGER NOT NULL,
  race_mask INTEGER NOT NULL DEFAULT 0,
  stats_json TEXT NOT NULL,
  weapon_min_dmg REAL,
  weapon_max_dmg REAL,
  weapon_speed REAL,
  expansion INTEGER NOT NULL
);

CREATE TABLE item_sources (
  item_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_zone TEXT,
  source_min_level INTEGER,
  drop_chance REAL,
  vendor_cost_copper INTEGER,
  quest_choice_group INTEGER,
  source_entity_kind TEXT,
  source_entity_id INTEGER,
  race_mask INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX idx_items_slot_req ON items(slot, required_level);
CREATE INDEX idx_sources_item ON item_sources(item_id);
CREATE INDEX idx_sources_min ON item_sources(source_min_level);
`;

export function createSchema(db: Database): void {
  db.exec(SCHEMA_SQL);
}
