import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export interface ParsedTable {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
}

const CREATE_RE = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\(([\s\S]+?)\)\s*(?:ENGINE|;|\n\s*\n)/gi;
const COL_RE = /^\s*`([A-Za-z0-9_]+)`\s+[A-Za-z]+/;
const INSERT_RE = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?(?:\s*\(([^)]+)\))?\s+VALUES\s+/gi;

function parseCreateTables(sql: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  let m: RegExpExecArray | null;
  while ((m = CREATE_RE.exec(sql)) !== null) {
    const [, name, body] = m;
    if (!name || !body) continue;
    const cols: string[] = [];
    for (const line of body.split('\n')) {
      const c = COL_RE.exec(line);
      if (c?.[1]) cols.push(c[1]);
    }
    if (cols.length > 0) tables.set(name, cols);
  }
  return tables;
}

function unescape(raw: string): string {
  return raw.replace(/\\(.)/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    if (c === '0') return '\0';
    return c;
  });
}

function skipWs(input: string, i: number): number {
  while (i < input.length) {
    const c = input[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '-' && input[i + 1] === '-') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function parseValueList(input: string, start: number): { values: (string | number | null)[]; end: number } {
  const values: (string | number | null)[] = [];
  let i = start;
  if (input[i] !== '(') throw new Error(`Expected '(' at ${i}`);
  i++;
  while (i < input.length) {
    i = skipWs(input, i);
    const ch = input[i];
    if (ch === ')') return { values, end: i + 1 };
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let out = '';
      while (j < input.length) {
        const c = input[j]!;
        if (c === '\\') { out += c + (input[j + 1] ?? ''); j += 2; continue; }
        if (c === quote) break;
        out += c; j++;
      }
      values.push(unescape(out));
      i = j + 1;
    } else if ((ch === 'N' || ch === 'n') && input.slice(i, i + 4).toUpperCase() === 'NULL') {
      values.push(null);
      i += 4;
    } else {
      let j = i;
      while (j < input.length && input[j] !== ',' && input[j] !== ')') j++;
      const tok = input.slice(i, j).trim();
      values.push(tok === '' ? null : Number(tok));
      i = j;
    }
    i = skipWs(input, i);
    if (input[i] === ',') i++;
  }
  throw new Error('Unterminated value list');
}

export function parseDumpSql(sql: string, onlyTables?: ReadonlySet<string>): Map<string, ParsedTable> {
  const tables = parseCreateTables(sql);
  const out = new Map<string, ParsedTable>();

  for (const [name, columns] of tables) {
    if (onlyTables && !onlyTables.has(name)) continue;
    out.set(name, { name, columns, rows: [] });
  }

  let m: RegExpExecArray | null;
  INSERT_RE.lastIndex = 0;
  while ((m = INSERT_RE.exec(sql)) !== null) {
    const tableName = m[1]!;
    const keep = !onlyTables || onlyTables.has(tableName);
    const explicitCols = m[2]?.split(',').map((c) => c.trim().replace(/`/g, ''));
    let parsed = out.get(tableName);
    if (keep) {
      if (!parsed) {
        parsed = { name: tableName, columns: explicitCols ?? [], rows: [] };
        out.set(tableName, parsed);
      } else if (explicitCols) {
        parsed.columns = explicitCols;
      }
    }

    let i = INSERT_RE.lastIndex;
    while (i < sql.length) {
      i = skipWs(sql, i);
      if (sql[i] !== '(') break;
      const { values, end } = parseValueList(sql, i);
      if (keep && parsed) parsed.rows.push(values);
      i = skipWs(sql, end);
      if (sql[i] === ',') { i++; continue; }
      if (sql[i] === ';') { i++; break; }
      break;
    }
    INSERT_RE.lastIndex = i;
  }
  return out;
}

export function loadDumpDir(path: string): Map<string, ParsedTable> {
  const stat = statSync(path);
  const files: string[] = [];
  if (stat.isFile()) files.push(path);
  else {
    for (const f of readdirSync(path)) {
      if (extname(f).toLowerCase() === '.sql') files.push(join(path, f));
    }
  }
  const merged = new Map<string, ParsedTable>();
  for (const f of files) {
    const sql = readFileSync(f, 'utf8');
    const parsed = parseDumpSql(sql);
    for (const [name, t] of parsed) {
      const existing = merged.get(name);
      if (existing) {
        existing.rows.push(...t.rows);
        if (existing.columns.length === 0) existing.columns = t.columns;
      } else {
        merged.set(name, t);
      }
    }
  }
  return merged;
}

export function rowToObject(t: ParsedTable, row: (string | number | null)[]): Record<string, string | number | null> {
  const obj: Record<string, string | number | null> = {};
  for (let i = 0; i < t.columns.length; i++) {
    obj[t.columns[i]!] = row[i] ?? null;
  }
  return obj;
}
