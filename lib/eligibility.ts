import { addMonths, daysBetween, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { getCatalogCard } from './catalog';
import type { CardAccount, Issuer } from './types';

/**
 * When you can earn a sign-up bonus on a product again.
 *
 * Issuers gate bonuses on a clock that starts the last time you EARNED one --
 * not when you opened or closed the card. Chase runs the Sapphire pair as a
 * single 48-month family; Amex is once per product for life. These are the
 * rules people actually plan applications around, and they are computable from
 * the bonus history already in this app.
 *
 * Like the 5/24 counter, this is community-documented behaviour rather than
 * published policy, and it changes. It is here because it follows from your
 * own data; treat the date as a prompt to check, not as a guarantee.
 */

export type EligibilityRule = {
  id: string;
  issuer: Issuer;
  label: string;
  /** Catalog ids treated as one family sharing a single clock. */
  family: string[];
  /** Months from the last earned bonus. null means once per lifetime. */
  months: number | null;
  note: string;
};

export const ELIGIBILITY_RULES: EligibilityRule[] = [
  {
    id: 'chase-sapphire',
    issuer: 'chase',
    label: 'Chase Sapphire family',
    family: ['chase-sapphire-preferred', 'chase-sapphire-reserve'],
    months: 48,
    note:
      'Preferred and Reserve share one clock, and you cannot hold both at once. ' +
      'The 48 months run from when the last Sapphire bonus posted.',
  },
  {
    id: 'chase-ink',
    issuer: 'chase',
    label: 'Chase Ink (per product)',
    family: ['chase-ink-cash', 'chase-ink-unlimited', 'chase-ink-preferred', 'chase-ink-premier'],
    months: 24,
    note:
      'Counted per product rather than across the family, so the four Ink cards ' +
      'each have their own clock — which is why people cycle them.',
  },
  {
    id: 'citi-typ',
    issuer: 'citi',
    label: 'Citi ThankYou family',
    family: ['citi-strata-premier', 'citi-strata-elite', 'citi-double-cash', 'citi-custom-cash', 'citi-rewards-plus'],
    months: 48,
    note: 'Citi treats the ThankYou cards as one family for bonus eligibility.',
  },
  {
    id: 'capitalone-venture',
    issuer: 'capital-one',
    label: 'Capital One Venture family',
    family: ['capitalone-venture-x', 'capitalone-venture', 'capitalone-ventureone'],
    months: 48,
    note: 'Capital One limits repeat bonuses across the Venture line.',
  },
  {
    id: 'amex-lifetime',
    issuer: 'amex',
    label: 'American Express (per product)',
    family: [
      'amex-gold', 'amex-platinum', 'amex-green', 'amex-blue-cash-preferred',
      'amex-blue-business-plus', 'amex-business-gold', 'amex-business-platinum',
    ],
    months: null,
    note:
      'Once per product, for life, tracked indefinitely. The pre-approval ' +
      'check tells you before you apply.',
  },
];

export type EligibilityStatus = {
  rule: EligibilityRule;
  /** The card whose earned bonus started the clock. */
  lastEarnedOn: string | null;
  lastEarnedDate: IsoDate | null;
  eligible: boolean;
  /** When the clock runs out. null when eligible now, or never (lifetime). */
  eligibleFrom: IsoDate | null;
  daysUntil: number | null;
  /** True for a lifetime rule already used up. */
  permanentlyUsed: boolean;
};

/**
 * Eligibility per family, from your own earned bonuses. A family you have
 * never earned a bonus in is eligible and is left out of the result -- the
 * useful list is the one with clocks running.
 */
export function bonusEligibility(
  cards: CardAccount[],
  now: IsoDate = today(),
): EligibilityStatus[] {
  return ELIGIBILITY_RULES.flatMap((rule): EligibilityStatus[] => {
    const earned = cards
      .filter((card) => card.catalogId !== null && rule.family.includes(card.catalogId))
      .filter((card) => card.bonus?.status === 'earned')
      .map((card) => ({
        card,
        // The clock starts when the bonus posted; fall back to when the spend
        // was met, then to the open date, so a partly-filled record still says
        // something rather than nothing.
        date: card.bonus?.postedDate ?? card.bonus?.earnedDate ?? card.openedDate,
      }))
      .sort((a, b) => toUtcMs(b.date) - toUtcMs(a.date));

    if (earned.length === 0) return [];
    const latest = earned[0];
    const productName = getCatalogCard(latest.card.catalogId)?.name ?? latest.card.productName;

    if (rule.months === null) {
      return [{
        rule,
        lastEarnedOn: productName,
        lastEarnedDate: latest.date,
        eligible: false,
        eligibleFrom: null,
        daysUntil: null,
        permanentlyUsed: true,
      }];
    }

    const eligibleFrom = addMonths(latest.date, rule.months);
    const daysUntil = daysBetween(now, eligibleFrom);

    return [{
      rule,
      lastEarnedOn: productName,
      lastEarnedDate: latest.date,
      eligible: daysUntil <= 0,
      eligibleFrom,
      daysUntil,
      permanentlyUsed: false,
    }];
  }).sort((a, b) => (a.daysUntil ?? 1e9) - (b.daysUntil ?? 1e9));
}
