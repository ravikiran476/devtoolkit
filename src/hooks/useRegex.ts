import { useEffect, useRef, useState } from 'react';
import type { RegexInput, RegexResult } from '../lib/regex';

export type RegexState =
  | { status: 'running'; last?: RegexResult }
  | { status: 'done'; result: RegexResult }
  | { status: 'timeout'; ms: number };

const TIMEOUT_MS = 1000;
const DEBOUNCE_MS = 120;

function createWorker(): Worker {
  return new Worker(new URL('../lib/regex.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Evaluates the regex in a Web Worker. If it runs longer than a second (catastrophic
 * backtracking), the worker is terminated and replaced, and the state says so.
 */
export function useRegex(input: RegexInput): RegexState {
  const [state, setState] = useState<RegexState>({ status: 'running' });
  const worker = useRef<Worker | null>(null);
  const busy = useRef(false);
  const seq = useRef(0);
  const key = JSON.stringify(input);

  useEffect(() => () => worker.current?.terminate(), []);

  useEffect(() => {
    const id = ++seq.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState((prev) => ({ status: 'running', last: prev.status === 'done' ? prev.result : prev.status === 'running' ? prev.last : undefined }));
    const debounce = setTimeout(() => {
      worker.current ??= createWorker();
      const w = worker.current;
      w.onmessage = (event: MessageEvent<{ id: number; result: RegexResult }>) => {
        if (event.data.id !== id) return;
        busy.current = false;
        clearTimeout(timer);
        setState({ status: 'done', result: event.data.result });
      };
      timer = setTimeout(() => {
        w.terminate();
        worker.current = null;
        busy.current = false;
        if (id === seq.current) setState({ status: 'timeout', ms: TIMEOUT_MS });
      }, TIMEOUT_MS);
      busy.current = true;
      w.postMessage({ id, input: JSON.parse(key) as RegexInput });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timer);
      // A job still running would delay the next one; it is no longer wanted, so stop it.
      if (busy.current) {
        worker.current?.terminate();
        worker.current = null;
        busy.current = false;
      }
    };
  }, [key]);

  return state;
}
