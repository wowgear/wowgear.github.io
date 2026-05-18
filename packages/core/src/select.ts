import { scoreItem } from './score.js';
import {
  allowedArmorSubclass,
  ALLOWED_WEAPON_SUBCLASS,
  ARMOR_SLOTS,
  ARMOR_SUBCLASS,
  CLASS_MASK,
  DISPLAY_SLOTS,
  RELIC_BY_CLASS,
  SHIELD_CLASSES,
  SLOT,
  WEAPON_SLOTS,
  type ClassName,
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

function isObtainable(sources: ItemSource[] | undefined, charLevel: number): boolean {
  if (!sources || sources.length === 0) return false;
  for (const s of sources) {
    if (s.source_min_level == null || s.source_min_level <= charLevel) return true;
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

export function bestPerSlot(args: BestPerSlotArgs): Record<number, RankedItem[]> {
  const { items, sources, weights, charLevel, charClass, topN = TOP_N_DEFAULT } = args;
  const classBit = CLASS_MASK[charClass];

  const byDisplaySlot = new Map<Slot, RankedItem[]>();
  for (const ds of DISPLAY_SLOTS) byDisplaySlot.set(ds, []);

  const armorOk = allowedArmorSubclass(charClass, charLevel);

  for (const item of items) {
    if (!isEquippable(item, charLevel, classBit, charClass, armorOk)) continue;
    const itemSources = sources.get(item.id);
    if (!isObtainable(itemSources, charLevel)) continue;

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
    list.sort((a, b) => b.score - a.score);
    result[slot] = dedupeByQuestChoice(list).slice(0, topN);
  }
  return result;
}
