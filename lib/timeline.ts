import { addDays, formatDate, monthKey, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { activeBonuses } from './bonuses';
import { upcomingFees } from './fees';
import type { CardAccount, Settings } from './types';

/**
 * The two things that have a deadline -- an annual fee posting and a bonus
 * window closing -- merged into one date-ordered list, because they compete
 * for the same attention and looking at them in separate tabs is how one gets
 * missed.
 */

export type TimelineKind = 'fee' | 'bonus';

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  date: IsoDate;
  daysUntil: number;
  cardId: string;
  cardLabel: string;
  title: string;
  detail: string;
  amountCents: number | null;
  tone: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
  /** True when the date is inferred rather than read off a statement or offer. */
  predicted: boolean;
};

export function buildTimeline(
  cards: CardAccount[],
  settings: Settings,
  months = 12,
  now: IsoDate = today(),
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const fee of upcomingFees(cards, settings.feeReviewLeadDays, months, now)) {
    const daysUntil = fee.daysUntil;
    const reviewBy = addDays(fee.date, -settings.feeReviewLeadDays);
    events.push({
      id: `fee-${fee.cardId}-${fee.date}`,
      kind: 'fee',
      date: fee.date,
      daysUntil,
      cardId: fee.cardId,
      cardLabel: fee.cardLabel,
      title: 'Annual fee posts',
      detail:
        daysUntil <= settings.feeReviewLeadDays
          ? `Year ${fee.anniversaryNumber} -- decide to keep, downgrade, or cancel now`
          : `Year ${fee.anniversaryNumber} -- review by ${formatDate(reviewBy)}`,
      amountCents: fee.amountCents,
      tone: daysUntil <= 14 ? 'danger' : daysUntil <= settings.feeReviewLeadDays ? 'warn' : 'neutral',
      predicted: fee.predicted,
    });
  }

  const horizonMs = toUtcMs(addDays(now, Math.round(months * 30.44)));
  for (const tracked of activeBonuses(cards, settings.bonusWarnDays, now)) {
    const { outlook } = tracked;
    if (outlook.windowClosed) continue;
    if (toUtcMs(outlook.deadline) > horizonMs) continue;
    const remaining = outlook.remainingCents;
    events.push({
      id: `bonus-${tracked.card.id}`,
      kind: 'bonus',
      date: outlook.deadline,
      daysUntil: outlook.daysLeft,
      cardId: tracked.card.id,
      cardLabel: tracked.label,
      title: 'Bonus spend window closes',
      detail:
        remaining === 0
          ? 'Requirement met -- mark it earned'
          : `${outlook.daysLeft} days left on the remaining spend`,
      amountCents: remaining === 0 ? null : remaining,
      tone:
        remaining === 0 ? 'ok'
        : outlook.paceStatus === 'at-risk' ? 'danger'
        : outlook.paceStatus === 'behind' ? 'warn'
        : 'accent',
      predicted: outlook.deadlineDerived,
    });
  }

  return events.sort((a, b) => toUtcMs(a.date) - toUtcMs(b.date));
}

export type TimelineMonth = { key: string; anchor: IsoDate; events: TimelineEvent[] };

export function groupByMonth(events: TimelineEvent[]): TimelineMonth[] {
  const months = new Map<string, TimelineMonth>();
  for (const event of events) {
    const key = monthKey(event.date);
    const existing = months.get(key);
    if (existing) existing.events.push(event);
    else months.set(key, { key, anchor: event.date, events: [event] });
  }
  return [...months.values()];
}
