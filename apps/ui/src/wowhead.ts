import type { ItemSource } from '@wowgear/core';

const BASE = 'https://www.wowhead.com/tbc';

export function itemUrl(itemId: number): string {
  return `${BASE}/item=${itemId}`;
}

const QUEST_PREFIX = /^Quest:\s*/;
const LEVEL_SUFFIX = /\s*\(L(?:vl|evel)?\s*[\d\-+]+\)$/i;

export function sourceUrl(source: ItemSource): string {
  let query = source.source_name;
  query = query.replace(QUEST_PREFIX, '').replace(LEVEL_SUFFIX, '');
  query = query.split(':').pop()?.trim() ?? query;
  return `${BASE}/search?q=${encodeURIComponent(query)}`;
}
