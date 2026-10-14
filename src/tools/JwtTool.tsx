import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Badge, Button, CopyButton, KeyValueTable, Panel, TextArea, type Tone } from '../components/ui';
import { useNow } from '../hooks/useNow';
import { encodeBase64 } from '../lib/base64';
import { CLAIM_INFO, TIME_CLAIMS, decodeJwt, tokenState, type TokenState } from '../lib/jwt';
import { relativeTime } from '../lib/time';

function buildSample(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'https://auth.example.com',
    sub: 'user_8a7f2c',
    aud: 'devtoolkit',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    roles: ['admin', 'editor'],
    iat: now - 600,
    nbf: now - 600,
    exp: now + 3600,
  };
  return `${encodeBase64(JSON.stringify(header), true)}.${encodeBase64(JSON.stringify(payload), true)}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;
}

const STATE_INFO: Record<TokenState, { tone: Tone; label: string }> = {
  valid: { tone: 'success', label: 'Active' },
  expired: { tone: 'error', label: 'Expired' },
  'not-yet-valid': { tone: 'warning', label: 'Not yet valid' },
  'no-expiry': { tone: 'neutral', label: 'No expiry' },
};

export default function JwtTool() {
  const [token, setToken] = useState(buildSample);
  const now = useNow(1000);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      return { ok: true as const, ...decodeJwt(token) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [token]);

  const segments = token.trim().replace(/^Bearer\s+/i, '').split('.');
  const segmentColors = ['text-rose-600 dark:text-rose-400', 'text-violet-600 dark:text-violet-400', 'text-sky-600 dark:text-sky-400'];

  return (
    <div className="space-y-4">
      <Panel
        title="Encoded token"
        actions={
          <>
            <Button variant="ghost" onClick={() => setToken(buildSample())}>Sample</Button>
            <Button variant="ghost" onClick={() => setToken('')}>Clear</Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextArea
            aria-label="JWT"
            rows={4}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            invalid={decoded?.ok === false}
            placeholder="eyJhbGciOi… (a leading “Bearer ” is fine)"
            className="break-all"
          />
          {decoded?.ok && (
            <p className="break-all rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed dark:bg-slate-950" aria-label="Token segments">
              {segments.map((seg, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-slate-400">.</span>}
                  <span className={segmentColors[i]}>{seg}</span>
                </span>
              ))}
            </p>
          )}
          {decoded === null && <Alert tone="neutral">Paste a JWT to decode it.</Alert>}
          {decoded?.ok === false && <Alert tone="error">{decoded.error}</Alert>}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            🔒 Decoded locally in your browser. The signature is <strong>not</strong> verified — never trust a token's claims without server-side verification.
          </p>
        </div>
      </Panel>

      {decoded?.ok && (
        <>
          <StatusBanner payload={decoded.payload} header={decoded.header} now={now} />
          <div className="grid gap-4 lg:grid-cols-2">
            <JsonPanel title={<span className="text-rose-600 dark:text-rose-400">Header</span>} value={decoded.header} />
            <JsonPanel title={<span className="text-violet-600 dark:text-violet-400">Payload</span>} value={decoded.payload} />
          </div>
          <Panel title="Claims">
            <KeyValueTable
              rows={Object.entries(decoded.payload).map(([key, value]) => {
                const isTime = TIME_CLAIMS.has(key) && typeof value === 'number';
                return {
                  label: (
                    <span>
                      <code className="font-mono text-slate-700 dark:text-slate-200">{key}</code>
                      {CLAIM_INFO[key] && <span className="block text-[11px] font-normal">{CLAIM_INFO[key]}</span>}
                    </span>
                  ),
                  value: typeof value === 'string' ? value : JSON.stringify(value),
                  hint: isTime ? `${new Date(value * 1000).toLocaleString()} · ${relativeTime(value * 1000, now)}` : undefined,
                  copy: typeof value === 'string' ? value : JSON.stringify(value),
                };
              })}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

function StatusBanner({ header, payload, now }: { header: Record<string, unknown>; payload: Record<string, unknown>; now: number }) {
  const state = tokenState(payload, now);
  const { tone, label } = STATE_INFO[state];
  const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf * 1000 : undefined;
  const alg = String(header.alg ?? 'unknown');

  return (
    <div className="space-y-2">
      <Alert tone={tone} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge tone={tone}>{label}</Badge>
        {state === 'valid' && exp && <span>Expires {relativeTime(exp, now)}</span>}
        {state === 'expired' && exp && <span>Expired {relativeTime(exp, now)}</span>}
        {state === 'not-yet-valid' && nbf && <span>Becomes valid {relativeTime(nbf, now)}</span>}
        {state === 'no-expiry' && <span>This token has no <code>exp</code> claim.</span>}
        <span className="ml-auto text-xs opacity-80">
          alg <code className="font-semibold">{alg}</code>
          {header.kid !== undefined && <> · kid <code className="font-semibold">{String(header.kid)}</code></>}
        </span>
      </Alert>
      {alg.toLowerCase() === 'none' && (
        <Alert tone="warning">⚠ <code>alg: none</code> means the token is unsigned. Servers must reject it.</Alert>
      )}
    </div>
  );
}

function JsonPanel({ title, value }: { title: ReactNode; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <Panel title={title} actions={<CopyButton text={text} />}>
      <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-100">{text}</pre>
    </Panel>
  );
}
