import type { GateExpansion } from './professiongates.js';

export type GateSourceKind = 'quest';

export interface PlayerLevelGate {
  alliance: number | null;
  horde: number | null;
}

type SourceGateTable = Readonly<Partial<Record<GateSourceKind, Readonly<Record<number, PlayerLevelGate>>>>>;

const TBC_OLD_MAN_BARLO_DAILY: PlayerLevelGate = { alliance: 70, horde: 70 };

export const SOURCE_LEVEL_GATES: Readonly<Record<GateExpansion, SourceGateTable>> = {
  vanilla: {},
  tbc: {
    quest: {
      11665: TBC_OLD_MAN_BARLO_DAILY,
      11666: TBC_OLD_MAN_BARLO_DAILY,
      11667: TBC_OLD_MAN_BARLO_DAILY,
      11668: TBC_OLD_MAN_BARLO_DAILY,
      11669: TBC_OLD_MAN_BARLO_DAILY,
    },
  },
  wotlk: {},
};

export function sourcePlayerLevelGate(
  expansion: GateExpansion,
  kind: GateSourceKind,
  id: number,
): PlayerLevelGate | null {
  return SOURCE_LEVEL_GATES[expansion][kind]?.[id] ?? null;
}
