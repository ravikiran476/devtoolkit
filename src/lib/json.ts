export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; line?: number; column?: number };

/**
 * Parses JSON. On failure, the error is located by our own scanner because engine
 * messages differ between browsers and often omit the position.
 */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const loc = locateJsonError(text);
    if (!loc) return { ok: false, error: (e as Error).message };
    const before = text.slice(0, loc.offset);
    return {
      ok: false,
      error: loc.message,
      line: before.split('\n').length,
      column: loc.offset - before.lastIndexOf('\n'),
    };
  }
}

interface JsonErrorLocation {
  offset: number;
  message: string;
}

/** Minimal RFC 8259 scanner that returns the first syntax error, or null if the text is valid. */
export function locateJsonError(text: string): JsonErrorLocation | null {
  let i = 0;
  const fail = (message: string, offset = i): never => {
    throw { offset, message } satisfies JsonErrorLocation;
  };
  const found = (at = i) => (at >= text.length ? 'end of input' : JSON.stringify(text[at]));
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
  };

  const string = () => {
    const start = i++;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i++;
        return;
      }
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('Invalid \\u escape sequence');
          i += 6;
        } else if (next !== undefined && '"\\/bfnrt'.includes(next)) {
          i += 2;
        } else {
          fail(`Invalid escape sequence \\${next ?? ''}`);
        }
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) fail('Unescaped control character in string (use \\n, \\t …)');
      i++;
    }
    fail('Unterminated string', start);
  };

  const value = (): void => {
    ws();
    const ch = text[i];
    if (ch === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail(`Expected a double-quoted property name but found ${found()}`);
        string();
        ws();
        if (text[i] !== ':') fail(`Expected ':' after property name but found ${found()}`);
        i++;
        value();
        ws();
        if (text[i] === ',') {
          i++;
          ws();
          if (text[i] === '}') fail('Trailing comma is not allowed in JSON');
        } else if (text[i] === '}') {
          i++;
          return;
        } else {
          fail(`Expected ',' or '}' after property value but found ${found()}`);
        }
      }
    }
    if (ch === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ',') {
          i++;
          ws();
          if (text[i] === ']') fail('Trailing comma is not allowed in JSON');
        } else if (text[i] === ']') {
          i++;
          return;
        } else {
          fail(`Expected ',' or ']' after array element but found ${found()}`);
        }
      }
    }
    if (ch === '"') return string();
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const re = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
      re.lastIndex = i;
      if (!re.exec(text)) fail('Invalid number');
      i = re.lastIndex;
      return;
    }
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return;
      }
    }
    if (ch === "'") fail('Strings must use double quotes');
    fail(`Unexpected ${found()}`);
  };

  try {
    value();
    ws();
    if (i < text.length) fail(`Unexpected ${found()} after the end of the JSON value`);
    return null;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'offset' in e) return e as JsonErrorLocation;
    throw e;
  }
}

export interface JsonWarning {
  line: number;
  message: string;
}

const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

/**
 * Things JSON.parse silently changes in valid JSON: integers beyond 2^53 and decimals with
 * more digits than a double holds are rounded, and only the last of duplicate keys is kept.
 * Expects text that JSON.parse accepts.
 */
export function jsonWarnings(text: string, limit = 20): JsonWarning[] {
  const warnings: JsonWarning[] = [];
  const stack: Array<Set<string> | null> = []; // one entry per open object (key set) or array (null)
  let expectKey = false;
  for (let i = 0; i < text.length && warnings.length < limit; i++) {
    const ch = text[i];
    if (ch === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      const top = stack[stack.length - 1];
      if (expectKey && top) {
        const key = JSON.parse(text.slice(start, i + 1)) as string;
        if (top.has(key)) warnings.push({ line: lineAt(text, start), message: `Duplicate key ${JSON.stringify(key)}: only the last value is kept` });
        top.add(key);
      }
      expectKey = false;
    } else if (ch === '{') {
      stack.push(new Set());
      expectKey = true;
    } else if (ch === '[') {
      stack.push(null);
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    } else if (ch === ',') {
      expectKey = stack[stack.length - 1] != null;
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const m = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
      m.lastIndex = i;
      const raw = m.exec(text)![0];
      const value = Number(raw);
      const isInteger = /^-?\d+$/.test(raw);
      const digits = raw.replace(/^-/, '').replace(/[eE].*$/, '').replace('.', '').replace(/^0+/, '');
      if (!Number.isFinite(value)) {
        warnings.push({ line: lineAt(text, i), message: `${raw} is out of range and is read as ${String(value)}` });
      } else if (isInteger && !Number.isSafeInteger(value)) {
        warnings.push({ line: lineAt(text, i), message: `${raw} is larger than 2^53 and is read as ${String(value)}` });
      } else if (!isInteger && digits.replace(/0+$/, '').length > 17) {
        warnings.push({ line: lineAt(text, i), message: `${raw} has more digits than a double can hold and is read as ${String(value)}` });
      }
      i += raw.length - 1;
    }
  }
  return warnings;
}

/**
 * Re-indents (or minifies) valid JSON without parsing it into JavaScript values, so numbers,
 * string escapes and duplicate keys come out exactly as they went in. Layout matches
 * JSON.stringify(value, null, indent).
 */
export function reformatJson(text: string, indent: string | number = 2): string {
  const pad = typeof indent === 'number' ? ' '.repeat(indent) : indent;
  const out: string[] = [];
  let depth = 0;
  const newline = () => (pad ? `\n${pad.repeat(depth)}` : '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    if (ch === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      out.push(text.slice(start, i + 1));
    } else if (ch === '{' || ch === '[') {
      // Empty containers stay on one line, as in JSON.stringify.
      let j = i + 1;
      while (j < text.length && ' \t\n\r'.includes(text[j]!)) j++;
      if (text[j] === (ch === '{' ? '}' : ']')) {
        out.push(ch === '{' ? '{}' : '[]');
        i = j;
        continue;
      }
      depth++;
      out.push(ch + newline());
    } else if (ch === '}' || ch === ']') {
      depth--;
      out.push(newline() + ch);
    } else if (ch === ',') {
      out.push(',' + newline());
    } else if (ch === ':') {
      out.push(pad ? ': ' : ':');
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

/** Recursively sorts object keys alphabetically. Arrays keep their order. */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys(value[k])]),
    );
  }
  return value;
}

export function describeJsonValue(value: unknown): string {
  if (Array.isArray(value)) return `array · ${value.length} item${value.length === 1 ? '' : 's'}`;
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return `object · ${n} key${n === 1 ? '' : 's'}`;
  }
  return value === null ? 'null' : typeof value;
}

export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

/** Structural diff of two JSON values. Paths use JSONPath-like notation rooted at `$`. */
export function diffJson(before: unknown, after: unknown, path = '$'): DiffEntry[] {
  const tb = kindOf(before);
  const ta = kindOf(after);
  if (tb !== ta) return [{ path, kind: 'changed', before, after }];

  if (tb === 'object') {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    return keys.flatMap((key) => {
      const p = joinPath(path, key);
      if (!Object.hasOwn(b, key)) return [{ path: p, kind: 'added' as const, after: a[key] }];
      if (!Object.hasOwn(a, key)) return [{ path: p, kind: 'removed' as const, before: b[key] }];
      return diffJson(b[key], a[key], p);
    });
  }

  if (tb === 'array') return diffArrays(before as unknown[], after as unknown[], path);

  return Object.is(before, after) ? [] : [{ path, kind: 'changed', before, after }];
}

/** Larger arrays fall back to comparing by position, to keep the diff fast. */
const MAX_ALIGNED_CELLS = 4_000_000;

/** Key-order-independent fingerprint, so {a,b} and {b,a} count as equal elements. */
const canonical = (v: unknown): string => JSON.stringify(sortKeys(v));

/**
 * Aligns the two arrays on their longest common subsequence of equal elements, so inserting
 * one item at the top reports one addition instead of a change at every index after it.
 * Unmatched elements between two aligned ones are compared pairwise (a modified element
 * shows field-level changes); the rest are additions or removals. Removed elements use
 * their index in the original, everything else the index in the modified array.
 */
function diffArrays(b: unknown[], a: unknown[], path: string): DiffEntry[] {
  if (b.length * a.length > MAX_ALIGNED_CELLS) {
    const out: DiffEntry[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const p = `${path}[${i}]`;
      if (i >= b.length) out.push({ path: p, kind: 'added', after: a[i] });
      else if (i >= a.length) out.push({ path: p, kind: 'removed', before: b[i] });
      else out.push(...diffJson(b[i], a[i], p));
    }
    return out;
  }

  const kb = b.map(canonical);
  const ka = a.map(canonical);
  // lcs[i][j] = length of the LCS of b[i..] and a[j..].
  const lcs = Array.from({ length: b.length + 1 }, () => new Uint32Array(a.length + 1));
  for (let i = b.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) {
      lcs[i]![j] = kb[i] === ka[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffEntry[] = [];
  let removed: number[] = [];
  let added: number[] = [];
  const flush = () => {
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) out.push(...diffJson(b[removed[k]!], a[added[k]!], `${path}[${added[k]}]`));
    for (const i of removed.slice(paired)) out.push({ path: `${path}[${i}]`, kind: 'removed', before: b[i] });
    for (const j of added.slice(paired)) out.push({ path: `${path}[${j}]`, kind: 'added', after: a[j] });
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < b.length || j < a.length) {
    if (i < b.length && j < a.length && kb[i] === ka[j]) {
      flush();
      i++;
      j++;
    } else if (j >= a.length || (i < b.length && lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      removed.push(i++);
    } else {
      added.push(j++);
    }
  }
  flush();
  return out;
}

function kindOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function joinPath(path: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}
