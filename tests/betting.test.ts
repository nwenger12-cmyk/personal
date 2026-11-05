import { describe, expect, it } from 'vitest';
import {
  americanToDecimal,
  combinedMargin,
  decimalToAmerican,
  planHedge,
  summarizeByBook,
  summarizeTaxYear,
  triggersW2G,
  wagerNetCents,
} from '@/lib/betting';
import type { Wager } from '@/lib/betting';
import { coerceData } from '@/lib/storage';

function wager(partial: Partial<Wager>): Wager {
  return {
    id: Math.random().toString(36),
    date: '2026-03-01',
    book: 'BetMGM',
    selection: '',
    americanOdds: -110,
    stakeCents: 10_000,
    stakeKind: 'cash',
    result: 'pending',
    promo: '',
    group: null,
    notes: '',
    ...partial,
  };
}

describe('odds', () => {
  it('converts American to decimal both ways', () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5);
    expect(americanToDecimal(-200)).toBeCloseTo(1.5);
    expect(americanToDecimal(100)).toBeCloseTo(2);
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(1.5)).toBe(-200);
  });

  it('rejects odds between -100 and +100', () => {
    expect(() => americanToDecimal(50)).toThrow();
    expect(() => americanToDecimal(-99)).toThrow();
  });

  it('measures the combined margin of a two-way market', () => {
    // -110 / -110 is the standard ~4.8% vig.
    expect(combinedMargin(-110, -110)).toBeCloseTo(0.0476, 3);
    expect(combinedMargin(105, 105)).toBeLessThan(0);
  });
});

describe('planHedge', () => {
  it('equalises a qualifying bet so both outcomes match', () => {
    const plan = planHedge({ mode: 'qualifying', stakeCents: 10_000, promoOdds: -110, hedgeOdds: -110 });
    expect(plan.hedgeStakeCents).toBe(10_000);
    expect(Math.abs(plan.promoWinsCents - plan.hedgeWinsCents)).toBeLessThanOrEqual(1);
    // Losing the vig: about -$9.09 on $100.
    expect(plan.lockedCents).toBe(-909);
    expect(plan.cashOutlayCents).toBe(20_000);
  });

  it('converts a bonus bet at long odds', () => {
    // $50 bonus at +400, hedge at -500.
    const plan = planHedge({ mode: 'bonus', stakeCents: 5_000, promoOdds: 400, hedgeOdds: -500 });
    // x = 50 * 4 / 1.2 = 166.67
    expect(plan.hedgeStakeCents).toBe(16_667);
    expect(plan.lockedCents).toBeGreaterThan(3_300);
    expect(plan.rate).toBeCloseTo(0.667, 2);
    // The bonus stake is not cash at risk.
    expect(plan.cashOutlayCents).toBe(16_667);
  });

  it('values a no-sweat refund into the losing branch', () => {
    const plan = planHedge({
      mode: 'no-sweat',
      stakeCents: 10_000,
      promoOdds: 300,
      hedgeOdds: -350,
      refundCents: 10_000,
      refundConversion: 0.7,
    });
    // x = (100*4 - 70) / (1 + 100/350)
    expect(plan.hedgeStakeCents).toBe(Math.round((40_000 - 7_000) / (1 + 100 / 350)));
    expect(Math.abs(plan.promoWinsCents - plan.hedgeWinsCents)).toBeLessThanOrEqual(1);
    expect(plan.lockedCents).toBeGreaterThan(0);
  });

  it('caps the refund at the stake', () => {
    const a = planHedge({ mode: 'no-sweat', stakeCents: 5_000, promoOdds: 300, hedgeOdds: -350, refundCents: 99_999 });
    const b = planHedge({ mode: 'no-sweat', stakeCents: 5_000, promoOdds: 300, hedgeOdds: -350, refundCents: 5_000 });
    expect(a).toEqual(b);
  });

  it('rounds the hedge to whole dollars and reports the real outcomes', () => {
    const plan = planHedge({ mode: 'bonus', stakeCents: 5_000, promoOdds: 400, hedgeOdds: -500, roundToDollar: true });
    expect(plan.hedgeStakeCents).toBe(16_700);
    expect(plan.lockedCents).toBe(Math.min(plan.promoWinsCents, plan.hedgeWinsCents));
  });

  it('refuses a zero stake', () => {
    expect(() => planHedge({ mode: 'qualifying', stakeCents: 0, promoOdds: -110, hedgeOdds: -110 })).toThrow();
  });
});

describe('W-2G', () => {
  it('needs both the threshold and 300x', () => {
    // $2,000+ winnings but nowhere near 300x.
    expect(triggersW2G(100_000, 300, 200_000)).toBe(false);
    // 300x but under the threshold.
    expect(triggersW2G(100, 30_000, 200_000)).toBe(false);
    // $10 at +30000 wins $3,000: both tests met.
    expect(triggersW2G(1_000, 30_000, 200_000)).toBe(true);
  });
});

describe('the log', () => {
  it('nets cash and bonus wagers correctly', () => {
    expect(wagerNetCents(wager({ result: 'won', americanOdds: 100 }))).toBe(10_000);
    expect(wagerNetCents(wager({ result: 'lost' }))).toBe(-10_000);
    expect(wagerNetCents(wager({ result: 'lost', stakeKind: 'bonus' }))).toBe(0);
    expect(wagerNetCents(wager({ result: 'won', stakeKind: 'bonus', americanOdds: 400 }))).toBe(40_000);
    expect(wagerNetCents(wager({ result: 'push' }))).toBe(0);
  });

  it('shows the gap between profit and taxable winnings', () => {
    // A hedged bonus bet: $50 bonus at +400 lost, $166.67 at -500 won.
    const wagers = [
      wager({ stakeKind: 'bonus', stakeCents: 5_000, americanOdds: 400, result: 'lost' }),
      wager({ stakeCents: 16_667, americanOdds: -500, result: 'won', book: 'FanDuel' }),
      // A qualifier: $100 at -110 won, $100 at -110 lost.
      wager({ stakeCents: 10_000, result: 'won' }),
      wager({ stakeCents: 10_000, result: 'lost', book: 'FanDuel' }),
      wager({ date: '2025-12-31', result: 'won' }),
      wager({ result: 'pending' }),
    ];
    const s = summarizeTaxYear(wagers, 2026);
    expect(s.winningsCents).toBe(3_333 + 9_091);
    expect(s.lossesCents).toBe(10_000);
    expect(s.netCents).toBe(2_424);
    expect(s.taxableStandardCents).toBe(12_424);
    expect(s.taxableItemizedCents).toBe(12_424 - 9_000);
    expect(s.pendingCount).toBe(1);
    expect(s.settledCount).toBe(4);
  });

  it('allows full loss netting before 2026', () => {
    const s = summarizeTaxYear(
      [wager({ date: '2025-01-01', result: 'won' }), wager({ date: '2025-01-01', result: 'lost' })],
      2025,
    );
    expect(s.taxableItemizedCents).toBe(0);
  });

  it('totals by book', () => {
    const books = summarizeByBook([
      wager({ result: 'won', americanOdds: 100 }),
      wager({ result: 'lost', book: 'FanDuel' }),
    ]);
    expect(books.map((b) => b.book)).toEqual(['BetMGM', 'FanDuel']);
  });
});

describe('storage', () => {
  it('keeps valid wagers and drops broken ones', () => {
    const data = coerceData({
      cards: [],
      wagers: [
        { date: '2026-01-02', americanOdds: -110, stakeCents: 500, result: 'won', stakeKind: 'bonus' },
        { date: 'nope', americanOdds: -110 },
        { date: '2026-01-02', americanOdds: 20 },
        'junk',
      ],
    });
    expect(data.wagers).toHaveLength(1);
    expect(data.wagers[0].stakeKind).toBe('bonus');
    expect(data.wagers[0].result).toBe('won');
  });

  it('defaults to no wagers and the 2026 W-2G threshold', () => {
    const data = coerceData({ cards: [] });
    expect(data.wagers).toEqual([]);
    expect(data.settings.w2gThresholdCents).toBe(200_000);
  });
});
