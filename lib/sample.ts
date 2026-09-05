import { addDays, addMonths, today } from './dates';
import type { IsoDate } from './dates';
import { getCategory } from './categories';
import { importKeyFor } from './expenses';
import { blankBonus, cardFromCatalog, newId } from './storage';
import { DATA_VERSION, DEFAULT_SETTINGS, defaultEntities } from './types';
import type { AppData, CardAccount, Expense } from './types';

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

  const rate = (categoryId: string, multiplier: number, capDollars?: number) => ({
    id: newId(),
    categoryId,
    multiplier,
    capCents: capDollars === undefined ? null : capDollars * 100,
    notes: '',
  });
  const perk = (
    label: string,
    dollars: number,
    period: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    usedPeriods: string[] = [],
  ) => ({ id: newId(), label, valueCents: dollars * 100, period, usedPeriods, notes: '' });

  const sapphire = make('chase-sapphire-preferred', 26, {
    nickname: 'Sapphire Preferred',
    last4: '4417',
    annualCreditsValueCents: 5_000,
    notes: 'Hotel credit covers about half the fee if I remember to use it.',
    earnRates: [rate('everything', 1), rate('dining', 3), rate('online', 3), rate('travel', 2)],
    perks: [perk('$50 hotel credit', 50, 'annual')],
  });

  const freedom = make('chase-freedom-unlimited', 40, {
    last4: '9021',
    earnRates: [rate('everything', 1.5), rate('dining', 3), rate('drugstores', 3)],
  });

  const inkPreferred = make('chase-ink-preferred', 2, {
    nickname: 'Ink Preferred',
    last4: '7730',
    earnRates: [
      rate('everything', 1),
      rate('advertising', 3, 150_000),
      rate('shipping', 3, 150_000),
      rate('travel', 3, 150_000),
      rate('internet', 3, 150_000),
    ],
  });
  inkPreferred.bonus = {
    ...blankBonus(inkPreferred),
    rewardKind: 'points',
    points: 100_000,
    spendRequiredCents: 800_000,
    spendWindowMonths: 3,
    startDate: monthsAgo(2, now),
    progressSource: 'expenses',
    spendProgressCents: 512_000,
    progressUpdated: addMonths(now, -1),
    status: 'tracking',
    notes: 'Q4 contractor invoices should finish this off.',
  };

  const inkCash = make('chase-ink-cash', 14, {
    last4: '5512',
    earnRates: [rate('everything', 1), rate('office', 5, 25_000), rate('internet', 5, 25_000)],
  });
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
    earnRates: [rate('everything', 2), rate('hotels', 10), rate('flights', 5)],
    perks: [perk('$300 travel credit', 300, 'annual')],
    retentionOffers: [
      {
        id: newId(),
        date: monthsAgo(10, now),
        description: 'Offered 10,000 bonus miles at sign-up match',
        valueCents: 14_000,
        points: 10_000,
        accepted: true,
      },
    ],
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

  const savor = make('capitalone-savor', 7, {
    last4: '1180',
    earnRates: [rate('everything', 1), rate('dining', 3), rate('groceries', 3), rate('streaming', 3)],
  });

  const discover = make('discover-it-cash-back', 30, {
    last4: '6644',
    earnRates: [rate('everything', 1), rate('gas', 5, 1_500)],
  });

  const united = make('chase-united-explorer', 20, {
    last4: '2095',
    earnRates: [rate('everything', 1), rate('flights', 2), rate('dining', 2)],
    perks: [perk('$50 United travel credit', 50, 'semiannual', [])],
  });

  const strata = make('citi-strata-premier', 1, {
    nickname: 'Strata Premier',
    last4: '8871',
    earnRates: [
      rate('everything', 1),
      rate('dining', 3),
      rate('groceries', 3),
      rate('gas', 3),
      rate('flights', 3),
      rate('hotels', 3),
    ],
    perks: [perk('$100 hotel credit', 100, 'annual')],
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

  const entities = defaultEntities();
  const [locusstock, personal] = entities;

  // Expenses are laid out backwards from today so the tax summary, the review
  // queue and the monthly strip all have something in them on the current
  // year rather than on a year that has already been filed.
  const spend = (
    daysAgo: number,
    merchant: string,
    dollars: number,
    categoryId: string,
    entityId: string,
    cardId: string | null,
    extra: Partial<Expense> = {},
  ): Expense => {
    const date = addDays(now, -daysAgo);
    const amountCents = Math.round(dollars * 100);
    return {
      id: newId(),
      date,
      amountCents,
      merchant,
      description: '',
      entityId,
      categoryId,
      cardId,
      deductiblePercent: getCategory(categoryId)?.defaultDeductiblePercent ?? 100,
      reviewed: true,
      receiptNote: '',
      source: 'import',
      importKey: importKeyFor(date, amountCents, merchant),
      notes: '',
      ...extra,
    };
  };

  const expenses: Expense[] = [
    spend(6, 'ADOBE CREATIVE CLOUD', 69.99, 'software', locusstock.id, inkPreferred.id),
    spend(9, 'AMAZON WEB SERVICES', 214.4, 'cloud-hosting', locusstock.id, inkPreferred.id),
    spend(11, 'B&H PHOTO VIDEO', 389.12, 'supplies', locusstock.id, inkPreferred.id),
    spend(14, 'ARTLIST.IO', 199, 'stock-licensing', locusstock.id, inkCash.id),
    spend(18, 'LENSRENTALS.COM', 612.5, 'rent-equipment', locusstock.id, inkPreferred.id),
    spend(21, 'DELTA AIR LINES', 428.6, 'travel', locusstock.id, ventureX.id),
    spend(21, 'MARRIOTT BONVOY MOAB', 356.88, 'travel', locusstock.id, ventureX.id),
    spend(22, 'CANYONLANDS CAFE', 74.2, 'meals', locusstock.id, ventureX.id),
    spend(30, 'CLOUDFLARE', 25, 'cloud-hosting', locusstock.id, inkPreferred.id),
    spend(34, 'UPWORK ESCROW', 1450, 'contract-labor', locusstock.id, inkPreferred.id, {
      description: 'Editor -- Q3 batch colour pass',
    }),
    spend(41, 'FAA DRONEZONE', 175, 'taxes-licenses', locusstock.id, inkCash.id),
    spend(52, 'STAPLES', 62.35, 'office', locusstock.id, inkCash.id),
    spend(58, 'VERCEL INC', 20, 'cloud-hosting', locusstock.id, inkPreferred.id),
    spend(63, 'SHELL OIL 574', 71.4, 'vehicle', locusstock.id, savor.id, {
      deductiblePercent: 60,
      notes: 'Location scouting -- roughly 60% business miles this tank.',
    }),
    spend(70, 'WHOLE FOODS', 184.22, 'uncategorized', personal.id, savor.id, {
      reviewed: false,
    }),
    spend(72, 'SQ *UNKNOWN VENDOR', 240, 'uncategorized', locusstock.id, inkPreferred.id, {
      reviewed: false,
      notes: 'Need to find the receipt for this one.',
    }),
    spend(76, 'STATE FARM INSURANCE', 148.5, 'insurance', locusstock.id, inkCash.id, {
      description: 'Equipment and liability, monthly',
    }),
    spend(88, 'APPLE STORE', 2199, 'depreciation', locusstock.id, inkPreferred.id, {
      description: 'MacBook Pro -- edit machine',
      notes: 'Capitalised; ask about section 179 vs. bonus depreciation.',
    }),
    spend(95, 'NETFLIX', 22.99, 'uncategorized', personal.id, savor.id, { reviewed: false }),
    spend(104, 'GOOGLE ADS', 300, 'advertising', locusstock.id, inkPreferred.id),
  ];

  return {
    version: DATA_VERSION,
    cards: [
      sapphire, freedom, inkPreferred, inkCash,
      ventureX, savor, discover, united, strata,
    ],
    entities,
    expenses,
    mileage: [
      {
        id: newId(),
        date: addDays(now, -19),
        miles: 214,
        purpose: 'Location scout — Moab shoot',
        route: 'Studio → Moab → studio',
        entityId: locusstock.id,
      },
      {
        id: newId(),
        date: addDays(now, -47),
        miles: 38,
        purpose: 'Client meeting',
        route: 'Studio → downtown → studio',
        entityId: locusstock.id,
      },
    ],
    categorizationRules: [],
    balances: [
      { programId: 'chase-ur', amount: 187_400, updated: now, lastActivity: monthsAgo(1, now) },
      { programId: 'capitalone-miles', amount: 92_000, updated: now, lastActivity: monthsAgo(2, now) },
      { programId: 'citi-typ', amount: 12_300, updated: now, lastActivity: now },
      { programId: 'discover-cashback', amount: 4_215, updated: now, lastActivity: monthsAgo(4, now) },
    ],
    valuationOverrides: {},
    settings: {
      ...DEFAULT_SETTINGS,
      defaultEntityId: locusstock.id,
      activeTaxYear: Number(now.slice(0, 4)),
    },
    updatedAt: new Date().toISOString(),
  };
}
