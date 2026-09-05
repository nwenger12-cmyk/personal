'use client';

import { formatDate, relativeDays } from '@/lib/dates';
import { bonusEligibility } from '@/lib/eligibility';
import type { CardAccount } from '@/lib/types';
import { Badge, Panel, PanelHeader } from './ui';

/**
 * When each bonus clock runs out.
 *
 * Like 5/24 this is community-documented behaviour rather than published
 * policy, and only families you have actually earned a bonus in appear —
 * there is nothing useful to say about a clock that was never started.
 */
export function EligibilityPanel({ cards }: { cards: CardAccount[] }) {
  const statuses = bonusEligibility(cards);
  if (statuses.length === 0) return null;

  return (
    <Panel className="space-y-4">
      <PanelHeader
        title="Bonus eligibility"
        description="Issuers gate a repeat bonus on when you last earned one, not on when you opened or closed the card."
      />

      <ul className="divide-y divide-line border-t border-line">
        {statuses.map((status) => (
          <li key={status.rule.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-text">{status.rule.label}</span>
              {status.permanentlyUsed ? (
                <Badge tone="danger">Used for life</Badge>
              ) : status.eligible ? (
                <Badge tone="ok">Eligible now</Badge>
              ) : (
                <Badge tone="warn" mono>
                  {relativeDays(status.daysUntil ?? 0)}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              Last earned on {status.lastEarnedOn}
              {status.lastEarnedDate ? `, ${formatDate(status.lastEarnedDate)}` : ''}.
              {status.eligibleFrom && !status.eligible
                ? ` Eligible again around ${formatDate(status.eligibleFrom)}.`
                : ''}{' '}
              {status.rule.note}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
