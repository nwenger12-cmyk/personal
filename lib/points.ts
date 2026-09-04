import {
  balanceValueCents,
  bestRedemption,
  centsPerPoint,
  getProgram,
} from './programs';
import type { Program, Redemption } from './programs';
import type { CardAccount, ProgramBalance } from './types';

/** One balance, priced every way it can be redeemed. */
export type RedemptionRow = {
  redemption: Redemption;
  centsPerPoint: number;
  valueCents: number;
  isBest: boolean;
};

export type BalanceView = {
  program: Program;
  balance: ProgramBalance;
  rows: RedemptionRow[];
  /** Value at the best available rate -- the headline number. */
  bestValueCents: number;
  bestRedemptionId: string | null;
  /** Cards feeding this program, so it is clear where the balance comes from. */
  cards: CardAccount[];
};

export function balanceViews(
  balances: ProgramBalance[],
  overrides: Record<string, number>,
  cards: CardAccount[] = [],
): BalanceView[] {
  return balances
    .flatMap((balance): BalanceView[] => {
      const program = getProgram(balance.programId);
      if (!program) return [];

      const best = bestRedemption(program, overrides);
      const rows: RedemptionRow[] = program.redemptions.map((redemption) => {
        const cpp = centsPerPoint(program, redemption, overrides);
        return {
          redemption,
          centsPerPoint: cpp,
          valueCents: balanceValueCents(program, balance.amount, cpp),
          isBest: best?.redemption.id === redemption.id,
        };
      });

      return [{
        program,
        balance,
        rows,
        bestValueCents: best
          ? balanceValueCents(program, balance.amount, best.centsPerPoint)
          : 0,
        bestRedemptionId: best?.redemption.id ?? null,
        cards: cards.filter(
          (card) => card.programId === program.id && card.status === 'open',
        ),
      }];
    })
    .sort((a, b) => b.bestValueCents - a.bestValueCents);
}

export function totalValueCents(views: BalanceView[]): number {
  return views.reduce((sum, view) => sum + view.bestValueCents, 0);
}

/**
 * Programs a held card earns into but that have no balance recorded yet --
 * the gap between "cards I have" and "balances I am tracking".
 */
export function untrackedPrograms(
  cards: CardAccount[],
  balances: ProgramBalance[],
): Program[] {
  const tracked = new Set(balances.map((b) => b.programId));
  const seen = new Set<string>();
  const out: Program[] = [];
  for (const card of cards) {
    if (card.status !== 'open' || !card.programId) continue;
    if (tracked.has(card.programId) || seen.has(card.programId)) continue;
    const program = getProgram(card.programId);
    if (!program) continue;
    seen.add(program.id);
    out.push(program);
  }
  return out;
}
