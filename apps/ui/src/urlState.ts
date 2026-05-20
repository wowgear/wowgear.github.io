import { useEffect, useState } from 'react';
import type { ClassName, Spec } from '@wowgear/core';
import { CLASS_MIN_LEVEL, SPEC_BY_CLASS } from '@wowgear/core';

export type Expansion = 'vanilla' | 'tbc' | 'wotlk';

export const LEVEL_CAP: Record<Expansion, number> = { vanilla: 60, tbc: 70, wotlk: 80 };

const EXPANSIONS: ReadonlySet<Expansion> = new Set(['vanilla', 'tbc', 'wotlk']);

const EXPANSION_ORDER: Expansion[] = ['vanilla', 'tbc', 'wotlk'];

const CLASS_EXPANSION_MIN: Partial<Record<ClassName, Expansion>> = {
  deathknight: 'wotlk',
};

function isClassAvailable(cls: ClassName, exp: Expansion): boolean {
  const min = CLASS_EXPANSION_MIN[cls];
  if (!min) return true;
  return EXPANSION_ORDER.indexOf(exp) >= EXPANSION_ORDER.indexOf(min);
}

export interface CharState {
  expansion: Expansion;
  cls: ClassName;
  spec: Spec;
  level: number;
  drop: boolean;
  dungeon: boolean;
  quest: boolean;
  vendor: boolean;
  profession: boolean;
  raid: boolean;
  pvp: boolean;
  holiday: boolean;
}

const DEFAULT: CharState = {
  expansion: 'vanilla',
  cls: 'rogue', spec: 'combat', level: 22,
  drop: true, dungeon: true, quest: true, vendor: true, profession: true,
  raid: false, pvp: false, holiday: false,
};

function parse(search: string): CharState {
  const p = new URLSearchParams(search);
  const wantedExp = p.get('expansion') as Expansion | null;
  const expansion: Expansion = wantedExp && EXPANSIONS.has(wantedExp) ? wantedExp : DEFAULT.expansion;
  const cap = LEVEL_CAP[expansion];
  let cls = (p.get('class') ?? DEFAULT.cls) as ClassName;
  if (!isClassAvailable(cls, expansion)) cls = DEFAULT.cls;
  const specs = SPEC_BY_CLASS[cls] ?? [DEFAULT.spec];
  const wanted = p.get('spec') as Spec | null;
  const spec: Spec = wanted && specs.includes(wanted) ? wanted : specs[0]!;
  const lvl = Number(p.get('level') ?? DEFAULT.level);
  const classMin = CLASS_MIN_LEVEL[cls] ?? 1;
  const level = Number.isFinite(lvl)
    ? Math.min(cap, Math.max(classMin, Math.round(lvl)))
    : Math.min(cap, Math.max(classMin, DEFAULT.level));
  return {
    expansion, cls, spec, level,
    drop: p.get('drop') !== '0',
    dungeon: p.get('dungeon') !== '0',
    quest: p.get('quest') !== '0',
    vendor: p.get('vendor') !== '0',
    profession: p.get('profession') !== '0',
    raid: p.get('raid') === '1',
    pvp: p.get('pvp') === '1',
    holiday: p.get('holiday') === '1',
  };
}

function serialize(s: CharState): string {
  const parts: string[] = [];
  if (s.expansion !== DEFAULT.expansion) parts.push(`expansion=${s.expansion}`);
  parts.push(`class=${s.cls}`, `spec=${s.spec}`, `level=${s.level}`);
  if (!s.drop) parts.push('drop=0');
  if (!s.dungeon) parts.push('dungeon=0');
  if (!s.quest) parts.push('quest=0');
  if (!s.vendor) parts.push('vendor=0');
  if (!s.profession) parts.push('profession=0');
  if (s.raid) parts.push('raid=1');
  if (s.pvp) parts.push('pvp=1');
  if (s.holiday) parts.push('holiday=1');
  return `?${parts.join('&')}`;
}

export function useUrlState(): [CharState, (next: Partial<CharState>) => void] {
  const [state, setState] = useState<CharState>(() => parse(window.location.search));

  useEffect(() => {
    const onPop = () => setState(parse(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = (next: Partial<CharState>): void => {
    setState((prev) => {
      const candidate = { ...prev, ...next };
      const exp = candidate.expansion;
      const cap = LEVEL_CAP[exp];
      const cls = isClassAvailable(candidate.cls, exp) ? candidate.cls : DEFAULT.cls;
      const classMin = CLASS_MIN_LEVEL[cls] ?? 1;
      const safeSpecs = SPEC_BY_CLASS[cls];
      const merged: CharState = {
        expansion: exp,
        cls,
        spec: safeSpecs.includes(candidate.spec) ? candidate.spec : safeSpecs[0]!,
        level: Math.min(cap, Math.max(classMin, Math.round(candidate.level))),
        drop: candidate.drop,
        dungeon: candidate.dungeon,
        quest: candidate.quest,
        vendor: candidate.vendor,
        profession: candidate.profession,
        raid: candidate.raid,
        pvp: candidate.pvp,
        holiday: candidate.holiday,
      };
      const qs = serialize(merged);
      window.history.replaceState(null, '', qs);
      return merged;
    });
  };

  return [state, update];
}
