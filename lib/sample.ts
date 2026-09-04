import { addMonths, today } from './dates';
import type { IsoDate } from './dates';
import { blankBonus, cardFromCatalog, newId } from './storage';
import { DEFAULT_SETTINGS, DATA_VERSION } from './types';
import type { AppData, CardAccount } from './types';

/**
 * A wallet to look at before you have entered your own.
 *
 * Dates are generated relative to today, so the timeline, the 5/24 counter and
 * the bonus pace all show something live rather than a frozen snapshot. Loading
 * it replaces whatever is stored, and Settings can clear it again.
 */

function monthsAgo(n: number, now: IsoDate): IsoDate {
  return addMonths(now, -n);
}

export function sampleData(now: IsoDate = today()): AppData {
  const make = (
    catalogId: string,
    openedMonthsAgo: number,
    extra: Partial<CardAccount> = {},
  ): CardAccount => ({
    ...cardFromCatalog(catalogId, monthsAgo(openedMonthsAgo, now)),
    id: newId(),
    ...extra,
  });

  const sapphire = make('chase-sapphire-preferred', 26, {
    nickname: 'Sapphire Preferred',
    last4: '4417',
    annualCreditsValueCents: 5_000,
    notes: 'Hotel credit covers about half the fee if I remember to use it.',
  });

  const freedom = make('chase-freedom-unlimited', 40, { last4: '9021' });

  const inkPreferred = make('chase-ink-preferred', 2, {
    nickname: 'Ink Preferred',
    last4: '7730',
  });
  inkPreferred.bonus = {
    ...blankBonus(inkPreferred),
    rewardKind: 'points',
    points: 100_000,
    spendRequiredCents: 800_000,
    spendWindowMonths: 3,
    startDate: monthsAgo(2, now),
    spendProgressCents: 512_000,
    progressUpdated: addMonths(now, -1),
    status: 'tracking',
    notes: 'Q4 contractor invoices should finish this off.',
  };

  const inkCash = make('chase-ink-cash', 14, { last4: '5512' });
  inkCash.bonus = {
    ...blankBonus(inkCash),
    rewardKind: 'points',
    points: 90_000,
    spendRequiredCents: 600_000,
    spendWindowMonths: 3,
    startDate: monthsAgo(14, now),
    spendProgressCents: 634_000,
    status: 'earned',
    earnedDate: monthsAgo(12, now),
    postedDate: monthsAgo(11, now),
  };

  const ventureX = make('capitalone-venture-x', 10, {
    nickname: 'Venture X',
    last4: '3308',
    annualCreditsValueCents: 40_000,
    notes: '$300 travel credit plus 10k anniversary miles -- fee is roughly a wash.',
  });
  ventureX.bonus = {
    ...blankBonus(ventureX),
    rewardKind: 'points',
    points: 75_000,
    spendRequiredCents: 400_000,
    spendWindowMonths: 3,
    startDate: monthsAgo(10, now),
    spendProgressCents: 431_500,
    status: 'earned',
    earnedDate: monthsAgo(8, now),
    postedDate: monthsAgo(8, now),
  };

  const savor = make('capitalone-savor', 7, { last4: '1180' });

  const discover = make('discover-it-cash-back', 30, { last4: '6644' });

  const united = make('chase-united-explorer', 20, { last4: '2095' });

  const strata = make('citi-strata-premier', 1, {
    nickname: 'Strata Premier',
    last4: '8871',
  });
  strata.bonus = {
    ...blankBonus(strata),
    rewardKind: 'points',
    points: 75_000,
    spendRequiredCents: 400_000,
    spendWindowMonths: 3,
    startDate: monthsAgo(1, now),
    spendProgressCents: 91_800,
    progressUpdated: now,
    status: 'tracking',
  };

  return {
    version: DATA_VERSION,
    cards: [
      sapphire, freedom, inkPreferred, inkCash,
      ventureX, savor, discover, united, strata,
    ],
    balances: [
      { programId: 'chase-ur', amount: 187_400, updated: now },
      { programId: 'capitalone-miles', amount: 92_000, updated: now },
      { programId: 'citi-typ', amount: 12_300, updated: now },
      { programId: 'discover-cashback', amount: 4_215, updated: now },
    ],
    valuationOverrides: {},
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: new Date().toISOString(),
  };
}
