'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { Badge, Button, EmptyState, Field, Note, Panel, PanelHeader, Select, Stat, StatRow, TextInput } from '@/components/ui';
import { addMonths, daysBetween, formatDate, today } from '@/lib/dates';
import { centsToInput, formatCents, formatCount, formatCpp, formatDollars, formatNumber, parseDollarsToCents, parseIntegerInput } from '@/lib/money';
import { balanceViews, totalValueCents, untrackedPrograms } from '@/lib/points';
import type { BalanceView } from '@/lib/points';
import { PROGRAMS } from '@/lib/programs';

function BalanceEditor({
  view,
  onSet,
  onRemove,
}: {
  view: BalanceView;
  onSet: (amount: number) => void;
  onRemove: () => void;
}) {
  const isCash = view.program.unit === 'cash';
  const [draft, setDraft] = useState(
    isCash ? centsToInput(view.balance.amount) : String(view.balance.amount),
  );
  const parsed = isCash ? parseDollarsToCents(draft) : parseIntegerInput(draft);
  const changed = parsed !== null && parsed !== view.balance.amount;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-44">
        <Field label={isCash ? 'Balance ($)' : `Balance (${view.program.unit})`}>
          <TextInput
            mono
            inputMode={isCash ? 'decimal' : 'numeric'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
      </div>
      <Button
        size="sm"
        variant={changed ? 'primary' : 'secondary'}
        disabled={!changed}
        onClick={() => parsed !== null && onSet(parsed)}
      >
        Update
      </Button>
      <Button size="sm" variant="ghost" onClick={onRemove}>
        Stop tracking
      </Button>
      <span className="ml-auto flex items-center gap-2 text-xs text-dim">
        Updated <span className="font-mono">{formatDate(view.balance.updated)}</span>
        {(() => {
          const age = daysBetween(view.balance.updated, today());
          if (age <= 45) return null;
          return <Badge tone={age > 90 ? 'danger' : 'warn'}>{age} days old</Badge>;
        })()}
      </span>
    </div>
  );
}

function ProgramPanel({
  view,
  onSet,
  onRemove,
}: {
  view: BalanceView;
  onSet: (amount: number) => void;
  onRemove: () => void;
}) {
  const isCash = view.program.unit === 'cash';

  return (
    <Panel className="space-y-4">
      <PanelHeader
        title={view.program.name}
        description={view.program.note}
        action={
          <span className="text-right">
            <span className="block font-mono text-xl font-semibold text-text">
              {isCash
                ? formatCents(view.balance.amount)
                : formatNumber(view.balance.amount)}
            </span>
            <span className="block font-mono text-xs text-dim">
              ~{formatCents(view.bestValueCents)} at best
            </span>
          </span>
        }
      />

      {view.cards.length > 0 ? (
        <p className="text-xs text-dim">
          Earned by {view.cards.map((c) => c.nickname || c.productName).join(', ')}.
        </p>
      ) : null}

      {!isCash ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <caption className="sr-only">
              What {view.program.name} points are worth by redemption route
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
                <th scope="col" className="pb-2 font-medium">Redemption</th>
                <th scope="col" className="pb-2 text-right font-medium">Rate</th>
                <th scope="col" className="pb-2 text-right font-medium">Your balance is worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {view.rows.map((row) => (
                <tr key={row.redemption.id}>
                  <td className="py-2.5 pr-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-text">{row.redemption.label}</span>
                      {row.isBest ? <Badge tone="ok">Best</Badge> : null}
                      {!row.redemption.fixed ? <Badge>Estimate</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-dim">
                      {row.redemption.note}
                    </span>
                  </td>
                  <td className="py-2.5 text-right align-top font-mono text-muted">
                    {formatCpp(row.centsPerPoint)}
                  </td>
                  <td className="py-2.5 text-right align-top font-mono text-text">
                    {formatCents(row.valueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {view.program.expiry.inactivityMonths !== null ? (
        (() => {
          const from = view.balance.lastActivity ?? view.balance.updated;
          const expiresOn = addMonths(from, view.program.expiry.inactivityMonths);
          const daysLeft = daysBetween(today(), expiresOn);
          return (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/50 px-4 py-3 ring-1 ring-line">
              <Badge tone={daysLeft <= 120 ? 'warn' : 'neutral'} mono>
                {daysLeft < 0 ? 'may have expired' : `expires ${formatDate(expiresOn)}`}
              </Badge>
              <span className="text-xs leading-relaxed text-muted">
                {view.program.expiry.note} Last activity {formatDate(from)}.
              </span>
            </div>
          );
        })()
      ) : (
        <p className="text-xs leading-relaxed text-dim">{view.program.expiry.note}</p>
      )}

      {view.program.transferPartners.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-text">
            {view.program.transferPartners.length} transfer partners
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {view.program.transferPartners.map((partner) => (
              <li key={partner}>
                <Badge>{partner}</Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="border-t border-line pt-4">
        <BalanceEditor view={view} onSet={onSet} onRemove={onRemove} />
      </div>
    </Panel>
  );
}

export default function PointsPage() {
  const { data, ready, setBalance, removeBalance } = useData();
  const [addProgramId, setAddProgramId] = useState('');

  const { views, total, untracked } = useMemo(() => {
    const list = balanceViews(data.balances, data.valuationOverrides, data.cards);
    return {
      views: list,
      total: totalValueCents(list),
      untracked: untrackedPrograms(data.cards, data.balances),
    };
  }, [data.balances, data.valuationOverrides, data.cards]);

  if (!ready) return <p className="text-sm text-dim">Loading your balances...</p>;

  const trackedIds = new Set(data.balances.map((b) => b.programId));
  const addable = PROGRAMS.filter((p) => !trackedIds.has(p.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Points</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Balances are tracked per program rather than per card, because that is
          how they actually work -- every Chase card feeds one Ultimate Rewards
          balance, not five separate ones.
        </p>
      </div>

      {views.length > 0 ? (
        <StatRow>
          <Stat
            label="Total value"
            value={total}
            format={formatDollars}
            tone="ok"
            hint="at the best rate for each program"
          />
          <Stat
            label="Programs tracked"
            value={views.length}
            format={formatCount}
            hint={untracked.length > 0 ? `${untracked.length} more from cards you hold` : 'all covered'}
          />
          <Stat
            label="Largest balance"
            value={views[0]?.bestValueCents}
            format={formatDollars}
            display={views[0] ? undefined : '--'}
            hint={views[0]?.program.shortName}
          />
        </StatRow>
      ) : null}

      <Note>
        Balances are the one figure nothing can fetch for you -- no issuer
        exposes a points API, and the services that show balances do it by
        signing in as you. Anything over 45 days old is flagged, and the
        dashboard reminds you.{' '}
        Fixed rates -- cash back, a travel portal multiplier -- are what the
        issuer publishes. Transfer-partner rates are marked as estimates because
        what a point is worth depends entirely on the award you book. Replace
        any of them with your own number in Settings.
      </Note>

      {views.length === 0 ? (
        <EmptyState
          title="No balances yet"
          description="Add the balance for each program you earn into. Points are the part no aggregator can fetch, so this is the one number worth updating by hand every month or so."
          action={
            addable.length > 0 ? (
              <div className="flex flex-wrap items-end justify-center gap-2">
                <div className="w-64 text-left">
                  <Field label="Program">
                    <Select
                      value={addProgramId}
                      onChange={(e) => setAddProgramId(e.target.value)}
                    >
                      <option value="">Choose a program</option>
                      {addable.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button
                  variant="primary"
                  disabled={!addProgramId}
                  onClick={() => {
                    setBalance(addProgramId, 0);
                    setAddProgramId('');
                  }}
                >
                  Track it
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {views.map((view) => (
            <ProgramPanel
              key={view.program.id}
              view={view}
              onSet={(amount) => setBalance(view.program.id, amount)}
              onRemove={() => removeBalance(view.program.id)}
            />
          ))}
        </div>
      )}

      {views.length > 0 && addable.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Track another program"
            description={
              untracked.length > 0
                ? `You hold cards earning into ${untracked
                    .map((p) => p.shortName)
                    .join(', ')} with no balance recorded yet.`
                : undefined
            }
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-64">
              <Field label="Program">
                <Select value={addProgramId} onChange={(e) => setAddProgramId(e.target.value)}>
                  <option value="">Choose a program</option>
                  {addable.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={!addProgramId}
              onClick={() => {
                setBalance(addProgramId, 0);
                setAddProgramId('');
              }}
            >
              Track it
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
