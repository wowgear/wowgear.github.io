import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { ALLIANCE_RACE_MASK, HORDE_RACE_MASK } from '@wowgear/core/types';
import { professionMinPlayerLevel, PROFESSION_LEVEL_GATES, type GateExpansion } from './professiongates.js';
import type { ProjectedSource, ProjectedSourceType } from './project.js';
import { sourcePlayerLevelGate, type PlayerLevelGate } from './sourcegates.js';

const ATT_DIRECTORY: Readonly<Record<GateExpansion, string>> = {
  vanilla: 'Vanilla',
  tbc: 'TBC',
  wotlk: 'Wrath',
};

const SOURCE_CATEGORIES = new Set([
  'Character.lua',
  'Craftables.lua',
  'ExpansionFeatures.lua',
  'Holidays.lua',
  'Instances.lua',
  'Professions.lua',
  'PVP.lua',
  'Unsorted.lua',
  'WorldDrops.lua',
  'WorldEvents.lua',
  'Zones.lua',
]);

const CONSTRUCTORS = new Set([
  'ah',
  'e',
  'h',
  'i',
  'inst',
  'm',
  'n',
  'o',
  'prof',
  'q',
  's',
]);

const VENDOR_HEADER_ID = -58;
const WORLD_DROP_HEADER_ID = -63;
const ALL_FACTION_RACES = ALLIANCE_RACE_MASK | HORDE_RACE_MASK;
const MAX_SOURCES_PER_ITEM = 12;
const MAX_SCRIPT_BYTES = 64 * 1024 * 1024;
const MAX_CALL_DEPTH = 512;
const MAX_SOURCE_QUESTS = 128;

interface Token {
  kind: 'identifier' | 'number' | 'string' | 'symbol';
  value: string;
}

interface TokenReader {
  iterator: Iterator<Token>;
  lookahead: Token[];
  done: boolean;
}

interface AttNode {
  kind: string;
  id: number;
  secondId: number | null;
  parent: AttNode | null;
  category: string;
  level: number | null;
  faction: number | null;
  requireSkill: number | null;
  learnedAt: number | null;
  isRaid: boolean;
  sourceQuests: number[];
  hasClosedNodeChild: boolean;
}

interface QuestNode {
  level: number | null;
  sourceQuests: number[];
}

type QuestMap = Map<number, QuestNode[]>;

interface Acquisition {
  type: ProjectedSourceType;
  name: string;
  zone: string | null;
  entityKind: ProjectedSource['source_entity_kind'];
  entityId: number | null;
  allianceLevel: number | null;
  hordeLevel: number | null;
  raceMask: number;
}

export interface AttSources {
  sources: ProjectedSource[];
  itemsCovered: Set<number>;
}

function* tokenize(text: string): Generator<Token> {
  let position = 0;
  while (position < text.length) {
    const char = text[position]!;
    if (/\s/.test(char)) {
      position++;
      continue;
    }
    if (char === '-' && text[position + 1] === '-') {
      if (text[position + 2] === '[' && text[position + 3] === '[') {
        const end = text.indexOf(']]', position + 4);
        position = end < 0 ? text.length : end + 2;
      } else {
        const end = text.indexOf('\n', position + 2);
        position = end < 0 ? text.length : end + 1;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      position++;
      while (position < text.length) {
        const current = text[position]!;
        if (current === '\\') {
          position += 2;
          continue;
        }
        position++;
        if (current === quote) break;
      }
      yield { kind: 'string', value: '' };
      continue;
    }
    if (char === '[' && text[position + 1] === '[') {
      const end = text.indexOf(']]', position + 2);
      position = end < 0 ? text.length : end + 2;
      yield { kind: 'string', value: '' };
      continue;
    }
    if ((char >= '0' && char <= '9') || (char === '.' && /[0-9]/.test(text[position + 1] ?? ''))) {
      const start = position;
      position++;
      while (position < text.length && /[0-9.eE]/.test(text[position]!)) position++;
      yield { kind: 'number', value: text.slice(start, position) };
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = position;
      position++;
      while (position < text.length && /[A-Za-z0-9_]/.test(text[position]!)) position++;
      yield { kind: 'identifier', value: text.slice(start, position) };
      continue;
    }
    yield { kind: 'symbol', value: char };
    position++;
  }
}

function tokenReader(text: string): TokenReader {
  return { iterator: tokenize(text), lookahead: [], done: false };
}

function peekToken(reader: TokenReader, offset = 0): Token | undefined {
  while (!reader.done && reader.lookahead.length <= offset) {
    const next = reader.iterator.next();
    if (next.done) reader.done = true;
    else reader.lookahead.push(next.value);
  }
  return reader.lookahead[offset];
}

function takeToken(reader: TokenReader): Token | undefined {
  const token = peekToken(reader);
  if (token) reader.lookahead.shift();
  return token;
}

function signedNumber(reader: TokenReader, offset = 0): { value: number; width: number } | null {
  const sign = peekToken(reader, offset)?.value === '-' ? -1 : 1;
  const numberOffset = sign === -1 ? offset + 1 : offset;
  const token = peekToken(reader, numberOffset);
  if (token?.kind !== 'number') return null;
  const value = Number(token.value) * sign;
  return Number.isFinite(value) ? { value, width: numberOffset - offset + 1 } : null;
}

function takeSignedNumber(reader: TokenReader): number | null {
  const number = signedNumber(reader);
  if (!number) return null;
  for (let index = 0; index < number.width; index++) takeToken(reader);
  return number.value;
}

function callArguments(reader: TokenReader): { first: number; second: number | null } | null {
  const first = takeSignedNumber(reader);
  if (first == null) return null;
  if (peekToken(reader)?.value !== ',') return { first, second: null };
  takeToken(reader);
  return { first, second: takeSignedNumber(reader) };
}

function assignedNumber(reader: TokenReader): number | null {
  if (peekToken(reader)?.value !== '=') return null;
  takeToken(reader);
  return takeSignedNumber(reader);
}

function assignedNumbers(reader: TokenReader): number[] | null {
  if (peekToken(reader)?.value !== '=' || peekToken(reader, 1)?.value !== '{') return null;
  takeToken(reader);
  takeToken(reader);
  const values: number[] = [];
  let depth = 1;
  while (depth > 0) {
    const token = takeToken(reader);
    if (!token) throw new Error('unterminated ATT sourceQuests table');
    if (token.value === '{') {
      depth++;
      continue;
    }
    if (token.value === '}') {
      depth--;
      continue;
    }
    if (depth !== 1) continue;
    if (token.kind === 'number') values.push(Number(token.value));
    else if (token.value === '-') {
      const number = takeSignedNumber(reader);
      if (number != null) values.push(-number);
    }
    if (values.length > MAX_SOURCE_QUESTS) throw new Error('ATT sourceQuests exceeds safety limit');
  }
  return values;
}

function parentNode(stack: Array<AttNode | null>): AttNode | null {
  for (let index = stack.length - 1; index >= 0; index--) {
    const node = stack[index];
    if (node) return node;
  }
  return null;
}

function parseNodes(text: string, category: string, visit: (node: AttNode) => void): void {
  const reader = tokenReader(text);
  const calls: Array<AttNode | null> = [];

  while (true) {
    const token = takeToken(reader);
    if (!token) break;
    if (token.kind === 'identifier' && peekToken(reader)?.value === '(') {
      takeToken(reader);
      const args = CONSTRUCTORS.has(token.value) ? callArguments(reader) : null;
      const node = CONSTRUCTORS.has(token.value) && args
        ? {
            kind: token.value,
            id: args.first,
            secondId: args.second,
            parent: parentNode(calls),
            category,
            level: null,
            faction: null,
            requireSkill: null,
            learnedAt: null,
            isRaid: false,
            sourceQuests: [],
            hasClosedNodeChild: false,
          } satisfies AttNode
        : null;
      calls.push(node);
      if (calls.length > MAX_CALL_DEPTH) throw new Error('ATT call depth exceeds safety limit');
      continue;
    }
    if (token.value === '(') {
      calls.push(null);
      continue;
    }
    if (token.value === ')') {
      const node = calls.pop();
      if (node) {
        visit(node);
        if (node.parent) node.parent.hasClosedNodeChild = true;
      }
      continue;
    }
    if (token.kind !== 'identifier') continue;
    const node = calls[calls.length - 1] ?? null;
    if (!node) continue;
    if (token.value === 'sourceQuests') {
      const values = assignedNumbers(reader);
      if (!values) continue;
      if (node.hasClosedNodeChild) throw new Error('ATT source metadata follows nested source data');
      node.sourceQuests = values;
      continue;
    }
    if (
      token.value !== 'lvl'
      && token.value !== 'r'
      && token.value !== 'requireSkill'
      && token.value !== 'learnedAt'
      && token.value !== 'isRaid'
    ) continue;
    const value = assignedNumber(reader);
    if (value == null) continue;
    if (node.hasClosedNodeChild) throw new Error('ATT source metadata follows nested source data');
    if (token.value === 'lvl') node.level = value;
    else if (token.value === 'r') node.faction = value;
    else if (token.value === 'requireSkill') node.requireSkill = value;
    else if (token.value === 'learnedAt') node.learnedAt = value;
    else if (token.value === 'isRaid') node.isRaid = value !== 0;
  }
  if (calls.length !== 0) throw new Error('unterminated ATT function call');
}

function checkedPath(root: string, base: string, file: string): string {
  const path = resolve(base, file);
  const pathFromRoot = relative(root, path);
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new Error(`ATT manifest path escapes root: ${file}`);
  }
  return path;
}

function manifestScripts(root: string, manifest: string, seen: Set<string>, scripts: Set<string>): void {
  if (seen.has(manifest)) return;
  seen.add(manifest);
  if (!existsSync(manifest)) throw new Error(`ATT manifest not found: ${manifest}`);
  const xml = scriptText(manifest);
  const entry = /<(Script|Include)\s+file="([^"]+)"\s*\/>/g;
  for (const match of xml.matchAll(entry)) {
    const kind = match[1]!;
    const file = match[2]!;
    const path = checkedPath(root, dirname(manifest), file);
    if (kind === 'Include') manifestScripts(root, path, seen, scripts);
    else if (SOURCE_CATEGORIES.has(basename(path))) scripts.add(path);
  }
}

function scriptText(path: string): string {
  const size = statSync(path).size;
  if (size > MAX_SCRIPT_BYTES) throw new Error(`ATT source file exceeds safety limit: ${path}`);
  return readFileSync(path, 'utf8');
}

function ancestors(node: AttNode): AttNode[] {
  const values: AttNode[] = [];
  let current: AttNode | null = node;
  while (current) {
    values.push(current);
    current = current.parent;
  }
  return values;
}

function nearest(nodes: AttNode[], kind: string): AttNode | null {
  for (const node of nodes) if (node.kind === kind) return node;
  return null;
}

function nearestAny(nodes: AttNode[], kinds: ReadonlySet<string>): AttNode | null {
  for (const node of nodes) if (kinds.has(node.kind)) return node;
  return null;
}

function factionMask(nodes: AttNode[]): number {
  let mask = ALL_FACTION_RACES;
  let restricted = false;
  for (const node of nodes) {
    if (node.faction === 1) {
      mask &= HORDE_RACE_MASK;
      restricted = true;
    } else if (node.faction === 2) {
      mask &= ALLIANCE_RACE_MASK;
      restricted = true;
    }
  }
  return restricted ? mask : 0;
}

function mergeLevel(current: number | null, candidate: number | null): number | null {
  if (candidate == null) return current;
  return current == null ? candidate : Math.max(current, candidate);
}

function mergeGate(current: PlayerLevelGate, candidate: PlayerLevelGate | null): PlayerLevelGate {
  if (!candidate) return current;
  return {
    alliance: mergeLevel(current.alliance, candidate.alliance),
    horde: mergeLevel(current.horde, candidate.horde),
  };
}

function professionGate(expansion: GateExpansion, node: AttNode, nodes: AttNode[]): number | null {
  if (node.learnedAt == null || node.learnedAt <= 0) return null;
  const candidates: number[] = [];
  if (node.requireSkill != null) candidates.push(node.requireSkill);
  for (const ancestor of nodes) if (ancestor.kind === 'prof') candidates.push(ancestor.id);
  for (const skill of candidates) {
    if (!PROFESSION_LEVEL_GATES[expansion][skill]) continue;
    const level = professionMinPlayerLevel(expansion, skill, node.learnedAt);
    if (level != null) return level;
  }
  return null;
}

function questGate(
  expansion: GateExpansion,
  questId: number,
  quests: QuestMap,
  visiting: Set<number>,
  memo: Map<number, PlayerLevelGate>,
): PlayerLevelGate {
  const cached = memo.get(questId);
  if (cached) return cached;

  let gate: PlayerLevelGate = { alliance: null, horde: null };
  for (const quest of quests.get(questId) ?? []) {
    if (quest.level != null && quest.level > 0) {
      gate = mergeGate(gate, { alliance: quest.level, horde: quest.level });
    }
  }
  gate = mergeGate(gate, sourcePlayerLevelGate(expansion, 'quest', questId));
  if (visiting.has(questId)) return gate;

  visiting.add(questId);
  for (const quest of quests.get(questId) ?? []) {
    for (const sourceQuestId of quest.sourceQuests) {
      gate = mergeGate(gate, questGate(expansion, sourceQuestId, quests, visiting, memo));
    }
  }
  visiting.delete(questId);
  memo.set(questId, gate);
  return gate;
}

function pathGate(
  expansion: GateExpansion,
  path: AttNode[],
  quests: QuestMap,
  questMemo: Map<number, PlayerLevelGate>,
): PlayerLevelGate {
  let gate: PlayerLevelGate = { alliance: 1, horde: 1 };
  for (const node of path) {
    if (node.level != null && node.level > 0) {
      gate = mergeGate(gate, { alliance: node.level, horde: node.level });
    }
    if (node.kind === 'q') {
      gate = mergeGate(gate, questGate(expansion, node.id, quests, new Set(), questMemo));
    }
    const professionLevel = professionGate(expansion, node, path);
    if (professionLevel != null) {
      gate = mergeGate(gate, { alliance: professionLevel, horde: professionLevel });
    }
  }
  return gate;
}

function sourceType(path: AttNode[]): ProjectedSourceType | null {
  const category = path[0]?.category;
  if (category === 'Holidays.lua' || category === 'WorldEvents.lua') return 'holiday';
  if (category === 'PVP.lua') return 'pvp';
  if (category === 'Craftables.lua' || category === 'Professions.lua') return 'profession';
  const quest = nearest(path, 'q');
  if (quest) return 'quest';
  const instance = nearest(path, 'inst');
  if (category === 'Instances.lua' || instance) return instance?.isRaid ? 'raid' : 'dungeon';
  const header = nearest(path, 'h');
  const npc = nearest(path, 'n');
  if (header?.id === VENDOR_HEADER_ID && npc) return 'vendor';
  if (npc || nearest(path, 'o') || header?.id === WORLD_DROP_HEADER_ID || category === 'WorldDrops.lua') return 'drop';
  return null;
}

function acquisition(
  expansion: GateExpansion,
  node: AttNode,
  quests: QuestMap,
  questMemo: Map<number, PlayerLevelGate>,
): Acquisition | null {
  const path = ancestors(node);
  const type = sourceType(path);
  if (!type) return null;
  const entity = nearestAny(path, new Set(['q', 'n', 'o', 'e', 'prof', 'inst']));
  const entityKind = entity?.kind === 'q'
    ? 'quest'
    : entity?.kind === 'n'
      ? 'npc'
      : entity?.kind === 'o'
        ? 'object'
        : null;
  const entityId = entity?.id ?? null;
  const sourceName = entity?.kind === 'q'
    ? `Quest #${entity.id}`
    : entity?.kind === 'n'
      ? `NPC #${entity.id}`
      : entity?.kind === 'o'
        ? `Object #${entity.id}`
        : entity?.kind === 'e'
          ? `Encounter #${entity.id}`
          : entity?.kind === 'inst'
            ? `${type === 'raid' ? 'Raid' : 'Dungeon'} #${entity.id}`
            : entity?.kind === 'prof'
              ? `Profession #${entity.id}`
              : type;
  const instance = nearest(path, 'inst');
  const map = nearest(path, 'm');
  const raceMask = factionMask(path);
  const gate = pathGate(expansion, path, quests, questMemo);
  return {
    type,
    name: sourceName,
    zone: instance ? `Instance #${instance.id}` : map ? `Zone #${map.id}` : null,
    entityKind,
    entityId,
    allianceLevel: raceMask !== 0 && (raceMask & ALLIANCE_RACE_MASK) === 0 ? null : gate.alliance,
    hordeLevel: raceMask !== 0 && (raceMask & HORDE_RACE_MASK) === 0 ? null : gate.horde,
    raceMask,
  };
}

function itemId(node: AttNode): number | null {
  if (node.kind === 'i') return node.id > 0 ? node.id : null;
  if (node.kind === 's') return node.secondId != null && node.secondId > 0 ? node.secondId : null;
  return null;
}

function parentContainer(node: AttNode): AttNode | null {
  let current = node.parent;
  while (current) {
    if (current.kind === 'ah' && current.id > 0) return current;
    current = current.parent;
  }
  return null;
}

function addSource(sources: Map<number, ProjectedSource[]>, item: number, source: Acquisition): void {
  const row: ProjectedSource = {
    item_id: item,
    source_type: source.type,
    source_name: source.name,
    source_zone: source.zone,
    min_player_level_alliance: source.allianceLevel,
    min_player_level_horde: source.hordeLevel,
    drop_chance: null,
    vendor_cost_copper: null,
    quest_choice_group: null,
    source_entity_kind: source.entityKind,
    source_entity_id: source.entityId,
    race_mask: source.raceMask,
  };
  const rows = sources.get(item);
  if (rows) rows.push(row);
  else sources.set(item, [row]);
}

function mergeNullableMinimum(left: number | null, right: number | null): number | null {
  if (left == null) return right;
  if (right == null) return left;
  return Math.min(left, right);
}

function mergeRaceMask(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  return left | right;
}

function dedupeSources(sources: ProjectedSource[]): ProjectedSource[] {
  const byIdentity = new Map<string, ProjectedSource>();
  for (const source of sources) {
    const key = source.source_entity_id == null
      ? `${source.source_type}:${source.source_name}`
      : `${source.source_type}:${source.source_entity_kind}:${source.source_entity_id}`;
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, { ...source });
      continue;
    }
    existing.min_player_level_alliance = mergeNullableMinimum(
      existing.min_player_level_alliance,
      source.min_player_level_alliance,
    );
    existing.min_player_level_horde = mergeNullableMinimum(
      existing.min_player_level_horde,
      source.min_player_level_horde,
    );
    existing.race_mask = mergeRaceMask(existing.race_mask, source.race_mask);
  }
  return [...byIdentity.values()];
}

function capSources(sources: ProjectedSource[]): ProjectedSource[] {
  const sorted = dedupeSources(sources).sort((left, right) => {
    const leftLevel = Math.min(left.min_player_level_alliance ?? Infinity, left.min_player_level_horde ?? Infinity);
    const rightLevel = Math.min(right.min_player_level_alliance ?? Infinity, right.min_player_level_horde ?? Infinity);
    return leftLevel - rightLevel;
  });
  const kept = sorted.slice(0, MAX_SOURCES_PER_ITEM);
  for (const factionMask of [ALLIANCE_RACE_MASK, HORDE_RACE_MASK]) {
    if (!sorted.some((source) => source.race_mask === 0 || (source.race_mask & factionMask) !== 0)) continue;
    if (kept.some((source) => source.race_mask === 0 || (source.race_mask & factionMask) !== 0)) continue;
    const source = sorted.find((candidate) => candidate.race_mask === 0 || (candidate.race_mask & factionMask) !== 0);
    if (source) kept.push(source);
  }
  return kept;
}

export function readAttSources(
  directory: string,
  expansion: GateExpansion,
  knownItems: ReadonlySet<number>,
): AttSources {
  const root = resolve(directory);
  const manifest = join(root, 'db', ATT_DIRECTORY[expansion], 'Database.xml');
  const scripts = new Set<string>();
  manifestScripts(root, manifest, new Set(), scripts);

  const quests: QuestMap = new Map();
  for (const script of scripts) {
    if (!existsSync(script)) throw new Error(`ATT source file not found: ${script}`);
    parseNodes(scriptText(script), basename(script), (node) => {
      if (node.kind !== 'q') return;
      const quest = { level: node.level, sourceQuests: node.sourceQuests } satisfies QuestNode;
      const values = quests.get(node.id);
      if (values) values.push(quest);
      else quests.set(node.id, [quest]);
    });
  }

  const containerParents = new Map<number, Set<number>>();
  const directSources = new Map<number, ProjectedSource[]>();
  const questMemo = new Map<number, PlayerLevelGate>();
  for (const script of scripts) {
    parseNodes(scriptText(script), basename(script), (node) => {
      const item = itemId(node);
      if (item != null) {
        const container = parentContainer(node);
        if (container) {
          const parents = containerParents.get(item);
          if (parents) parents.add(container.id);
          else containerParents.set(item, new Set([container.id]));
        } else {
          const source = acquisition(expansion, node, quests, questMemo);
          if (source) addSource(directSources, item, source);
        }
      }
      if (node.kind !== 'ah' || node.id <= 0) return;
      const source = acquisition(expansion, node, quests, questMemo);
      if (source) addSource(directSources, node.id, source);
    });
  }

  const sources: ProjectedSource[] = [];
  for (const item of knownItems) {
    const resolved: ProjectedSource[] = [];
    const pending = [item];
    const visited = new Set<number>();
    while (pending.length > 0) {
      const sourceItem = pending.pop()!;
      if (visited.has(sourceItem)) continue;
      visited.add(sourceItem);
      for (const source of directSources.get(sourceItem) ?? []) {
        resolved.push(sourceItem === item ? source : { ...source, item_id: item });
      }
      for (const container of containerParents.get(sourceItem) ?? []) pending.push(container);
    }
    sources.push(...capSources(resolved));
  }

  return { sources, itemsCovered: new Set(sources.map((source) => source.item_id)) };
}
