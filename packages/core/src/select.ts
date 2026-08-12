import { scoreItem } from './score.js';
import {
  allowedArmorSubclass,
  ALLOWED_WEAPON_SUBCLASS,
  ARMOR_SLOTS,
  ARMOR_SUBCLASS,
  CLASS_MASK,
  DISPLAY_SLOTS,
  raceMaskAllows,
  RELIC_BY_CLASS,
  SHIELD_CLASSES,
  SLOT,
  WEAPON_SLOTS,
  type ClassName,
  type Faction,
  type Item,
  type ItemSource,
  type RankedItem,
  type Slot,
  type StatWeights,
} from './types.js';

export interface BestPerSlotArgs {
  items: Item[];
  sources: Map<number, ItemSource[]>;
  weights: StatWeights;
  charLevel: number;
  charClass: ClassName;
  faction: Faction;
  topN?: number;
}

const TOP_N_DEFAULT = 3;

const SLOT_GROUPS: Record<number, Slot[]> = {
  [SLOT.Chest]:    [SLOT.Chest, SLOT.Robe],
  [SLOT.MainHand]: [SLOT.MainHand, SLOT.Weapon, SLOT.TwoHand],
  [SLOT.OffHand]:  [SLOT.OffHand,  SLOT.Weapon, SLOT.Holdable, SLOT.Shield],
  [SLOT.Ranged]:   [SLOT.Ranged, SLOT.RangedRight, SLOT.Thrown, SLOT.Relic],
};

function isEquippable(item: Item, charLevel: number, classBit: number, cls: ClassName, armorOk: ReadonlySet<number>): boolean {
  if (item.required_level > charLevel) return false;
  if (item.class_mask !== 0 && (item.class_mask & classBit) === 0) return false;
  if (WEAPON_SLOTS.has(item.slot) && !ALLOWED_WEAPON_SUBCLASS[cls].has(item.subclass)) return false;
  if (ARMOR_SLOTS.has(item.slot) && !armorOk.has(item.subclass)) return false;
  if (item.slot === SLOT.Shield) {
    if (!SHIELD_CLASSES.has(cls)) return false;
    if (item.subclass !== ARMOR_SUBCLASS.Shield) return false;
  }
  if (item.slot === SLOT.OffHand && item.subclass === ARMOR_SUBCLASS.Shield) {
    return false;
  }
  if (item.slot === SLOT.Relic) {
    const want = RELIC_BY_CLASS[cls];
    if (want == null || item.subclass !== want) return false;
  }
  return true;
}

function minimumPlayerLevel(source: ItemSource, faction: Faction): number | null {
  if (faction === 'alliance') return source.min_player_level_alliance;
  if (faction === 'horde') return source.min_player_level_horde;
  const alliance = source.min_player_level_alliance;
  const horde = source.min_player_level_horde;
  if (alliance == null) return horde;
  if (horde == null) return alliance;
  return Math.min(alliance, horde);
}

function isObtainable(sources: ItemSource[] | undefined, charLevel: number, faction: Faction): boolean {
  if (!sources || sources.length === 0) return false;
  for (const s of sources) {
    const minimumLevel = minimumPlayerLevel(s, faction);
    if (minimumLevel == null || minimumLevel > charLevel) continue;
    if (!raceMaskAllows(s.race_mask, faction)) continue;
    return true;
  }
  return false;
}

function dedupeByQuestChoice(ranked: RankedItem[]): RankedItem[] {
  const seenGroups = new Set<number>();
  const seenNames = new Set<string>();
  const out: RankedItem[] = [];
  for (const r of ranked) {
    const group = r.sources.find((s) => s.quest_choice_group != null)?.quest_choice_group;
    if (group != null) {
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
    }
    if (seenNames.has(r.item.name)) continue;
    seenNames.add(r.item.name);
    out.push(r);
  }
  return out;
}

function rank(list: RankedItem[], topN: number): RankedItem[] {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  return dedupeByQuestChoice(sorted).slice(0, topN);
}

export function bestPerSlot(args: BestPerSlotArgs): Record<number, RankedItem[]> {
  const { items, sources, weights, charLevel, charClass, faction, topN = TOP_N_DEFAULT } = args;
  const classBit = CLASS_MASK[charClass];

  const byDisplaySlot = new Map<Slot, RankedItem[]>();
  for (const ds of DISPLAY_SLOTS) byDisplaySlot.set(ds, []);

  const armorOk = allowedArmorSubclass(charClass, charLevel);

  for (const item of items) {
    if (!isEquippable(item, charLevel, classBit, charClass, armorOk)) continue;
    const itemSources = sources.get(item.id);
    if (!isObtainable(itemSources, charLevel, faction)) continue;

    const score = scoreItem(item, weights);
    if (score <= 0) continue;

    const ranked: RankedItem = { item, score, sources: itemSources ?? [] };

    for (const ds of DISPLAY_SLOTS) {
      const group = SLOT_GROUPS[ds] ?? [ds];
      if (group.includes(item.slot)) {
        byDisplaySlot.get(ds)!.push(ranked);
      }
    }
  }

  const result: Record<number, RankedItem[]> = {};
  for (const [slot, list] of byDisplaySlot) {
    if (slot === SLOT.MainHand || slot === SLOT.OffHand) continue;
    result[slot] = rank(list, topN);
  }

  // A two-hander occupies both hands, so the weapon recommendation is the better of two
  // configurations: best two-hander alone, or best one-hander + best off-hand. Present the winner.
  const mh = byDisplaySlot.get(SLOT.MainHand)!;
  const twoHand = rank(mh.filter((r) => r.item.slot === SLOT.TwoHand), topN);
  const oneHand = rank(mh.filter((r) => r.item.slot !== SLOT.TwoHand), topN);
  const offHand = rank(byDisplaySlot.get(SLOT.OffHand)!, topN);

  const twoHandScore = twoHand[0]?.score ?? -Infinity;
  const oneHandScore = oneHand[0]?.score ?? -Infinity;
  const offHandScore = offHand[0]?.score ?? 0;
  const oneHandConfig = oneHandScore === -Infinity ? -Infinity : oneHandScore + offHandScore;

  if (oneHandConfig > twoHandScore) {
    result[SLOT.MainHand] = oneHand;
    result[SLOT.OffHand] = offHand;
  } else {
    result[SLOT.MainHand] = twoHand;
    result[SLOT.OffHand] = [];
  }

  return result;
}
