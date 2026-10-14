const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: string[];
  nameOffset?: number;
}

const SPECS: FieldSpec[] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31 },
  { name: 'Month', min: 1, max: 12, names: MONTHS, nameOffset: 1 },
  { name: 'Day of week', min: 0, max: 7, names: DAYS, nameOffset: 0 },
];

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface CronField {
  name: string;
  raw: string;
  values: number[];
  /** Vixie-cron semantics: a field is "restricted" unless it starts with `*`. */
  restricted: boolean;
  /** True when every possible value is included. */
  full: boolean;
}

export interface CronSchedule {
  expression: string;
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

/** Parses a standard 5-field cron expression (or @macro). Throws with a readable message on error. */
export function parseCron(expression: string): CronSchedule {
  const trimmed = expression.trim();
  let expanded = trimmed;
  if (trimmed.startsWith('@')) {
    const macro = MACROS[trimmed.toLowerCase()];
    if (!macro) throw new Error(`Unsupported macro "${trimmed}"`);
    expanded = macro;
  }

  const raw = expanded.split(/\s+/).filter(Boolean);
  if (raw.length !== 5) {
    throw new Error(`Expected 5 fields (minute hour day-of-month month day-of-week), got ${raw.length}`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = raw.map((r, i) => parseField(r, SPECS[i]));
  return { expression: trimmed, minute, hour, dayOfMonth, month, dayOfWeek };
}

function parseField(raw: string, spec: FieldSpec): CronField {
  const set = new Set<number>();
  for (const part of raw.split(',')) {
    if (!part) throw new Error(`${spec.name}: empty list item in "${raw}"`);
    const pieces = part.split('/');
    if (pieces.length > 2) throw new Error(`${spec.name}: invalid step syntax "${part}"`);
    const [range, stepStr] = pieces;

    let step = 1;
    if (stepStr !== undefined) {
      if (!/^\d+$/.test(stepStr) || Number(stepStr) === 0) throw new Error(`${spec.name}: invalid step "${stepStr}"`);
      step = Number(stepStr);
    }

    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = spec.min;
      hi = spec.max;
    } else if (range.includes('-')) {
      const bounds = range.split('-');
      if (bounds.length !== 2 || !bounds[0] || !bounds[1]) throw new Error(`${spec.name}: invalid range "${range}"`);
      lo = parseValue(bounds[0], spec);
      hi = parseValue(bounds[1], spec);
      if (lo > hi) throw new Error(`${spec.name}: range "${range}" is reversed`);
    } else {
      lo = parseValue(range, spec);
      hi = stepStr !== undefined ? spec.max : lo;
    }
    for (let v = lo; v <= hi; v += step) set.add(v);
  }

  let values = [...set];
  if (spec.name === 'Day of week') values = values.map((v) => (v === 7 ? 0 : v));
  values = [...new Set(values)].sort((a, b) => a - b);

  const domainSize = spec.name === 'Day of week' ? 7 : spec.max - spec.min + 1;
  return { name: spec.name, raw, values, restricted: !raw.startsWith('*'), full: values.length === domainSize };
}

function parseValue(token: string, spec: FieldSpec): number {
  let n: number;
  if (/^\d+$/.test(token)) {
    n = Number(token);
  } else {
    const idx = spec.names?.indexOf(token.toUpperCase()) ?? -1;
    if (idx < 0) throw new Error(`${spec.name}: "${token}" is not a valid value`);
    n = idx + (spec.nameOffset ?? 0);
  }
  if (n < spec.min || n > spec.max) throw new Error(`${spec.name}: ${token} is outside ${spec.min}–${spec.max}`);
  return n;
}

function dayMatches(s: CronSchedule, d: Date): boolean {
  const dom = s.dayOfMonth.values.includes(d.getDate());
  const dow = s.dayOfWeek.values.includes(d.getDay());
  // Classic cron: when both day fields are restricted, a day matches if EITHER matches.
  return s.dayOfMonth.restricted && s.dayOfWeek.restricted ? dom || dow : dom && dow;
}

/** Next `count` run times strictly after `from`, in local time. */
export function nextRuns(s: CronSchedule, from: Date = new Date(), count = 10): Date[] {
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  const horizon = from.getTime() + 8 * 366 * 24 * 3600e3;
  const out: Date[] = [];
  for (let guard = 0; out.length < count && d.getTime() <= horizon && guard < 200_000; guard++) {
    if (!s.month.values.includes(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
    } else if (!dayMatches(s, d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
    } else if (!s.hour.values.includes(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else if (!s.minute.values.includes(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0);
    } else {
      out.push(new Date(d));
      d.setMinutes(d.getMinutes() + 1, 0, 0);
    }
  }
  return out;
}

/** Collapses runs of 3+ consecutive numbers: [1,2,3,5] → "1–3, 5". */
export function compressRanges(nums: number[], label: (n: number) => string = String): string {
  const parts: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) parts.push(`${label(nums[i])}–${label(nums[j])}`);
    else for (let k = i; k <= j; k++) parts.push(label(nums[k]));
    i = j + 1;
  }
  return parts.join(', ');
}

export const monthName = (n: number) => MONTH_NAMES[n - 1];
export const dayName = (n: number) => DAY_NAMES[n];

const pad = (n: number) => String(n).padStart(2, '0');
const stepOf = (raw: string) => /^\*\/(\d+)$/.exec(raw)?.[1];
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Human-readable English description of a schedule. */
export function describeCron(s: CronSchedule): string {
  const { minute: m, hour: h, dayOfMonth: dom, month, dayOfWeek: dow } = s;
  const single = (f: CronField) => f.values.length === 1 && !f.raw.includes('*');

  let time: string;
  if (single(m) && single(h)) {
    time = `At ${pad(h.values[0])}:${pad(m.values[0])}`;
  } else if (single(m) && !h.full && !h.raw.includes('/') && h.values.length <= 6) {
    time = `At ${h.values.map((x) => `${pad(x)}:${pad(m.values[0])}`).join(', ')}`;
  } else {
    const mStep = stepOf(m.raw);
    const minutePart = m.full ? 'Every minute' : mStep ? `Every ${mStep} minutes` : `At minute ${compressRanges(m.values)}`;
    const hStep = stepOf(h.raw);
    let hourPart = '';
    if (h.full) hourPart = m.full || mStep ? '' : 'past every hour';
    else if (hStep) hourPart = m.full || mStep ? `of every ${ordinal(Number(hStep))} hour` : `past every ${ordinal(Number(hStep))} hour`;
    else hourPart = `${m.full || mStep ? 'during' : 'past'} hour ${compressRanges(h.values)}`;
    time = [minutePart, hourPart].filter(Boolean).join(' ');
  }

  const domStep = stepOf(dom.raw);
  const domPart = dom.full ? '' : domStep ? `every ${ordinal(Number(domStep))} day of the month` : `on day ${compressRanges(dom.values)} of the month`;
  const dowPart = dow.full ? '' : `on ${compressRanges(dow.values, dayName)}`;
  const days =
    domPart && dowPart ? (dom.restricted && dow.restricted ? `${domPart} or ${dowPart}` : `${domPart} if it's ${dowPart.slice(3)}`)
    : domPart || dowPart;
  const months = month.full ? '' : `in ${compressRanges(month.values, monthName)}`;

  return [time, days, months].filter(Boolean).join(' ');
}
