import type { Spec } from '@wowgear/core';
import { SPEC_BY_CLASS } from '@wowgear/core';
import { LEVEL_CAP, type CharState } from '../urlState.js';

interface Props {
  state: CharState;
  onChange: (next: Partial<CharState>) => void;
}

export function FilterBar({ state, onChange }: Props): JSX.Element {
  const specs = SPEC_BY_CLASS[state.cls];

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-panel2 border-b border-black/40">
      <div className="flex items-center gap-1">
        <FactionToggle
          label="alliance"
          active={state.faction === 'alliance'}
          color="#3FC7EB"
          onClick={() => onChange({ faction: state.faction === 'alliance' ? 'any' : 'alliance' })}
        />
        <FactionToggle
          label="horde"
          active={state.faction === 'horde'}
          color="#E5343C"
          onClick={() => onChange({ faction: state.faction === 'horde' ? 'any' : 'horde' })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-1">
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

        <Group label="Level">
          <input
            type="range"
            min={1}
            max={LEVEL_CAP[state.expansion]}
            value={state.level}
            onChange={(e) => onChange({ level: Number(e.target.value) })}
            className="w-40 accent-yellow-400"
          />
          <span className="font-mono text-sm w-8 text-right">{state.level}</span>
        </Group>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Toggle on={state.drop} onClick={() => onChange({ drop: !state.drop })}>drop</Toggle>
        <Toggle on={state.dungeon} onClick={() => onChange({ dungeon: !state.dungeon })}>dungeon</Toggle>
        <Toggle on={state.quest} onClick={() => onChange({ quest: !state.quest })}>quest</Toggle>
        <Toggle on={state.vendor} onClick={() => onChange({ vendor: !state.vendor })}>vendor</Toggle>
        <Toggle on={state.profession} onClick={() => onChange({ profession: !state.profession })}>profession</Toggle>
        <Toggle on={state.raid} onClick={() => onChange({ raid: !state.raid })}>raid</Toggle>
        <Toggle on={state.pvp} onClick={() => onChange({ pvp: !state.pvp })}>pvp</Toggle>
        <Toggle on={state.holiday} onClick={() => onChange({ holiday: !state.holiday })}>holiday</Toggle>
      </div>
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

function FactionToggle({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={active ? { color, borderColor: color } : undefined}
      className={`px-3 py-1.5 text-sm rounded border transition ${
        active ? 'bg-black/40 ring-1' : 'border-transparent text-muted hover:text-ink hover:bg-black/20'
      }`}
    >
      {label}
    </button>
  );
}
