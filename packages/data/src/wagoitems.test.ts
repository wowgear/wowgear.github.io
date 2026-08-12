import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { bestPerSlot, SLOT, type Item, type ItemSource } from '@wowgear/core';
import { readWagoItems } from './wagoitems.js';

const POWER_AMPLIFICATION_GOGGLES_ID = 23761;

test('filters a Wago profession item below its expansion gate', () => {
  mkdirSync('/tmp/agents', { recursive: true });
  const fixtureDirectory = mkdtempSync('/tmp/agents/wowgear-profession-gate-');
  try {
    writeFileSync(
      `${fixtureDirectory}/Item.csv`,
      'ID,ClassID,SubclassID\n23761,4,1\n',
    );
    writeFileSync(
      `${fixtureDirectory}/ItemSparse.csv`,
      [
        'ID,Flags_0,DurationInInventory,Display_lang,ItemLevel,RequiredLevel,RequiredSkill,RequiredSkillRank,OverallQualityID,InventoryType,AllowableClass,AllowableRace,RequiredPVPRank,StatModifier_bonusStat_0,StatModifier_bonusAmount_0,MinDamage_0,MaxDamage_0,ItemDelay',
        '23761,0,0,Power Amplification Goggles,89,0,202,340,3,1,0,0,0,42,36,0,0,0',
        '',
      ].join('\n'),
    );
    writeFileSync(
      `${fixtureDirectory}/ItemEffect.csv`,
      'ParentItemID,SpellID,TriggerType\n',
    );
    writeFileSync(
      `${fixtureDirectory}/SpellEffect.csv`,
      'SpellID,Effect,EffectAura,EffectBasePoints,EffectDieSides,EffectMiscValue_0\n',
    );

    const projected = readWagoItems(fixtureDirectory, 'tbc')
      .find((candidate) => candidate.id === POWER_AMPLIFICATION_GOGGLES_ID);
    expect(projected).toBeDefined();
    if (!projected) return;

    const item: Item = {
      id: projected.id,
      name: projected.name,
      quality: projected.quality,
      item_level: projected.item_level,
      required_level: projected.required_level,
      required_skill: projected.required_skill,
      required_skill_rank: projected.required_skill_rank,
      slot: projected.slot as Item['slot'],
      subclass: projected.subclass,
      class_mask: projected.class_mask,
      stats: JSON.parse(projected.stats_json),
      weapon_min_dmg: projected.weapon_min_dmg,
      weapon_max_dmg: projected.weapon_max_dmg,
      weapon_speed: projected.weapon_speed,
    };
    const source: ItemSource = {
      item_id: POWER_AMPLIFICATION_GOGGLES_ID,
      source_type: 'profession',
      source_name: 'Engineering: Power Amplification Goggles',
      source_zone: null,
      min_player_level_alliance: projected.profession_min_level_alliance,
      min_player_level_horde: projected.profession_min_level_horde,
      drop_chance: null,
      vendor_cost_copper: null,
      quest_choice_group: null,
      source_entity_kind: null,
      source_entity_id: null,
      race_mask: 0,
    };
    const selectedAtLevel = (level: number): number[] => {
      const result = bestPerSlot({
        items: [item],
        sources: new Map([[POWER_AMPLIFICATION_GOGGLES_ID, [source]]]),
        weights: { spellpower: 1 },
        charLevel: level,
        charClass: 'warlock',
        faction: 'alliance',
      });
      return (result[SLOT.Head] ?? []).map((ranked) => ranked.item.id);
    };

    expect(projected).toMatchObject({
      required_skill: 202,
      required_skill_rank: 340,
      profession_min_level_alliance: 50,
      profession_min_level_horde: 50,
    });
    expect(selectedAtLevel(1)).not.toContain(POWER_AMPLIFICATION_GOGGLES_ID);
    expect(selectedAtLevel(49)).not.toContain(POWER_AMPLIFICATION_GOGGLES_ID);
    expect(selectedAtLevel(50)).toContain(POWER_AMPLIFICATION_GOGGLES_ID);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
