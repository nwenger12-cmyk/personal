import { cardLabel } from './fees';
import { bestRedemption, getProgram } from './programs';
import type { CardAccount, EarnRate } from './types';

/**
 * Which card to pull out, for a given kind of spending.
 *
 * The comparison people get wrong is "3x points" against "2% cash back",
 * because a multiplier is meaningless without knowing what the point is worth.
 * So everything here resolves to one number: cents earned per dollar spent,
 * which is the multiplier times the programme's best redemption rate. A card
 * earning 3x Chase points at 1.8c a point returns 5.4c per dollar; 2% cash
 * back returns 2c. That is the whole calculation, and it only works because
 * the valuations already live in this app and are editable.
 */

export type EarnCategory = {
  id: string;
  label: string;
  /** Merchant text that suggests this category, for the lookup box. */
  hints: string[];
};

export const EARN_CATEGORIES: EarnCategory[] = [
  { id: 'everything', label: 'Everything else', hints: [] },
  { id: 'dining', label: 'Dining & restaurants', hints: ['restaurant', 'cafe', 'coffee', 'bar', 'doordash', 'grubhub', 'uber eats'] },
  { id: 'groceries', label: 'Groceries', hints: ['grocery', 'supermarket', 'whole foods', 'trader', 'safeway', 'kroger'] },
  { id: 'travel', label: 'Travel (general)', hints: ['travel', 'booking', 'expedia', 'rental car', 'hertz', 'amtrak'] },
  { id: 'flights', label: 'Flights', hints: ['airline', 'delta', 'united', 'southwest', 'american air', 'jetblue', 'alaska'] },
  { id: 'hotels', label: 'Hotels', hints: ['hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'ihg'] },
  { id: 'gas', label: 'Gas', hints: ['gas', 'shell', 'chevron', 'exxon', 'bp ', 'fuel'] },
  { id: 'transit', label: 'Transit & rideshare', hints: ['uber', 'lyft', 'transit', 'metro', 'parking', 'toll'] },
  { id: 'online', label: 'Online retail', hints: ['amazon', 'ebay', 'etsy', 'shopify'] },
  { id: 'drugstores', label: 'Drugstores', hints: ['pharmacy', 'walgreens', 'cvs', 'rite aid'] },
  { id: 'streaming', label: 'Streaming', hints: ['netflix', 'spotify', 'hulu', 'disney+', 'youtube'] },
  { id: 'advertising', label: 'Advertising', hints: ['google ads', 'meta', 'facebk', 'linkedin ads'] },
  { id: 'shipping', label: 'Shipping', hints: ['usps', 'fedex', 'ups ', 'dhl'] },
  { id: 'office', label: 'Office supply & telecom', hints: ['staples', 'office depot', 'verizon', 'at&t', 'comcast'] },
  { id: 'internet', label: 'Internet, cable & phone', hints: ['internet', 'cable', 'phone', 'wireless'] },
];

const BY_ID = new Map(EARN_CATEGORIES.map((c) => [c.id, c]));

export function getEarnCategory(id: string): EarnCategory | null {
  return BY_ID.get(id) ?? null;
}

/** Guess the category from merchant text, for the "where am I spending" box. */
export function guessEarnCategory(text: string): EarnCategory | null {
  const haystack = ` ${text.toLowerCase()} `;
  for (const category of EARN_CATEGORIES) {
    if (category.hints.some((hint) => haystack.includes(hint))) return category;
  }
  return null;
}

export type CardEarning = {
  card: CardAccount;
  label: string;
  /** The rate that applies, or null when only the base rate does. */
  rate: EarnRate | null;
  multiplier: number;
  /** What one point of this card's currency is worth, in cents. */
  centsPerPoint: number;
  /** The number that actually decides it: cents back per dollar spent. */
  centsPerDollar: number;
  programShortName: string;
  /** True when the elevated rate is capped and the cap is worth remembering. */
  capCents: number | null;
};

/**
 * Every open card ranked for one category, best return first.
 *
 * A card with no rate entered for the category falls back to its "everything
 * else" rate, and to 1x if it has neither -- which is the honest default, not
 * a reason to leave the card out of the comparison.
 */
export function rankCardsForCategory(
  cards: CardAccount[],
  categoryId: string,
  overrides: Record<string, number>,
): CardEarning[] {
  return cards
    .filter((card) => card.status === 'open')
    .map((card): CardEarning => {
      const specific = card.earnRates.find((r) => r.categoryId === categoryId) ?? null;
      const base = card.earnRates.find((r) => r.categoryId === 'everything') ?? null;
      const rate = specific ?? base;
      const multiplier = rate?.multiplier ?? 1;

      const program = getProgram(card.programId);
      // A cash-back card returns cents directly, so its "point" is worth 1c and
      // the multiplier is already a percentage.
      const best = program ? bestRedemption(program, overrides) : null;
      const centsPerPoint = program
        ? program.unit === 'cash'
          ? 1
          : best?.centsPerPoint ?? 1
        : 1;

      return {
        card,
        label: cardLabel(card),
        rate: specific,
        multiplier,
        centsPerPoint,
        centsPerDollar: multiplier * centsPerPoint,
        programShortName: program?.shortName ?? 'Cash',
        capCents: rate?.capCents ?? null,
      };
    })
    .sort((a, b) => b.centsPerDollar - a.centsPerDollar);
}

export function bestCardForCategory(
  cards: CardAccount[],
  categoryId: string,
  overrides: Record<string, number>,
): CardEarning | null {
  return rankCardsForCategory(cards, categoryId, overrides)[0] ?? null;
}

/**
 * The best card for every category at once -- the wallet cheat sheet. Only
 * categories where some card beats its own baseline are worth listing; the
 * rest are "use whatever your everything-else card is".
 */
export function walletCheatSheet(
  cards: CardAccount[],
  overrides: Record<string, number>,
): { category: EarnCategory; best: CardEarning; runnerUp: CardEarning | null }[] {
  return EARN_CATEGORIES.flatMap((category) => {
    const ranked = rankCardsForCategory(cards, category.id, overrides);
    if (ranked.length === 0) return [];
    return [{ category, best: ranked[0], runnerUp: ranked[1] ?? null }];
  });
}

/** Cards with no rates entered at all -- the cheat sheet is guesswork until they are. */
export function cardsMissingRates(cards: CardAccount[]): CardAccount[] {
  return cards.filter((card) => card.status === 'open' && card.earnRates.length === 0);
}
