'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/**
 * The shared primitives. Every one of them takes its colors from the semantic
 * tokens in globals.css -- no literal hex, no `text-white`, no `slate-700` --
 * so light and dark stay in sync without any component knowing which is on.
 */

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

// A label on a 12% wash of its own color uses the -ink strength, which is the
// hue pushed to text weight. The base strength on a pale wash fails contrast.
const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent/12 text-accent-ink border-accent/25',
  ok: 'bg-ok/12 text-ok-ink border-ok/25',
  warn: 'bg-warn/12 text-warn-ink border-warn/30',
  danger: 'bg-danger/12 text-danger-ink border-danger/30',
};

export function Badge({
  tone = 'neutral',
  children,
  mono = false,
}: {
  tone?: Tone;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        mono ? 'font-mono' : ''
      } ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A headline number. `value` is always a machine value, so it is always mono. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === 'neutral' ? 'text-text'
    : tone === 'accent' ? 'text-accent-ink'
    : tone === 'ok' ? 'text-ok-ink'
    : tone === 'warn' ? 'text-warn-ink'
    : 'text-danger-ink';

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-dim">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueTone}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-dim">{hint}</div> : null}
    </div>
  );
}

const BUTTON_VARIANT = {
  primary: 'bg-accent text-on-accent border-accent hover:opacity-90',
  secondary: 'bg-surface text-text border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-text',
  danger: 'bg-transparent text-danger-ink border-danger/40 hover:bg-danger/10',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT;
  size?: 'sm' | 'md';
}) {
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger-ink">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs leading-relaxed text-dim">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-text ' +
  'placeholder:text-dim outline-none transition-colors focus:border-accent';

export function TextInput({
  mono = false,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={`${CONTROL} ${mono ? 'font-mono' : ''} ${className}`} {...props} />;
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-text">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-relaxed text-dim">{hint}</span> : null}
      </span>
    </label>
  );
}

const BAR_TONE: Record<Tone, string> = {
  neutral: 'bg-dim',
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

/**
 * A progress bar with an optional pace marker: the thin line showing where you
 * would be if you had spent evenly across the window. Being behind that line
 * is the thing that actually predicts a missed bonus.
 */
export function ProgressBar({
  ratio,
  tone = 'accent',
  marker,
  label,
}: {
  ratio: number;
  tone?: Tone;
  marker?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${BAR_TONE[tone]}`}
        style={{ width: `${pct}%` }}
      />
      {typeof marker === 'number' && marker > 0 && marker < 1 ? (
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-text/40"
          style={{ left: `${Math.min(100, marker * 100)}%` }}
        />
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2/50 px-6 py-10 text-center">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A short caveat attached to a number the app estimated rather than knows. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
      {children}
    </p>
  );
}
