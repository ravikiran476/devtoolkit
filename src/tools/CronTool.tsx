import { useMemo, useState } from 'react';
import { Alert, Button, CopyButton, Panel, Select, TextInput, cx } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { compressRanges, dayName, describeCron, monthName, nextRuns, nextRunsInZone, parseCron, type CronField } from '../lib/cron';
import { LOCAL_TZ, allTimeZones, relativeTime } from '../lib/time';

const PRESETS: Array<[string, string]> = [
  ['* * * * *', 'Every minute'],
  ['*/5 * * * *', 'Every 5 min'],
  ['0 * * * *', 'Hourly'],
  ['0 0 * * *', 'Daily at midnight'],
  ['0 9 * * 1-5', 'Weekdays 9am'],
  ['0 0 * * 0', 'Weekly (Sun)'],
  ['0 0 1 * *', 'Monthly'],
  ['30 2 1 1,4,7,10 *', 'Quarterly'],
];

const SYNTAX: Array<[string, string]> = [
  ['*', 'any value'],
  [',', 'list — 1,15'],
  ['-', 'range — 1-5'],
  ['/', 'step — */10, 5-30/5'],
  ['JAN–DEC', 'month names'],
  ['SUN–SAT', 'weekday names (0 and 7 = Sunday)'],
  ['@daily …', '@yearly @monthly @weekly @daily @hourly'],
];

export default function CronTool() {
  const [expr, setExpr] = useState('0 9 * * 1-5');
  // The zone the server running the schedule uses (cron reads times in its own zone).
  const [tz, setTz] = useState(LOCAL_TZ);
  const zones = useMemo(allTimeZones, []);
  const now = useNow(30_000);

  const parsed = useMemo(() => {
    try {
      const schedule = parseCron(expr);
      return { ok: true as const, schedule, description: describeCron(schedule) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [expr]);

  // Recompute upcoming runs when the minute rolls over, not on every tick.
  const minuteKey = Math.floor(now / 60_000);
  const runs = useMemo(
    () => (!parsed.ok ? [] : tz === LOCAL_TZ ? nextRuns(parsed.schedule, new Date(), 10) : nextRunsInZone(parsed.schedule, tz, new Date(), 10)),
    [parsed, tz, minuteKey],
  );

  return (
    <div className="space-y-4">
      <Panel title="Expression" actions={<CopyButton text={expr} />}>
        <div className="space-y-4">
          <TextInput
            aria-label="Cron expression"
            className="h-12 w-full text-center font-mono text-xl tracking-wider"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            invalid={!parsed.ok}
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([value, label]) => (
              <Button key={value} variant={expr === value ? 'primary' : 'secondary'} onClick={() => setExpr(value)} title={value}>
                {label}
              </Button>
            ))}
          </div>
          {parsed.ok ? (
            <p className="rounded-lg bg-indigo-50 px-4 py-3 text-center text-lg font-medium text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">
              “{parsed.description}”
            </p>
          ) : (
            <Alert tone="error">{parsed.error}</Alert>
          )}
        </div>
      </Panel>

      {parsed.ok && (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Fields">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[parsed.schedule.minute, parsed.schedule.hour, parsed.schedule.dayOfMonth, parsed.schedule.month, parsed.schedule.dayOfWeek].map((f) => (
                <FieldCard key={f.name} field={f} />
              ))}
            </div>
          </Panel>
          <Panel
            title="Next 10 runs"
            actions={
              <Select aria-label="Time zone the schedule runs in" value={tz} onChange={(e) => setTz(e.target.value)} className="max-w-56">
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                    {z === LOCAL_TZ ? ' (local)' : ''}
                  </option>
                ))}
              </Select>
            }
          >
            {runs.length === 0 ? (
              <Alert tone="warning">No runs in the next 8 years — this schedule may never fire (e.g. Feb 30).</Alert>
            ) : (
              <ol className="space-y-1.5">
                {runs.map((d, i) => (
                  <li key={d.getTime()} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-mono tabular-nums text-slate-800 dark:text-slate-100">
                      <span className="mr-2 text-xs text-slate-400">{i + 1}.</span>
                      {d.toLocaleString(undefined, { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{relativeTime(d.getTime(), now)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      <Panel title="Syntax">
        <div className="mb-3 overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-300">{`┌───────────── minute (0–59)
│ ┌─────────── hour (0–23)
│ │ ┌───────── day of month (1–31)
│ │ │ ┌─────── month (1–12 or JAN–DEC)
│ │ │ │ ┌───── day of week (0–7 or SUN–SAT)
* * * * *`}</pre>
        </div>
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {SYNTAX.map(([token, desc]) => (
            <div key={token} className="flex gap-3">
              <dt className="w-20 shrink-0 font-mono text-xs text-indigo-700 dark:text-indigo-300">{token}</dt>
              <dd className="text-xs text-slate-600 dark:text-slate-300">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          When both day-of-month and day-of-week are restricted, a day matches if <em>either</em> field matches (standard cron behavior).
        </p>
      </Panel>
    </div>
  );
}

function FieldCard({ field }: { field: CronField }) {
  const label = field.name === 'Month' ? monthName : field.name === 'Day of week' ? dayName : String;
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{field.name}</div>
      <div className="mt-1 font-mono text-base font-semibold text-indigo-700 dark:text-indigo-300">{field.raw}</div>
      <div className={cx('mt-1 text-xs', field.full ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200')}>
        {field.full ? 'every' : compressRanges(field.values, label)}
      </div>
    </div>
  );
}
