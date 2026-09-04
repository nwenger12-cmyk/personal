'use client';

import type { ReactNode } from 'react';
import { formatDate, relativeDays } from '@/lib/dates';
import { formatCents, formatNumber, formatPercent } from '@/lib/money';
import type { TrackedBonus } from '@/lib/bonuses';
import type { PaceStatus } from '@/lib/bonuses';
import { Badge, ProgressBar } from './ui';
import type { Tone } from './ui';

const PACE: Record<PaceStatus, { tone: Tone; label: string }> = {
  earned: { tone: 'ok', label: 'Requirement met' },
  missed: { tone: 'danger', label: 'Window closed short' },
  ahead: { tone: 'ok', label: 'Ahead of pace' },
  'on-track': { tone: 'accent', label: 'On pace' },
  behind: { tone: 'warn', label: 'Behind pace' },
  'at-risk': { tone: 'danger', label: 'Deadline close' },
};

export function rewardLabel(bonus: TrackedBonus['bonus']): string {
  return bonus.rewardKind === 'cash'
    ? `${formatCents(bonus.cashCents)} cash back`
    : `${formatNumber(bonus.points)} points`;
}

export function BonusProgress({
  tracked,
  footer,
}: {
  tracked: TrackedBonus;
  footer?: ReactNode;
}) {
  const { bonus, outlook, label } = tracked;
  const pace = PACE[outlook.paceStatus];
  const done = outlook.remainingCents === 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{label}</h3>
          <p className="mt-0.5 text-sm text-muted">
            <span className="font-mono">{rewardLabel(bonus)}</span> for{' '}
            <span className="font-mono">{formatCents(bonus.spendRequiredCents)}</span> of spend
          </p>
        </div>
        <Badge tone={pace.tone}>{pace.label}</Badge>
      </div>

      <div className="mt-4">
        <ProgressBar
          ratio={outlook.progressRatio}
          tone={pace.tone === 'danger' ? 'danger' : pace.tone === 'warn' ? 'warn' : pace.tone}
          marker={outlook.windowClosed ? undefined : outlook.expectedRatio}
          label={`${label} bonus progress`}
        />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-mono text-text">
            {formatCents(outlook.progressCents)}
            <span className="text-dim"> / {formatCents(outlook.requiredCents)}</span>
          </span>
          <span className="font-mono text-xs text-dim">
            {formatPercent(outlook.progressRatio)}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-dim">Still to spend</dt>
          <dd className="mt-0.5 font-mono text-text">
            {done ? '--' : formatCents(outlook.remainingCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-dim">Deadline</dt>
          <dd className="mt-0.5 font-mono text-text">{formatDate(outlook.deadline)}</dd>
          <dd className="text-xs text-dim">
            {outlook.windowClosed ? 'closed' : relativeDays(outlook.daysLeft)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-dim">Pace needed</dt>
          <dd className="mt-0.5 font-mono text-text">
            {outlook.perDayNeededCents === null
              ? '--'
              : `${formatCents(outlook.perDayNeededCents)}/day`}
          </dd>
        </div>
      </dl>

      {bonus.notes ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{bonus.notes}</p>
      ) : null}

      {outlook.deadlineDerived ? (
        <p className="mt-3 text-xs leading-relaxed text-dim">
          Deadline derived from {formatDate(bonus.startDate)} plus{' '}
          {bonus.spendWindowMonths} months. If your offer letter says otherwise,
          set the exact date on the card.
        </p>
      ) : null}

      {footer ? <div className="mt-4 border-t border-line pt-4">{footer}</div> : null}
    </div>
  );
}
