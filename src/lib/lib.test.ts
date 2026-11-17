import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64 } from './base64';
import { compressRanges, describeCron, nextRuns, nextRunsInZone, parseCron, zoneOffsetMs } from './cron';
import { runRegex } from './regex';
import { diffJson, jsonWarnings, locateJsonError, parseJson, reformatJson, sortKeys } from './json';
import { decodeJwt, tokenState } from './jwt';
import { parseTimestamp } from './time';
import { formatUuid, inspectUuid, uuidV4, uuidV7 } from './uuid';

describe('json', () => {
  it('reports line and column for syntax errors', () => {
    expect(parseJson('{\n  "a": 1,\n  "b": }')).toEqual({ ok: false, error: 'Unexpected "}"', line: 3, column: 8 });
    expect(parseJson('{"a":1,}')).toMatchObject({ error: 'Trailing comma is not allowed in JSON', line: 1, column: 8 });
    expect(parseJson("{'a':1}")).toMatchObject({ error: 'Expected a double-quoted property name but found "\'"' });
    expect(parseJson('[1, 2')).toMatchObject({ error: "Expected ',' or ']' after array element but found end of input" });
    expect(parseJson('')).toMatchObject({ error: 'Unexpected end of input', line: 1, column: 1 });
  });

  it('locator agrees with JSON.parse on valid input', () => {
    for (const s of ['0', '-1.5e+3', '"\\u00e9\\n"', '{"a":[true,false,null,{}],"b":[]}', ' [ ] ']) {
      expect(locateJsonError(s)).toBeNull();
    }
    for (const s of ['01', '1.', '"\\x"', '{"a" 1}', '[1]x', 'nul']) {
      expect(locateJsonError(s)).not.toBeNull();
    }
  });

  it('sorts keys recursively', () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: { d: 1, c: [{ z: 1, y: 2 }] } }))).toBe(
      '{"a":{"c":[{"y":2,"z":1}],"d":1},"b":1}',
    );
  });

  it('diffs nested structures', () => {
    const d = diffJson({ a: 1, b: [1, 2], c: { x: 1 }, 'odd key': 1 }, { a: 2, b: [1], c: { x: 1, y: 2 } });
    expect(d).toEqual([
      { path: '$.a', kind: 'changed', before: 1, after: 2 },
      { path: '$.b[1]', kind: 'removed', before: 2 },
      { path: '$.c.y', kind: 'added', after: 2 },
      { path: '$["odd key"]', kind: 'removed', before: 1 },
    ]);
  });

  it('treats type changes as a single change', () => {
    expect(diffJson({ a: [1] }, { a: { 0: 1 } })).toHaveLength(1);
  });

  it('aligns arrays, so an insertion at the top is one addition', () => {
    const before = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(diffJson(before, [{ id: 0 }, ...before])).toEqual([{ path: '$[0]', kind: 'added', after: { id: 0 } }]);
    expect(diffJson(before, [before[0], before[2]])).toEqual([{ path: '$[1]', kind: 'removed', before: { id: 2 } }]);
    // A modified element between unchanged ones shows field-level changes.
    expect(diffJson(['a', { id: 2, n: 'x' }, 'c'], ['new', 'a', { id: 2, n: 'y' }, 'c'])).toEqual([
      { path: '$[0]', kind: 'added', after: 'new' },
      { path: '$[2].n', kind: 'changed', before: 'x', after: 'y' },
    ]);
    // Key order does not make elements different.
    expect(diffJson([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toEqual([]);
  });

  it('warns about values JSON.parse would change', () => {
    const text = '{\n  "id": 12345678901234567890,\n  "pi": 3.14159265358979323846,\n  "ok": 9007199254740991,\n  "a": 1,\n  "a": 2,\n  "nested": [{"a": 1}, {"a": 2}],\n  "big": 1e400\n}';
    expect(jsonWarnings(text)).toEqual([
      { line: 2, message: '12345678901234567890 is larger than 2^53 and is read as 12345678901234567000' },
      { line: 3, message: '3.14159265358979323846 has more digits than a double can hold and is read as 3.141592653589793' },
      { line: 6, message: 'Duplicate key "a": only the last value is kept' },
      { line: 8, message: '1e400 is out of range and is read as Infinity' },
    ]);
    expect(jsonWarnings('{"a": "12345678901234567890", "b": [1.5, -0.1]}')).toEqual([]);
  });

  it('reformats without changing any value', () => {
    const text = '{"id":12345678901234567890,"s":"caf\\u00e9 \\"q\\"","a":1,"a":2,"e":{},"l":[],"n":[1,{"x":null}]}';
    const pretty = reformatJson(text, 2);
    expect(pretty).toContain('"id": 12345678901234567890');
    expect(pretty).toContain('"s": "caf\\u00e9 \\"q\\""');
    expect(reformatJson(pretty, 0)).toBe(text);
    // Same layout as JSON.stringify for values it represents exactly.
    const plain = '{"a":[1,{"b":[]}],"c":{},"d":"x"}';
    for (const indent of [2, 4, '\t'] as const) expect(reformatJson(plain, indent)).toBe(JSON.stringify(JSON.parse(plain), null, indent));
  });
});

describe('regex', () => {
  it('returns matches as plain data, with numbered and named groups', () => {
    const r = runRegex({ pattern: '(?<user>\\w+)@(\\w+)', flags: 'g', text: 'a@b, c@d', replacement: '$<user>' });
    expect(r).toEqual({
      ok: true,
      truncated: false,
      replaced: 'a, c',
      matches: [
        { index: 0, groups: ['a@b', 'a', 'b'], named: { user: 'a' } },
        { index: 5, groups: ['c@d', 'c', 'd'], named: { user: 'c' } },
      ],
    });
    expect(structuredClone(r)).toEqual(r); // can be posted from a worker
  });

  it('stops after the first match without g, caps matches, and reports bad patterns', () => {
    expect(runRegex({ pattern: 'a', flags: '', text: 'aaa' })).toMatchObject({ matches: [{ index: 0 }] });
    expect(runRegex({ pattern: 'a', flags: 'g', text: 'aaaa', maxMatches: 2 })).toMatchObject({ truncated: true, matches: [{}, {}] });
    expect(runRegex({ pattern: '(', flags: '', text: '' })).toMatchObject({ ok: false });
  });
});

describe('base64', () => {
  it('round-trips unicode', () => {
    const text = 'héllo 👋 世界';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
    expect(decodeBase64(encodeBase64(text, true))).toBe(text);
  });

  it('produces url-safe output without padding', () => {
    expect(encodeBase64('??>', true)).toBe('Pz8-');
    expect(encodeBase64('a', true)).toBe('YQ');
  });

  it('rejects invalid input', () => {
    expect(() => decodeBase64('abc$')).toThrow();
    expect(() => decodeBase64('abcde')).toThrow();
  });
});

describe('jwt', () => {
  const token = [
    encodeBase64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), true),
    encodeBase64(JSON.stringify({ sub: '42', exp: 2000, nbf: 1000 }), true),
    'sig',
  ].join('.');

  it('decodes header and payload, stripping a Bearer prefix', () => {
    const d = decodeJwt(`Bearer ${token}`);
    expect(d.header.alg).toBe('HS256');
    expect(d.payload.sub).toBe('42');
  });

  it('computes token state', () => {
    const { payload } = decodeJwt(token);
    expect(tokenState(payload, 500_000)).toBe('not-yet-valid');
    expect(tokenState(payload, 1_500_000)).toBe('valid');
    expect(tokenState(payload, 2_000_000)).toBe('expired');
  });

  it('rejects malformed tokens', () => {
    expect(() => decodeJwt('a.b')).toThrow(/3 dot-separated/);
    expect(() => decodeJwt('!!!.e30.x')).toThrow(/Header/);
  });
});

describe('timestamps', () => {
  it('auto-detects units by magnitude', () => {
    expect(parseTimestamp('1700000000')).toMatchObject({ ok: true, ms: 1700000000000, source: 'Unix seconds' });
    expect(parseTimestamp('1700000000000')).toMatchObject({ ok: true, ms: 1700000000000, source: 'Unix milliseconds' });
    expect(parseTimestamp('1700000000000000')).toMatchObject({ ok: true, ms: 1700000000000 });
    expect(parseTimestamp('2023-11-14T22:13:20Z')).toMatchObject({ ok: true, ms: 1700000000000 });
    expect(parseTimestamp('not a date').ok).toBe(false);
  });
});

describe('uuid', () => {
  it('generates valid v4 and v7', () => {
    expect(inspectUuid(uuidV4())).toMatchObject({ valid: true, version: 4, variant: 'RFC 9562' });
    const v7 = inspectUuid(uuidV7(1700000000123));
    expect(v7).toMatchObject({ valid: true, version: 7, timestampMs: 1700000000123 });
  });

  it('formats and parses variants', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const f = formatUuid(id, { uppercase: true, hyphens: false, braces: true });
    expect(f).toBe('{123E4567E89B42D3A456426614174000}');
    expect(inspectUuid(f)).toMatchObject({ valid: true, canonical: id });
    expect(inspectUuid('nope').valid).toBe(false);
  });
});

describe('cron', () => {
  it('computes next runs for step expressions', () => {
    const runs = nextRuns(parseCron('*/15 * * * *'), new Date(2026, 0, 1, 10, 7), 3);
    expect(runs.map((d) => d.getMinutes())).toEqual([15, 30, 45]);
  });

  it('finds rare dates like Feb 29', () => {
    const [run] = nextRuns(parseCron('0 0 29 2 *'), new Date(2026, 0, 1), 1);
    expect(run.getFullYear()).toBe(2028);
  });

  it('uses OR semantics when both day fields are restricted', () => {
    const runs = nextRuns(parseCron('0 0 13 * FRI'), new Date(2026, 1, 1), 3);
    // Feb 2026: Fri 6th, Fri 13th (also the 13th), Fri 20th
    expect(runs.map((d) => d.getDate())).toEqual([6, 13, 20]);
  });

  it('normalizes Sunday=7 and supports names and macros', () => {
    expect(parseCron('0 0 * * 7').dayOfWeek.values).toEqual([0]);
    expect(parseCron('0 0 * jan-mar mon').month.values).toEqual([1, 2, 3]);
    expect(parseCron('@daily').hour.values).toEqual([0]);
  });

  it('describes schedules in English', () => {
    expect(describeCron(parseCron('0 9 * * 1-5'))).toBe('At 09:00 on Monday–Friday');
    expect(describeCron(parseCron('*/5 * * * *'))).toBe('Every 5 minutes');
    expect(describeCron(parseCron('30 8,18 1 * *'))).toBe('At 08:30, 18:30 on day 1 of the month');
  });

  it('rejects invalid expressions', () => {
    expect(() => parseCron('60 * * * *')).toThrow(/Minute/);
    expect(() => parseCron('* * *')).toThrow(/5 fields/);
    expect(() => parseCron('5-1 * * * *')).toThrow(/reversed/);
  });

  it('computes runs in another time zone, across daylight-saving changes', () => {
    const iso = (ds: Date[]) => ds.map((d) => d.toISOString());
    // 09:00 New York is 14:00 UTC in winter and 13:00 UTC in summer.
    expect(iso(nextRunsInZone(parseCron('0 9 * * *'), 'America/New_York', new Date('2026-03-07T00:00:00Z'), 3))).toEqual([
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ]);
    // 02:30 does not exist on 8 March 2026 in New York (clocks jump 02:00 → 03:00): no run that day.
    expect(iso(nextRunsInZone(parseCron('30 2 * * *'), 'America/New_York', new Date('2026-03-07T12:00:00Z'), 2))).toEqual([
      '2026-03-09T06:30:00.000Z',
      '2026-03-10T06:30:00.000Z',
    ]);
    // 01:30 happens twice on 1 November 2026; it runs once.
    expect(nextRunsInZone(parseCron('30 1 1 11 *'), 'America/New_York', new Date('2026-10-31T00:00:00Z'), 1)).toHaveLength(1);
    expect(iso(nextRunsInZone(parseCron('*/15 * * * *'), 'Asia/Kolkata', new Date('2026-01-01T10:07:00Z'), 2))).toEqual([
      '2026-01-01T10:15:00.000Z',
      '2026-01-01T10:30:00.000Z',
    ]);
    expect(zoneOffsetMs('Asia/Kolkata', Date.UTC(2026, 0, 1))).toBe(5.5 * 3600e3);
  });

  it('compresses ranges', () => {
    expect(compressRanges([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7, 8');
  });
});
