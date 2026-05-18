import type { ClassName } from '@wowgear/core';
import { SPEC_BY_CLASS } from '@wowgear/core';

const CLASS_COLORS: Record<ClassName, string> = {
  warrior: '#C79C6E',
  paladin: '#F58CBA',
  hunter:  '#ABD473',
  rogue:   '#FFF569',
  priest:  '#FFFFFF',
  shaman:  '#0070DE',
  mage:    '#69CCF0',
  warlock: '#9482C9',
  druid:   '#FF7D0A',
};

const CLASS_LABELS: Record<ClassName, string> = {
  warrior: 'Warrior',
  paladin: 'Paladin',
  hunter:  'Hunter',
  rogue:   'Rogue',
  priest:  'Priest',
  shaman:  'Shaman',
  mage:    'Mage',
  warlock: 'Warlock',
  druid:   'Druid',
};

const CLASSES = Object.keys(SPEC_BY_CLASS) as ClassName[];

interface Props {
  selected: ClassName;
  onSelect: (cls: ClassName) => void;
}

export function ClassPicker({ selected, onSelect }: Props): JSX.Element {
  return (
    <aside className="w-[180px] shrink-0 bg-panel2 border-r border-black/40 overflow-y-auto">
      <div className="px-3 py-3 text-[10px] uppercase tracking-wide text-muted border-b border-black/40">
        Class
      </div>
      <ul className="p-2 space-y-1">
        {CLASSES.map((c) => {
          const active = c === selected;
          return (
            <li key={c}>
              <button
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left text-sm transition ${
                  active ? 'bg-black/40 ring-1 ring-white/20' : 'hover:bg-black/20'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-sm shrink-0 ring-1 ring-black/60"
                  style={{ backgroundColor: CLASS_COLORS[c] }}
                />
                <span style={{ color: CLASS_COLORS[c] }}>{CLASS_LABELS[c]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
