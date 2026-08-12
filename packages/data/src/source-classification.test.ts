import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { resolve } from 'node:path';
import { bestPerSlot, SLOT, type Item, type ItemSource } from '@wowgear/core';

const POWER_AMPLIFICATION_GOGGLES_ID = 23761;

test('removes Power Amplification Goggles when profession sources are disabled', () => {
  const databasePath = resolve(import.meta.dir, '../../../apps/ui/public/tbc.sqlite');
  const database = new Database(databasePath, { readonly: true });
  const rows = database.query<{
    item_id: number;
    name: string;
    quality: number;
    item_level: number;
    required_level: number;
    required_skill: number;
    required_skill_rank: number;
    slot: number;
    subclass: number;
    class_mask: number;
    race_mask: number;
    stats_json: string;
    weapon_min_dmg: number | null;
    weapon_max_dmg: number | null;
    weapon_speed: number | null;
    source_type: ItemSource['source_type'];
    source_name: string;
    source_zone: string | null;
    min_player_level_alliance: number | null;
    min_player_level_horde: number | null;
    drop_chance: number | null;
    vendor_cost_copper: number | null;
    quest_choice_group: number | null;
    source_entity_kind: ItemSource['source_entity_kind'];
    source_entity_id: number | null;
  }, [number]>('SELECT * FROM gear WHERE item_id = ?').all(POWER_AMPLIFICATION_GOGGLES_ID);
  database.close();

  expect(rows.length).toBeGreaterThan(0);
  const row = rows[0];
  if (!row) return;

  const item: Item = {
    id: row.item_id,
    name: row.name,
    quality: row.quality,
    item_level: row.item_level,
    required_level: row.required_level,
    required_skill: row.required_skill,
    required_skill_rank: row.required_skill_rank,
    slot: row.slot as Item['slot'],
    subclass: row.subclass,
    class_mask: row.class_mask,
    stats: JSON.parse(row.stats_json),
    weapon_min_dmg: row.weapon_min_dmg,
    weapon_max_dmg: row.weapon_max_dmg,
    weapon_speed: row.weapon_speed,
  };
  const allSources: ItemSource[] = rows.map((source) => ({
    item_id: source.item_id,
    source_type: source.source_type,
    source_name: source.source_name,
    source_zone: source.source_zone,
    min_player_level_alliance: source.min_player_level_alliance,
    min_player_level_horde: source.min_player_level_horde,
    drop_chance: source.drop_chance,
    vendor_cost_copper: source.vendor_cost_copper,
    quest_choice_group: source.quest_choice_group,
    source_entity_kind: source.source_entity_kind,
    source_entity_id: source.source_entity_id,
    race_mask: source.race_mask,
  }));
  expect(allSources).toContainEqual(expect.objectContaining({
    source_type: 'profession',
    min_player_level_alliance: 50,
    min_player_level_horde: 50,
  }));
  const enabledSources = allSources.filter((source) => source.source_type !== 'profession');
  const result = bestPerSlot({
    items: [item],
    sources: enabledSources.length === 0
      ? new Map()
      : new Map([[POWER_AMPLIFICATION_GOGGLES_ID, enabledSources]]),
    weights: { spellpower: 1 },
    charLevel: 50,
    charClass: 'warlock',
    faction: 'alliance',
  });

  expect((result[SLOT.Head] ?? []).map((ranked) => ranked.item.id))
    .not.toContain(POWER_AMPLIFICATION_GOGGLES_ID);
});
