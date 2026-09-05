'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AnimatedBar, CountUp, motion, useReducedMotion } from './motion';

/**
 * The shared primitives.
 *
 * Two rules hold the look together. Colours come only from the semantic tokens
 * in globals.css -- no literal hex, no `text-white` -- so dark and light stay
 * in step without any component knowing which is on. And structure is carried
 * by space and hairlines rather than by boxes inside boxes: a panel is a tinted
 * surface with one faint edge, not a card with a border and a shadow.
 */

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

// A label on a wash of its own colour uses the -ink strength, which is the hue
// pushed to text weight. The base strength on a wash fails contrast.
const BADGE_TONE: Record<Tone, string> = {
  neutral: 'text-dim ring-line',
  accent: 'text-accent-ink ring-accent/30 bg-accent/10',
  ok: 'text-ok-ink ring-ok/30 bg-ok/10',
  warn: 'text-warn-ink ring-warn/30 bg-warn/10',
  danger: 'text-danger-ink ring-danger/30 bg-danger/10',
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
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
      className={`rounded-2xl bg-surface/70 p-6 ring-1 ring-line backdrop-blur-sm ${className}`}
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
    <div className="mb-5 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-label text-dim">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The section heading used between blocks on a page. */
export function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-label text-dim">
        {children}
      </h2>
      {action}
    </div>
  );
}

const STAT_TONE: Record<Tone, string> = {
  neutral: 'text-text',
  accent: 'text-accent-ink',
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  danger: 'text-danger-ink',
};

/**
 * A headline figure. `value` is a number plus a formatter rather than a string
 * so it can count up to its value; anything genuinely non-numeric passes
 * `display` instead and renders static.
 */
export function Stat({
  label,
  value,
  format,
  display,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value?: number;
  format?: (value: number) => string;
  display?: string;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-label text-dim">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-3xl font-semibold tracking-tighter tabular-nums ${STAT_TONE[tone]}`}
      >
        {display !== undefined || value === undefined || !format ? (
          display ?? '--'
        ) : (
          <CountUp value={value} format={format} />
        )}
      </div>
      {hint ? (
        <div className="mt-1.5 text-xs leading-relaxed text-dim">{hint}</div>
      ) : null}
    </div>
  );
}

/** Stats sit in a row divided by hairlines rather than in a grid of boxes. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-6 rounded-2xl bg-surface/50 p-6 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line [&>*:not(:first-child)]:lg:pl-8">
      {children}
    </div>
  );
}

const BUTTON_VARIANT = {
  primary:
    'bg-accent text-on-accent ring-1 ring-accent/60 shadow-glow hover:brightness-110',
  secondary: 'bg-surface-2 text-text ring-1 ring-line-strong hover:bg-surface-2/70',
  ghost: 'bg-transparent text-muted ring-1 ring-transparent hover:bg-surface-2 hover:text-text',
  danger: 'bg-transparent text-danger-ink ring-1 ring-danger/40 hover:bg-danger/10',
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
  const reduce = useReducedMotion();
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <motion.button
      type="button"
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${sizing} ${BUTTON_VARIANT[variant]} ${className}`}
      {...(props as React.ComponentProps<typeof motion.button>)}
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
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-label text-dim">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger-ink">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-dim">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg bg-surface-2/60 px-3 py-2 text-sm text-text ring-1 ring-line ' +
  'placeholder:text-dim outline-none transition-all focus:bg-surface-2 focus:ring-accent/60';

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
 * would be if you had spent evenly across the window. Being behind that line is
 * the thing that actually predicts a missed bonus.
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
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <AnimatedBar ratio={ratio} className={`h-full rounded-full ${BAR_TONE[tone]}`} />
      {typeof marker === 'number' && marker > 0 && marker < 1 ? (
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-text/50"
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
    <div className="rounded-2xl bg-surface/40 px-6 py-14 text-center ring-1 ring-dashed ring-line-strong">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A short caveat attached to a number the app estimated rather than knows. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-surface-2/50 px-4 py-3 text-xs leading-relaxed text-muted ring-1 ring-line">
      {children}
    </p>
  );
}
