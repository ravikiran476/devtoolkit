// Runs regular expressions off the main thread. A pattern with catastrophic backtracking
// can spin for minutes; here the page stays responsive and simply terminates this worker.
import { runRegex, type RegexInput } from './regex';

self.onmessage = (event: MessageEvent<{ id: number; input: RegexInput }>) => {
  const { id, input } = event.data;
  self.postMessage({ id, result: runRegex(input) });
};
