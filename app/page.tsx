'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AttentionPanel } from '@/components/AttentionPanel';
import { useData } from '@/components/DataProvider';
import { Reveal } from '@/components/motion';
import { Timeline } from '@/components/Timeline';
import { Button, EmptyState, Panel, SectionLabel, Stat, StatRow } from '@/components/ui';
import { attentionItems } from '@/lib/attention';
import { activeBonuses, outstandingSpendCents } from '@/lib/bonuses';
import { formatDate, today } from '@/lib/dates';
import { feeTotals, upcomingFees } from '@/lib/fees';
import { formatCount, formatDollars } from '@/lib/money';
import { balanceViews, totalValueCents } from '@/lib/points';
import { taxSummary, taxYearOf } from '@/lib/expenses';
import { fiveTwentyFour } from '@/lib/rules';
import { sampleData } from '@/lib/sample';
import { buildTimeline } from '@/lib/timeline';

/**
 * The home screen answers one question: is there anything I need to do?
 *
 * So it is a single column with four blocks and nothing competing for
 * attention -- what needs doing, the four numbers worth knowing, what is
 * coming, and where the money went. Bonus detail and the 5/24 counter used to
 * sit here too; they have their own tabs, and anything urgent about them
 * already surfaces at the top.
 */
export default function DashboardPage() {
  const { data, ready, replaceAll } = useData();
  const { cards, settings } = data;

  const view = useMemo(() => {
    const now = today();
    const year = Number(now.slice(0, 4));
    const bonuses = activeBonuses(cards, settings.bonusWarnDays, now, data.expenses);
    const balances = balanceViews(data.balances, data.valuationOverrides, cards);
    const summary = taxSummary(data.expenses, data.entities, year);

    return {
      year,
      totals: feeTotals(cards),
      nextFee: upcomingFees(cards, settings.feeReviewLeadDays, 24, now)[0] ?? null,
      bonusCount: bonuses.length,
      outstanding: outstandingSpendCents(bonuses),
      pointsValue: totalValueCents(balances),
      timeline: buildTimeline(cards, settings, 12, now),
      five24: fiveTwentyFour(cards, now),
      attention: attentionItems(data, now),
      spending: {
        grossCents: data.expenses
          .filter((e) => taxYearOf(e) === year)
          .reduce((sum, e) => sum + e.amountCents, 0),
        deductibleCents: summary.entities
          .filter((e) => e.entity.kind === 'business')
          .reduce((sum, e) => sum + e.deductibleCents, 0),
        count: data.expenses.filter((e) => taxYearOf(e) === year).length,
      },
    };
  }, [cards, data, settings]);

  if (!ready) {
    return <p className="text-sm text-dim">Loading…</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-10">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-label text-accent-ink">
            Card Hub
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tighter text-text sm:text-5xl">
            Every fee, bonus and point in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            When each annual fee posts, how much spend is left on a sign-up
            bonus, what your points are worth, and where every dollar lands at
            tax time.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <EmptyState
            title="Nothing tracked yet"
            description="Add your first card, or load a sample wallet to see how it works before entering anything real."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/cards">
                  <Button variant="primary">Add a card</Button>
                </Link>
                <Button onClick={() => replaceAll(sampleData())}>Load sample data</Button>
              </div>
            }
          />
        </Reveal>
      </div>
    );
  }

  const { totals, nextFee, outstanding, pointsValue, five24, spending, bonusCount } = view;
  const openCards = cards.filter((c) => c.status === 'open').length;

  return (
    <div className="space-y-12">
      <Reveal>
        <h1 className="text-3xl font-semibold tracking-tighter text-text sm:text-4xl">
          {view.attention.length === 0 ? 'All clear.' : 'Here’s what needs you.'}
        </h1>
        <p className="mt-3 font-mono text-sm text-dim">
          {openCards} cards · {five24.count}/24 · {bonusCount} bonus
          {bonusCount === 1 ? '' : 'es'} in flight
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <AttentionPanel items={view.attention} />
      </Reveal>

      <Reveal delay={0.12}>
        <StatRow>
          <Stat
            label="Annual fees"
            value={totals.annualFeeCents}
            format={formatDollars}
            tone={totals.annualFeeCents > 0 ? 'warn' : 'neutral'}
            hint={
              totals.annualCreditsCents > 0
                ? `${formatDollars(totals.netCents)} net of credits you use`
                : `across ${totals.cardCount} fee-carrying ${
                    totals.cardCount === 1 ? 'card' : 'cards'
                  }`
            }
          />
          <Stat
            label="Next fee"
            value={nextFee?.amountCents}
            format={formatDollars}
            display={nextFee ? undefined : '--'}
            tone={nextFee && nextFee.daysUntil <= settings.feeReviewLeadDays ? 'danger' : 'neutral'}
            hint={
              nextFee
                ? `${nextFee.cardLabel} · ${formatDate(nextFee.date)}`
                : 'nothing scheduled'
            }
          />
          <Stat
            label="Bonus spend left"
            value={outstanding}
            format={formatDollars}
            display={outstanding > 0 ? undefined : '--'}
            tone={outstanding > 0 ? 'accent' : 'ok'}
            hint={
              outstanding > 0 ? (
                <Link href="/bonuses" className="underline underline-offset-2">
                  across {bonusCount} {bonusCount === 1 ? 'bonus' : 'bonuses'}
                </Link>
              ) : (
                'nothing being tracked'
              )
            }
          />
          <Stat
            label="Points value"
            value={pointsValue}
            format={formatDollars}
            display={pointsValue > 0 ? undefined : '--'}
            tone={pointsValue > 0 ? 'ok' : 'neutral'}
            hint={
              <Link href="/points" className="underline underline-offset-2">
                {pointsValue > 0 ? 'at the best rate for each program' : 'add your balances'}
              </Link>
            }
          />
        </StatRow>
      </Reveal>

      <Reveal delay={0.18}>
        <SectionLabel
          action={
            <Link href="/cards" className="text-xs text-dim underline underline-offset-4 hover:text-text">
              All cards
            </Link>
          }
        >
          Next 12 months
        </SectionLabel>
        <Panel>
          <Timeline events={view.timeline} />
        </Panel>
      </Reveal>

      {spending.count > 0 ? (
        <Reveal delay={0.24}>
          <SectionLabel
            action={
              <Link href="/taxes" className="text-xs text-dim underline underline-offset-4 hover:text-text">
                Tax summary
              </Link>
            }
          >
            Spending · {view.year}
          </SectionLabel>
          <StatRow>
            <Stat
              label="Recorded"
              value={spending.grossCents}
              format={formatDollars}
              hint={`${spending.count} transactions this year`}
            />
            <Stat
              label="Business deductible"
              value={spending.deductibleCents}
              format={formatDollars}
              tone="ok"
              hint="after each expense's percentage"
            />
            <Stat
              label="Cards"
              value={openCards}
              format={formatCount}
              hint={`${five24.count} of them count toward 5/24`}
            />
            <Stat
              label="Open bonuses"
              value={bonusCount}
              format={formatCount}
              tone={bonusCount > 0 ? 'accent' : 'neutral'}
              hint={
                <Link href="/bonuses" className="underline underline-offset-2">
                  see progress
                </Link>
              }
            />
          </StatRow>
        </Reveal>
      ) : null}
    </div>
  );
}
