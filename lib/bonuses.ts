import { addMonths, daysBetween, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { cardLabel } from './fees';
import type { CardAccount, SignupBonus } from './types';

/**
 * Sign-up bonus progress, and the one number that actually decides the
 * outcome: dollars per day you have to keep spending to finish in time.
 *
 * A raw percentage is not enough. 60% of the way there is comfortable with two
 * months left and a lost bonus with nine days left, so every status here is
 * computed against the time remaining rather than against the total.
 */

export type PaceStatus =
  | 'earned'    // requirement met
  | 'missed'    // window closed short
  | 'ahead'     // spending faster than the window needs
  | 'on-track'
  | 'behind'    // still possible, but the required pace has gone up
  | 'at-risk';  // deadline close and a real gap left

export type BonusOutlook = {
  deadline: IsoDate;
  /** False when the deadline was read off the offer letter instead of derived. */
  deadlineDerived: boolean;
  daysLeft: number;
  daysTotal: number;
  daysElapsed: number;
  requiredCents: number;
  progressCents: number;
  remainingCents: number;
  /** 0-1, clamped. */
  progressRatio: number;
  /** Where you would be if you had spent evenly. 0-1, clamped. */
  expectedRatio: number;
  /** Spend per day needed from here. null once there is nothing left to spend. */
  perDayNeededCents: number | null;
  paceStatus: PaceStatus;
  windowClosed: boolean;
};

export function bonusDeadline(bonus: SignupBonus): IsoDate {
  return bonus.deadlineOverride ?? addMonths(bonus.startDate, bonus.spendWindowMonths);
}

export function bonusOutlook(
  bonus: SignupBonus,
  warnDays: number,
  now: IsoDate = today(),
): BonusOutlook {
  const deadline = bonusDeadline(bonus);
  const daysTotal = Math.max(1, daysBetween(bonus.startDate, deadline));
  const daysLeft = daysBetween(now, deadline);
  const daysElapsed = Math.max(0, Math.min(daysTotal, daysBetween(bonus.startDate, now)));

  const requiredCents = Math.max(0, bonus.spendRequiredCents);
  const progressCents = Math.max(0, bonus.spendProgressCents);
  const remainingCents = Math.max(0, requiredCents - progressCents);

  const progressRatio =
    requiredCents === 0 ? 1 : Math.min(1, progressCents / requiredCents);
  const expectedRatio = Math.min(1, daysElapsed / daysTotal);
  const windowClosed = daysLeft < 0;

  // Days you can still spend on. The deadline day itself counts.
  const spendableDays = Math.max(0, daysLeft) + 1;
  const perDayNeededCents =
    remainingCents === 0 || windowClosed
      ? null
      : Math.ceil(remainingCents / spendableDays);

  let paceStatus: PaceStatus;
  if (bonus.status === 'earned' || remainingCents === 0) paceStatus = 'earned';
  else if (bonus.status === 'missed' || windowClosed) paceStatus = 'missed';
  else if (daysLeft <= warnDays) paceStatus = 'at-risk';
  // A 10% cushion keeps a card from flapping between on-track and behind.
  else if (progressRatio >= expectedRatio * 1.1) paceStatus = 'ahead';
  else if (progressRatio >= expectedRatio) paceStatus = 'on-track';
  else paceStatus = 'behind';

  return {
    deadline,
    deadlineDerived: bonus.deadlineOverride === null,
    daysLeft,
    daysTotal,
    daysElapsed,
    requiredCents,
    progressCents,
    remainingCents,
    progressRatio,
    expectedRatio,
    perDayNeededCents,
    paceStatus,
    windowClosed,
  };
}

export type TrackedBonus = {
  card: CardAccount;
  bonus: SignupBonus;
  outlook: BonusOutlook;
  label: string;
};

/** Bonuses still being worked, soonest deadline first. */
export function activeBonuses(
  cards: CardAccount[],
  warnDays: number,
  now: IsoDate = today(),
): TrackedBonus[] {
  return cards
    .filter((card): card is CardAccount & { bonus: SignupBonus } => card.bonus !== null)
    .filter((card) => card.bonus.status === 'tracking')
    .map((card) => ({
      card,
      bonus: card.bonus,
      outlook: bonusOutlook(card.bonus, warnDays, now),
      label: cardLabel(card),
    }))
    .sort((a, b) => toUtcMs(a.outlook.deadline) - toUtcMs(b.outlook.deadline));
}

export function settledBonuses(cards: CardAccount[]): TrackedBonus[] {
  return cards
    .filter((card): card is CardAccount & { bonus: SignupBonus } => card.bonus !== null)
    .filter((card) => card.bonus.status !== 'tracking')
    .map((card) => ({
      card,
      bonus: card.bonus,
      outlook: bonusOutlook(card.bonus, 0),
      label: cardLabel(card),
    }))
    .sort((a, b) => toUtcMs(b.outlook.deadline) - toUtcMs(a.outlook.deadline));
}

/**
 * Total spend still owed across the bonuses that can still be finished. A
 * bonus whose window has already closed is excluded -- no amount of spending
 * reaches it now, so counting it would overstate what is actually left to do.
 */
export function outstandingSpendCents(bonuses: TrackedBonus[]): number {
  return bonuses
    .filter((b) => !b.outlook.windowClosed)
    .reduce((sum, b) => sum + b.outlook.remainingCents, 0);
}

/**
 * Points (or cash, for a cash-back card) waiting to be unlocked by finishing
 * the bonuses in flight -- the reward for the spend above.
 */
export function pendingRewards(bonuses: TrackedBonus[]): {
  points: number;
  cashCents: number;
} {
  return bonuses
    .filter((b) => !b.outlook.windowClosed)
    .reduce(
    (acc, b) => ({
      points: acc.points + (b.bonus.rewardKind === 'points' ? b.bonus.points : 0),
      cashCents: acc.cashCents + (b.bonus.rewardKind === 'cash' ? b.bonus.cashCents : 0),
    }),
    { points: 0, cashCents: 0 },
  );
}
