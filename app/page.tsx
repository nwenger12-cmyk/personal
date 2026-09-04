'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { BonusProgress } from '@/components/BonusProgress';
import { FiveTwentyFourPanel } from '@/components/FiveTwentyFourPanel';
import { Timeline } from '@/components/Timeline';
import { Button, EmptyState, Panel, PanelHeader, Stat } from '@/components/ui';
import { activeBonuses, outstandingSpendCents, pendingRewards } from '@/lib/bonuses';
import { formatDate, relativeDays, today } from '@/lib/dates';
import { feeTotals, upcomingFees } from '@/lib/fees';
import { formatCents, formatDollars, formatNumber } from '@/lib/money';
import { taxSummary, taxYearOf } from '@/lib/expenses';
import { balanceViews, totalValueCents } from '@/lib/points';
import { fiveTwentyFour } from '@/lib/rules';
import { sampleData } from '@/lib/sample';
import { buildTimeline } from '@/lib/timeline';

export default function DashboardPage() {
  const { data, ready, replaceAll } = useData();
  const { cards, settings } = data;

  const view = useMemo(() => {
    const now = today();
    const bonuses = activeBonuses(cards, settings.bonusWarnDays, now);
    const balances = balanceViews(data.balances, data.valuationOverrides, cards);
    return {
      totals: feeTotals(cards),
      nextFee: upcomingFees(cards, settings.feeReviewLeadDays, 24, now)[0] ?? null,
      bonuses,
      outstanding: outstandingSpendCents(bonuses),
      pending: pendingRewards(bonuses),
      pointsValue: totalValueCents(balances),
      timeline: buildTimeline(cards, settings, 12, now),
      five24: fiveTwentyFour(cards, now),
      spending: (() => {
        const year = Number(now.slice(0, 4));
        const inYear = data.expenses.filter((e) => taxYearOf(e) === year);
        const summary = taxSummary(data.expenses, data.entities, year);
        return {
          year,
          grossCents: inYear.reduce((sum, e) => sum + e.amountCents, 0),
          deductibleCents: summary.entities
            .filter((e) => e.entity.kind === 'business')
            .reduce((sum, e) => sum + e.deductibleCents, 0),
          count: inYear.length,
          needsReview: inYear.filter((e) => !e.reviewed).length,
          uncategorized: summary.uncategorizedCount,
        };
      })(),
    };
  }, [cards, data.balances, data.valuationOverrides, data.expenses, data.entities, settings]);

  if (!ready) {
    return <p className="text-sm text-dim">Loading your cards...</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Card Hub</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            One place for the things that cost real money if you forget them:
            when each annual fee posts, how much spend is left on a sign-up
            bonus before the window shuts, what the points you are sitting on
            are worth, and where every dollar of spending lands at tax time.
          </p>
        </div>
        <EmptyState
          title="No cards yet"
          description="Add your first card, or load a sample wallet to see how the tracking works before entering anything real."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/cards">
                <Button variant="primary">Add a card</Button>
              </Link>
              <Button onClick={() => replaceAll(sampleData())}>
                Load sample data
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const {
    totals, nextFee, bonuses, outstanding, pending, pointsValue, five24, spending,
  } = view;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          {cards.filter((c) => c.status === 'open').length} open cards ·{' '}
          {five24.count}/24 · {bonuses.length} bonus
          {bonuses.length === 1 ? '' : 'es'} in flight
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Annual fees"
          value={formatDollars(totals.annualFeeCents)}
          tone={totals.annualFeeCents > 0 ? 'warn' : 'neutral'}
          hint={
            totals.annualCreditsCents > 0
              ? `${formatDollars(totals.netCents)} net after ${formatDollars(
                  totals.annualCreditsCents,
                )} of credits you use`
              : `across ${totals.cardCount} fee-carrying ${
                  totals.cardCount === 1 ? 'card' : 'cards'
                }`
          }
        />
        <Stat
          label="Next fee"
          value={nextFee ? formatDollars(nextFee.amountCents) : '--'}
          tone={nextFee && nextFee.daysUntil <= settings.feeReviewLeadDays ? 'danger' : 'neutral'}
          hint={
            nextFee
              ? `${nextFee.cardLabel} · ${formatDate(nextFee.date)}`
              : 'nothing scheduled'
          }
        />
        <Stat
          label="Bonus spend left"
          value={outstanding > 0 ? formatDollars(outstanding) : '--'}
          tone={outstanding > 0 ? 'accent' : 'ok'}
          hint={
            pending.points > 0 || pending.cashCents > 0
              ? `unlocks ${
                  pending.points > 0 ? `${formatNumber(pending.points)} points` : ''
                }${pending.points > 0 && pending.cashCents > 0 ? ' + ' : ''}${
                  pending.cashCents > 0 ? formatCents(pending.cashCents) : ''
                }`
              : 'no bonuses being tracked'
          }
        />
        <Stat
          label="Points value"
          value={pointsValue > 0 ? formatDollars(pointsValue) : '--'}
          tone={pointsValue > 0 ? 'ok' : 'neutral'}
          hint={
            pointsValue > 0 ? (
              <>
                at the best rate for each program ·{' '}
                <Link href="/points" className="underline underline-offset-2">
                  see options
                </Link>
              </>
            ) : (
              <Link href="/points" className="underline underline-offset-2">
                add your balances
              </Link>
            )
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <Panel>
          <PanelHeader
            title="Next 12 months"
            description="Annual fees and bonus deadlines together, because they compete for the same attention."
          />
          <Timeline events={view.timeline} />
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Bonuses in flight"
              action={
                bonuses.length > 0 ? (
                  <Link href="/bonuses">
                    <Button size="sm">Update spend</Button>
                  </Link>
                ) : undefined
              }
            />
            {bonuses.length === 0 ? (
              <p className="text-sm text-dim">
                Nothing being tracked. Add a sign-up bonus to a card and its
                progress shows up here.
              </p>
            ) : (
              <div className="space-y-3">
                {bonuses.slice(0, 3).map((tracked) => (
                  <BonusProgress key={tracked.card.id} tracked={tracked} />
                ))}
                {bonuses.length > 3 ? (
                  <Link
                    href="/bonuses"
                    className="block text-sm text-accent-ink underline underline-offset-2"
                  >
                    {bonuses.length - 3} more
                  </Link>
                ) : null}
              </div>
            )}
          </Panel>

          <FiveTwentyFourPanel status={five24} />
        </div>
      </div>

      {spending.count > 0 ? (
        <Panel>
          <PanelHeader
            title={`Spending — ${spending.year}`}
            description="Categorised against the Schedule C line each one lands on, split by entity."
            action={
              <Link href="/taxes">
                <Button size="sm">Tax summary</Button>
              </Link>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Recorded"
              value={formatDollars(spending.grossCents)}
              hint={`${spending.count} transactions this year`}
            />
            <Stat
              label="Business deductible"
              value={formatDollars(spending.deductibleCents)}
              tone="ok"
              hint="after each expense's percentage"
            />
            <Stat
              label="Needs review"
              value={String(spending.needsReview)}
              tone={spending.needsReview > 0 ? 'warn' : 'ok'}
              hint={
                spending.uncategorized > 0 ? (
                  <Link href="/expenses" className="underline underline-offset-2">
                    {spending.uncategorized} uncategorised — excluded from totals
                  </Link>
                ) : (
                  'everything is filed'
                )
              }
            />
          </div>
        </Panel>
      ) : null}

      {nextFee && nextFee.daysUntil <= settings.feeReviewLeadDays ? (
        <Panel className="border-warn/30 bg-warn/5">
          <PanelHeader
            title="Fee decision due"
            description={
              <>
                <span className="font-medium text-text">{nextFee.cardLabel}</span> posts{' '}
                <span className="font-mono">{formatCents(nextFee.amountCents)}</span>{' '}
                {relativeDays(nextFee.daysUntil)}. Call before it posts if you want to
                downgrade or cancel -- issuers generally refund a fee only within about
                30 days of the charge, and downgrading to a no-fee card in the same
                family keeps the account age on your report.
              </>
            }
            action={
              <Link href={`/cards?card=${nextFee.cardId}`}>
                <Button size="sm">Open card</Button>
              </Link>
            }
          />
        </Panel>
      ) : null}
    </div>
  );
}
