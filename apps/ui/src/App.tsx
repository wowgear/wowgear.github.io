import { useEffect, useMemo, useState } from 'react';
import {
  bestPerSlot,
  bucketForLevel,
  DISPLAY_SLOTS,
  SLOT,
  weightsFor,
  type ItemSource,
  type RankedItem,
} from '@wowgear/core';
import { loadAll, loadDb, type DbBundle } from './db.js';
import { useUrlState } from './urlState.js';
import { Navbar } from './components/Navbar.js';
import { ClassPicker } from './components/ClassPicker.js';
import { FilterBar } from './components/FilterBar.js';
import { SlotCard } from './components/SlotCard.js';
import { ItemDetailsPanel } from './components/ItemDetailsPanel.js';

const SLOT_LABELS: Record<number, string> = {
  [SLOT.Head]: 'Head',
  [SLOT.Neck]: 'Neck',
  [SLOT.Shoulder]: 'Shoulder',
  [SLOT.Back]: 'Back',
  [SLOT.Chest]: 'Chest',
  [SLOT.Wrist]: 'Wrist',
  [SLOT.Hands]: 'Hands',
  [SLOT.Waist]: 'Waist',
  [SLOT.Legs]: 'Legs',
  [SLOT.Feet]: 'Feet',
  [SLOT.Finger]: 'Finger',
  [SLOT.Trinket]: 'Trinket',
  [SLOT.MainHand]: 'Main Hand',
  [SLOT.OffHand]: 'Off Hand',
  [SLOT.Ranged]: 'Ranged',
};

const PAPER_DOLL_LAYOUT: ReadonlyArray<readonly [number, number, number]> = [
  [SLOT.Head, 1, 1],
  [SLOT.Neck, 2, 1],
  [SLOT.Shoulder, 1, 2],
  [SLOT.Back, 2, 2],
  [SLOT.Chest, 1, 3],
  [SLOT.Wrist, 2, 3],
  [SLOT.Hands, 1, 4],
  [SLOT.Waist, 2, 4],
  [SLOT.Legs, 1, 5],
  [SLOT.Feet, 2, 5],
  [SLOT.Finger, 1, 6],
  [SLOT.Trinket, 2, 6],
  [SLOT.MainHand, 1, 7],
  [SLOT.OffHand, 2, 7],
  [SLOT.Ranged, 1, 8],
];

export function App(): JSX.Element {
  const [state, update] = useUrlState();
  const [bundle, setBundle] = useState<DbBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<RankedItem | null>(null);

  useEffect(() => {
    setBundle(null);
    setError(null);
    setPicked(null);
    loadDb(state.expansion)
      .then((db) => setBundle(loadAll(db)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [state.expansion]);

  const filteredSources = useMemo(() => {
    if (!bundle) return null;
    const out = new Map<number, ItemSource[]>();
    for (const [id, list] of bundle.sources) {
      const kept = list.filter((s) => {
        if (s.source_type === 'raid' && !state.raid) return false;
        if (s.source_type === 'pvp' && !state.pvp) return false;
        if (s.source_type === 'holiday' && !state.holiday) return false;
        return true;
      });
      if (kept.length > 0) out.set(id, kept);
    }
    return out;
  }, [bundle, state.raid, state.pvp, state.holiday]);

  const results = useMemo(() => {
    if (!bundle || !filteredSources) return null;
    let weights;
    try { weights = weightsFor(state.cls, state.spec, bucketForLevel(state.level)); }
    catch { return null; }
    return bestPerSlot({
      items: bundle.items,
      sources: filteredSources,
      weights,
      charLevel: state.level,
      charClass: state.cls,
    });
  }, [bundle, filteredSources, state]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar
        expansion={state.expansion}
        onChange={(exp) => update({ expansion: exp })}
      />

      <div className="flex-1 flex overflow-hidden w-full max-w-6xl mx-auto">
        <ClassPicker
          selected={state.cls}
          expansion={state.expansion}
          onSelect={(cls) => update({ cls })}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <FilterBar state={state} onChange={update} />

          <div className="flex-1 overflow-y-auto p-4">
            {error && <div className="text-red-400">DB error: {error}</div>}
            {!bundle && !error && <div className="text-muted">loading data…</div>}
            {results && (
              <div className="grid grid-cols-2 gap-3 max-w-[760px] mx-auto">
                {DISPLAY_SLOTS.map((slot) => {
                  const layout = PAPER_DOLL_LAYOUT.find(([s]) => s === slot);
                  if (!layout) return null;
                  const [, col, row] = layout;
                  return (
                    <div key={slot} style={{ gridColumn: col, gridRow: row }}>
                      <SlotCard
                        label={SLOT_LABELS[slot] ?? String(slot)}
                        list={results[slot] ?? []}
                        picked={picked}
                        expansion={state.expansion}
                        onPick={setPicked}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <ItemDetailsPanel picked={picked} expansion={state.expansion} />
      </div>
    </div>
  );
}
