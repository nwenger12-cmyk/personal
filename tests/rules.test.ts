import { describe, expect, it } from 'vitest';
import { countsToward524, fiveTwentyFour } from '@/lib/rules';
import { blankCard } from '@/lib/storage';
import type { CardAccount, Issuer } from '@/lib/types';

const NOW = '2024-06-01';

function card(
  id: string,
  openedDate: string,
  overrides: Partial<CardAccount> = {},
): CardAccount {
  return { ...blankCard(openedDate), id, productName: id, ...overrides };
}

describe('countsToward524', () => {
  it('counts every personal card', () => {
    expect(countsToward524(card('a', NOW, { issuer: 'chase' }))).toBe(true);
    expect(countsToward524(card('b', NOW, { issuer: 'amex' }))).toBe(true);
  });

  it('leaves out business cards that stay off the personal bureaus', () => {
    for (const issuer of ['chase', 'citi', 'amex'] as Issuer[]) {
      expect(countsToward524(card('x', NOW, { issuer, business: true }))).toBe(false);
    }
  });

  it('counts business cards from issuers that report them personally', () => {
    for (const issuer of ['capital-one', 'discover'] as Issuer[]) {
      expect(countsToward524(card('x', NOW, { issuer, business: true }))).toBe(true);
    }
  });
});

describe('fiveTwentyFour', () => {
  it('counts only what was opened inside the 24-month window', () => {
    const status = fiveTwentyFour(
      [
        card('recent', '2023-06-01'),
        card('edge-in', '2022-06-15'),
        card('aged-out', '2022-05-01'),
      ],
      NOW,
    );
    expect(status.count).toBe(2);
    expect(status.entries.map((e) => e.cardId)).toEqual(['edge-in', 'recent']);
    expect(status.underLimit).toBe(true);
  });

  it('still counts a card that has since been closed', () => {
    const status = fiveTwentyFour(
      [card('closed', '2023-06-01', { status: 'closed', closedDate: '2024-01-01' })],
      NOW,
    );
    expect(status.count).toBe(1);
  });

  it('reports when each card falls off', () => {
    const status = fiveTwentyFour([card('a', '2023-03-10')], NOW);
    expect(status.nextFallOff?.fallsOffDate).toBe('2025-03-10');
    expect(status.nextFallOff?.daysUntilFallOff).toBe(282);
  });

  it('goes over the limit at five and says when a slot opens', () => {
    const status = fiveTwentyFour(
      [
        card('1', '2022-07-01'),
        card('2', '2022-08-01'),
        card('3', '2023-01-01'),
        card('4', '2023-06-01'),
        card('5', '2024-01-01'),
      ],
      NOW,
    );
    expect(status.count).toBe(5);
    expect(status.underLimit).toBe(false);
    // The oldest falling off takes the count to 4.
    expect(status.clearsOn).toBe('2024-07-01');
  });

  it('separates out authorized-user cards', () => {
    const status = fiveTwentyFour(
      [
        card('own', '2023-06-01'),
        card('au', '2023-07-01', { authorizedUser: true }),
      ],
      NOW,
    );
    expect(status.count).toBe(2);
    expect(status.countExcludingAuthorizedUser).toBe(1);
  });

  it('does not report a clear date while under the limit', () => {
    const status = fiveTwentyFour([card('a', '2023-06-01')], NOW);
    expect(status.clearsOn).toBeNull();
  });
});
