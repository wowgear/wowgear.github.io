import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readAttSources } from './attsource.js';
import { flattenGearRecords } from './cli/build.js';
import type { ProjectedItem } from './project.js';

const WEATHER_BEATEN_FISHING_HAT_ID = 33820;
const BAG_OF_FISHING_TREASURES_ID = 34863;
const POWER_AMPLIFICATION_GOGGLES_ID = 23761;

function projectedItem(
  id: number,
  requiredSkill: number,
  requiredSkillRank: number,
  professionLevel: number | null,
): ProjectedItem {
  return {
    id,
    name: `Item #${id}`,
    quality: 3,
    item_level: 1,
    required_level: 0,
    required_skill: requiredSkill,
    required_skill_rank: requiredSkillRank,
    profession_min_level_alliance: professionLevel,
    profession_min_level_horde: professionLevel,
    slot: 1,
    subclass: 1,
    class_mask: 0,
    race_mask: 0,
    stats_json: '{"spellpower":1}',
    weapon_min_dmg: null,
    weapon_max_dmg: null,
    weapon_speed: null,
    flags: 0,
    duration: 0,
  };
}

function branchingQuestData(depth: number, itemId: number): string {
  const quests: string[] = [];
  for (let id = 1; id <= depth; id++) {
    const sourceQuests = id === depth ? '' : `sourceQuests={${id + 1},${id + 1}},`;
    const level = id === depth ? 'lvl=60,' : '';
    const reward = id === 1 ? `g={i(${itemId},{})},` : '';
    quests.push(`q(${id},{${level}${sourceQuests}${reward}})`);
  }
  return `categories.Zones=m(1,{g={${quests.join(',')}}});\n`;
}

test('flattens ATT container and profession gates into acquisition paths', () => {
  mkdirSync('/tmp/agents', { recursive: true });
  const directory = mkdtempSync('/tmp/agents/wowgear-att-source-');
  const tbcDirectory = `${directory}/db/TBC`;
  const categoriesDirectory = `${tbcDirectory}/Categories`;
  mkdirSync(categoriesDirectory, { recursive: true });

  try {
    writeFileSync(
      `${tbcDirectory}/Database.xml`,
      [
        '<Ui>',
        '  <Script file="Categories/Zones.lua"/>',
        '  <Script file="Categories/Craftables.lua"/>',
        '</Ui>',
      ].join('\n'),
    );
    writeFileSync(
      `${categoriesDirectory}/Zones.lua`,
      [
        'categories.Zones=m(1952,{g={',
        `h(-45,{g={q(11666,{g={i(${BAG_OF_FISHING_TREASURES_ID},{})}})}}),`,
        `ah(${BAG_OF_FISHING_TREASURES_ID},{g={i(${WEATHER_BEATEN_FISHING_HAT_ID},{})}})`,
        '}});',
      ].join('\n'),
    );
    writeFileSync(
      `${categoriesDirectory}/Craftables.lua`,
      `categories.Craftables=prof(202,{g={h(-88,{g={s(144655,34847,{learnedAt=350,lvl=70,requireSkill=202}),toy(30542,{lvl=70}),s(134148,${POWER_AMPLIFICATION_GOGGLES_ID},{learnedAt=340,requireSkill=202}),s(144937,35181,{learnedAt=350,lvl=70,requireSkill=202})}})}});\n`,
    );

    const result = readAttSources(
      directory,
      'tbc',
      new Set([WEATHER_BEATEN_FISHING_HAT_ID, POWER_AMPLIFICATION_GOGGLES_ID]),
    );

    expect(result.sources).toContainEqual(expect.objectContaining({
      item_id: WEATHER_BEATEN_FISHING_HAT_ID,
      source_type: 'quest',
      source_entity_kind: 'quest',
      source_entity_id: 11666,
      min_player_level_alliance: 70,
      min_player_level_horde: 70,
    }));
    expect(result.sources).toContainEqual(expect.objectContaining({
      item_id: POWER_AMPLIFICATION_GOGGLES_ID,
      source_type: 'profession',
      min_player_level_alliance: 50,
      min_player_level_horde: 50,
    }));

    const records = flattenGearRecords(
      [
        projectedItem(WEATHER_BEATEN_FISHING_HAT_ID, 0, 0, null),
        projectedItem(POWER_AMPLIFICATION_GOGGLES_ID, 202, 340, 50),
      ],
      result.sources,
    );
    expect(records).toContainEqual(expect.objectContaining({
      item: expect.objectContaining({ id: WEATHER_BEATEN_FISHING_HAT_ID }),
      allianceLevel: 70,
      hordeLevel: 70,
    }));
    expect(records).toContainEqual(expect.objectContaining({
      item: expect.objectContaining({ id: POWER_AMPLIFICATION_GOGGLES_ID }),
      allianceLevel: 50,
      hordeLevel: 50,
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('memoizes shared quest prerequisites', () => {
  mkdirSync('/tmp/agents', { recursive: true });
  const directory = mkdtempSync('/tmp/agents/wowgear-att-quest-dag-');
  const tbcDirectory = `${directory}/db/TBC`;
  const categoriesDirectory = `${tbcDirectory}/Categories`;
  const itemId = 99999;
  mkdirSync(categoriesDirectory, { recursive: true });

  try {
    writeFileSync(
      `${tbcDirectory}/Database.xml`,
      '<Ui><Script file="Categories/Zones.lua"/></Ui>',
    );
    writeFileSync(`${categoriesDirectory}/Zones.lua`, branchingQuestData(26, itemId));

    const result = readAttSources(directory, 'tbc', new Set([itemId]));

    expect(result.sources).toContainEqual(expect.objectContaining({
      item_id: itemId,
      source_type: 'quest',
      min_player_level_alliance: 60,
      min_player_level_horde: 60,
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
