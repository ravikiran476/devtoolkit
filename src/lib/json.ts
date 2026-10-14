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

  if (tb === 'array') {
    const b = before as unknown[];
    const a = after as unknown[];
    const out: DiffEntry[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const p = `${path}[${i}]`;
      if (i >= b.length) out.push({ path: p, kind: 'added', after: a[i] });
      else if (i >= a.length) out.push({ path: p, kind: 'removed', before: b[i] });
      else out.push(...diffJson(b[i], a[i], p));
    }
    return out;
  }

  return Object.is(before, after) ? [] : [{ path, kind: 'changed', before, after }];
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
