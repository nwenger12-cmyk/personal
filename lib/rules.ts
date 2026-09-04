import { addMonths, daysBetween, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { cardLabel } from './fees';
import type { CardAccount, Issuer } from './types';

/**
 * Chase's 5/24 rule, computed from your own card list.
 *
 * Chase declines most applications from anyone who has opened five or more
 * personal credit cards across all issuers in the previous 24 months. It is
 * unwritten but consistent, and for a Chase-heavy wallet it is the single
 * constraint worth planning around -- so this counts the same things Chase
 * counts, and shows when each one falls off.
 *
 * What counts:
 *   - any personal card, from any issuer
 *   - business cards from issuers that report them to the personal bureaus
 *   - cards you are an authorized user on (they appear on your report; Chase
 *     will sometimes discount them if you point them out, so they are counted
 *     but reported separately)
 *
 * What does not: business cards from Chase, Citi, and Amex, which do not
 * appear on a personal credit report.
 */

export const FIVE_24_LIMIT = 5;

/** Issuers that report business cards to the personal credit bureaus. */
const BUSINESS_REPORTS_PERSONAL: Issuer[] = ['capital-one', 'discover'];

export function countsToward524(card: CardAccount): boolean {
  if (!card.business) return true;
  return BUSINESS_REPORTS_PERSONAL.includes(card.issuer);
}

export type FiveTwentyFourEntry = {
  cardId: string;
  label: string;
  issuer: Issuer;
  openedDate: IsoDate;
  /** The date this card stops counting: 24 months after it was opened. */
  fallsOffDate: IsoDate;
  daysUntilFallOff: number;
  authorizedUser: boolean;
};

export type FiveTwentyFourStatus = {
  count: number;
  limit: number;
  /** Excludes authorized-user cards -- the count Chase may accept if you ask. */
  countExcludingAuthorizedUser: number;
  underLimit: boolean;
  entries: FiveTwentyFourEntry[];
  /** When the count next drops, and to what. */
  nextFallOff: FiveTwentyFourEntry | null;
  /** The soonest date the count would be back under the limit, if it is over. */
  clearsOn: IsoDate | null;
};

export function fiveTwentyFour(
  cards: CardAccount[],
  now: IsoDate = today(),
): FiveTwentyFourStatus {
  const cutoff = addMonths(now, -24);

  const entries = cards
    .filter(countsToward524)
    // A closed card still counts -- 5/24 is about opening, not about holding.
    .filter((card) => toUtcMs(card.openedDate) > toUtcMs(cutoff))
    .map((card) => {
      const fallsOffDate = addMonths(card.openedDate, 24);
      return {
        cardId: card.id,
        label: cardLabel(card),
        issuer: card.issuer,
        openedDate: card.openedDate,
        fallsOffDate,
        daysUntilFallOff: daysBetween(now, fallsOffDate),
        authorizedUser: card.authorizedUser,
      };
    })
    .sort((a, b) => toUtcMs(a.fallsOffDate) - toUtcMs(b.fallsOffDate));

  const count = entries.length;
  const countExcludingAuthorizedUser = entries.filter((e) => !e.authorizedUser).length;
  const underLimit = count < FIVE_24_LIMIT;

  // Once `count - n` drops below the limit, the nth-oldest card's fall-off is
  // the date the slot opens up.
  const surplus = count - (FIVE_24_LIMIT - 1);
  const clearsOn = underLimit ? null : entries[surplus - 1]?.fallsOffDate ?? null;

  return {
    count,
    limit: FIVE_24_LIMIT,
    countExcludingAuthorizedUser,
    underLimit,
    entries,
    nextFallOff: entries[0] ?? null,
    clearsOn,
  };
}

/**
 * Issuer application rules, as reference text rather than as logic.
 *
 * These are community-documented patterns, not published policy, and they get
 * adjusted without notice. They are shown next to the 5/24 counter so the
 * context is there when you are deciding what to apply for -- but only 5/24 is
 * computed, because only 5/24 can be computed honestly from your own data.
 */
export type IssuerRule = {
  issuer: Issuer;
  title: string;
  detail: string;
};

export const ISSUER_RULES: IssuerRule[] = [
  {
    issuer: 'chase',
    title: '5/24',
    detail:
      'Five or more personal cards opened anywhere in 24 months and Chase will ' +
      'almost always decline. Chase business cards do not add to the count, but ' +
      'you still have to be under it to be approved for one.',
  },
  {
    issuer: 'chase',
    title: 'One bonus per product per 48 months',
    detail:
      'The Sapphire family shares a single bonus clock: no bonus if you have ' +
      'earned one on any Sapphire card in the last 48 months, and you cannot ' +
      'hold two at once. Ink and co-brand cards are counted per product.',
  },
  {
    issuer: 'capital-one',
    title: 'Roughly one new card per six months',
    detail:
      'Capital One rarely approves a second card inside six months, and tends ' +
      'to cap how many of its cards you hold at once. Its business cards do ' +
      'report to the personal bureaus, so they add to your 5/24 count.',
  },
  {
    issuer: 'citi',
    title: 'Spacing between applications',
    detail:
      'Citi limits how close together applications can be -- commonly described ' +
      'as one card per eight days and two per 65 days. Bonus eligibility for ' +
      'the ThankYou family is usually a 48-month clock across the family.',
  },
  {
    issuer: 'discover',
    title: 'One card at a time, and a personal-bureau business card',
    detail:
      'Discover generally wants an existing card open for about a year before ' +
      'approving another. Its business card reports to the personal bureaus, ' +
      'so it counts toward 5/24.',
  },
  {
    issuer: 'amex',
    title: 'Once per lifetime, per card',
    detail:
      'A welcome offer on a given Amex product is once per lifetime, tracked ' +
      'indefinitely. The pre-approval check will tell you before you apply.',
  },
];
