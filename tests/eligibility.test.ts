import { describe, expect, it } from 'vitest';
import { bonusEligibility } from '@/lib/eligibility';
import { blankBonus, blankCard } from '@/lib/storage';
import type { CardAccount } from '@/lib/types';

const NOW = '2026-09-05';

function card(
  id: string,
  catalogId: string,
  bonus: Partial<CardAccount['bonus']> | null,
): CardAccount {
  const base = { ...blankCard('2022-01-01'), id, catalogId, productName: id };
  if (!bonus) return base;
  return { ...base, bonus: { ...blankBonus(base), ...bonus } as CardAccount['bonus'] };
}

describe('bonusEligibility', () => {
  it('says nothing about a family you have never earned a bonus in', () => {
    expect(bonusEligibility([card('a', 'chase-sapphire-preferred', null)], NOW)).toEqual([]);
  });

  it('runs a 48-month clock from when the bonus posted', () => {
    const status = bonusEligibility(
      [card('csp', 'chase-sapphire-preferred', { status: 'earned', postedDate: '2024-03-10' })],
      NOW,
    ).find((s) => s.rule.id === 'chase-sapphire');
    expect(status?.eligibleFrom).toBe('2028-03-10');
    expect(status?.eligible).toBe(false);
  });

  it('treats Preferred and Reserve as one family', () => {
    // A Reserve bonus blocks a Preferred bonus and vice versa.
    const status = bonusEligibility(
      [card('csr', 'chase-sapphire-reserve', { status: 'earned', postedDate: '2023-01-01' })],
      NOW,
    ).find((s) => s.rule.id === 'chase-sapphire');
    expect(status?.lastEarnedOn).toBe('Sapphire Reserve');
    expect(status?.eligibleFrom).toBe('2027-01-01');
  });

  it('uses the most recent earned bonus in the family', () => {
    const status = bonusEligibility(
      [
        card('csp', 'chase-sapphire-preferred', { status: 'earned', postedDate: '2021-01-01' }),
        card('csr', 'chase-sapphire-reserve', { status: 'earned', postedDate: '2024-06-01' }),
      ],
      NOW,
    ).find((s) => s.rule.id === 'chase-sapphire');
    expect(status?.eligibleFrom).toBe('2028-06-01');
  });

  it('reports a clock that has already run out as eligible', () => {
    const status = bonusEligibility(
      [card('csp', 'chase-sapphire-preferred', { status: 'earned', postedDate: '2020-01-01' })],
      NOW,
    ).find((s) => s.rule.id === 'chase-sapphire');
    expect(status?.eligible).toBe(true);
    expect(status?.daysUntil).toBeLessThan(0);
  });

  it('marks an Amex product as used for life', () => {
    const status = bonusEligibility(
      [card('gold', 'amex-gold', { status: 'earned', postedDate: '2019-05-01' })],
      NOW,
    ).find((s) => s.rule.id === 'amex-lifetime');
    expect(status?.permanentlyUsed).toBe(true);
    expect(status?.eligibleFrom).toBeNull();
    expect(status?.eligible).toBe(false);
  });

  it('ignores a bonus still being worked or missed', () => {
    expect(
      bonusEligibility([card('csp', 'chase-sapphire-preferred', { status: 'tracking' })], NOW),
    ).toEqual([]);
    expect(
      bonusEligibility([card('csp', 'chase-sapphire-preferred', { status: 'missed' })], NOW),
    ).toEqual([]);
  });

  it('falls back to the earned date when nothing recorded when it posted', () => {
    const status = bonusEligibility(
      [card('csp', 'chase-sapphire-preferred', {
        status: 'earned',
        earnedDate: '2024-02-01',
        postedDate: null,
      })],
      NOW,
    ).find((s) => s.rule.id === 'chase-sapphire');
    expect(status?.eligibleFrom).toBe('2028-02-01');
  });

  it('orders the soonest clock first', () => {
    const all = bonusEligibility(
      [
        card('csp', 'chase-sapphire-preferred', { status: 'earned', postedDate: '2024-06-01' }),
        card('ink', 'chase-ink-cash', { status: 'earned', postedDate: '2025-01-01' }),
      ],
      NOW,
    );
    const days = all.map((s) => s.daysUntil ?? 1e9);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});
