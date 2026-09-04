import type { IsoDate } from './dates';

export type Issuer =
  | 'chase'
  | 'capital-one'
  | 'citi'
  | 'discover'
  | 'amex'
  | 'bank-of-america'
  | 'wells-fargo'
  | 'us-bank'
  | 'barclays'
  | 'other';

export const ISSUER_LABELS: Record<Issuer, string> = {
  chase: 'Chase',
  'capital-one': 'Capital One',
  citi: 'Citi',
  discover: 'Discover',
  amex: 'American Express',
  'bank-of-america': 'Bank of America',
  'wells-fargo': 'Wells Fargo',
  'us-bank': 'U.S. Bank',
  barclays: 'Barclays',
  other: 'Other',
};

export const ISSUER_ORDER: Issuer[] = [
  'chase', 'capital-one', 'citi', 'discover', 'amex',
  'bank-of-america', 'wells-fargo', 'us-bank', 'barclays', 'other',
];

export type CardStatus = 'open' | 'closed';

export type BonusStatus = 'tracking' | 'earned' | 'missed';

/** A sign-up bonus attached to one card. */
export type SignupBonus = {
  /** Points-earning cards store `points`; cash-back cards store `cashCents`. */
  rewardKind: 'points' | 'cash';
  points: number;
  cashCents: number;
  spendRequiredCents: number;
  /** Issuers count the window in calendar months (Chase 3, Amex 6), not days. */
  spendWindowMonths: number;
  /** Usually the account open date; some issuers start the clock at approval. */
  startDate: IsoDate;
  /** Set when the real deadline on the offer letter differs from the default. */
  deadlineOverride: IsoDate | null;
  spendProgressCents: number;
  progressUpdated: IsoDate | null;
  status: BonusStatus;
  /** When the spend requirement was met. */
  earnedDate: IsoDate | null;
  /** When the points/cash actually posted -- often a statement later. */
  postedDate: IsoDate | null;
  notes: string;
};

/** An annual fee that actually posted, as opposed to one that is predicted. */
export type FeeCharge = {
  id: string;
  date: IsoDate;
  amountCents: number;
  refunded: boolean;
  note: string;
};

export type CardAccount = {
  id: string;
  /** Links back to CARD_CATALOG for defaults; null for a hand-entered card. */
  catalogId: string | null;
  issuer: Issuer;
  productName: string;
  nickname: string;
  /** Last four digits, for telling two of the same product apart. */
  last4: string;
  business: boolean;
  /** An authorized-user card someone else opened -- excluded from fee totals. */
  authorizedUser: boolean;
  openedDate: IsoDate;
  closedDate: IsoDate | null;
  status: CardStatus;
  annualFeeCents: number;
  firstYearFeeWaived: boolean;
  /** Overrides the anniversary prediction when a statement proves otherwise. */
  nextFeeDateOverride: IsoDate | null;
  creditLimitCents: number | null;
  /** The rewards currency this card earns into; null for a plain cash card. */
  programId: string | null;
  /** Credits and perks you actually use each year, for net-cost-of-keeping. */
  annualCreditsValueCents: number;
  bonus: SignupBonus | null;
  feeHistory: FeeCharge[];
  notes: string;
};

export type ProgramBalance = {
  programId: string;
  /** Points/miles for a points program; cents for a cash-back program. */
  amount: number;
  updated: IsoDate;
};

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  theme: ThemePreference;
  /**
   * How far ahead of a posting annual fee to flag it. The point is to decide
   * whether to keep, downgrade, or cancel *before* the charge, so this wants
   * to be comfortably longer than a statement cycle.
   */
  feeReviewLeadDays: number;
  /** Flag a bonus deadline this many days out. */
  bonusWarnDays: number;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  feeReviewLeadDays: 45,
  bonusWarnDays: 30,
};

export type AppData = {
  version: number;
  cards: CardAccount[];
  balances: ProgramBalance[];
  /**
   * Per-redemption cents-per-point overrides, keyed `programId:redemptionId`.
   * The shipped valuations are estimates; this is where you replace one with
   * a number you actually got.
   */
  valuationOverrides: Record<string, number>;
  settings: Settings;
  updatedAt: string;
};

export const DATA_VERSION = 1;

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    cards: [],
    balances: [],
    valuationOverrides: {},
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: new Date().toISOString(),
  };
}
