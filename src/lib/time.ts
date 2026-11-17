const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600e3],
  ['month', 30 * 24 * 3600e3],
  ['week', 7 * 24 * 3600e3],
  ['day', 24 * 3600e3],
  ['hour', 3600e3],
  ['minute', 60e3],
  ['second', 1e3],
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "in 3 hours", "2 days ago", "now" … */
export function relativeTime(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  }
  return '';
}

export type TimestampUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

export type ParsedTimestamp = { ok: true; ms: number; source: string } | { ok: false; error: string };

/**
 * Accepts a Unix timestamp (unit auto-detected by magnitude) or any date string
 * the browser can parse (ISO 8601, RFC 2822, …).
 */
export function parseTimestamp(raw: string): ParsedTimestamp {
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Enter a timestamp or date' };

  if (/^-?\d+(\.\d+)?$/.test(input)) {
    const n = Number(input);
    const abs = Math.abs(n);
    const [ms, unit]: [number, TimestampUnit] =
      abs < 1e11 ? [n * 1000, 'seconds']
      : abs < 1e14 ? [n, 'milliseconds']
      : abs < 1e17 ? [n / 1e3, 'microseconds']
      : [n / 1e6, 'nanoseconds'];
    return isValidMs(ms) ? { ok: true, ms, source: `Unix ${unit}` } : { ok: false, error: 'Timestamp out of range' };
  }

  const ms = Date.parse(input);
  return isValidMs(ms) ? { ok: true, ms, source: 'Date string' } : { ok: false, error: 'Unrecognized date format' };
}

function isValidMs(ms: number): boolean {
  return Number.isFinite(ms) && !Number.isNaN(new Date(ms).getTime());
}

export const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** UTC, the local zone, then every IANA zone the browser knows. */
export function allTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.('timeZone') ?? [];
  return [...new Set(['UTC', LOCAL_TZ, ...zones])];
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
