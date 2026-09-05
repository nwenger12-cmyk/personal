import { describe, expect, it } from 'vitest';
import {
  annualPerkValueCents,
  expiringPerks,
  nextPerkDeadline,
  periodEnd,
  periodKey,
  periodLabel,
  perkStatus,
  perkUseThisYear,
  togglePerkPeriod,
} from '@/lib/perks';
import { blankCard } from '@/lib/storage';
import type { CardAccount, Perk } from '@/lib/types';

function perk(overrides: Partial<Perk> = {}): Perk {
  return {
    id: 'p1',
    label: '$15 Uber Cash',
    valueCents: 1_500,
    period: 'monthly',
    usedPeriods: [],
    notes: '',
    ...overrides,
  };
}

function card(perks: Perk[]): CardAccount {
  return { ...blankCard('2024-01-01'), id: 'c1', productName: 'Platinum', perks };
}

describe('periodKey', () => {
  it('names each period shape', () => {
    expect(periodKey('monthly', '2026-03-15')).toBe('2026-M03');
    expect(periodKey('quarterly', '2026-03-15')).toBe('2026-Q1');
    expect(periodKey('quarterly', '2026-04-01')).toBe('2026-Q2');
    expect(periodKey('semiannual', '2026-06-30')).toBe('2026-H1');
    expect(periodKey('semiannual', '2026-07-01')).toBe('2026-H2');
    expect(periodKey('annual', '2026-12-31')).toBe('2026');
  });
});

describe('periodEnd', () => {
  it('is the last day of the period', () => {
    expect(periodEnd('monthly', '2026-03-15')).toBe('2026-03-31');
    expect(periodEnd('monthly', '2026-02-10')).toBe('2026-02-28');
    expect(periodEnd('monthly', '2024-02-10')).toBe('2024-02-29');
    expect(periodEnd('quarterly', '2026-01-05')).toBe('2026-03-31');
    expect(periodEnd('semiannual', '2026-02-01')).toBe('2026-06-30');
    expect(periodEnd('annual', '2026-05-05')).toBe('2026-12-31');
  });
});

describe('periodLabel', () => {
  it('reads the way a person would say it', () => {
    expect(periodLabel('monthly', '2026-M03')).toBe('Mar 2026');
    expect(periodLabel('quarterly', '2026-Q2')).toBe('Q2 2026');
    expect(periodLabel('semiannual', '2026-H1')).toBe('H1 2026');
    expect(periodLabel('annual', '2026')).toBe('2026');
  });
});

describe('perkStatus', () => {
  it('reports the current period and how long is left', () => {
    const status = perkStatus(card([perk()]), perk(), '2026-03-20');
    expect(status.key).toBe('2026-M03');
    expect(status.endDate).toBe('2026-03-31');
    expect(status.daysLeft).toBe(11);
    expect(status.used).toBe(false);
  });

  it('knows a period already ticked off', () => {
    const p = perk({ usedPeriods: ['2026-M03'] });
    expect(perkStatus(card([p]), p, '2026-03-20').used).toBe(true);
    expect(perkStatus(card([p]), p, '2026-04-02').used).toBe(false);
  });

  it('annualises by the number of periods in a year', () => {
    expect(perkStatus(card([perk()]), perk(), '2026-03-20').annualValueCents).toBe(18_000);
    const annual = perk({ period: 'annual', valueCents: 30_000 });
    expect(perkStatus(card([annual]), annual, '2026-03-20').annualValueCents).toBe(30_000);
  });
});

describe('annualPerkValueCents', () => {
  it('adds every perk at its yearly rate', () => {
    // $15/month plus $300/year.
    expect(
      annualPerkValueCents(
        card([perk(), perk({ id: 'p2', period: 'annual', valueCents: 30_000 })]),
      ),
    ).toBe(18_000 + 30_000);
  });
});

describe('expiringPerks', () => {
  it('surfaces an unused credit whose period is closing', () => {
    const found = expiringPerks([card([perk()])], 10, '2026-03-25');
    expect(found).toHaveLength(1);
    expect(found[0].daysLeft).toBe(6);
  });

  it('says nothing when the credit is already used', () => {
    expect(expiringPerks([card([perk({ usedPeriods: ['2026-M03'] })])], 10, '2026-03-25'))
      .toHaveLength(0);
  });

  it('says nothing while the period still has room', () => {
    expect(expiringPerks([card([perk()])], 10, '2026-03-05')).toHaveLength(0);
  });

  it('ignores a closed card', () => {
    const closed = { ...card([perk()]), status: 'closed' as const };
    expect(expiringPerks([closed], 10, '2026-03-25')).toHaveLength(0);
  });
});

describe('perkUseThisYear', () => {
  it('counts only periods that have already begun', () => {
    // By the end of March, three monthly periods exist, not twelve.
    const use = perkUseThisYear(card([perk({ usedPeriods: ['2026-M01', '2026-M02'] })]), '2026-03-15');
    expect(use.totalCount).toBe(3);
    expect(use.usedCount).toBe(2);
    expect(use.possibleCents).toBe(4_500);
    expect(use.usedCents).toBe(3_000);
  });
});

describe('togglePerkPeriod', () => {
  it('ticks a period on and off', () => {
    const on = togglePerkPeriod(perk(), '2026-M03');
    expect(on.usedPeriods).toEqual(['2026-M03']);
    expect(togglePerkPeriod(on, '2026-M03').usedPeriods).toEqual([]);
  });
});

describe('nextPerkDeadline', () => {
  it('is the end of the period in progress', () => {
    expect(nextPerkDeadline(perk(), '2026-03-15')).toBe('2026-03-31');
    expect(nextPerkDeadline(perk({ period: 'annual' }), '2026-03-15')).toBe('2026-12-31');
  });
});
