import type { ItemSource } from '@wowgear/core';
import type { Expansion } from './urlState.js';

const BASE_BY_EXP: Record<Expansion, string> = {
  vanilla: 'https://www.wowhead.com/classic',
  tbc: 'https://www.wowhead.com/tbc',
  wotlk: 'https://www.wowhead.com/wotlk',
};

const SYNTHETIC_SOURCE_NAME = 'World / dungeon / quest';

export function itemUrl(expansion: Expansion, itemId: number): string {
  return `${BASE_BY_EXP[expansion]}/item=${itemId}`;
}

const QUEST_PREFIX = /^Quest:\s*/;
const LEVEL_SUFFIX = /\s*\(L(?:vl|evel)?\s*[\d\-+]+\)$/i;

export function sourceUrl(expansion: Expansion, source: ItemSource): string | null {
  if (source.source_name === SYNTHETIC_SOURCE_NAME) return null;
  let query = source.source_name;
  query = query.replace(QUEST_PREFIX, '').replace(LEVEL_SUFFIX, '');
  query = query.split(':').pop()?.trim() ?? query;
  return `${BASE_BY_EXP[expansion]}/search?q=${encodeURIComponent(query)}`;
}
