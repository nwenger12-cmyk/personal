'use client';

import { formatDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { allPerkStatuses, perkUseThisYear, togglePerkPeriod } from '@/lib/perks';
import type { CardAccount } from '@/lib/types';
import { Stagger, StaggerItem } from './motion';
import { Badge, EmptyState, Panel, PanelHeader } from './ui';

/**
 * The credits on every card, with the period in progress ticked off or not.
 *
 * One click per credit is the whole interaction, and it is the highest-value
 * click in the app: a $695 fee justified by credits you forget to use is money
 * lost every month, quietly.
 */
export function PerkChecklist({
  cards,
  onToggle,
}: {
  cards: CardAccount[];
  onToggle: (card: CardAccount) => void;
}) {
  const statuses = allPerkStatuses(cards);

  if (statuses.length === 0) {
    return (
      <EmptyState
        title="No credits recorded"
        description="Add the recurring credits on a card — travel credit, monthly ride credit, a free night — and they show up here as a checklist that resets each period."
      />
    );
  }

  const unusedValue = statuses
    .filter((s) => !s.used)
    .reduce((sum, s) => sum + s.valueCents, 0);

  return (
    <Panel className="space-y-4">
      <PanelHeader
        title="Credits this period"
        description="Unused credit does not roll over. Tick one off when you have spent it."
        action={
          unusedValue > 0 ? (
            <Badge tone="warn" mono>
              {formatCents(unusedValue)} unused
            </Badge>
          ) : (
            <Badge tone="ok">All used</Badge>
          )
        }
      />

      <Stagger as="ul" className="divide-y divide-line border-t border-line">
        {statuses.map((status) => {
          const use = perkUseThisYear(status.card);
          return (
            <StaggerItem
              as="li"
              key={`${status.card.id}-${status.perk.id}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={status.used}
                  onChange={() =>
                    onToggle({
                      ...status.card,
                      perks: status.card.perks.map((p) =>
                        p.id === status.perk.id ? togglePerkPeriod(p, status.key) : p,
                      ),
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                  aria-label={`Mark ${status.perk.label} used for ${status.label}`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${
                      status.used ? 'text-dim line-through' : 'text-text'
                    }`}
                  >
                    {status.perk.label || 'Untitled credit'}
                  </span>
                  <span className="mt-0.5 block text-xs text-dim">
                    {status.cardLabel} · {status.label} · used {use.usedCount} of{' '}
                    {use.totalCount} so far this year
                  </span>
                </span>
              </label>

              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm text-text">
                  {formatCents(status.valueCents)}
                </span>
                {status.used ? (
                  <Badge tone="ok">Used</Badge>
                ) : (
                  <Badge tone={status.daysLeft <= 7 ? 'danger' : 'neutral'} mono>
                    by {formatDate(status.endDate)}
                  </Badge>
                )}
              </span>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Panel>
  );
}
