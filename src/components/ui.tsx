import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

const fieldBase =
  'rounded-lg border bg-white text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500';
const borderOk = 'border-slate-200 dark:border-slate-700';
const borderBad = 'border-rose-400 dark:border-rose-500/70';

export function TextArea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className={cx(fieldBase, invalid ? borderBad : borderOk, 'block w-full resize-y p-3 font-mono leading-relaxed', className)}
      {...props}
    />
  );
}

export function TextInput({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className={cx(fieldBase, invalid ? borderBad : borderOk, 'h-9 px-3', className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, borderOk, 'h-8 px-2 text-xs', className)} {...props}>
      {children}
    </select>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function CopyButton({ text, label = 'Copy', variant = 'secondary' }: { text: string; label?: string; variant?: ButtonVariant }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing sensible to do.
    }
  };
  return (
    <Button variant={variant} onClick={copy} disabled={!text} aria-label={`${label} to clipboard`}>
      {copied ? '✓ Copied' : label}
    </Button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-3 py-1 text-xs font-medium transition',
            o.value === value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <label title={title} className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-indigo-600" />
      {label}
    </label>
  );
}

export type Tone = 'neutral' | 'success' | 'error' | 'warning' | 'info';

const alertStyles: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300',
};

export function Alert({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3 py-2 text-xs', alertStyles[tone], className)}>
      {children}
    </div>
  );
}

const badgeStyles: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  error: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  info: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold', badgeStyles[tone])}>{children}</span>;
}

export interface KeyValueRow {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  copy?: string;
}

export function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.label}</dt>
          <dd className="min-w-0">
            <div className="break-all font-mono text-sm text-slate-800 dark:text-slate-100">{r.value}</div>
            {r.hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.hint}</div>}
          </dd>
          <div className="sm:justify-self-end">{r.copy !== undefined && <CopyButton text={r.copy} variant="ghost" />}</div>
        </div>
      ))}
    </dl>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
      {children}
    </label>
  );
}
