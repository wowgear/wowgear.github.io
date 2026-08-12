export type GateExpansion = 'vanilla' | 'tbc' | 'wotlk';

export interface ProfessionLevelGate {
  max_skill_rank: number;
  min_player_level: number;
}

type ProfessionGateTable = Readonly<Partial<Record<number, readonly ProfessionLevelGate[]>>>;

const VANILLA_PRODUCTION = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
] as const;

const VANILLA_GATHERING = [
  { max_skill_rank: 150, min_player_level: 1 },
  { max_skill_rank: 225, min_player_level: 10 },
  { max_skill_rank: 300, min_player_level: 25 },
] as const;

const VANILLA_FISHING = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
] as const;

const VANILLA_FIRST_AID = [
  { max_skill_rank: 225, min_player_level: 1 },
  { max_skill_rank: 300, min_player_level: 35 },
] as const;

const TBC_PRODUCTION = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
  { max_skill_rank: 375, min_player_level: 50 },
] as const;

const TBC_GATHERING = [
  { max_skill_rank: 150, min_player_level: 1 },
  { max_skill_rank: 225, min_player_level: 10 },
  { max_skill_rank: 375, min_player_level: 25 },
] as const;

const TBC_FISHING = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
  { max_skill_rank: 375, min_player_level: 45 },
] as const;

const TBC_COOKING = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 375, min_player_level: 35 },
] as const;

const TBC_FIRST_AID = [
  { max_skill_rank: 225, min_player_level: 1 },
  { max_skill_rank: 375, min_player_level: 35 },
] as const;

const WOTLK_PRODUCTION = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
  { max_skill_rank: 375, min_player_level: 50 },
  { max_skill_rank: 450, min_player_level: 65 },
] as const;

const WOTLK_GATHERING = [
  { max_skill_rank: 150, min_player_level: 1 },
  { max_skill_rank: 225, min_player_level: 10 },
  { max_skill_rank: 300, min_player_level: 25 },
  { max_skill_rank: 375, min_player_level: 40 },
  { max_skill_rank: 450, min_player_level: 55 },
] as const;

const WOTLK_FISHING = [
  { max_skill_rank: 75, min_player_level: 5 },
  { max_skill_rank: 150, min_player_level: 10 },
  { max_skill_rank: 225, min_player_level: 20 },
  { max_skill_rank: 300, min_player_level: 35 },
  { max_skill_rank: 450, min_player_level: 45 },
] as const;

const WOTLK_COOKING = [
  { max_skill_rank: 425, min_player_level: 1 },
  { max_skill_rank: 450, min_player_level: 65 },
] as const;

const WOTLK_FIRST_AID = [
  { max_skill_rank: 225, min_player_level: 1 },
  { max_skill_rank: 450, min_player_level: 35 },
] as const;

export const PROFESSION_LEVEL_GATES: Readonly<Record<GateExpansion, ProfessionGateTable>> = {
  vanilla: {
    129: VANILLA_FIRST_AID,
    164: VANILLA_PRODUCTION,
    165: VANILLA_PRODUCTION,
    171: VANILLA_PRODUCTION,
    182: VANILLA_GATHERING,
    185: VANILLA_PRODUCTION,
    186: VANILLA_GATHERING,
    197: VANILLA_PRODUCTION,
    202: VANILLA_PRODUCTION,
    333: VANILLA_PRODUCTION,
    356: VANILLA_FISHING,
    393: VANILLA_GATHERING,
  },
  tbc: {
    129: TBC_FIRST_AID,
    164: TBC_PRODUCTION,
    165: TBC_PRODUCTION,
    171: TBC_PRODUCTION,
    182: TBC_GATHERING,
    185: TBC_COOKING,
    186: TBC_GATHERING,
    197: TBC_PRODUCTION,
    202: TBC_PRODUCTION,
    333: TBC_PRODUCTION,
    356: TBC_FISHING,
    393: TBC_GATHERING,
    755: TBC_PRODUCTION,
  },
  wotlk: {
    129: WOTLK_FIRST_AID,
    164: WOTLK_PRODUCTION,
    165: WOTLK_PRODUCTION,
    171: WOTLK_PRODUCTION,
    182: WOTLK_GATHERING,
    185: WOTLK_COOKING,
    186: WOTLK_GATHERING,
    197: WOTLK_PRODUCTION,
    202: WOTLK_PRODUCTION,
    333: WOTLK_PRODUCTION,
    356: WOTLK_FISHING,
    393: WOTLK_GATHERING,
    755: WOTLK_PRODUCTION,
    773: WOTLK_PRODUCTION,
  },
};

export function professionMinPlayerLevel(
  expansion: GateExpansion,
  requiredSkill: number,
  requiredSkillRank: number,
): number | null {
  if (requiredSkill <= 0 || requiredSkillRank <= 0) return null;
  const gates = PROFESSION_LEVEL_GATES[expansion][requiredSkill];
  if (!gates) return null;
  for (const gate of gates) {
    if (requiredSkillRank <= gate.max_skill_rank) return gate.min_player_level;
  }
  return null;
}
