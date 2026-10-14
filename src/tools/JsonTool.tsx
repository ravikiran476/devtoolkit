import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Checkbox, CopyButton, Panel, Segmented, Select, TextArea } from '../components/ui';
import { describeJsonValue, diffJson, parseJson, sortKeys, type DiffEntry, type ParseResult } from '../lib/json';

const SAMPLE_LEFT = `{"name":"devtoolkit","version":"0.1.0","tags":["json","jwt","regex"],"author":{"name":"Ada","active":true},"stars":42,"license":null}`;
const SAMPLE_RIGHT = `{"name":"devtoolkit","version":"0.2.0","tags":["json","jwt","cron"],"author":{"name":"Ada","active":true,"email":"ada@example.com"},"stars":42}`;

export default function JsonTool() {
  const [tab, setTab] = useState<'format' | 'diff'>('format');
  return (
    <div className="space-y-4">
      <Segmented
        label="JSON mode"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'format', label: 'Format & validate' },
          { value: 'diff', label: 'Diff' },
        ]}
      />
      {/* Both stay mounted so switching tabs keeps your input. */}
      <div hidden={tab !== 'format'}>
        <JsonFormatter />
      </div>
      <div hidden={tab !== 'diff'}>
        <JsonDiff />
      </div>
    </div>
  );
}

function ParseStatus({ text, result }: { text: string; result: ParseResult }) {
  if (!text.trim()) return <Alert tone="neutral">Paste or type JSON to begin.</Alert>;
  if (result.ok) {
    const bytes = new TextEncoder().encode(text).length;
    return (
      <Alert tone="success">
        ✓ Valid JSON · {describeJsonValue(result.value)} · {bytes.toLocaleString()} bytes
      </Alert>
    );
  }
  return (
    <Alert tone="error">
      <span className="font-semibold">Invalid JSON</span>
      {result.line !== undefined && ` at line ${result.line}, column ${result.column}`}: {result.error}
    </Alert>
  );
}

function JsonFormatter() {
  const [input, setInput] = useState(SAMPLE_LEFT);
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty');
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2');
  const [sorted, setSorted] = useState(false);

  const parsed = useMemo(() => parseJson(input), [input]);
  const output = useMemo(() => {
    if (!parsed.ok) return '';
    const value = sorted ? sortKeys(parsed.value) : parsed.value;
    return mode === 'minify' ? JSON.stringify(value) : JSON.stringify(value, null, indent === 'tab' ? '\t' : Number(indent));
  }, [parsed, mode, indent, sorted]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Input"
        actions={
          <>
            <Button variant="ghost" onClick={() => setInput(SAMPLE_LEFT)}>Sample</Button>
            <Button variant="ghost" onClick={() => setInput('')}>Clear</Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextArea
            aria-label="JSON input"
            rows={18}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            invalid={!!input.trim() && !parsed.ok}
            placeholder='{"hello": "world"}'
          />
          <ParseStatus text={input} result={parsed} />
        </div>
      </Panel>

      <Panel title="Output" actions={<CopyButton text={output} />}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Output style"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pretty', label: 'Pretty' },
                { value: 'minify', label: 'Minify' },
              ]}
            />
            <Select aria-label="Indentation" value={indent} disabled={mode === 'minify'} onChange={(e) => setIndent(e.target.value as typeof indent)}>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tabs</option>
            </Select>
            <Checkbox label="Sort keys" checked={sorted} onChange={setSorted} />
          </div>
          <TextArea aria-label="Formatted JSON" rows={16} readOnly value={output} placeholder="Formatted output appears here" />
        </div>
      </Panel>
    </div>
  );
}

const DIFF_STYLE: Record<DiffEntry['kind'], { sign: string; tone: 'success' | 'error' | 'warning'; row: string }> = {
  added: { sign: '+', tone: 'success', row: 'bg-emerald-50/60 dark:bg-emerald-950/30' },
  removed: { sign: '−', tone: 'error', row: 'bg-rose-50/60 dark:bg-rose-950/30' },
  changed: { sign: '~', tone: 'warning', row: 'bg-amber-50/60 dark:bg-amber-950/30' },
};

function preview(v: unknown): string {
  const s = JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function JsonDiff() {
  const [left, setLeft] = useState(SAMPLE_LEFT);
  const [right, setRight] = useState(SAMPLE_RIGHT);
  const pl = useMemo(() => parseJson(left), [left]);
  const pr = useMemo(() => parseJson(right), [right]);
  const diff = useMemo(() => (pl.ok && pr.ok ? diffJson(pl.value, pr.value) : null), [pl, pr]);

  const counts = diff?.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: 'Original', value: left, set: setLeft, result: pl },
          { title: 'Modified', value: right, set: setRight, result: pr },
        ].map((side) => (
          <Panel key={side.title} title={side.title} actions={<Button variant="ghost" onClick={() => side.set('')}>Clear</Button>}>
            <div className="space-y-3">
              <TextArea
                aria-label={`${side.title} JSON`}
                rows={12}
                value={side.value}
                onChange={(e) => side.set(e.target.value)}
                invalid={!!side.value.trim() && !side.result.ok}
              />
              <ParseStatus text={side.value} result={side.result} />
            </div>
          </Panel>
        ))}
      </div>

      <Panel
        title="Differences"
        actions={
          <>
            <Button variant="ghost" onClick={() => { setLeft(right); setRight(left); }}>⇄ Swap</Button>
            {counts && (
              <div className="flex gap-1.5">
                <Badge tone="success">+{counts.added ?? 0}</Badge>
                <Badge tone="error">−{counts.removed ?? 0}</Badge>
                <Badge tone="warning">~{counts.changed ?? 0}</Badge>
              </div>
            )}
          </>
        }
      >
        {!diff ? (
          <Alert tone="neutral">Both sides must be valid JSON to compare.</Alert>
        ) : diff.length === 0 ? (
          <Alert tone="success">✓ The documents are structurally identical.</Alert>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 font-mono text-xs dark:divide-slate-800 dark:border-slate-800">
            {diff.map((d) => {
              const style = DIFF_STYLE[d.kind];
              return (
                <li key={`${d.kind}:${d.path}`} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 ${style.row}`}>
                  <Badge tone={style.tone}>{style.sign}</Badge>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{d.path}</span>
                  <span className="min-w-0 break-all text-slate-600 dark:text-slate-300">
                    {d.kind === 'added' && preview(d.after)}
                    {d.kind === 'removed' && <span className="line-through">{preview(d.before)}</span>}
                    {d.kind === 'changed' && (
                      <>
                        <span className="line-through opacity-70">{preview(d.before)}</span> → {preview(d.after)}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
