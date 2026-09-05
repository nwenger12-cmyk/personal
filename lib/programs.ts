/**
 * Rewards currencies and what a point in each is worth, by redemption route.
 *
 * IMPORTANT: every centsPerPoint below is an *estimate of a typical outcome*,
 * not a published rate. Fixed rates (cash back at 1.0c, a travel portal's
 * posted multiplier) are reliable; transfer-partner numbers are an average of
 * what people realistically get and swing wildly with the specific award you
 * book. They are here so the dashboard can show a defensible dollar figure
 * instead of a bare point count -- override any of them in Settings once you
 * know what your own redemptions actually return.
 */

export type RewardUnit = 'points' | 'miles' | 'cash';

export type Redemption = {
  id: string;
  label: string;
  centsPerPoint: number;
  /** Fixed rates are published by the issuer; variable ones are estimates. */
  fixed: boolean;
  note: string;
};

/**
 * How a balance can be lost.
 *
 * Transferable currencies mostly do not expire while an account is open and in
 * good standing -- the real risk there is closing your last card in the
 * programme, which forfeits the lot. Hotel programmes are the opposite: they
 * expire on inactivity, and a small transaction resets the clock. Both are
 * worth warning about, but they are different warnings.
 */
export type Expiry = {
  /** Months of no earning or redeeming before the balance is forfeited. */
  inactivityMonths: number | null;
  note: string;
};

export type Program = {
  id: string;
  name: string;
  shortName: string;
  unit: RewardUnit;
  /** True when balances pool across every card in the program (Chase UR). */
  pools: boolean;
  redemptions: Redemption[];
  transferPartners: string[];
  expiry: Expiry;
  note: string;
};

const CASH: Redemption = {
  id: 'cash',
  label: 'Cash back / statement credit',
  centsPerPoint: 1,
  fixed: true,
  note: 'The floor. Any other route has to beat this to be worth the effort.',
};

export const PROGRAMS: Program[] = [
  {
    id: 'chase-ur',
    name: 'Chase Ultimate Rewards',
    shortName: 'Chase UR',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Do not expire while a Chase card in the programme stays open. Closing your last one forfeits the balance, so transfer out before you cancel.',
    },
    note:
      'Points pool across every Chase card on the same login, personal and business alike. ' +
      'A no-fee Freedom or Ink only earns full-value points while you also hold a ' +
      'Sapphire or Ink Preferred to move them into.',
    redemptions: [
      CASH,
      {
        id: 'portal',
        label: 'Chase Travel portal',
        centsPerPoint: 1.25,
        fixed: true,
        note: 'The multiplier depends on which card you hold; confirm yours.',
      },
      {
        id: 'transfer',
        label: 'Transfer to airline / hotel partner',
        centsPerPoint: 1.8,
        fixed: false,
        note: 'Estimate. Hyatt and business-class awards run higher; economy runs lower.',
      },
    ],
    transferPartners: [
      'United MileagePlus', 'Southwest Rapid Rewards', 'JetBlue TrueBlue',
      'Air Canada Aeroplan', 'British Airways Avios', 'Iberia Avios',
      'Aer Lingus AerClub', 'Air France/KLM Flying Blue', 'Virgin Atlantic',
      'Emirates Skywards', 'Singapore KrisFlyer',
      'World of Hyatt', 'IHG One Rewards', 'Marriott Bonvoy',
    ],
  },
  {
    id: 'capitalone-miles',
    name: 'Capital One Miles',
    shortName: 'C1 Miles',
    unit: 'miles',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Do not expire while the account is open. Closing the account forfeits them.',
    },
    note: 'Miles pool across your Capital One cards.',
    redemptions: [
      {
        id: 'cash',
        label: 'Statement credit',
        centsPerPoint: 0.5,
        fixed: true,
        note: 'Capital One pays half a cent for cash -- the weakest common route.',
      },
      {
        id: 'portal',
        label: 'Capital One Travel portal',
        centsPerPoint: 1,
        fixed: true,
        note: 'Also the rate for erasing a past travel purchase.',
      },
      {
        id: 'transfer',
        label: 'Transfer to airline / hotel partner',
        centsPerPoint: 1.4,
        fixed: false,
        note: 'Estimate. Most partners transfer 1:1.',
      },
    ],
    transferPartners: [
      'Air Canada Aeroplan', 'Air France/KLM Flying Blue', 'Avianca LifeMiles',
      'British Airways Avios', 'Cathay Asia Miles', 'Emirates Skywards',
      'Etihad Guest', 'EVA Infinity MileageLands', 'Finnair Plus',
      'Qantas Frequent Flyer', 'Singapore KrisFlyer', 'TAP Miles&Go',
      'Turkish Miles&Smiles', 'Virgin Red',
      'Accor Live Limitless', 'Choice Privileges', 'Wyndham Rewards',
    ],
  },
  {
    id: 'citi-typ',
    name: 'Citi ThankYou Points',
    shortName: 'Citi TYP',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Survive while a ThankYou card stays open. Closing your last one starts a short window to use them, then they are gone.',
    },
    note: 'Points pool across your Citi ThankYou cards.',
    redemptions: [
      CASH,
      {
        id: 'portal',
        label: 'Citi Travel portal',
        centsPerPoint: 1,
        fixed: true,
        note: 'Higher on some premium cards; confirm yours.',
      },
      {
        id: 'transfer',
        label: 'Transfer to airline / hotel partner',
        centsPerPoint: 1.6,
        fixed: false,
        note: 'Estimate. Citi runs frequent transfer bonuses worth waiting for.',
      },
    ],
    transferPartners: [
      'Avianca LifeMiles', 'Cathay Asia Miles', 'Air France/KLM Flying Blue',
      'Emirates Skywards', 'Etihad Guest', 'EVA Infinity MileageLands',
      'JetBlue TrueBlue', 'Qantas Frequent Flyer', 'Qatar Privilege Club',
      'Singapore KrisFlyer', 'Thai Royal Orchid Plus', 'Turkish Miles&Smiles',
      'Virgin Atlantic Flying Club',
      'Accor Live Limitless', 'Choice Privileges', 'Wyndham Rewards',
    ],
  },
  {
    id: 'amex-mr',
    name: 'American Express Membership Rewards',
    shortName: 'Amex MR',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Do not expire while an account is open and in good standing. Closing every Membership Rewards card forfeits the balance.',
    },
    note: 'Points pool across your Membership Rewards cards.',
    redemptions: [
      {
        id: 'cash',
        label: 'Statement credit',
        centsPerPoint: 0.6,
        fixed: true,
        note: 'Deliberately poor. Amex points are meant to be transferred.',
      },
      {
        id: 'portal',
        label: 'Amex Travel (flights)',
        centsPerPoint: 1,
        fixed: true,
        note: 'Higher on some premium cards; confirm yours.',
      },
      {
        id: 'transfer',
        label: 'Transfer to airline / hotel partner',
        centsPerPoint: 1.8,
        fixed: false,
        note: 'Estimate. Watch for the recurring 20-40% transfer bonuses.',
      },
    ],
    transferPartners: [
      'Delta SkyMiles', 'Air Canada Aeroplan', 'Air France/KLM Flying Blue',
      'British Airways Avios', 'Iberia Avios', 'Aer Lingus AerClub',
      'Avianca LifeMiles', 'Cathay Asia Miles', 'Emirates Skywards',
      'Etihad Guest', 'Qantas Frequent Flyer', 'Singapore KrisFlyer',
      'Virgin Atlantic Flying Club', 'ANA Mileage Club',
      'Marriott Bonvoy', 'Hilton Honors', 'Choice Privileges',
    ],
  },
  {
    id: 'discover-cashback',
    name: 'Discover Cashback Bonus',
    shortName: 'Discover',
    unit: 'cash',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Do not expire while the account is open, and are paid out if Discover closes it.',
    },
    note:
      'Plain dollars, not a transferable currency. Tracked here so the total ' +
      'sitting unredeemed across your cards is visible in one place.',
    redemptions: [CASH],
    transferPartners: [],
  },
  {
    id: 'cash',
    name: 'Cash back',
    shortName: 'Cash',
    unit: 'cash',
    pools: false,
    expiry: {
      inactivityMonths: null,
      note: 'Depends on the issuer; most pay out rather than expire.',
    },
    note: 'A generic bucket for any card that pays straight cash back.',
    redemptions: [CASH],
    transferPartners: [],
  },
  {
    id: 'united',
    name: 'United MileagePlus',
    shortName: 'United',
    unit: 'miles',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'MileagePlus miles do not expire.',
    },
    note: 'Co-brand currency. Chase UR transfers in 1:1.',
    redemptions: [
      {
        id: 'award',
        label: 'Award flight',
        centsPerPoint: 1.3,
        fixed: false,
        note: 'Estimate. Dynamic pricing -- domestic economy often lands near 1.2c.',
      },
    ],
    transferPartners: [],
  },
  {
    id: 'southwest',
    name: 'Southwest Rapid Rewards',
    shortName: 'Southwest',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: null,
      note:
        'Rapid Rewards points do not expire.',
    },
    note:
      'Fare-linked, so the value is stable and easy to check. Chase UR ' +
      'transfers in 1:1, and the Companion Pass is the real prize here.',
    redemptions: [
      {
        id: 'award',
        label: 'Award flight',
        centsPerPoint: 1.4,
        fixed: false,
        note: 'Tracks the cash fare, so it barely moves.',
      },
    ],
    transferPartners: [],
  },
  {
    id: 'hyatt',
    name: 'World of Hyatt',
    shortName: 'Hyatt',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: 24,
      note:
        'Expire after 24 months with no earning or redeeming. Any qualifying activity resets the clock.',
    },
    note: 'The strongest Chase UR transfer partner on a cents-per-point basis.',
    redemptions: [
      {
        id: 'award',
        label: 'Award night',
        centsPerPoint: 1.7,
        fixed: false,
        note: 'Estimate. Award charts still exist here, which is why it holds up.',
      },
    ],
    transferPartners: [],
  },
  {
    id: 'marriott',
    name: 'Marriott Bonvoy',
    shortName: 'Marriott',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: 24,
      note:
        'Expire after 24 months of inactivity. A small earn resets the clock.',
    },
    note: 'Lots of points, each worth little. Chase UR transfers in 1:1.',
    redemptions: [
      {
        id: 'award',
        label: 'Award night',
        centsPerPoint: 0.7,
        fixed: false,
        note: 'Estimate. The 5th-night-free benefit is where the value hides.',
      },
    ],
    transferPartners: [],
  },
  {
    id: 'ihg',
    name: 'IHG One Rewards',
    shortName: 'IHG',
    unit: 'points',
    pools: true,
    expiry: {
      inactivityMonths: 24,
      note:
        'Expire after 24 months of inactivity.',
    },
    note: 'Low per-point value; the Premier card free night is the draw.',
    redemptions: [
      {
        id: 'award',
        label: 'Award night',
        centsPerPoint: 0.5,
        fixed: false,
        note: 'Estimate. The 4th night free on points helps.',
      },
    ],
    transferPartners: [],
  },
];

const BY_ID = new Map(PROGRAMS.map((p) => [p.id, p]));

export function getProgram(id: string | null | undefined): Program | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function valuationKey(programId: string, redemptionId: string): string {
  return `${programId}:${redemptionId}`;
}

/** The user's override for a redemption rate, falling back to the shipped one. */
export function centsPerPoint(
  program: Program,
  redemption: Redemption,
  overrides: Record<string, number>,
): number {
  const override = overrides[valuationKey(program.id, redemption.id)];
  return typeof override === 'number' && Number.isFinite(override) && override >= 0
    ? override
    : redemption.centsPerPoint;
}

/**
 * The route worth using -- the highest-value redemption for a balance. Used
 * for the headline "your points are worth about $X" figure.
 */
export function bestRedemption(
  program: Program,
  overrides: Record<string, number>,
): { redemption: Redemption; centsPerPoint: number } | null {
  let best: { redemption: Redemption; centsPerPoint: number } | null = null;
  for (const redemption of program.redemptions) {
    const cpp = centsPerPoint(program, redemption, overrides);
    if (!best || cpp > best.centsPerPoint) best = { redemption, centsPerPoint: cpp };
  }
  return best;
}

/**
 * Dollar value of a balance, in cents. A cash program's balance is already
 * cents, so it passes straight through rather than being multiplied.
 */
export function balanceValueCents(
  program: Program,
  amount: number,
  cpp: number,
): number {
  if (program.unit === 'cash') return Math.round(amount);
  return Math.round(amount * cpp);
}
