import { useMemo, useState } from 'react';
import { Alert, Badge, Button, CopyButton, FieldLabel, KeyValueTable, Panel, Select, TextInput } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { LOCAL_TZ, allTimeZones, pad2, parseTimestamp, relativeTime } from '../lib/time';

/** Value for <input type="datetime-local"> in local time. */
function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export default function TimestampTool() {
  const now = useNow(1000);
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [tz, setTz] = useState(LOCAL_TZ);
  const zones = useMemo(allTimeZones, []);

  const parsed = useMemo(() => parseTimestamp(input), [input]);
  const nowSec = Math.floor(now / 1000);

  return (
    <div className="space-y-4">
      <Panel title="Current time" actions={<Badge tone="success">● live</Badge>}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Unix seconds', value: String(nowSec) },
            { label: 'Unix milliseconds', value: String(now) },
            { label: 'ISO 8601 (UTC)', value: new Date(now).toISOString() },
          ].map((c) => (
            <div key={c.label} className="min-w-0">
              <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{c.value}</span>
                <CopyButton text={c.value} variant="ghost" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Convert">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <FieldLabel htmlFor="ts-input">Timestamp or date (seconds, ms, µs, ns, ISO 8601, RFC 2822…)</FieldLabel>
            <div className="flex gap-2">
              <TextInput id="ts-input" className="flex-1 font-mono" value={input} onChange={(e) => setInput(e.target.value)} invalid={!parsed.ok && !!input.trim()} />
              <Button onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now</Button>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="ts-picker">Or pick (local time)</FieldLabel>
            <TextInput
              id="ts-picker"
              type="datetime-local"
              step={1}
              value={parsed.ok ? toDateTimeLocal(parsed.ms) : ''}
              onChange={(e) => {
                const ms = new Date(e.target.value).getTime();
                if (!Number.isNaN(ms)) setInput(String(Math.floor(ms / 1000)));
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          {!parsed.ok ? (
            <Alert tone={input.trim() ? 'error' : 'neutral'}>{parsed.error}</Alert>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Interpreted as <Badge tone="info">{parsed.source}</Badge>
                </span>
                <Select aria-label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} className="max-w-64">
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                      {z === LOCAL_TZ ? ' (local)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <Results ms={parsed.ms} now={now} tz={tz} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Results({ ms, now, tz }: { ms: number; now: number; tz: string }) {
  const d = new Date(ms);
  const inZone = new Intl.DateTimeFormat(undefined, { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }).format(d);
  const seconds = String(Math.floor(ms / 1000));
  const millis = String(Math.round(ms));
  const iso = d.toISOString();
  const utc = d.toUTCString();
  return (
    <KeyValueTable
      rows={[
        { label: 'Unix seconds', value: seconds, copy: seconds },
        { label: 'Unix milliseconds', value: millis, copy: millis },
        { label: 'ISO 8601', value: iso, copy: iso },
        { label: 'RFC 7231 (HTTP)', value: utc, copy: utc },
        { label: tz, value: inZone, copy: inZone },
        { label: 'Relative', value: relativeTime(ms, now) },
      ]}
    />
  );
}
