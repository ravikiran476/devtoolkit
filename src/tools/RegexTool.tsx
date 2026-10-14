import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Badge, Checkbox, CopyButton, Panel, TextArea, TextInput, cx } from '../components/ui';

const MAX_MATCHES = 1000;

const FLAGS: Array<{ flag: string; label: string; title: string }> = [
  { flag: 'g', label: 'global', title: 'Find all matches' },
  { flag: 'i', label: 'ignore case', title: 'Case-insensitive' },
  { flag: 'm', label: 'multiline', title: '^ and $ match at line breaks' },
  { flag: 's', label: 'dotAll', title: '. matches newlines' },
  { flag: 'u', label: 'unicode', title: 'Unicode code point matching' },
  { flag: 'y', label: 'sticky', title: 'Match only at lastIndex' },
];

const SAMPLE_TEXT = `Contact the team at support@example.com or sales@devtoolkit.io.
Former address: ada.lovelace+news@mail.example.org (deprecated)
Not an email: user@localhost`;

const REFERENCE: Array<[string, string]> = [
  ['.', 'Any char (except newline)'],
  ['\\d \\w \\s', 'Digit, word char, whitespace'],
  ['\\D \\W \\S', 'Negated classes'],
  ['[abc] [^abc]', 'Set / negated set'],
  ['^ $', 'Start / end of input (or line with m)'],
  ['\\b', 'Word boundary'],
  ['* + ?', '0+, 1+, 0 or 1'],
  ['{n,m}', 'Between n and m'],
  ['*? +?', 'Lazy quantifiers'],
  ['(…) (?:…)', 'Capture / non-capture group'],
  ['(?<name>…)', 'Named group'],
  ['(?=…) (?!…)', 'Lookahead / negative'],
  ['(?<=…) (?<!…)', 'Lookbehind / negative'],
  ['a|b', 'Alternation'],
];

export default function RegexTool() {
  const [pattern, setPattern] = useState('(?<user>[\\w.+-]+)@(?<domain>[\\w-]+(?:\\.[\\w-]+)+)');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState(SAMPLE_TEXT);
  const [replaceOn, setReplaceOn] = useState(false);
  const [replacement, setReplacement] = useState('<$<user> at $<domain>>');

  const result = useMemo(() => {
    if (!pattern) return { ok: true as const, matches: [] as RegExpMatchArray[], truncated: false, regex: null };
    try {
      const regex = new RegExp(pattern, flags);
      // matchAll requires the g flag; we still honor non-global by stopping after the first match.
      const iter = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      const matches: RegExpMatchArray[] = [];
      let truncated = false;
      for (const m of text.matchAll(iter)) {
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }
        matches.push(m);
        if (!flags.includes('g')) break;
      }
      return { ok: true as const, matches, truncated, regex };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [pattern, flags, text]);

  const replaced = useMemo(() => {
    if (!replaceOn || !result.ok || !result.regex) return '';
    return text.replace(result.regex, replacement);
  }, [replaceOn, result, text, replacement]);

  const toggleFlag = (f: string, on: boolean) =>
    setFlags((prev) => {
      const set = new Set(prev.split(''));
      if (on) set.add(f);
      else set.delete(f);
      return FLAGS.map((x) => x.flag).filter((x) => set.has(x)).join('');
    });

  return (
    <div className="space-y-4">
      <Panel title="Pattern" actions={<CopyButton text={`/${pattern}/${flags}`} label="Copy /regex/" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-lg text-slate-400">/</span>
            <TextInput
              aria-label="Regular expression"
              className="flex-1 font-mono"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              invalid={!result.ok}
              placeholder="[a-z]+"
            />
            <span className="text-lg text-slate-400">/</span>
            <span className="min-w-8 text-sm text-indigo-600 dark:text-indigo-400">{flags}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FLAGS.map((f) => (
              <Checkbox key={f.flag} label={`${f.flag} · ${f.label}`} title={f.title} checked={flags.includes(f.flag)} onChange={(on) => toggleFlag(f.flag, on)} />
            ))}
          </div>
          {!result.ok && <Alert tone="error">{result.error}</Alert>}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Test string">
          <TextArea aria-label="Test string" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        </Panel>
        <Panel
          title="Matches highlighted"
          actions={result.ok && <Badge tone={result.matches.length ? 'success' : 'neutral'}>{result.matches.length}{result.truncated && '+'} match{result.matches.length === 1 ? '' : 'es'}</Badge>}
        >
          <pre className="min-h-full whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-100">
            {result.ok ? highlight(text, result.matches) : text}
          </pre>
        </Panel>
      </div>

      {result.ok && result.matches.length > 0 && <MatchTable matches={result.matches} truncated={result.truncated} />}

      <Panel title={<Checkbox label="Replace" checked={replaceOn} onChange={setReplaceOn} />} actions={replaceOn && <CopyButton text={replaced} />}>
        {replaceOn ? (
          <div className="space-y-3">
            <TextInput
              aria-label="Replacement"
              className="w-full font-mono"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="$1, $<name>, $& …"
            />
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-sm dark:bg-slate-950">{replaced}</pre>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enable to preview <code>String.prototype.replace</code> output. Supports <code>$1</code>, <code>$&lt;name&gt;</code>, <code>$&amp;</code>.
          </p>
        )}
      </Panel>

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">Quick reference</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {REFERENCE.map(([token, desc]) => (
            <div key={token} className="flex gap-3">
              <dt className="w-28 shrink-0 font-mono text-xs text-indigo-700 dark:text-indigo-300">{token}</dt>
              <dd className="text-xs text-slate-600 dark:text-slate-300">{desc}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function highlight(text: string, matches: RegExpMatchArray[]): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    const start = m.index ?? 0;
    if (m[0].length === 0 || start < cursor) return;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark
        key={i}
        className={cx(
          'rounded-sm px-0.5 text-inherit',
          i % 2 ? 'bg-sky-200/80 dark:bg-sky-700/60' : 'bg-amber-200/80 dark:bg-amber-600/50',
        )}
      >
        {m[0]}
      </mark>,
    );
    cursor = start + m[0].length;
  });
  out.push(text.slice(cursor));
  return out;
}

function MatchTable({ matches, truncated }: { matches: RegExpMatchArray[]; truncated: boolean }) {
  const groupCount = matches[0].length - 1;
  const named = Object.keys(matches[0].groups ?? {});
  return (
    <Panel title="Match details">
      {truncated && <Alert tone="warning" className="mb-3">Showing the first {MAX_MATCHES} matches.</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1.5 pr-4 font-medium">#</th>
              <th className="py-1.5 pr-4 font-medium">Index</th>
              <th className="py-1.5 pr-4 font-medium">Match</th>
              {named.length > 0
                ? named.map((n) => <th key={n} className="py-1.5 pr-4 font-medium">&lt;{n}&gt;</th>)
                : Array.from({ length: groupCount }, (_, i) => <th key={i} className="py-1.5 pr-4 font-medium">${i + 1}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {matches.map((m, i) => (
              <tr key={i} className="align-top">
                <td className="py-1.5 pr-4 text-slate-400">{i + 1}</td>
                <td className="py-1.5 pr-4 text-slate-500">{m.index}</td>
                <td className="break-all py-1.5 pr-4 font-semibold text-slate-800 dark:text-slate-100">{m[0] || <em className="text-slate-400">(empty)</em>}</td>
                {named.length > 0
                  ? named.map((n) => <td key={n} className="break-all py-1.5 pr-4 text-indigo-700 dark:text-indigo-300">{m.groups?.[n] ?? '—'}</td>)
                  : m.slice(1).map((g, j) => <td key={j} className="break-all py-1.5 pr-4 text-indigo-700 dark:text-indigo-300">{g ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
