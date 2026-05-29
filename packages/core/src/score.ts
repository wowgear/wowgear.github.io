import type { Item, StatKey, StatWeights } from './types.js';

export function scoreItem(item: Item, weights: StatWeights): number {
  let score = 0;

  for (const [key, value] of Object.entries(item.stats) as [StatKey, number | undefined][]) {
    if (value == null) continue;
    const w = weights[key];
    if (w) score += value * w;
  }

  const dpsW = weights.weapon_dps ?? 0;
  if (dpsW && item.weapon_min_dmg != null && item.weapon_max_dmg != null && item.weapon_speed) {
    const dps = ((item.weapon_min_dmg + item.weapon_max_dmg) / 2) / item.weapon_speed;
    score += dps * dpsW;
  }

  return score;
}
