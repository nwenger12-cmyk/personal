import { describe, expect, it } from 'vitest';
import { feeOutlook, feeTotals, upcomingFees } from '@/lib/fees';
import { blankCard, newId } from '@/lib/storage';
import type { CardAccount } from '@/lib/types';

function card(overrides: Partial<CardAccount> = {}): CardAccount {
  return { ...blankCard('2022-06-10'), productName: 'Test Card', ...overrides };
}

const NOW = '2024-03-15';
const LEAD = 45;

describe('feeOutlook', () => {
  it('predicts the next anniversary for a fee-carrying card', () => {
    const outlook = feeOutlook(card({ annualFeeCents: 9_500 }), LEAD, NOW);
    expect(outlook.nextChargeDate).toBe('2024-06-10');
    expect(outlook.anniversaryNumber).toBe(2);
    expect(outlook.predicted).toBe(true);
  });

  it('reports no fee for a no-fee card', () => {
    const outlook = feeOutlook(card({ annualFeeCents: 0 }), LEAD, NOW);
    expect(outlook.hasFee).toBe(false);
    expect(outlook.nextChargeDate).toBeNull();
  });

  it('skips year zero when the first year is waived', () => {
    const outlook = feeOutlook(
      card({ openedDate: '2024-01-05', annualFeeCents: 9_500, firstYearFeeWaived: true }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2025-01-05');
    expect(outlook.anniversaryNumber).toBe(1);
  });

  it('charges in the first year when the fee is not waived', () => {
    const outlook = feeOutlook(
      card({ openedDate: '2024-06-01', annualFeeCents: 9_500 }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2024-06-01');
  });

  it('tracks no fee on a closed card', () => {
    const outlook = feeOutlook(
      card({ annualFeeCents: 9_500, status: 'closed', closedDate: '2024-01-01' }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBeNull();
  });

  it("ignores an authorized-user card's fee -- it is not yours", () => {
    const outlook = feeOutlook(
      card({ annualFeeCents: 9_500, authorizedUser: true }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBeNull();
  });

  it('honours a pinned date over the anniversary', () => {
    const outlook = feeOutlook(
      card({ annualFeeCents: 9_500, nextFeeDateOverride: '2024-07-02' }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2024-07-02');
    expect(outlook.predicted).toBe(false);
  });

  it('rolls a pinned date forward a year once it has passed', () => {
    const outlook = feeOutlook(
      card({ annualFeeCents: 9_500, nextFeeDateOverride: '2023-07-02' }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2024-07-02');
  });

  it('moves past a cycle whose fee was actually recorded', () => {
    const outlook = feeOutlook(
      card({
        annualFeeCents: 9_500,
        feeHistory: [
          { id: newId(), date: '2024-06-14', amountCents: 9_500, refunded: false, note: '' },
        ],
      }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2025-06-10');
  });

  it('still expects the fee when the recorded charge was refunded', () => {
    const outlook = feeOutlook(
      card({
        annualFeeCents: 9_500,
        feeHistory: [
          { id: newId(), date: '2024-06-14', amountCents: 9_500, refunded: true, note: '' },
        ],
      }),
      LEAD,
      NOW,
    );
    expect(outlook.nextChargeDate).toBe('2024-06-10');
  });

  it('escalates urgency as the charge approaches', () => {
    const far = feeOutlook(card({ openedDate: '2022-12-01', annualFeeCents: 9_500 }), LEAD, NOW);
    expect(far.urgency).toBe('scheduled');

    const soon = feeOutlook(card({ openedDate: '2022-04-20', annualFeeCents: 9_500 }), LEAD, NOW);
    expect(soon.urgency).toBe('review');

    const now = feeOutlook(card({ openedDate: '2022-03-20', annualFeeCents: 9_500 }), LEAD, NOW);
    expect(now.urgency).toBe('imminent');
  });

  it('sets the review date a lead window before the charge', () => {
    const outlook = feeOutlook(card({ annualFeeCents: 9_500 }), 30, NOW);
    expect(outlook.reviewByDate).toBe('2024-05-11');
  });

  it('nets the fee against credits actually used', () => {
    const outlook = feeOutlook(
      card({ annualFeeCents: 39_500, annualCreditsValueCents: 40_000 }),
      LEAD,
      NOW,
    );
    expect(outlook.netAnnualCostCents).toBe(-500);
  });
});

describe('upcomingFees', () => {
  it('orders every card by charge date', () => {
    const events = upcomingFees(
      [
        card({ id: 'a', openedDate: '2022-09-01', annualFeeCents: 9_500 }),
        card({ id: 'b', openedDate: '2022-05-01', annualFeeCents: 39_500 }),
      ],
      LEAD,
      12,
      NOW,
    );
    expect(events.map((e) => e.date)).toEqual(['2024-05-01', '2024-09-01']);
  });

  it('emits every charge inside a multi-year window, not just the next one', () => {
    // 24 months from 2024-03-15 reaches 2026-03-15, so the 2026 anniversary
    // falls just outside it.
    const events = upcomingFees(
      [card({ openedDate: '2022-04-01', annualFeeCents: 9_500 })],
      LEAD,
      24,
      NOW,
    );
    expect(events.map((e) => e.date)).toEqual(['2024-04-01', '2025-04-01']);
    expect(events.map((e) => e.anniversaryNumber)).toEqual([2, 3]);
  });

  it('emits a single charge over a one-year window', () => {
    const events = upcomingFees(
      [card({ openedDate: '2022-04-01', annualFeeCents: 9_500 })],
      LEAD,
      12,
      NOW,
    );
    expect(events.map((e) => e.date)).toEqual(['2024-04-01']);
  });

  it('leaves out no-fee and closed cards', () => {
    const events = upcomingFees(
      [
        card({ id: 'a', annualFeeCents: 0 }),
        card({ id: 'b', annualFeeCents: 9_500, status: 'closed' }),
      ],
      LEAD,
      12,
      NOW,
    );
    expect(events).toHaveLength(0);
  });
});

describe('feeTotals', () => {
  it('counts open cards you own and nets off credits', () => {
    const totals = feeTotals([
      card({ id: 'a', annualFeeCents: 9_500, annualCreditsValueCents: 5_000 }),
      card({ id: 'b', annualFeeCents: 39_500, annualCreditsValueCents: 30_000 }),
      card({ id: 'c', annualFeeCents: 55_000, status: 'closed' }),
      card({ id: 'd', annualFeeCents: 69_500, authorizedUser: true }),
      card({ id: 'e', annualFeeCents: 0 }),
    ]);
    expect(totals.annualFeeCents).toBe(49_000);
    expect(totals.annualCreditsCents).toBe(35_000);
    expect(totals.netCents).toBe(14_000);
    expect(totals.cardCount).toBe(2);
  });
});
