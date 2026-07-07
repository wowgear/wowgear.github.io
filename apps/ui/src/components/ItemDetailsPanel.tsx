import type { Faction, ItemSource, RankedItem } from '@wowgear/core';
import { raceMaskAllows } from '@wowgear/core';
import { CopyButton } from './CopyButton.js';
import { ItemTooltip } from './ItemTooltip.js';
import { sourceUrl } from '../wowhead.js';
import type { Expansion } from '../urlState.js';

interface Props {
  picked: RankedItem | null;
  expansion: Expansion;
  faction: Faction;
}

function formatCopper(copper: number): string {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`);
  if (s || g) parts.push(`${s}s`);
  parts.push(`${c}c`);
  return parts.join(' ');
}

const SOURCE_ORDER: Record<ItemSource['source_type'], number> = {
  quest: 0, vendor: 1, drop: 2, dungeon: 3, profession: 4, craft: 5, raid: 6, pvp: 7, holiday: 8,
};

function dedupeSources(sources: ItemSource[]): ItemSource[] {
  const seen = new Map<string, ItemSource>();
  for (const s of sources) {
    const key = `${s.source_type}|${s.source_name}|${s.source_zone ?? ''}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, s); continue; }
    if ((s.drop_chance ?? 0) > (existing.drop_chance ?? 0)) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) => {
    const ord = SOURCE_ORDER[a.source_type] - SOURCE_ORDER[b.source_type];
    if (ord !== 0) return ord;
    return (a.source_min_level ?? 0) - (b.source_min_level ?? 0);
  });
}

export function ItemDetailsPanel({ picked, expansion, faction }: Props): JSX.Element {
  return (
    <aside className="w-[360px] shrink-0 bg-panel2 border-l border-black/40 flex flex-col">
      <div className="px-4 py-3 text-[10px] uppercase tracking-wide text-muted border-b border-black/40 shrink-0">
        Item details
      </div>

      {!picked ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-muted text-sm">Select an item to see details and sources</p>
        </div>
      ) : (
        <Body picked={picked} expansion={expansion} faction={faction} />
      )}
    </aside>
  );
}

function Body({ picked, expansion, faction }: { picked: RankedItem; expansion: Expansion; faction: Faction }): JSX.Element {
  const sources = dedupeSources(picked.sources.filter((s) => raceMaskAllows(s.race_mask, faction)));
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 shrink-0 relative">
        <ItemTooltip item={picked.item} expansion={expansion} />
        <CopyButton text={picked.item.name} className="absolute top-5 right-5 p-1" />
      </div>
      <div className="px-4 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted shrink-0">
        Sources
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {sources.length === 0 && <div className="text-muted text-sm px-1">no known sources</div>}
        {sources.map((s, i) => {
          const url = sourceUrl(expansion, s, picked.item.id);
          return (
            <div key={i} className="bg-panel rounded p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="capitalize text-yellow-300/90">{s.source_type}</span>
                {s.source_min_level != null && (
                  <span className="text-muted text-xs">lvl {s.source_min_level}+</span>
                )}
              </div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:underline hover:text-yellow-200"
                >
                  {s.source_name}
                </a>
              ) : (
                <span className="text-muted italic">{s.source_name}</span>
              )}
              {s.source_zone && <div className="text-muted text-xs">{s.source_zone}</div>}
              <div className="flex gap-3 text-xs text-muted mt-1">
                {s.drop_chance != null && <span>{(s.drop_chance * 100).toFixed(1)}% drop</span>}
                {s.vendor_cost_copper != null && <span>{formatCopper(s.vendor_cost_copper)}</span>}
                {s.quest_choice_group != null && <span>choice #{s.quest_choice_group}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
