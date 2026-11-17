import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cx } from './components/ui';
import { TOOLS, type ToolId } from './tools';

const THEME_KEY = 'devtoolkit-theme';

function toolFromHash(): ToolId {
  const id = window.location.hash.replace(/^#\/?/, '');
  return (TOOLS.find((t) => t.id === id)?.id ?? TOOLS[0].id) as ToolId;
}

export default function App() {
  const [active, setActive] = useState<ToolId>(toolFromHash);
  // Tools are mounted on first visit and then kept alive (hidden) so their input survives navigation.
  const [visited, setVisited] = useState<ReadonlySet<ToolId>>(() => new Set([toolFromHash()]));

  useEffect(() => {
    const onHash = () => {
      const id = toolFromHash();
      setActive(id);
      setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const tool = TOOLS.find((t) => t.id === active)!;
  useEffect(() => {
    document.title = `${tool.name} · DevToolkit`;
  }, [tool]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur md:h-screen md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:py-5">
          <a href={`#/${TOOLS[0].id}`} className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 font-mono text-sm font-bold text-white">{'{}'}</span>
            <span className="text-base font-bold tracking-tight">DevToolkit</span>
          </a>
          <ThemeToggle />
        </div>
        <nav aria-label="Tools" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
          {TOOLS.map((t) => (
            <a
              key={t.id}
              href={`#/${t.id}`}
              aria-current={t.id === active ? 'page' : undefined}
              className={cx(
                'flex shrink-0 items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                t.id === active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )}
            >
              <span
                className={cx(
                  'grid h-6 w-9 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold',
                  t.id === active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {t.glyph}
              </span>
              {t.name}
            </a>
          ))}
        </nav>
        <p className="mt-6 hidden px-5 text-xs leading-relaxed text-slate-400 md:block dark:text-slate-500">
          Everything runs locally in your browser. No data leaves this page.
        </p>
      </aside>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{tool.name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tool.description}</p>
        </header>
        {TOOLS.filter((t) => visited.has(t.id)).map(({ id, name, component: Tool }) => (
          <div key={id} hidden={id !== active}>
            <ErrorBoundary name={name}>
              <Tool />
            </ErrorBoundary>
          </div>
        ))}
      </main>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // storage unavailable (private mode); theme still applies for this session
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
