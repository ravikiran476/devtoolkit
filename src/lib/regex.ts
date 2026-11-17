export interface RegexInput {
  pattern: string;
  flags: string;
  text: string;
  /** Replacement string, or undefined to skip the replace preview. */
  replacement?: string;
  maxMatches?: number;
}

/** A match in plain data, so it can cross from a worker to the page. */
export interface RegexMatch {
  index: number;
  /** The whole match, then each numbered group (undefined when a group did not take part). */
  groups: Array<string | undefined>;
  named?: Record<string, string | undefined>;
}

export type RegexResult =
  | { ok: true; matches: RegexMatch[]; truncated: boolean; replaced?: string }
  | { ok: false; error: string };

/** Runs a JavaScript regular expression the way the tester shows it. Can be slow on purpose: run it in a worker. */
export function runRegex({ pattern, flags, text, replacement, maxMatches = 1000 }: RegexInput): RegexResult {
  if (!pattern) return { ok: true, matches: [], truncated: false, replaced: replacement === undefined ? undefined : text };
  let regex: RegExp;
  let iter: RegExp;
  try {
    regex = new RegExp(pattern, flags);
    // matchAll requires the g flag; a non-global pattern still stops after its first match.
    iter = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const matches: RegexMatch[] = [];
  let truncated = false;
  for (const m of text.matchAll(iter)) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    matches.push({ index: m.index ?? 0, groups: [...m], ...(m.groups ? { named: { ...m.groups } } : {}) });
    if (!flags.includes('g')) break;
  }
  return { ok: true, matches, truncated, replaced: replacement === undefined ? undefined : text.replace(regex, replacement) };
}
