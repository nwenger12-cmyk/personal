import { addDays, daysBetween, fromUtcMs, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { cardLabel } from './fees';
import type { CardAccount, Perk, PerkPeriod } from './types';

/**
 * Recurring card credits, tracked per period.
 *
 * A monthly credit is not one benefit worth $180 a year -- it is twelve
 * separate ones, each of which vanishes if the month closes unused. Treating
 * it as an annual figure is exactly how people end up paying a $695 fee for
 * credits they used four times. So every period is its own thing to tick off,
 * and the one that is about to close is what gets surfaced.
 *
 * Periods here are calendar periods. Most issuer credits work that way, but
 * some run on the cardmember year instead -- the card's notes field is the
 * place for that, since it is a per-card fact rather than a rule.
 */

const PERIODS_PER_YEAR: Record<PerkPeriod, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

export const PERK_PERIOD_LABELS: Record<PerkPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Twice a year',
  annual: 'Annual',
};

/** A stable key for the period a date falls in: 2026-M03, 2026-Q2, 2026-H1, 2026. */
export function periodKey(period: PerkPeriod, iso: IsoDate = today()): string {
  const year = iso.slice(0, 4);
  const month = Number(iso.slice(5, 7));
  switch (period) {
    case 'monthly':
      return `${year}-M${String(month).padStart(2, '0')}`;
    case 'quarterly':
      return `${year}-Q${Math.ceil(month / 3)}`;
    case 'semiannual':
      return `${year}-H${month <= 6 ? 1 : 2}`;
    case 'annual':
      return year;
  }
}

/** The last day of the period a date falls in -- the deadline to use it by. */
export function periodEnd(period: PerkPeriod, iso: IsoDate = today()): IsoDate {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const endMonth =
    period === 'monthly' ? month
    : period === 'quarterly' ? Math.ceil(month / 3) * 3
    : period === 'semiannual' ? (month <= 6 ? 6 : 12)
    : 12;
  // Day 0 of the following month is the last day of this one.
  return fromUtcMs(Date.UTC(year, endMonth, 0));
}

export function periodLabel(period: PerkPeriod, key: string): string {
  if (period === 'annual') return key;
  const [year, rest] = key.split('-');
  if (!rest) return key;
  if (rest.startsWith('M')) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[Number(rest.slice(1)) - 1]} ${year}`;
  }
  return `${rest} ${year}`;
}

export type PerkStatus = {
  perk: Perk;
  card: CardAccount;
  cardLabel: string;
  /** The period in progress right now. */
  key: string;
  label: string;
  used: boolean;
  endDate: IsoDate;
  daysLeft: number;
  valueCents: number;
  /** What this perk is worth across a full year if every period is used. */
  annualValueCents: number;
};

export function perkStatus(
  card: CardAccount,
  perk: Perk,
  now: IsoDate = today(),
): PerkStatus {
  const key = periodKey(perk.period, now);
  const endDate = periodEnd(perk.period, now);
  return {
    perk,
    card,
    cardLabel: cardLabel(card),
    key,
    label: periodLabel(perk.period, key),
    used: perk.usedPeriods.includes(key),
    endDate,
    daysLeft: daysBetween(now, endDate),
    valueCents: perk.valueCents,
    annualValueCents: perk.valueCents * PERIODS_PER_YEAR[perk.period],
  };
}

/** Every perk on every open card, current period first to expire first. */
export function allPerkStatuses(
  cards: CardAccount[],
  now: IsoDate = today(),
): PerkStatus[] {
  return cards
    .filter((card) => card.status === 'open')
    .flatMap((card) => card.perks.map((perk) => perkStatus(card, perk, now)))
    .sort((a, b) => toUtcMs(a.endDate) - toUtcMs(b.endDate));
}

/** Unused credits whose period closes inside the warning window. */
export function expiringPerks(
  cards: CardAccount[],
  warnDays: number,
  now: IsoDate = today(),
): PerkStatus[] {
  return allPerkStatuses(cards, now).filter(
    (status) => !status.used && status.daysLeft <= warnDays && status.daysLeft >= 0,
  );
}

/**
 * What a card's credits are worth over a year if you use them all. This is the
 * figure to weigh an annual fee against -- the flat "credits you actually use"
 * number on the card is a manual override for when you know you will not.
 */
export function annualPerkValueCents(card: CardAccount): number {
  return card.perks.reduce(
    (sum, perk) => sum + perk.valueCents * PERIODS_PER_YEAR[perk.period],
    0,
  );
}

/**
 * How much of this year's credits have actually been ticked off, per card.
 * The gap between this and the annual value is money left on the table.
 */
export function perkUseThisYear(
  card: CardAccount,
  now: IsoDate = today(),
): { usedCents: number; possibleCents: number; usedCount: number; totalCount: number } {
  const year = now.slice(0, 4);
  let usedCents = 0;
  let possibleCents = 0;
  let usedCount = 0;
  let totalCount = 0;

  for (const perk of card.perks) {
    const periods = PERIODS_PER_YEAR[perk.period];
    for (let i = 0; i < periods; i += 1) {
      // Only count periods that have already begun.
      const probe = `${year}-${String(Math.floor((i * 12) / periods) + 1).padStart(2, '0')}-01`;
      if (toUtcMs(probe) > toUtcMs(now)) continue;
      const key = periodKey(perk.period, probe);
      totalCount += 1;
      possibleCents += perk.valueCents;
      if (perk.usedPeriods.includes(key)) {
        usedCount += 1;
        usedCents += perk.valueCents;
      }
    }
  }

  return { usedCents, possibleCents, usedCount, totalCount };
}

export function togglePerkPeriod(perk: Perk, key: string): Perk {
  const used = perk.usedPeriods.includes(key);
  return {
    ...perk,
    usedPeriods: used
      ? perk.usedPeriods.filter((k) => k !== key)
      : [...perk.usedPeriods, key],
  };
}

/** Next period boundary after today, for the calendar export. */
export function nextPerkDeadline(perk: Perk, now: IsoDate = today()): IsoDate {
  const end = periodEnd(perk.period, now);
  return daysBetween(now, end) >= 0 ? end : periodEnd(perk.period, addDays(end, 1));
}
