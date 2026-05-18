import type { Spec } from '@wowgear/core';
import { SPEC_BY_CLASS } from '@wowgear/core';
import type { CharState } from '../urlState.js';

interface Props {
  state: CharState;
  onChange: (next: Partial<CharState>) => void;
}

export function FilterBar({ state, onChange }: Props): JSX.Element {
  const specs = SPEC_BY_CLASS[state.cls];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-panel2 border-b border-black/40">
      <Group label="Spec">
        <div className="flex gap-1">
          {specs.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ spec: s as Spec })}
              className={`px-3 py-1.5 text-sm rounded transition ${
                state.spec === s ? 'bg-black/40 ring-1 ring-white/30 text-ink' : 'text-muted hover:text-ink hover:bg-black/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Group>

      <Group label="Level">
        <input
          type="range"
          min={1}
          max={70}
          value={state.level}
          onChange={(e) => onChange({ level: Number(e.target.value) })}
          className="w-40 accent-yellow-400"
        />
        <span className="font-mono text-sm w-8 text-right">{state.level}</span>
      </Group>

      <Group label="Include">
        <Toggle on={state.raid} onClick={() => onChange({ raid: !state.raid })}>raid</Toggle>
        <Toggle on={state.pvp} onClick={() => onChange({ pvp: !state.pvp })}>pvp</Toggle>
        <Toggle on={state.holiday} onClick={() => onChange({ holiday: !state.holiday })}>holiday</Toggle>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded transition ${
        on ? 'bg-black/40 ring-1 ring-white/30 text-ink' : 'text-muted hover:text-ink hover:bg-black/20'
      }`}
    >
      {children}
    </button>
  );
}
