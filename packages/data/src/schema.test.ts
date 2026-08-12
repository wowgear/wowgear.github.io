import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createSchema } from './schema.js';

test('creates one denormalized runtime table', () => {
  const database = new Database(':memory:');
  createSchema(database);

  const tables = database.query<{ name: string }, []>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all();
  const columns = database.query<{ name: string }, []>('PRAGMA table_info(gear)').all();
  database.close();

  expect(tables.map((table) => table.name)).toEqual(['gear']);
  expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
    'item_id',
    'source_type',
    'min_player_level_alliance',
    'min_player_level_horde',
  ]));
});
