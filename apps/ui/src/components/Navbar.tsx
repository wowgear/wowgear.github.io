const EXPANSIONS = [
  { id: 'classic', label: 'Classic', enabled: false },
  { id: 'tbc', label: 'TBC', enabled: true },
  { id: 'wotlk', label: 'WotLK', enabled: false },
] as const;

export function Navbar(): JSX.Element {
  return (
    <header className="h-14 bg-panel2 border-b border-black/40 shrink-0">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-yellow-500/20 ring-1 ring-yellow-400/50" />
          <span className="font-semibold tracking-tight">Wowgear</span>
          <span className="text-muted text-xs">Leveling BiS</span>
        </div>

        <nav className="flex items-center gap-1">
          {EXPANSIONS.map((e) => (
            <button
              key={e.id}
              disabled={!e.enabled}
              className={`px-3 py-1.5 text-sm rounded transition ${
                e.enabled
                  ? 'bg-black/40 ring-1 ring-white/30 text-ink'
                  : 'text-muted/60 cursor-not-allowed'
              }`}
            >
              {e.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
