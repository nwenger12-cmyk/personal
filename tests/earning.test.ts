import { describe, expect, it } from 'vitest';
import {
  bestCardForCategory,
  guessEarnCategory,
  rankCardsForCategory,
  cardsMissingRates,
} from '@/lib/earning';
import { blankCard } from '@/lib/storage';
import type { CardAccount, EarnRate } from '@/lib/types';

function rate(categoryId: string, multiplier: number, capCents: number | null = null): EarnRate {
  return { id: `${categoryId}-${multiplier}`, categoryId, multiplier, capCents, notes: '' };
}

function card(
  id: string,
  programId: string | null,
  earnRates: EarnRate[],
  overrides: Partial<CardAccount> = {},
): CardAccount {
  return { ...blankCard('2024-01-01'), id, productName: id, programId, earnRates, ...overrides };
}

describe('rankCardsForCategory', () => {
  it('compares in cents per dollar, not in multipliers', () => {
    // 3x Chase points at 1.8c beats 2% cash back, and the ranking has to say so.
    const ranked = rankCardsForCategory(
      [
        card('sapphire', 'chase-ur', [rate('dining', 3)]),
        card('doublecash', 'cash', [rate('everything', 2)]),
      ],
      'dining',
      {},
    );
    expect(ranked[0].card.id).toBe('sapphire');
    expect(ranked[0].centsPerDollar).toBeCloseTo(5.4);
    expect(ranked[1].centsPerDollar).toBeCloseTo(2);
  });

  it('lets a cash card win when the multiplier is high enough', () => {
    const ranked = rankCardsForCategory(
      [
        card('sapphire', 'chase-ur', [rate('groceries', 1)]),
        card('blue-cash', 'cash', [rate('groceries', 6)]),
      ],
      'groceries',
      {},
    );
    expect(ranked[0].card.id).toBe('blue-cash');
    expect(ranked[0].centsPerDollar).toBeCloseTo(6);
  });

  it('falls back to the everything-else rate for an unlisted category', () => {
    const ranked = rankCardsForCategory(
      [card('freedom', 'chase-ur', [rate('everything', 1.5), rate('dining', 3)])],
      'gas',
      {},
    );
    expect(ranked[0].multiplier).toBe(1.5);
    expect(ranked[0].rate).toBeNull();
  });

  it('assumes 1x for a card with no rates rather than dropping it', () => {
    const ranked = rankCardsForCategory([card('bare', 'chase-ur', [])], 'dining', {});
    expect(ranked).toHaveLength(1);
    expect(ranked[0].multiplier).toBe(1);
  });

  it('follows an edited valuation upward', () => {
    const cards = [card('a', 'chase-ur', [rate('dining', 3)])];
    // Shipped transfer estimate is 1.8c, so 3x returns 5.4c.
    expect(rankCardsForCategory(cards, 'dining', {})[0].centsPerDollar).toBeCloseTo(5.4);
    expect(
      rankCardsForCategory(cards, 'dining', { 'chase-ur:transfer': 2.2 })[0].centsPerDollar,
    ).toBeCloseTo(6.6);
  });

  it('switches to the next-best route when a rate is marked down below it', () => {
    // Rating transfers at 0.9c makes the 1.25c portal the better route, so the
    // return follows the portal rather than the rate that was edited. Pricing
    // against the best available redemption is the whole point.
    const ranked = rankCardsForCategory(
      [card('a', 'chase-ur', [rate('dining', 3)])],
      'dining',
      { 'chase-ur:transfer': 0.9 },
    );
    expect(ranked[0].centsPerPoint).toBeCloseTo(1.25);
    expect(ranked[0].centsPerDollar).toBeCloseTo(3.75);
  });

  it('leaves out closed cards', () => {
    const ranked = rankCardsForCategory(
      [card('closed', 'chase-ur', [rate('dining', 5)], { status: 'closed' })],
      'dining',
      {},
    );
    expect(ranked).toHaveLength(0);
  });

  it('carries the cap so an elevated rate is not assumed to be unlimited', () => {
    const ranked = rankCardsForCategory(
      [card('ink', 'chase-ur', [rate('office', 5, 2_500_00)])],
      'office',
      {},
    );
    expect(ranked[0].capCents).toBe(250_000);
  });
});

describe('bestCardForCategory', () => {
  it('returns the top card, or nothing when there are none', () => {
    expect(bestCardForCategory([], 'dining', {})).toBeNull();
    expect(
      bestCardForCategory([card('a', 'cash', [rate('dining', 4)])], 'dining', {})?.card.id,
    ).toBe('a');
  });
});

describe('guessEarnCategory', () => {
  it('recognises merchant text', () => {
    expect(guessEarnCategory('WHOLE FOODS MARKET')?.id).toBe('groceries');
    expect(guessEarnCategory('DELTA AIR LINES')?.id).toBe('flights');
    expect(guessEarnCategory('SHELL OIL 574')?.id).toBe('gas');
  });

  it('returns nothing rather than guessing wildly', () => {
    expect(guessEarnCategory('SQ *LOCAL VENDOR')).toBeNull();
  });
});

describe('cardsMissingRates', () => {
  it('names the open cards that would be guesswork in the cheat sheet', () => {
    const missing = cardsMissingRates([
      card('has', 'chase-ur', [rate('dining', 3)]),
      card('bare', 'chase-ur', []),
      card('closed-bare', 'chase-ur', [], { status: 'closed' }),
    ]);
    expect(missing.map((c) => c.id)).toEqual(['bare']);
  });
});
