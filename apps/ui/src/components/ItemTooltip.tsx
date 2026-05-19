import type { Item } from '@wowgear/core';
import { itemUrl } from '../wowhead.js';
import type { Expansion } from '../urlState.js';

const QUALITY_HEX: Record<number, string> = {
  0: '#9d9d9d', 1: '#ffffff', 2: '#1eff00', 3: '#0070dd', 4: '#a335ee', 5: '#ff8000',
};

const STAT_LABELS: Record<string, string> = {
  str: 'Strength', agi: 'Agility', sta: 'Stamina', int: 'Intellect', spi: 'Spirit',
  ap: 'Attack Power', rap: 'Ranged Attack Power',
  hit_rating: 'Hit Rating', crit_rating: 'Crit Rating', haste_rating: 'Haste Rating',
  expertise_rating: 'Expertise Rating', armor_pen: 'Armor Penetration',
  spellpower: 'Spell Power', sp_arcane: 'Arcane Damage', sp_fire: 'Fire Damage',
  sp_frost: 'Frost Damage', sp_nature: 'Nature Damage', sp_shadow: 'Shadow Damage',
  sp_holy: 'Holy Damage', sp_healing: 'Healing',
  spell_hit_rating: 'Spell Hit Rating', spell_crit_rating: 'Spell Crit Rating',
  spell_haste_rating: 'Spell Haste Rating', spell_penetration: 'Spell Penetration',
  mp5: 'Mana per 5s', armor: 'Armor', defense_rating: 'Defense Rating',
  dodge_rating: 'Dodge Rating', parry_rating: 'Parry Rating',
  block_rating: 'Block Rating', block_value: 'Block Value', resilience: 'Resilience',
  res_arcane: 'Arcane Resistance', res_fire: 'Fire Resistance', res_frost: 'Frost Resistance',
  res_nature: 'Nature Resistance', res_shadow: 'Shadow Resistance', res_holy: 'Holy Resistance',
};

function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}

export function ItemTooltip({ item, expansion }: { item: Item; expansion: Expansion }): JSX.Element {
  const color = QUALITY_HEX[item.quality] ?? '#ffffff';
  return (
    <div className="bg-black/95 border border-white/20 rounded p-3 text-sm min-w-[240px] shadow-xl">
      <a
        href={itemUrl(expansion, item.id)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color }}
        className="font-semibold hover:underline"
      >
        {item.name}
      </a>
      {item.item_level > 0 && (
        <div className="text-muted text-xs">Item Level {item.item_level}</div>
      )}
      {item.required_level > 0 && (
        <div className="text-muted text-xs">Requires Level {item.required_level}</div>
      )}
      {item.weapon_min_dmg != null && item.weapon_max_dmg != null && item.weapon_speed && (
        <div className="mt-1 text-ink text-xs">
          {item.weapon_min_dmg}-{item.weapon_max_dmg} Damage &nbsp; Speed {item.weapon_speed.toFixed(2)}
          <div className="text-muted">
            ({(((item.weapon_min_dmg + item.weapon_max_dmg) / 2) / item.weapon_speed).toFixed(1)} DPS)
          </div>
        </div>
      )}
      <div className="mt-1 text-xs space-y-0.5">
        {Object.entries(item.stats).map(([k, v]) => (
          <div key={k} className="text-green-400">
            +{v} {statLabel(k)}
          </div>
        ))}
      </div>
    </div>
  );
}
