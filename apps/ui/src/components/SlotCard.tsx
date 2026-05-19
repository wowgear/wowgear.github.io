import { useEffect, useRef, useState } from 'react';
import type { RankedItem } from '@wowgear/core';
import { ItemTooltip } from './ItemTooltip.js';
import type { Expansion } from '../urlState.js';

const QUALITY_CLASS: Record<number, string> = {
  0: 'text-quality-0', 1: 'text-quality-1', 2: 'text-quality-2',
  3: 'text-quality-3', 4: 'text-quality-4', 5: 'text-quality-5',
};

interface Props {
  label: string;
  list: RankedItem[];
  picked: RankedItem | null;
  expansion: Expansion;
  onPick: (item: RankedItem) => void;
}

export function SlotCard({ label, list, picked, expansion, onPick }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIdx(0);
    setOpen(false);
  }, [list]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = list[selectedIdx] ?? list[0];

  if (!selected) {
    return (
      <div className="bg-panel2 border border-black/40 rounded px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
        <div className="text-muted text-xs">no obtainable item</div>
      </div>
    );
  }

  const color = QUALITY_CLASS[selected.item.quality] ?? 'text-ink';
  const hasAlternatives = list.length > 1;
  const isPickedNow = picked?.item.id === selected.item.id;

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex bg-panel2 border rounded overflow-hidden ${
          isPickedNow ? 'border-white/30' : 'border-black/40'
        }`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          onClick={() => onPick(selected)}
          className="flex-1 min-w-0 px-3 py-2 text-left hover:bg-black/30 cursor-pointer"
        >
          <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
          <div className="flex items-baseline gap-2">
            <span className={`truncate text-sm ${color}`}>{selected.item.name}</span>
            <span className="text-[10px] font-mono text-muted shrink-0">{selected.score.toFixed(0)}</span>
          </div>
        </button>
        {hasAlternatives && (
          <button
            type="button"
            aria-label="Show alternatives"
            onClick={() => setOpen((v) => !v)}
            className="px-3 border-l border-black/40 text-muted hover:text-ink hover:bg-black/30 cursor-pointer flex items-center justify-center"
          >
            <span className={`inline-block text-base leading-none transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
          </button>
        )}
      </div>

      {hover && !open && (
        <div className="absolute left-0 top-full z-30 mt-1 pointer-events-none">
          <ItemTooltip item={selected.item} expansion={expansion} />
        </div>
      )}

      {open && hasAlternatives && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-panel border border-black/40 rounded shadow-xl overflow-hidden">
          {list.map((r, i) => {
            const c = QUALITY_CLASS[r.item.quality] ?? 'text-ink';
            const isSel = i === selectedIdx;
            return (
              <li key={r.item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIdx(i);
                    onPick(r);
                    setOpen(false);
                  }}
                  className={`w-full flex items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-black/40 ${
                    isSel ? 'bg-black/30' : ''
                  }`}
                >
                  <span className={`truncate text-sm ${c}`}>{r.item.name}</span>
                  <span className="text-[10px] font-mono text-muted shrink-0">{r.score.toFixed(0)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
