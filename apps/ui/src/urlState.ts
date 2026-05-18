import { useEffect, useState } from 'react';
import type { ClassName, Spec } from '@wowgear/core';
import { SPEC_BY_CLASS } from '@wowgear/core';

export interface CharState {
  cls: ClassName;
  spec: Spec;
  level: number;
  raid: boolean;
  pvp: boolean;
  holiday: boolean;
}

const DEFAULT: CharState = { cls: 'rogue', spec: 'combat', level: 22, raid: false, pvp: false, holiday: false };

function parse(search: string): CharState {
  const p = new URLSearchParams(search);
  const cls = (p.get('class') ?? DEFAULT.cls) as ClassName;
  const specs = SPEC_BY_CLASS[cls] ?? [DEFAULT.spec];
  const wanted = p.get('spec') as Spec | null;
  const spec: Spec = wanted && specs.includes(wanted) ? wanted : specs[0]!;
  const lvl = Number(p.get('level') ?? DEFAULT.level);
  const level = Number.isFinite(lvl) ? Math.min(70, Math.max(1, Math.round(lvl))) : DEFAULT.level;
  return {
    cls, spec, level,
    raid: p.get('raid') === '1',
    pvp: p.get('pvp') === '1',
    holiday: p.get('holiday') === '1',
  };
}

function serialize(s: CharState): string {
  const parts = [`class=${s.cls}`, `spec=${s.spec}`, `level=${s.level}`];
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
      const specs = SPEC_BY_CLASS[candidate.cls];
      const merged: CharState = {
        cls: candidate.cls,
        spec: specs.includes(candidate.spec) ? candidate.spec : specs[0]!,
        level: Math.min(70, Math.max(1, Math.round(candidate.level))),
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
