import { describe, expect, it } from 'vitest';
import {
  activeBonuses,
  bonusDeadline,
  bonusOutlook,
  outstandingSpendCents,
  pendingRewards,
  readProgress,
} from '@/lib/bonuses';
import { blankCard, blankExpense } from '@/lib/storage';
import type { CardAccount, Expense, SignupBonus } from '@/lib/types';

const WARN = 30;

function bonus(overrides: Partial<SignupBonus> = {}): SignupBonus {
  return {
    rewardKind: 'points',
    points: 100_000,
    cashCents: 0,
    spendRequiredCents: 800_000,
    spendWindowMonths: 3,
    startDate: '2024-01-01',
    deadlineOverride: null,
    progressSource: 'manual',
    spendProgressCents: 0,
    progressUpdated: null,
    status: 'tracking',
    earnedDate: null,
    postedDate: null,
    notes: '',
    ...overrides,
  };
}

describe('bonusDeadline', () => {
  it('adds calendar months to the start date', () => {
    expect(bonusDeadline(bonus({ startDate: '2024-01-31', spendWindowMonths: 3 })))
      .toBe('2024-04-30');
  });

  it('uses the exact date from the offer when one is set', () => {
    expect(bonusDeadline(bonus({ deadlineOverride: '2024-04-15' }))).toBe('2024-04-15');
  });
});

describe('bonusOutlook', () => {
  it('reports the remaining spend and the pace it needs', () => {
    // Halfway through a 91-day window with half the spend done, so the pace
    // needed is the $4,000 left spread over the 46 days that remain.
    const outlook = bonusOutlook(bonus({ spendProgressCents: 400_000 }), WARN, '2024-02-15');
    expect(outlook.deadline).toBe('2024-04-01');
    expect(outlook.remainingCents).toBe(400_000);
    expect(outlook.daysLeft).toBe(46);
    expect(outlook.perDayNeededCents).toBe(Math.ceil(400_000 / 47));
    expect(outlook.paceStatus).toBe('on-track');
  });

  it('is behind once the window has run further than the spend', () => {
    // Two thirds of a 91-day window gone with half the spend done: still
    // possible, but the required daily pace has gone up.
    const outlook = bonusOutlook(bonus({ spendProgressCents: 400_000 }), WARN, '2024-02-29');
    expect(outlook.paceStatus).toBe('behind');
  });

  it('calls it earned once the requirement is met', () => {
    const outlook = bonusOutlook(bonus({ spendProgressCents: 810_000 }), WARN, '2024-02-01');
    expect(outlook.paceStatus).toBe('earned');
    expect(outlook.remainingCents).toBe(0);
    expect(outlook.perDayNeededCents).toBeNull();
  });

  it('flags being behind the even-spending line', () => {
    // Two thirds of the window gone, a fifth of the spend done.
    const outlook = bonusOutlook(bonus({ spendProgressCents: 160_000 }), WARN, '2024-03-01');
    expect(outlook.paceStatus).toBe('behind');
    expect(outlook.progressRatio).toBeLessThan(outlook.expectedRatio);
  });

  it('flags at-risk once the deadline is inside the warning window', () => {
    const outlook = bonusOutlook(bonus({ spendProgressCents: 700_000 }), WARN, '2024-03-20');
    expect(outlook.daysLeft).toBeLessThanOrEqual(WARN);
    expect(outlook.paceStatus).toBe('at-risk');
  });

  it('calls it missed once the window has closed short', () => {
    const outlook = bonusOutlook(bonus({ spendProgressCents: 700_000 }), WARN, '2024-04-05');
    expect(outlook.windowClosed).toBe(true);
    expect(outlook.paceStatus).toBe('missed');
    expect(outlook.perDayNeededCents).toBeNull();
  });

  it('still reads as earned after the window if the spend was met', () => {
    const outlook = bonusOutlook(
      bonus({ spendProgressCents: 800_000, status: 'earned' }),
      WARN,
      '2024-06-01',
    );
    expect(outlook.paceStatus).toBe('earned');
  });

  it('counts the deadline day itself as spendable', () => {
    // $100 left on the last day is $100 that day, not a divide by zero.
    const outlook = bonusOutlook(
      bonus({ spendRequiredCents: 800_000, spendProgressCents: 790_000 }),
      0,
      '2024-04-01',
    );
    expect(outlook.daysLeft).toBe(0);
    expect(outlook.perDayNeededCents).toBe(10_000);
  });

  it('does not divide by zero when the window is a single day', () => {
    const outlook = bonusOutlook(
      bonus({ startDate: '2024-01-01', deadlineOverride: '2024-01-01' }),
      WARN,
      '2024-01-01',
    );
    expect(Number.isFinite(outlook.expectedRatio)).toBe(true);
    expect(outlook.expectedRatio).toBe(0);
  });
});

describe('activeBonuses', () => {
  function card(id: string, b: SignupBonus | null): CardAccount {
    return { ...blankCard('2024-01-01'), id, productName: id, bonus: b };
  }

  it('keeps only the ones still being worked, soonest deadline first', () => {
    const list = activeBonuses(
      [
        card('late', bonus({ deadlineOverride: '2024-06-01' })),
        card('soon', bonus({ deadlineOverride: '2024-04-01' })),
        card('done', bonus({ status: 'earned' })),
        card('none', null),
      ],
      WARN,
      '2024-02-01',
    );
    expect(list.map((b) => b.card.id)).toEqual(['soon', 'late']);
  });

  it('totals the spend left across every tracked bonus', () => {
    const list = activeBonuses(
      [
        card('a', bonus({ spendRequiredCents: 800_000, spendProgressCents: 300_000 })),
        card('b', bonus({ spendRequiredCents: 400_000, spendProgressCents: 100_000 })),
      ],
      WARN,
      '2024-02-01',
    );
    expect(outstandingSpendCents(list)).toBe(800_000);
  });
});

describe('outstanding totals', () => {
  function card(id: string, b: SignupBonus): CardAccount {
    return { ...blankCard('2024-01-01'), id, productName: id, bonus: b };
  }

  it('leaves out a bonus whose window has already closed', () => {
    // Spending more cannot reach a closed window, so counting its shortfall
    // would overstate what is actually left to do.
    const list = activeBonuses(
      [
        card('live', bonus({
          deadlineOverride: '2024-06-01',
          spendRequiredCents: 800_000,
          spendProgressCents: 300_000,
          points: 60_000,
        })),
        card('expired', bonus({
          deadlineOverride: '2024-01-15',
          spendRequiredCents: 400_000,
          spendProgressCents: 100_000,
          points: 90_000,
        })),
      ],
      WARN,
      '2024-02-01',
    );
    expect(outstandingSpendCents(list)).toBe(500_000);
    expect(pendingRewards(list).points).toBe(60_000);
  });
});

describe('derived progress', () => {
  function card(id: string, b: SignupBonus): CardAccount {
    return { ...blankCard('2024-01-01'), id, productName: id, bonus: b };
  }
  function spend(cardId: string | null, date: string, cents: number): Expense {
    return { ...blankExpense('e1', date), cardId, amountCents: cents };
  }

  const tracking = bonus({
    startDate: '2024-01-01',
    spendWindowMonths: 3,
    spendRequiredCents: 800_000,
    progressSource: 'expenses',
    spendProgressCents: 0,
  });

  it('adds up imported transactions on that card inside the window', () => {
    const c = card('c1', tracking);
    const reading = readProgress(c, tracking, [
      spend('c1', '2024-01-15', 300_000),
      spend('c1', '2024-02-15', 200_000),
    ]);
    expect(reading.cents).toBe(500_000);
    expect(reading.source).toBe('expenses');
    expect(reading.expenseCount).toBe(2);
  });

  it('ignores spend on a different card', () => {
    const c = card('c1', tracking);
    const reading = readProgress(c, tracking, [
      spend('c1', '2024-01-15', 300_000),
      spend('c2', '2024-01-15', 999_000),
      spend(null, '2024-01-15', 999_000),
    ]);
    expect(reading.cents).toBe(300_000);
  });

  it('ignores spend outside the window', () => {
    const c = card('c1', tracking);
    const reading = readProgress(c, tracking, [
      spend('c1', '2023-12-31', 100_000),
      spend('c1', '2024-01-01', 100_000),
      spend('c1', '2024-04-01', 100_000),
      spend('c1', '2024-04-02', 100_000),
    ]);
    // The start date and the deadline both count; a day either side does not.
    expect(reading.cents).toBe(200_000);
  });

  it('nets refunds off, the way an issuer counts', () => {
    const c = card('c1', tracking);
    const reading = readProgress(c, tracking, [
      spend('c1', '2024-01-15', 300_000),
      spend('c1', '2024-02-01', -50_000),
    ]);
    expect(reading.cents).toBe(250_000);
  });

  it('falls back to the pinned figure when nothing has been imported', () => {
    // Showing a derived zero would read as "no progress" when the truth is
    // "nothing to derive from yet".
    const withFigure = { ...tracking, spendProgressCents: 412_000 };
    const reading = readProgress(card('c1', withFigure), withFigure, []);
    expect(reading.cents).toBe(412_000);
    expect(reading.source).toBe('manual');
    expect(reading.fellBackToManual).toBe(true);
  });

  it('uses the pinned figure when set to manual, whatever was imported', () => {
    const manual = { ...tracking, progressSource: 'manual' as const, spendProgressCents: 100 };
    const reading = readProgress(card('c1', manual), manual, [
      spend('c1', '2024-01-15', 300_000),
    ]);
    expect(reading.cents).toBe(100);
    expect(reading.source).toBe('manual');
  });

  it('drives the outlook through activeBonuses', () => {
    const list = activeBonuses(
      [card('c1', tracking)],
      30,
      '2024-02-01',
      [spend('c1', '2024-01-15', 800_000)],
    );
    expect(list[0].outlook.progressCents).toBe(800_000);
    expect(list[0].outlook.paceStatus).toBe('earned');
  });
});
