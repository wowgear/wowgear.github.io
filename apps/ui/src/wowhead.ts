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

// Wowhead listview tab anchors: linking to the item itself with the relevant tab
// opened beats a name search, which can return many matches.
const ITEM_TAB_BY_SOURCE: Partial<Record<ItemSource['source_type'], string>> = {
  drop: 'dropped-by',
  dungeon: 'dropped-by',
  raid: 'dropped-by',
  vendor: 'sold-by',
  pvp: 'sold-by',
  profession: 'created-by-spell',
  craft: 'created-by-spell',
};

function searchUrl(expansion: Expansion, source: ItemSource): string {
  let query = source.source_name.replace(QUEST_PREFIX, '').replace(LEVEL_SUFFIX, '');
  query = query.split(':').pop()?.trim() ?? query;
  return `${BASE_BY_EXP[expansion]}/search?q=${encodeURIComponent(query)}`;
}

export function sourceUrl(expansion: Expansion, source: ItemSource, itemId: number): string | null {
  if (source.source_name === SYNTHETIC_SOURCE_NAME) return null;
  const base = BASE_BY_EXP[expansion];
  if (source.source_entity_kind === 'quest' && source.source_entity_id != null) {
    return `${base}/quest=${source.source_entity_id}`;
  }
  const tab = ITEM_TAB_BY_SOURCE[source.source_type];
  if (tab) return `${base}/item=${itemId}#${tab}`;
  return searchUrl(expansion, source);
}
