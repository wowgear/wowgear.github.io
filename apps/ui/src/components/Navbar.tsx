import type { Expansion } from '../urlState.js';

interface Props {
  expansion: Expansion;
  onChange: (next: Expansion) => void;
}

const EXPANSIONS: ReadonlyArray<{ id: Expansion; label: string }> = [
  { id: 'vanilla', label: 'Classic' },
  { id: 'tbc', label: 'TBC' },
  { id: 'wotlk', label: 'WotLK' },
];

export function Navbar({ expansion, onChange }: Props): JSX.Element {
  return (
    <header className="h-14 bg-panel2 border-b border-black/40 shrink-0">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-yellow-500/20 ring-1 ring-yellow-400/50" />
          <span className="font-semibold tracking-tight">Wowgear</span>
          <span className="text-muted text-xs">Leveling BiS</span>
        </div>

        <nav className="flex items-center gap-1">
          {EXPANSIONS.map((e) => {
            const active = expansion === e.id;
            return (
              <button
                key={e.id}
                onClick={() => onChange(e.id)}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  active
                    ? 'bg-black/40 ring-1 ring-white/30 text-ink'
                    : 'text-muted hover:text-ink hover:bg-black/20'
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
