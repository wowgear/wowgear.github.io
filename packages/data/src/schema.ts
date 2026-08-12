import type { Database } from 'bun:sqlite';

export const SCHEMA_SQL = `
CREATE TABLE gear (
  item_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quality INTEGER NOT NULL,
  item_level INTEGER NOT NULL,
  required_level INTEGER NOT NULL,
  required_skill INTEGER NOT NULL,
  required_skill_rank INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  subclass INTEGER NOT NULL,
  class_mask INTEGER NOT NULL,
  race_mask INTEGER NOT NULL,
  stats_json TEXT NOT NULL,
  weapon_min_dmg REAL,
  weapon_max_dmg REAL,
  weapon_speed REAL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_zone TEXT,
  min_player_level_alliance INTEGER,
  min_player_level_horde INTEGER,
  drop_chance REAL,
  vendor_cost_copper INTEGER,
  quest_choice_group INTEGER,
  source_entity_kind TEXT,
  source_entity_id INTEGER
);

CREATE INDEX idx_gear_item ON gear(item_id);
CREATE INDEX idx_gear_alliance ON gear(slot, source_type, min_player_level_alliance);
CREATE INDEX idx_gear_horde ON gear(slot, source_type, min_player_level_horde);
`;

export function createSchema(database: Database): void {
  database.exec(SCHEMA_SQL);
}
