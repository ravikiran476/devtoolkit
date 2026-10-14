import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, CopyButton, KeyValueTable, Panel, Segmented, TextArea } from '../components/ui';
import { decodeBase64, encodeBase64 } from '../lib/base64';

type Mode = 'url' | 'base64';
type Direction = 'encode' | 'decode';

export default function EncodeTool() {
  const [mode, setMode] = useState<Mode>('url');
  const [direction, setDirection] = useState<Direction>('encode');
  const [input, setInput] = useState('https://example.com/search?q=dev tools & more&lang=en#résumé');
  const [fullUri, setFullUri] = useState(false);
  const [plusAsSpace, setPlusAsSpace] = useState(true);
  const [urlSafe, setUrlSafe] = useState(false);

  const result = useMemo((): { ok: true; value: string } | { ok: false; error: string } => {
    try {
      if (mode === 'url') {
        if (direction === 'encode') return { ok: true, value: fullUri ? encodeURI(input) : encodeURIComponent(input) };
        const src = plusAsSpace ? input.replace(/\+/g, ' ') : input;
        return { ok: true, value: fullUri ? decodeURI(src) : decodeURIComponent(src) };
      }
      return { ok: true, value: direction === 'encode' ? encodeBase64(input, urlSafe) : decodeBase64(input) };
    } catch (e) {
      const msg = e instanceof URIError ? 'Malformed percent-encoding sequence' : (e as Error).message;
      return { ok: false, error: msg };
    }
  }, [mode, direction, input, fullUri, plusAsSpace, urlSafe]);

  const output = result.ok ? result.value : '';

  const swap = () => {
    setInput(output);
    setDirection(direction === 'encode' ? 'decode' : 'encode');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Encoding"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'url', label: 'URL' },
            { value: 'base64', label: 'Base64' },
          ]}
        />
        <Segmented
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'encode', label: 'Encode' },
            { value: 'decode', label: 'Decode' },
          ]}
        />
        {mode === 'url' && (
          <Checkbox
            label="Whole URI (encodeURI)"
            title="Keeps reserved characters like : / ? # & = intact. Off = encodeURIComponent (for a single query value)."
            checked={fullUri}
            onChange={setFullUri}
          />
        )}
        {mode === 'url' && direction === 'decode' && (
          <Checkbox label="Treat + as space" title="application/x-www-form-urlencoded style" checked={plusAsSpace} onChange={setPlusAsSpace} />
        )}
        {mode === 'base64' && direction === 'encode' && (
          <Checkbox label="URL-safe (Base64URL, no padding)" checked={urlSafe} onChange={setUrlSafe} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={direction === 'encode' ? 'Plain text' : mode === 'url' ? 'Encoded URL' : 'Base64'}
          actions={<Button variant="ghost" onClick={() => setInput('')}>Clear</Button>}
        >
          <TextArea aria-label="Input" rows={10} value={input} onChange={(e) => setInput(e.target.value)} invalid={!result.ok} />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{input.length.toLocaleString()} chars</p>
        </Panel>
        <Panel
          title={direction === 'encode' ? (mode === 'url' ? 'Encoded URL' : 'Base64') : 'Plain text'}
          actions={
            <>
              <Button variant="ghost" onClick={swap} disabled={!result.ok} title="Use output as input and flip direction">⇄ Swap</Button>
              <CopyButton text={output} />
            </>
          }
        >
          {result.ok ? (
            <>
              <TextArea aria-label="Output" rows={10} readOnly value={output} />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{output.length.toLocaleString()} chars</p>
            </>
          ) : (
            <Alert tone="error">{result.error}</Alert>
          )}
        </Panel>
      </div>

      {mode === 'url' && <UrlBreakdown candidates={[input, output]} />}
    </div>
  );
}

function UrlBreakdown({ candidates }: { candidates: string[] }) {
  const url = useMemo(() => {
    for (const c of candidates) {
      const s = c.trim();
      if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) continue;
      try {
        return new URL(s);
      } catch {
        // not a URL; try the next candidate
      }
    }
    return null;
  }, [candidates]);

  if (!url) return null;
  const params = [...url.searchParams.entries()];

  return (
    <Panel title="URL breakdown">
      <KeyValueTable
        rows={[
          { label: 'Protocol', value: url.protocol, copy: url.protocol },
          { label: 'Host', value: url.host, copy: url.host },
          ...(url.username ? [{ label: 'Username', value: url.username }] : []),
          { label: 'Path', value: decodeSafe(url.pathname), copy: url.pathname },
          ...(url.hash ? [{ label: 'Fragment', value: decodeSafe(url.hash), copy: url.hash }] : []),
        ]}
      />
      {params.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Query parameters ({params.length})</h4>
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Key</th>
                <th className="py-1.5 font-medium">Value (decoded)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {params.map(([k, v], i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-4 font-semibold text-indigo-700 dark:text-indigo-300">{k}</td>
                  <td className="break-all py-1.5 text-slate-800 dark:text-slate-100">{v || <span className="text-slate-400">(empty)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
