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
  /**
   * Where the progress figure comes from.
   *
   * 'expenses' adds up the imported transactions on this card inside the
   * window, so importing a statement moves the bonus forward with no second
   * step. 'manual' pins `spendProgressCents` instead, for a card whose
   * transactions are not being imported or when the issuer's own tally
   * disagrees with the arithmetic.
   */
  progressSource: 'expenses' | 'manual';
  /** The pinned figure. Ignored while progressSource is 'expenses'. */
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

// ---- Spending and tax categorisation ---------------------------------------

/**
 * A thing expenses get attributed to: a business, or personal spending.
 *
 * Entities are user-defined rather than a fixed list because the split is
 * personal to whoever is using this -- one business, three businesses, and
 * personal alongside them. Keeping them separate is what makes the tax summary
 * usable: two businesses filing two Schedule Cs need two sets of totals, not
 * one pile.
 */
export type EntityKind = 'business' | 'personal';

export type Entity = {
  id: string;
  name: string;
  kind: EntityKind;
  /** Shown on the entity's tax summary -- EIN, filing form, whatever helps. */
  notes: string;
};

export type Expense = {
  id: string;
  /** The date of the transaction, which is what decides its tax year. */
  date: IsoDate;
  /** Always positive. A refund is entered as a negative amount deliberately. */
  amountCents: number;
  merchant: string;
  description: string;
  entityId: string;
  categoryId: string;
  /** The card that paid, when it was one of yours. */
  cardId: string | null;
  /**
   * How much of this counts as a deductible business expense, 0-100. Seeded
   * from the category default; overridden per expense for mixed-use spend.
   */
  deductiblePercent: number;
  /** False until you have confirmed the category -- the import review queue. */
  reviewed: boolean;
  /** Whether a receipt exists, and where. Substantiation is the weak point. */
  receiptNote: string;
  source: 'manual' | 'import' | 'card-fee';
  /**
   * Stable identity for an imported row (date + amount + merchant), so
   * re-importing an overlapping statement updates rather than duplicates.
   */
  importKey: string | null;
  notes: string;
};

/**
 * A merchant pattern that files an expense automatically on import.
 *
 * Substring match on the merchant text, most recently added first. These are
 * seeded with common cases and grow as you categorise: filing an imported row
 * offers to remember the merchant, which is what stops the second import being
 * as much work as the first.
 */
export type CategorizationRule = {
  id: string;
  /** Case-insensitive substring of the merchant/description text. */
  match: string;
  categoryId: string;
  /** Optional -- a rule can set the category without forcing an entity. */
  entityId: string | null;
  deductiblePercent: number | null;
  /** True for the shipped rules, so they can be told apart from yours. */
  builtIn: boolean;
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
  /** The tax year the expense views open on. */
  activeTaxYear: number;
  /** Which entity a new expense defaults to. */
  defaultEntityId: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  feeReviewLeadDays: 45,
  bonusWarnDays: 30,
  activeTaxYear: new Date().getFullYear(),
  defaultEntityId: null,
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
  entities: Entity[];
  expenses: Expense[];
  categorizationRules: CategorizationRule[];
  settings: Settings;
  updatedAt: string;
};

export const DATA_VERSION = 2;

/**
 * Seeded so the expense views have somewhere to put things on day one. Rename
 * or delete them in Settings -- nothing depends on these ids.
 */
export function defaultEntities(): Entity[] {
  return [
    { id: 'entity-locusstock', name: 'LocusStock', kind: 'business', notes: '' },
    { id: 'entity-personal', name: 'Personal', kind: 'personal', notes: '' },
  ];
}

export function emptyData(): AppData {
  const entities = defaultEntities();
  return {
    version: DATA_VERSION,
    cards: [],
    balances: [],
    valuationOverrides: {},
    entities,
    expenses: [],
    categorizationRules: [],
    settings: { ...DEFAULT_SETTINGS, defaultEntityId: entities[0].id },
    updatedAt: new Date().toISOString(),
  };
}
