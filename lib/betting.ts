import type { IsoDate } from './dates';

/**
 * Sportsbook promo conversion, done with two books instead of an exchange.
 *
 * Virginia has no betting exchange, so the "lay" side of a matched bet is a
 * back bet on the opposite outcome at a second book. With two books each
 * taking their own margin, a qualifying bet costs a little and a bonus bet
 * converts at well under 100% -- this module works out how much to put on
 * each side so the result is the same whichever way the game goes.
 *
 * Every stake here is integer cents, like the rest of the app. Odds come in
 * as American (-110, +150) because that is what every US book shows.
 */

export type StakeKind = 'cash' | 'bonus';
export type WagerResult = 'pending' | 'won' | 'lost' | 'push' | 'void';

/** One bet at one book. A hedged promo is two of these sharing a `group`. */
export type Wager = {
  id: string;
  date: IsoDate;
  book: string;
  /** What the bet is on, e.g. "Bills -3.5". */
  selection: string;
  americanOdds: number;
  stakeCents: number;
  /**
   * Cash comes back with the winnings; a bonus bet's stake does not. That
   * single difference is why bonus bets want long odds and qualifying bets
   * want short ones.
   */
  stakeKind: StakeKind;
  result: WagerResult;
  /** Which promo this was for, e.g. "BetMGM no-sweat day 3". */
  promo: string;
  /** Wagers placed together as one hedge share this id. */
  group: string | null;
  notes: string;
};

export type PromoMode = 'qualifying' | 'bonus' | 'no-sweat';

// ---- odds -------------------------------------------------------------------

/** American odds are never between -100 and +100. */
export function isValidAmerican(odds: number): boolean {
  return Number.isFinite(odds) && Math.abs(odds) >= 100;
}

export function americanToDecimal(odds: number): number {
  if (!isValidAmerican(odds)) throw new Error(`Not valid American odds: ${odds}`);
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimal: number): number {
  if (!(decimal > 1)) throw new Error(`Not valid decimal odds: ${decimal}`);
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

/** The book's implied probability, margin included. */
export function impliedProbability(odds: number): number {
  return 1 / americanToDecimal(odds);
}

/**
 * How much the two books take between them on a two-way market. Under 0 means
 * an arbitrage -- rare, and usually a sign one line is about to move.
 */
export function combinedMargin(oddsA: number, oddsB: number): number {
  return impliedProbability(oddsA) + impliedProbability(oddsB) - 1;
}

/** What a winning bet credits back, stake included for cash. */
export function payoutCents(stakeCents: number, odds: number, kind: StakeKind): number {
  const decimal = americanToDecimal(odds);
  const multiple = kind === 'cash' ? decimal : decimal - 1;
  return Math.round(stakeCents * multiple);
}

/** Profit on a win, not counting the stake. Same for cash and bonus. */
export function winningsCents(stakeCents: number, odds: number): number {
  return Math.round(stakeCents * (americanToDecimal(odds) - 1));
}

// ---- hedging ----------------------------------------------------------------

export type HedgeInput = {
  mode: PromoMode;
  /** The promo-side stake: the qualifying bet, the bonus bet, or the no-sweat bet. */
  stakeCents: number;
  /** Odds on the promo side. */
  promoOdds: number;
  /** Odds on the opposite outcome at the second book. */
  hedgeOdds: number;
  /**
   * no-sweat only: the bonus bet refunded if the promo bet loses -- usually
   * the stake, capped by the offer.
   */
  refundCents?: number;
  /**
   * no-sweat only: what a bonus bet is worth in cash once you convert it
   * yourself, as a fraction. 0.70 is a sound planning figure for two-book
   * hedging at +300 to +500; record your own and use that.
   */
  refundConversion?: number;
  /**
   * Round the hedge stake to whole dollars. Odd-cent stakes are a classic
   * flag for a book's risk team; a whole-dollar stake costs a few cents.
   */
  roundToDollar?: boolean;
};

export type HedgeOutcome = {
  /** Net change across both books if the promo side wins. */
  promoWinsCents: number;
  /** Net change across both books if the hedge side wins, refund valued in. */
  hedgeWinsCents: number;
};

export type HedgePlan = HedgeOutcome & {
  hedgeStakeCents: number;
  /** The worse of the two outcomes -- what is actually locked in. */
  lockedCents: number;
  /** Locked profit as a fraction of the promo stake. Negative for a qualifier. */
  rate: number;
  /** Cash put at risk across both books. A bonus stake is not your money. */
  cashOutlayCents: number;
};

function validateHedge(input: HedgeInput): void {
  if (!Number.isFinite(input.stakeCents) || input.stakeCents <= 0) {
    throw new Error('Stake has to be more than zero.');
  }
  if (!isValidAmerican(input.promoOdds) || !isValidAmerican(input.hedgeOdds)) {
    throw new Error('Odds have to be American odds, -100 or below or +100 or above.');
  }
}

/** Outcomes for a given hedge stake -- used for the plan and for rounding. */
export function hedgeOutcomes(input: HedgeInput, hedgeStakeCents: number): HedgeOutcome {
  const s = input.stakeCents;
  const b = americanToDecimal(input.promoOdds);
  const h = americanToDecimal(input.hedgeOdds);
  const hedgeWinNet = hedgeStakeCents * (h - 1);

  switch (input.mode) {
    case 'qualifying':
      return {
        promoWinsCents: Math.round(s * (b - 1) - hedgeStakeCents),
        hedgeWinsCents: Math.round(hedgeWinNet - s),
      };
    case 'bonus':
      // The bonus stake is gone either way; only the hedge costs real money.
      return {
        promoWinsCents: Math.round(s * (b - 1) - hedgeStakeCents),
        hedgeWinsCents: Math.round(hedgeWinNet),
      };
    case 'no-sweat': {
      const refund = Math.min(input.refundCents ?? s, s);
      const value = refund * clampConversion(input.refundConversion);
      return {
        promoWinsCents: Math.round(s * (b - 1) - hedgeStakeCents),
        hedgeWinsCents: Math.round(hedgeWinNet - s + value),
      };
    }
  }
}

function clampConversion(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0.7;
  return Math.min(1, Math.max(0, value));
}

/**
 * The hedge stake that makes both outcomes equal.
 *
 *   qualifying:  S·B = x·H              ->  x = S·B / H
 *   bonus:       S·(B−1) = x·H          ->  x = S·(B−1) / H
 *   no-sweat:    S·B = x·H + c·R        ->  x = (S·B − c·R) / H
 */
export function planHedge(input: HedgeInput): HedgePlan {
  validateHedge(input);
  const s = input.stakeCents;
  const b = americanToDecimal(input.promoOdds);
  const h = americanToDecimal(input.hedgeOdds);

  let exact: number;
  if (input.mode === 'qualifying') exact = (s * b) / h;
  else if (input.mode === 'bonus') exact = (s * (b - 1)) / h;
  else {
    const refund = Math.min(input.refundCents ?? s, s);
    exact = Math.max(0, (s * b - clampConversion(input.refundConversion) * refund) / h);
  }

  const hedgeStakeCents = input.roundToDollar
    ? Math.max(100, Math.round(exact / 100) * 100)
    : Math.round(exact);
  const outcomes = hedgeOutcomes(input, hedgeStakeCents);
  const lockedCents = Math.min(outcomes.promoWinsCents, outcomes.hedgeWinsCents);

  return {
    ...outcomes,
    hedgeStakeCents,
    lockedCents,
    rate: lockedCents / s,
    cashOutlayCents: (input.mode === 'bonus' ? 0 : s) + hedgeStakeCents,
  };
}

// ---- W-2G -------------------------------------------------------------------

/**
 * Form W-2G for a sports wager needs BOTH: winnings (payout less the wager)
 * at or over the threshold, AND winnings at least 300 times the wager. The
 * second test is the one that matters for this kind of betting: it needs odds
 * of about +30000, so no bet placed to hedge a promo comes close.
 *
 * The dollar threshold is $600 through 2025. The 2025 tax law raised the
 * $600 floor to $2,000 from 2026, indexed after that. That is the default in
 * Settings -- confirm it against the current IRS W-2G instructions.
 *
 * Not getting a W-2G changes the paperwork, not the tax: every dollar won is
 * reportable income either way.
 */
export const W2G_MULTIPLE = 300;

export function triggersW2G(stakeCents: number, odds: number, thresholdCents: number): boolean {
  const winnings = winningsCents(stakeCents, odds);
  return winnings >= thresholdCents && winnings >= W2G_MULTIPLE * stakeCents;
}

/** Odds at or beyond which the 300x test can be met at all. */
export const W2G_MIN_AMERICAN = W2G_MULTIPLE * 100;

// ---- the log ----------------------------------------------------------------

/** Net change to your money from one settled wager. */
export function wagerNetCents(wager: Wager): number {
  switch (wager.result) {
    case 'won':
      return winningsCents(wager.stakeCents, wager.americanOdds);
    case 'lost':
      return wager.stakeKind === 'cash' ? -wager.stakeCents : 0;
    default:
      return 0;
  }
}

export type GamblingTaxSummary = {
  /** Sum of winnings on won wagers -- what is reportable as income. */
  winningsCents: number;
  /** Cash stakes lost. A lost bonus bet was never your money, so it is not a loss. */
  lossesCents: number;
  /** What you actually made. */
  netCents: number;
  /**
   * Taxable amount if you itemise: winnings less losses, with losses capped
   * at 90% from 2026 and never more than winnings.
   */
  taxableItemizedCents: number;
  /** Taxable amount on the standard deduction: every dollar of winnings. */
  taxableStandardCents: number;
  pendingCount: number;
  settledCount: number;
};

/**
 * Totals for one tax year, wager by wager.
 *
 * This is the uncomfortable bit of matched betting. Every hedge has a winning
 * leg and a losing leg, so gross winnings run far ahead of the profit. On the
 * standard deduction losses are not deductible at all, and you owe tax on the
 * gross winnings. Itemising, only 90% of losses come off from 2026. Logging
 * every leg is what lets you see -- and plan for -- that gap.
 */
export function summarizeTaxYear(
  wagers: Wager[],
  year: number,
  lossDeductibleShare = year >= 2026 ? 0.9 : 1,
): GamblingTaxSummary {
  let winnings = 0;
  let losses = 0;
  let pending = 0;
  let settled = 0;

  for (const wager of wagers) {
    if (Number(wager.date.slice(0, 4)) !== year) continue;
    if (wager.result === 'pending') {
      pending += 1;
      continue;
    }
    settled += 1;
    const net = wagerNetCents(wager);
    if (net > 0) winnings += net;
    else losses += -net;
  }

  const deductible = Math.min(winnings, Math.round(losses * lossDeductibleShare));
  return {
    winningsCents: winnings,
    lossesCents: losses,
    netCents: winnings - losses,
    taxableItemizedCents: winnings - deductible,
    taxableStandardCents: winnings,
    pendingCount: pending,
    settledCount: settled,
  };
}

export type BookSummary = {
  book: string;
  netCents: number;
  wagerCount: number;
  pendingCount: number;
};

export function summarizeByBook(wagers: Wager[]): BookSummary[] {
  const map = new Map<string, BookSummary>();
  for (const wager of wagers) {
    const key = wager.book.trim() || 'Unnamed book';
    const entry = map.get(key) ?? { book: key, netCents: 0, wagerCount: 0, pendingCount: 0 };
    entry.wagerCount += 1;
    if (wager.result === 'pending') entry.pendingCount += 1;
    entry.netCents += wagerNetCents(wager);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.netCents - a.netCents);
}

/**
 * Settling one leg of a two-way hedge settles the other: if one side won,
 * the opposite side lost. Push and void carry across unchanged.
 */
export function oppositeResult(result: WagerResult): WagerResult {
  if (result === 'won') return 'lost';
  if (result === 'lost') return 'won';
  return result;
}

/** Books legal in Virginia with a sportsbook app, for the book picker. */
export const VIRGINIA_BOOKS = [
  'BetMGM',
  'bet365',
  'Caesars',
  'DraftKings',
  'Fanatics',
  'FanDuel',
  'Hard Rock Bet',
  'BetRivers',
  'theScore Bet',
];
