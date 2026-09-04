'use client';

import { bonusOutlook } from '@/lib/bonuses';
import { formatDate, relativeDays } from '@/lib/dates';
import { cardLabel, feeOutlook } from '@/lib/fees';
import { formatCents } from '@/lib/money';
import { getProgram } from '@/lib/programs';
import { ISSUER_LABELS, ISSUER_ORDER } from '@/lib/types';
import type { CardAccount, Issuer, Settings } from '@/lib/types';
import { Badge, Button } from './ui';

function FeeCell({ card, settings }: { card: CardAccount; settings: Settings }) {
  const outlook = feeOutlook(card, settings.feeReviewLeadDays);

  if (card.annualFeeCents === 0) {
    return <span className="text-sm text-dim">No fee</span>;
  }
  if (!outlook.nextChargeDate) {
    return (
      <span className="text-sm text-dim">
        {formatCents(card.annualFeeCents)}
        <span className="ml-1 text-xs">
          {card.authorizedUser ? '· not yours' : '· closed'}
        </span>
      </span>
    );
  }

  const tone =
    outlook.urgency === 'imminent' ? 'danger'
    : outlook.urgency === 'review' ? 'warn'
    : 'neutral';

  return (
    <span className="block">
      <span className="font-mono text-sm text-text">{formatCents(card.annualFeeCents)}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-dim">
          {formatDate(outlook.nextChargeDate)}
        </span>
        <Badge tone={tone} mono>
          {relativeDays(outlook.daysUntil ?? 0)}
        </Badge>
      </span>
    </span>
  );
}

function BonusCell({ card, settings }: { card: CardAccount; settings: Settings }) {
  if (!card.bonus) return <span className="text-sm text-dim">--</span>;

  if (card.bonus.status === 'earned') {
    return <Badge tone="ok">Earned</Badge>;
  }
  if (card.bonus.status === 'missed') {
    return <Badge tone="danger">Missed</Badge>;
  }

  const outlook = bonusOutlook(card.bonus, settings.bonusWarnDays);
  const tone =
    outlook.paceStatus === 'at-risk' ? 'danger'
    : outlook.paceStatus === 'behind' ? 'warn'
    : outlook.paceStatus === 'earned' ? 'ok'
    : 'accent';

  return (
    <span className="block">
      <Badge tone={tone} mono>
        {formatCents(outlook.remainingCents)} left
      </Badge>
      <span className="mt-0.5 block font-mono text-xs text-dim">
        by {formatDate(outlook.deadline)}
      </span>
    </span>
  );
}

export function CardList({
  cards,
  settings,
  onEdit,
}: {
  cards: CardAccount[];
  settings: Settings;
  onEdit: (card: CardAccount) => void;
}) {
  const byIssuer = new Map<Issuer, CardAccount[]>();
  for (const card of cards) {
    const list = byIssuer.get(card.issuer);
    if (list) list.push(card);
    else byIssuer.set(card.issuer, [card]);
  }

  const issuers = ISSUER_ORDER.filter((issuer) => byIssuer.has(issuer));

  return (
    <div className="space-y-8">
      {issuers.map((issuer) => {
        const group = (byIssuer.get(issuer) ?? [])
          .slice()
          .sort((a, b) => (a.openedDate < b.openedDate ? 1 : -1));

        return (
          <div key={issuer}>
            <h2 className="flex items-baseline gap-2 text-sm font-semibold text-text">
              {ISSUER_LABELS[issuer]}
              <span className="font-mono text-xs font-normal text-dim">
                {group.length}
              </span>
            </h2>

            <ul className="mt-2 divide-y divide-line border-y border-line">
              {group.map((card) => {
                const program = getProgram(card.programId);
                return (
                  <li
                    key={card.id}
                    className="grid grid-cols-1 items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {cardLabel(card)}
                        </span>
                        {card.business ? <Badge>Business</Badge> : null}
                        {card.authorizedUser ? <Badge>AU</Badge> : null}
                        {card.status === 'closed' ? (
                          <Badge tone="neutral">Closed</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-dim">
                        Opened <span className="font-mono">{formatDate(card.openedDate)}</span>
                        {program ? ` · ${program.shortName}` : ''}
                      </div>
                    </div>

                    <FeeCell card={card} settings={settings} />
                    <BonusCell card={card} settings={settings} />

                    <Button size="sm" variant="ghost" onClick={() => onEdit(card)}>
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
