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

const REPO_URL = 'https://github.com/wowgear/wowgear.github.io';
const ISSUE_URL = `${REPO_URL}/issues/new`;

export function Navbar({ expansion, onChange }: Props): JSX.Element {
  return (
    <header className="h-14 bg-panel2 border-b border-black/40 shrink-0">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-yellow-500/20 ring-1 ring-yellow-400/50" />
          <span className="font-semibold tracking-tight">Wowgear</span>
          <span className="text-muted text-xs">Leveling BiS</span>
        </div>

        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-3 pl-3 border-l border-black/40">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition text-muted hover:text-ink hover:bg-black/20"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              GitHub
            </a>
            <a
              href={ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted hover:text-ink transition"
            >
              Report an issue
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
