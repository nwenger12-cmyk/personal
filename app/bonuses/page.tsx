'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { BonusProgress, rewardLabel } from '@/components/BonusProgress';
import { Badge, Button, EmptyState, Field, Panel, PanelHeader, Stat, StatRow, TextInput } from '@/components/ui';
import { activeBonuses, outstandingSpendCents, pendingRewards, settledBonuses } from '@/lib/bonuses';
import type { TrackedBonus } from '@/lib/bonuses';
import { formatDate, today } from '@/lib/dates';
import { centsToInput, formatCents, formatDollars, formatNumber, parseDollarsToCents } from '@/lib/money';
import type { CardAccount } from '@/lib/types';

function BonusActions({
  tracked,
  onProgress,
  onSource,
  onEarned,
}: {
  tracked: TrackedBonus;
  onProgress: (cents: number) => void;
  onSource: (source: 'expenses' | 'manual') => void;
  onEarned: () => void;
}) {
  const [draft, setDraft] = useState(centsToInput(tracked.bonus.spendProgressCents));
  const parsed = parseDollarsToCents(draft);
  const changed = parsed !== null && parsed !== tracked.bonus.spendProgressCents;
  const automatic = tracked.bonus.progressSource === 'expenses';

  return (
    <div className="space-y-3">
      {automatic ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ok">Automatic</Badge>
          <span className="text-sm text-muted">
            {tracked.progress.expenseCount > 0
              ? `Adding up ${tracked.progress.expenseCount} imported transactions on this card.`
              : 'Nothing imported for this card yet — import a statement and this fills in.'}
          </span>
          <Link href="/import" className="text-sm text-accent-ink underline underline-offset-2">
            Import a statement
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Field label="Spend so far">
              <TextInput
                mono
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </Field>
          </div>
          <Button
            size="sm"
            variant={changed ? 'primary' : 'secondary'}
            disabled={!changed}
            onClick={() => parsed !== null && onProgress(parsed)}
          >
            Update
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onSource(automatic ? 'manual' : 'expenses')}>
          {automatic ? 'Track by hand instead' : 'Track from imports'}
        </Button>
        {tracked.outlook.remainingCents === 0 && tracked.bonus.status === 'tracking' ? (
          <Button size="sm" variant="primary" onClick={onEarned}>
            Mark earned
          </Button>
        ) : null}
        <Link href={`/cards?card=${tracked.card.id}`} className="ml-auto">
          <Button size="sm" variant="ghost">
            Edit card
          </Button>
        </Link>
      </div>

      {!automatic && tracked.bonus.progressUpdated ? (
        <p className="text-xs text-dim">
          Last updated{' '}
          <span className="font-mono">{formatDate(tracked.bonus.progressUpdated)}</span>.
        </p>
      ) : null}
    </div>
  );
}

export default function BonusesPage() {
  const { data, ready, upsertCard } = useData();

  const { active, settled, outstanding, pending } = useMemo(() => {
    const list = activeBonuses(
      data.cards,
      data.settings.bonusWarnDays,
      today(),
      data.expenses,
    );
    return {
      active: list,
      settled: settledBonuses(data.cards, data.expenses),
      outstanding: outstandingSpendCents(list),
      pending: pendingRewards(list),
    };
  }, [data.cards, data.expenses, data.settings.bonusWarnDays]);

  if (!ready) return <p className="text-sm text-dim">Loading your bonuses...</p>;

  function setProgress(card: CardAccount, cents: number) {
    if (!card.bonus) return;
    upsertCard({
      ...card,
      bonus: {
        ...card.bonus,
        spendProgressCents: Math.max(0, cents),
        progressUpdated: today(),
      },
    });
  }

  function setSource(card: CardAccount, progressSource: 'expenses' | 'manual') {
    if (!card.bonus) return;
    upsertCard({ ...card, bonus: { ...card.bonus, progressSource } });
  }

  function markEarned(card: CardAccount) {
    if (!card.bonus) return;
    upsertCard({
      ...card,
      bonus: { ...card.bonus, status: 'earned', earnedDate: card.bonus.earnedDate ?? today() },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Sign-up bonuses</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Progress adds itself up from the transactions you import, so there is
          no second number to keep in step. The thin line on each bar is where
          even spending would have put you by now — being behind it with the
          deadline approaching is what actually costs a bonus.
        </p>
      </div>

      {active.length > 0 ? (
        <StatRow>
          <Stat
            label="Spend remaining"
            value={outstanding}
            format={formatDollars}
            tone={outstanding > 0 ? 'accent' : 'ok'}
            hint={`across ${active.length} ${active.length === 1 ? 'bonus' : 'bonuses'}`}
          />
          <Stat
            label="Points at stake"
            value={pending.points}
            format={formatNumber}
            display={pending.points > 0 ? undefined : '--'}
            tone="ok"
            hint="unlocked by finishing the spend above"
          />
          <Stat
            label="Cash at stake"
            value={pending.cashCents}
            format={formatDollars}
            display={pending.cashCents > 0 ? undefined : '--'}
            tone="ok"
            hint="from cash-back sign-up offers"
          />
        </StatRow>
      ) : null}

      {active.length === 0 ? (
        <EmptyState
          title="No bonuses being tracked"
          description="Open a card and add its sign-up bonus -- the points, the spend required, and the window -- and the pace tracking shows up here."
          action={
            <Link href="/cards">
              <Button variant="primary">Go to cards</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {active.map((tracked) => (
            <BonusProgress
              key={tracked.card.id}
              tracked={tracked}
              footer={
                <BonusActions
                  tracked={tracked}
                  onProgress={(cents) => setProgress(tracked.card, cents)}
                  onSource={(source) => setSource(tracked.card, source)}
                  onEarned={() => markEarned(tracked.card)}
                />
              }
            />
          ))}
        </div>
      )}

      {settled.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Settled"
            description="Bonuses that have been earned or missed. Kept because the dates matter for issuer eligibility clocks later."
          />
          <ul className="divide-y divide-line border-t border-line">
            {settled.map((tracked) => (
              <li
                key={tracked.card.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-text">{tracked.label}</span>
                  <span className="mt-0.5 block text-xs text-dim">
                    <span className="font-mono">{rewardLabel(tracked.bonus)}</span> for{' '}
                    <span className="font-mono">
                      {formatCents(tracked.bonus.spendRequiredCents)}
                    </span>
                    {tracked.bonus.earnedDate
                      ? ` · met ${formatDate(tracked.bonus.earnedDate)}`
                      : ''}
                    {tracked.bonus.postedDate
                      ? ` · posted ${formatDate(tracked.bonus.postedDate)}`
                      : ''}
                  </span>
                </span>
                <Badge tone={tracked.bonus.status === 'earned' ? 'ok' : 'danger'}>
                  {tracked.bonus.status === 'earned' ? 'Earned' : 'Missed'}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
