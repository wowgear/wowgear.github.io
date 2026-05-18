import { useState } from 'react';
import type { RankedItem } from '@wowgear/core';
import { ItemTooltip } from './ItemTooltip.js';

const QUALITY_CLASS: Record<number, string> = {
  0: 'text-quality-0', 1: 'text-quality-1', 2: 'text-quality-2',
  3: 'text-quality-3', 4: 'text-quality-4', 5: 'text-quality-5',
};

interface Props {
  label: string;
  list: RankedItem[];
  onPick: (item: RankedItem) => void;
}

export function SlotCard({ label, list, onPick }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const top = list[0];

  return (
    <div className="bg-panel2 border border-black/40 rounded p-3 min-h-[68px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
        {list.length > 1 && (
          <button
            className="text-[10px] text-muted hover:text-ink"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'hide' : `+${list.length - 1}`}
          </button>
        )}
      </div>

      {top ? (
        <div className="mt-1 space-y-1">
          <Row r={top} onPick={onPick} />
          {expanded && list.slice(1).map((r) => (
            <Row key={r.item.id} r={r} onPick={onPick} dimmed />
          ))}
        </div>
      ) : (
        <div className="text-muted text-xs mt-2">no obtainable item</div>
      )}
    </div>
  );
}

function Row({ r, onPick, dimmed = false }: { r: RankedItem; onPick: (i: RankedItem) => void; dimmed?: boolean }): JSX.Element {
  const [hover, setHover] = useState(false);
  const color = QUALITY_CLASS[r.item.quality] ?? 'text-ink';
  return (
    <div
      className={`relative cursor-pointer ${dimmed ? 'opacity-70' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onPick(r)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate text-sm ${color}`}>{r.item.name}</span>
        <span className="text-[10px] font-mono text-muted shrink-0">{r.score.toFixed(0)}</span>
      </div>
      {hover && (
        <div className="absolute left-0 top-full z-50 mt-1 pointer-events-none">
          <ItemTooltip item={r.item} />
        </div>
      )}
    </div>
  );
}
