import { addDays, addYears, daysBetween, monthsBetween, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import type { CardAccount } from './types';

/**
 * When the next annual fee lands, and how much runway is left to do something
 * about it.
 *
 * The prediction rests on one rule: an annual fee posts on the statement that
 * contains the account anniversary. So the anniversary of the open date is the
 * date to plan around, give or take a statement cycle -- which is exactly why
 * the dashboard leads with "review by" rather than with the charge date. Once
 * a real charge is recorded from a statement, that cycle stops being predicted
 * and the next one is measured from what actually happened.
 */

export type FeeUrgency = 'none' | 'scheduled' | 'review' | 'imminent';

export type FeeOutlook = {
  hasFee: boolean;
  annualFeeCents: number;
  /** null when the card is closed, fee-free, or an authorized-user card. */
  nextChargeDate: IsoDate | null;
  daysUntil: number | null;
  /** The date to have decided keep / downgrade / cancel by. */
  reviewByDate: IsoDate | null;
  urgency: FeeUrgency;
  /** False once the date comes from a recorded charge instead of the anniversary. */
  predicted: boolean;
  /** 1 = first anniversary. Useful because year 1 is often waived. */
  anniversaryNumber: number | null;
  /** Annual fee minus the credits you said you actually use. */
  netAnnualCostCents: number;
};

/** A charge already recorded for this cycle means the prediction should move on. */
function chargeRecordedNear(card: CardAccount, date: IsoDate): boolean {
  const target = toUtcMs(date);
  return card.feeHistory.some((charge) => {
    if (charge.refunded) return false;
    const delta = Math.abs(toUtcMs(charge.date) - target);
    // A fee can post up to a statement cycle either side of the anniversary.
    return delta <= 60 * 86_400_000;
  });
}

export function feeOutlook(
  card: CardAccount,
  leadDays: number,
  now: IsoDate = today(),
): FeeOutlook {
  const netAnnualCostCents = card.annualFeeCents - card.annualCreditsValueCents;
  const base = {
    hasFee: card.annualFeeCents > 0,
    annualFeeCents: card.annualFeeCents,
    nextChargeDate: null,
    daysUntil: null,
    reviewByDate: null,
    urgency: 'none' as FeeUrgency,
    predicted: true,
    anniversaryNumber: null,
    netAnnualCostCents,
  };

  if (card.annualFeeCents <= 0) return base;
  if (card.status === 'closed') return base;
  // An authorized-user card's fee is on whoever owns the account, not on you.
  if (card.authorizedUser) return base;

  const override = card.nextFeeDateOverride;
  const anchor = override ?? card.openedDate;
  // With no override, a first-year waiver moves the first charge to year one.
  const minK = override ? 0 : card.firstYearFeeWaived ? 1 : 0;

  let nextChargeDate: IsoDate | null = null;
  for (let k = minK; k <= minK + 60; k += 1) {
    const candidate = addYears(anchor, k);
    if (daysBetween(now, candidate) < 0) continue;
    if (chargeRecordedNear(card, candidate)) continue;
    nextChargeDate = candidate;
    break;
  }
  if (!nextChargeDate) return base;

  const daysUntil = daysBetween(now, nextChargeDate);
  const reviewByDate = addDays(nextChargeDate, -leadDays);

  let urgency: FeeUrgency = 'scheduled';
  if (daysUntil <= 14) urgency = 'imminent';
  else if (daysUntil <= leadDays) urgency = 'review';

  return {
    ...base,
    nextChargeDate,
    daysUntil,
    reviewByDate,
    urgency,
    predicted: override === null,
    anniversaryNumber: Math.max(
      1,
      Math.round(monthsBetween(card.openedDate, nextChargeDate) / 12),
    ),
  };
}

export type FeeEvent = {
  cardId: string;
  cardLabel: string;
  issuer: CardAccount['issuer'];
  date: IsoDate;
  daysUntil: number;
  amountCents: number;
  anniversaryNumber: number | null;
  predicted: boolean;
};

/**
 * Every annual fee expected in the next `months` months, oldest first --
 * including the second charge on a card whose anniversary comes round twice
 * inside a long window.
 */
export function upcomingFees(
  cards: CardAccount[],
  leadDays: number,
  months = 12,
  now: IsoDate = today(),
): FeeEvent[] {
  const horizon = addYears(now, months / 12);
  const events: FeeEvent[] = [];

  for (const card of cards) {
    const outlook = feeOutlook(card, leadDays, now);
    if (!outlook.nextChargeDate) continue;

    let date = outlook.nextChargeDate;
    let anniversary = outlook.anniversaryNumber ?? 1;
    while (toUtcMs(date) <= toUtcMs(horizon)) {
      events.push({
        cardId: card.id,
        cardLabel: cardLabel(card),
        issuer: card.issuer,
        date,
        daysUntil: daysBetween(now, date),
        amountCents: card.annualFeeCents,
        anniversaryNumber: anniversary,
        predicted: outlook.predicted,
      });
      date = addYears(date, 1);
      anniversary += 1;
    }
  }

  return events.sort((a, b) => toUtcMs(a.date) - toUtcMs(b.date));
}

export function cardLabel(card: CardAccount): string {
  const base = card.nickname.trim() || card.productName;
  return card.last4 ? `${base} ...${card.last4}` : base;
}

/** Fees you are actually on the hook for: open, fee-carrying, and yours. */
export function payableCards(cards: CardAccount[]): CardAccount[] {
  return cards.filter(
    (card) => card.status === 'open' && !card.authorizedUser && card.annualFeeCents > 0,
  );
}

export type FeeTotals = {
  annualFeeCents: number;
  annualCreditsCents: number;
  netCents: number;
  cardCount: number;
};

export function feeTotals(cards: CardAccount[]): FeeTotals {
  const relevant = cards.filter((card) => card.status === 'open' && !card.authorizedUser);
  const annualFeeCents = relevant.reduce((sum, c) => sum + c.annualFeeCents, 0);
  const annualCreditsCents = relevant.reduce((sum, c) => sum + c.annualCreditsValueCents, 0);
  return {
    annualFeeCents,
    annualCreditsCents,
    netCents: annualFeeCents - annualCreditsCents,
    cardCount: relevant.filter((c) => c.annualFeeCents > 0).length,
  };
}
