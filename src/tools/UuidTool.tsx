import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, CopyButton, FieldLabel, KeyValueTable, Panel, Segmented, TextArea, TextInput } from '../components/ui';
import { formatUuid, inspectUuid, uuidV4, uuidV7 } from '../lib/uuid';

type Version = 'v4' | 'v7';

function generate(version: Version, count: number): string[] {
  return Array.from({ length: count }, () => (version === 'v4' ? uuidV4() : uuidV7()));
}

export default function UuidTool() {
  const [version, setVersion] = useState<Version>('v4');
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [ids, setIds] = useState(() => generate('v4', 5));

  const regenerate = (v = version, n = count) => setIds(generate(v, n));
  const output = ids.map((id) => formatUuid(id, { uppercase, hyphens, braces })).join('\n');

  return (
    <div className="space-y-4">
      <Panel
        title="Generate"
        actions={
          <>
            <Button variant="primary" onClick={() => regenerate()}>↻ Generate</Button>
            <CopyButton text={output} label="Copy all" />
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <FieldLabel>Version</FieldLabel>
              <Segmented
                label="UUID version"
                value={version}
                onChange={(v) => {
                  setVersion(v);
                  regenerate(v);
                }}
                options={[
                  { value: 'v4', label: 'v4 · random' },
                  { value: 'v7', label: 'v7 · time-ordered' },
                ]}
              />
            </div>
            <div>
              <FieldLabel htmlFor="uuid-count">Count (1–1000)</FieldLabel>
              <TextInput
                id="uuid-count"
                type="number"
                min={1}
                max={1000}
                className="w-24"
                value={count}
                onChange={(e) => {
                  const n = Math.min(1000, Math.max(1, Math.floor(Number(e.target.value) || 1)));
                  setCount(n);
                  regenerate(version, n);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-4 pb-2">
              <Checkbox label="Uppercase" checked={uppercase} onChange={setUppercase} />
              <Checkbox label="Hyphens" checked={hyphens} onChange={setHyphens} />
              <Checkbox label="{Braces}" checked={braces} onChange={setBraces} />
            </div>
          </div>
          <TextArea aria-label="Generated UUIDs" rows={Math.min(12, Math.max(4, ids.length))} readOnly value={output} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generated with <code>crypto.getRandomValues</code>. v7 embeds a millisecond timestamp, so IDs sort by creation time — handy for database keys.
          </p>
        </div>
      </Panel>

      <UuidInspector />
    </div>
  );
}

function UuidInspector() {
  const [input, setInput] = useState('');
  const info = useMemo(() => (input.trim() ? inspectUuid(input) : null), [input]);

  return (
    <Panel title="Inspect / validate">
      <TextInput
        aria-label="UUID to inspect"
        className="w-full font-mono"
        placeholder="Paste a UUID (any case, with or without hyphens/braces/urn:uuid:)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        invalid={info?.valid === false}
      />
      <div className="mt-3">
        {info === null ? null : !info.valid ? (
          <Alert tone="error">Not a valid UUID.</Alert>
        ) : (
          <KeyValueTable
            rows={[
              { label: 'Canonical', value: info.canonical, copy: info.canonical },
              {
                label: 'Version',
                value: info.special === 'nil' ? 'Nil UUID' : info.special === 'max' ? 'Max UUID' : String(info.version),
              },
              { label: 'Variant', value: info.variant },
              ...(info.timestampMs !== undefined
                ? [{ label: 'Embedded time', value: new Date(info.timestampMs).toISOString(), hint: new Date(info.timestampMs).toLocaleString() }]
                : []),
            ]}
          />
        )}
      </div>
    </Panel>
  );
}
