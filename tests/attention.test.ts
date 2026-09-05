import { describe, expect, it } from 'vitest';
import { attentionItems, lastImportByCard, missingRecurring } from '@/lib/attention';
import { blankCard, blankExpense, newId } from '@/lib/storage';
import { emptyData } from '@/lib/types';
import type { AppData, CardAccount, Expense } from '@/lib/types';

const NOW = '2026-09-04';

function expense(date: string, merchant: string, overrides: Partial<Expense> = {}): Expense {
  return {
    ...blankExpense('entity-locusstock', date),
    id: newId(),
    merchant,
    amountCents: 5_000,
    categoryId: 'software',
    cardId: 'card-1',
    ...overrides,
  };
}

function data(overrides: Partial<AppData> = {}): AppData {
  return { ...emptyData(), ...overrides };
}

describe('missingRecurring', () => {
  it('flags a subscription that billed monthly and then stopped', () => {
    const rows = [
      expense('2026-03-01', 'ADOBE'),
      expense('2026-04-01', 'ADOBE'),
      expense('2026-05-01', 'ADOBE'),
    ];
    const missing = missingRecurring(rows, NOW);
    expect(missing).toHaveLength(1);
    expect(missing[0].merchant).toBe('ADOBE');
    expect(missing[0].monthsSeen).toBe(3);
  });

  it('ignores a merchant still billing', () => {
    const rows = [
      expense('2026-06-01', 'ADOBE'),
      expense('2026-07-01', 'ADOBE'),
      expense('2026-08-25', 'ADOBE'),
    ];
    expect(missingRecurring(rows, NOW)).toHaveLength(0);
  });

  it('ignores a merchant seen in fewer than three months', () => {
    const rows = [expense('2026-01-01', 'ONE OFF'), expense('2026-02-01', 'ONE OFF')];
    expect(missingRecurring(rows, NOW)).toHaveLength(0);
  });

  it('counts months, not transactions', () => {
    // Three charges in one month is not a monthly subscription.
    const rows = [
      expense('2026-01-01', 'STORE'),
      expense('2026-01-10', 'STORE'),
      expense('2026-01-20', 'STORE'),
    ];
    expect(missingRecurring(rows, NOW)).toHaveLength(0);
  });

  it('groups merchant text that differs only in punctuation', () => {
    const rows = [
      expense('2026-03-01', 'AWS *billing'),
      expense('2026-04-01', 'AWS  BILLING'),
      expense('2026-05-01', 'aws-billing'),
    ];
    expect(missingRecurring(rows, NOW)).toHaveLength(1);
  });
});

describe('lastImportByCard', () => {
  it('takes the newest date per card', () => {
    const last = lastImportByCard([
      expense('2026-01-01', 'A', { cardId: 'c1' }),
      expense('2026-05-01', 'B', { cardId: 'c1' }),
      expense('2026-02-01', 'C', { cardId: 'c2' }),
      expense('2026-08-01', 'D', { cardId: null }),
    ]);
    expect(last.get('c1')).toBe('2026-05-01');
    expect(last.get('c2')).toBe('2026-02-01');
    expect(last.size).toBe(2);
  });
});

describe('attentionItems', () => {
  const card: CardAccount = {
    ...blankCard('2024-01-10'),
    id: 'card-1',
    productName: 'Ink Preferred',
    nickname: 'Ink',
  };

  it('prompts for a first import when there is no spending at all', () => {
    const items = attentionItems(data({ cards: [card] }), NOW);
    expect(items.map((i) => i.id)).toContain('no-expenses');
  });

  it('flags a card that has gone quiet', () => {
    const items = attentionItems(
      data({ cards: [card], expenses: [expense('2026-05-01', 'ADOBE')] }),
      NOW,
    );
    const stale = items.find((i) => i.id === 'stale-imports');
    expect(stale).toBeDefined();
    expect(stale?.detail).toContain('Ink');
  });

  it('does not flag a card imported recently', () => {
    const items = attentionItems(
      data({ cards: [card], expenses: [expense('2026-08-28', 'ADOBE')] }),
      NOW,
    );
    expect(items.map((i) => i.id)).not.toContain('stale-imports');
  });

  it('separates a card that has never been imported from one that stopped', () => {
    const second = { ...blankCard('2024-02-01'), id: 'card-2', productName: 'Venture X' };
    const items = attentionItems(
      data({ cards: [card, second], expenses: [expense('2026-08-28', 'ADOBE')] }),
      NOW,
    );
    const untracked = items.find((i) => i.id === 'untracked-cards');
    expect(untracked?.detail).toContain('Venture X');
    expect(untracked?.detail).not.toContain('Ink');
  });

  it('flags transactions waiting for a category', () => {
    const items = attentionItems(
      data({
        cards: [card],
        expenses: [expense('2026-08-28', 'MYSTERY', { reviewed: false })],
      }),
      NOW,
    );
    expect(items.map((i) => i.id)).toContain('unreviewed');
  });

  it('flags a points balance nobody has touched', () => {
    const items = attentionItems(
      data({
        cards: [card],
        expenses: [expense('2026-08-28', 'ADOBE')],
        balances: [{ programId: 'chase-ur', amount: 100_000, updated: '2026-01-01' }],
      }),
      NOW,
    );
    const stale = items.find((i) => i.id === 'stale-balances');
    expect(stale?.detail).toContain('Chase UR');
  });

  it('leaves a freshly updated balance alone', () => {
    const items = attentionItems(
      data({
        cards: [card],
        expenses: [expense('2026-08-28', 'ADOBE')],
        balances: [{ programId: 'chase-ur', amount: 100_000, updated: '2026-08-30' }],
      }),
      NOW,
    );
    expect(items.map((i) => i.id)).not.toContain('stale-balances');
  });

  it('puts urgent items before quieter ones', () => {
    const feeCard: CardAccount = {
      ...blankCard('2024-09-10'),
      id: 'fee-card',
      productName: 'Sapphire Reserve',
      annualFeeCents: 79_500,
    };
    const items = attentionItems(
      data({
        cards: [feeCard],
        expenses: [expense('2026-01-01', 'ADOBE', { cardId: 'fee-card' })],
        balances: [{ programId: 'chase-ur', amount: 1, updated: '2026-01-01' }],
      }),
      NOW,
    );
    const severities = items.map((i) => i.severity);
    const rank = { now: 0, soon: 1, idle: 2 } as const;
    expect(severities.map((s) => rank[s])).toEqual(
      [...severities.map((s) => rank[s])].sort((a, b) => a - b),
    );
  });

  it('is empty when everything is current', () => {
    const items = attentionItems(
      data({
        cards: [card],
        expenses: [expense('2026-08-28', 'ADOBE')],
        balances: [{ programId: 'chase-ur', amount: 100_000, updated: '2026-09-01' }],
      }),
      NOW,
    );
    expect(items).toEqual([]);
  });
});
