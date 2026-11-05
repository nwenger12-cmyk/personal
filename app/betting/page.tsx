'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Note,
  Panel,
  PanelHeader,
  Select,
  Stat,
  StatRow,
  TextInput,
} from '@/components/ui';
import {
  VIRGINIA_BOOKS,
  W2G_MIN_AMERICAN,
  combinedMargin,
  isValidAmerican,
  oppositeResult,
  planHedge,
  summarizeByBook,
  summarizeTaxYear,
  triggersW2G,
  wagerNetCents,
} from '@/lib/betting';
import type { HedgePlan, PromoMode, Wager, WagerResult } from '@/lib/betting';
import { formatDate, today } from '@/lib/dates';
import { centsToInput, formatCents, formatDollars, formatPercent, parseDollarsToCents } from '@/lib/money';
import { newId } from '@/lib/storage';

const MODES: { id: PromoMode; label: string; hint: string }[] = [
  {
    id: 'qualifying',
    label: 'Qualifying bet (cash)',
    hint: 'Cash on both sides to unlock a promo. Pick short, close odds -- you lose a little, and that is the cost of the bonus.',
  },
  {
    id: 'bonus',
    label: 'Bonus bet (stake not returned)',
    hint: 'Converting a bonus bet or FanCash-funded bet. Longer odds on the bonus side (+300 to +500) convert better.',
  },
  {
    id: 'no-sweat',
    label: 'No-sweat / second chance',
    hint: 'A cash bet refunded as a bonus bet if it loses. The refund is valued at your conversion rate, so the hedge is smaller.',
  },
];

function parseOdds(input: string): number | null {
  const n = Number(input.replace(/\s/g, ''));
  return isValidAmerican(n) ? Math.round(n) : null;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function signed(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

function BookSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {VIRGINIA_BOOKS.map((book) => (
        <option key={book} value={book}>
          {book}
        </option>
      ))}
    </Select>
  );
}

// ---- calculator -------------------------------------------------------------

function HedgeCalculator({
  w2gThresholdCents,
  onLog,
}: {
  w2gThresholdCents: number;
  onLog: (legs: Wager[]) => void;
}) {
  const [mode, setMode] = useState<PromoMode>('bonus');
  const [promoBook, setPromoBook] = useState('Fanatics');
  const [hedgeBook, setHedgeBook] = useState('DraftKings');
  const [stake, setStake] = useState('50');
  const [promoOdds, setPromoOdds] = useState('+400');
  const [hedgeOdds, setHedgeOdds] = useState('-500');
  const [refund, setRefund] = useState('100');
  const [conversion, setConversion] = useState('70');
  const [round, setRound] = useState(true);
  const [promoLabel, setPromoLabel] = useState('');
  const [promoSelection, setPromoSelection] = useState('');
  const [hedgeSelection, setHedgeSelection] = useState('');
  const [date, setDate] = useState(today());

  const stakeCents = parseDollarsToCents(stake);
  const pOdds = parseOdds(promoOdds);
  const hOdds = parseOdds(hedgeOdds);
  const refundCents = parseDollarsToCents(refund);
  const conversionRate = Number(conversion) / 100;

  const error =
    stakeCents === null || stakeCents <= 0
      ? 'Enter the stake.'
      : pOdds === null || hOdds === null
        ? 'Odds are American: -110, +400. Nothing between -100 and +100.'
        : mode === 'no-sweat' && (refundCents === null || !Number.isFinite(conversionRate))
          ? 'Enter the refund and your conversion rate.'
          : null;

  let plan: HedgePlan | null = null;
  if (!error && stakeCents && pOdds !== null && hOdds !== null) {
    plan = planHedge({
      mode,
      stakeCents,
      promoOdds: pOdds,
      hedgeOdds: hOdds,
      refundCents: refundCents ?? undefined,
      refundConversion: conversionRate,
      roundToDollar: round,
    });
  }

  const sameBook = promoBook === hedgeBook;
  const margin = pOdds !== null && hOdds !== null ? combinedMargin(pOdds, hOdds) : null;
  const w2g =
    plan && pOdds !== null && hOdds !== null && stakeCents
      ? triggersW2G(stakeCents, pOdds, w2gThresholdCents) ||
        triggersW2G(plan.hedgeStakeCents, hOdds, w2gThresholdCents)
      : false;
  const modeInfo = MODES.find((m) => m.id === mode)!;

  function log() {
    if (!plan || !stakeCents || pOdds === null || hOdds === null) return;
    const group = newId();
    const promo = promoLabel.trim() || modeInfo.label;
    onLog([
      {
        id: newId(),
        date,
        book: promoBook,
        selection: promoSelection.trim(),
        americanOdds: pOdds,
        stakeCents,
        stakeKind: mode === 'bonus' ? 'bonus' : 'cash',
        result: 'pending',
        promo,
        group,
        notes: mode === 'no-sweat' ? `Refund if lost: ${formatCents(Math.min(refundCents ?? stakeCents, stakeCents))} bonus` : '',
      },
      {
        id: newId(),
        date,
        book: hedgeBook,
        selection: hedgeSelection.trim(),
        americanOdds: hOdds,
        stakeCents: plan.hedgeStakeCents,
        stakeKind: 'cash',
        result: 'pending',
        promo,
        group,
        notes: 'Hedge',
      },
    ]);
    setPromoSelection('');
    setHedgeSelection('');
  }

  return (
    <Panel className="space-y-5">
      <PanelHeader
        title="Hedge calculator"
        description="The promo bet at one book, the opposite outcome at another. The hedge stake makes both results land on the same number."
      />

      <Field label="What you are converting" hint={modeInfo.hint}>
        <Select value={mode} onChange={(e) => setMode(e.target.value as PromoMode)}>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-surface-2/40 p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-label text-accent-ink">Promo side</p>
          <Field label="Book">
            <BookSelect value={promoBook} onChange={setPromoBook} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === 'bonus' ? 'Bonus amount' : 'Stake'}>
              <TextInput mono inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
            </Field>
            <Field label="Odds">
              <TextInput mono value={promoOdds} onChange={(e) => setPromoOdds(e.target.value)} />
            </Field>
          </div>
          <Field label="Selection (optional)">
            <TextInput value={promoSelection} onChange={(e) => setPromoSelection(e.target.value)} placeholder="Jets ML" />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl bg-surface-2/40 p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-label text-dim">Hedge side</p>
          <Field label="Book">
            <BookSelect value={hedgeBook} onChange={setHedgeBook} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hedge stake">
              <TextInput mono readOnly value={plan ? centsToInput(plan.hedgeStakeCents) : ''} />
            </Field>
            <Field label="Odds">
              <TextInput mono value={hedgeOdds} onChange={(e) => setHedgeOdds(e.target.value)} />
            </Field>
          </div>
          <Field label="Selection (optional)">
            <TextInput value={hedgeSelection} onChange={(e) => setHedgeSelection(e.target.value)} placeholder="Bills ML" />
          </Field>
        </div>
      </div>

      {mode === 'no-sweat' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Refund if it loses" hint="Usually the stake, up to the offer's cap.">
            <TextInput mono inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} />
          </Field>
          <Field
            label="Bonus bet conversion %"
            hint="What a bonus bet nets you once hedged. 65-75% is typical across two US books; use your own average once you have one."
          >
            <TextInput mono inputMode="decimal" value={conversion} onChange={(e) => setConversion(e.target.value)} />
          </Field>
        </div>
      ) : null}

      <Checkbox
        label="Round the hedge to whole dollars"
        hint="Odd-cent stakes like $166.67 look like a hedge to a book's risk team. Rounding costs a few cents."
        checked={round}
        onChange={setRound}
      />

      {error ? <p className="text-sm text-danger-ink">{error}</p> : null}

      {plan ? (
        <div className="space-y-4 border-t border-line pt-5">
          <div className="grid gap-6 sm:grid-cols-3">
            <Stat
              label="Bet at hedge book"
              display={formatCents(plan.hedgeStakeCents)}
              hint={`on the other side at ${hedgeBook}`}
            />
            <Stat
              label="Locked in"
              display={signed(plan.lockedCents)}
              tone={plan.lockedCents >= 0 ? 'ok' : 'warn'}
              hint={
                mode === 'qualifying'
                  ? `${formatPercent(-plan.rate, 1)} qualifying cost`
                  : `${formatPercent(plan.rate, 1)} of the ${mode === 'bonus' ? 'bonus' : 'stake'}`
              }
            />
            <Stat
              label="Cash tied up"
              display={formatCents(plan.cashOutlayCents)}
              hint="until both legs settle"
            />
          </div>

          <ul className="space-y-1 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-muted">{promoBook} side wins</span>
              <span className="font-mono text-text">{signed(plan.promoWinsCents)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-muted">
                {hedgeBook} side wins{mode === 'no-sweat' ? ' (refund valued in)' : ''}
              </span>
              <span className="font-mono text-text">{signed(plan.hedgeWinsCents)}</span>
            </li>
          </ul>

          <div className="flex flex-wrap gap-2">
            {margin !== null ? (
              <Badge tone={margin < 0.03 ? 'ok' : margin < 0.06 ? 'neutral' : 'warn'} mono>
                {formatPercent(margin, 1)} combined margin
              </Badge>
            ) : null}
            {w2g ? (
              <Badge tone="danger">W-2G: one leg meets both the $ and 300x tests</Badge>
            ) : (
              <Badge tone="ok">No W-2G at these odds</Badge>
            )}
            {sameBook ? <Badge tone="danger">Both sides at one book</Badge> : null}
          </div>

          {margin !== null && margin >= 0.06 ? (
            <Note>
              The two books are taking {formatPercent(margin, 1)} between them. Shopping
              the hedge line across your other books usually finds better.
            </Note>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Promo name">
              <TextInput
                value={promoLabel}
                onChange={(e) => setPromoLabel(e.target.value)}
                placeholder="Fanatics Go Long day 2"
              />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="pb-1">
              <Button variant="primary" size="sm" disabled={sameBook} onClick={log}>
                Log both legs
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

// ---- open bets --------------------------------------------------------------

type Group = { key: string; legs: Wager[] };

function groupWagers(wagers: Wager[]): Group[] {
  const map = new Map<string, Wager[]>();
  for (const w of wagers) {
    const key = w.group ?? w.id;
    map.set(key, [...(map.get(key) ?? []), w]);
  }
  return [...map.entries()]
    .map(([key, legs]) => ({ key, legs }))
    .sort((a, b) => (a.legs[0].date < b.legs[0].date ? 1 : -1));
}

function LegLine({ wager }: { wager: Wager }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-medium text-text">{wager.book}</span>
      <span className="font-mono text-dim">{formatOdds(wager.americanOdds)}</span>
      <span className="font-mono text-text">{formatCents(wager.stakeCents)}</span>
      {wager.stakeKind === 'bonus' ? <Badge tone="accent">bonus</Badge> : null}
      {wager.selection ? <span className="text-muted">{wager.selection}</span> : null}
    </span>
  );
}

function OpenBets({
  groups,
  onSettle,
  onRemove,
}: {
  groups: Group[];
  onSettle: (legs: Wager[]) => void;
  onRemove: (ids: string[]) => void;
}) {
  function settle(group: Group, winnerId: string | null, result: WagerResult = 'won') {
    onSettle(
      group.legs.map((leg) => ({
        ...leg,
        result: winnerId === null ? result : leg.id === winnerId ? 'won' : oppositeResult('won'),
      })),
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Open bets"
        description="Settle a hedge with one tap: whichever side won, the other lost."
      />
      <ul className="divide-y divide-line border-t border-line">
        {groups.map((group) => (
          <li key={group.key} className="space-y-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-text">{group.legs[0].promo || 'Bet'}</span>
              <span className="font-mono text-xs text-dim">{formatDate(group.legs[0].date)}</span>
            </div>
            {group.legs.map((leg) => (
              <div key={leg.id} className="flex flex-wrap items-center justify-between gap-2">
                <LegLine wager={leg} />
                {group.legs.length > 1 ? (
                  <Button size="sm" onClick={() => settle(group, leg.id)}>
                    This side won
                  </Button>
                ) : (
                  <span className="flex gap-1.5">
                    <Button size="sm" onClick={() => settle(group, null, 'won')}>Won</Button>
                    <Button size="sm" onClick={() => settle(group, null, 'lost')}>Lost</Button>
                  </span>
                )}
              </div>
            ))}
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => settle(group, null, 'push')}>
                Push / void
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(group.legs.map((l) => l.id))}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---- page -------------------------------------------------------------------

export default function BettingPage() {
  const { data, ready, upsertWagers, removeWagers, updateSettings } = useData();
  const year = data.settings.activeTaxYear;
  const [threshold, setThreshold] = useState(centsToInput(data.settings.w2gThresholdCents));

  const { open, settled, tax, books } = useMemo(() => {
    const wagers = data.wagers;
    const pending = wagers.filter((w) => w.result === 'pending');
    const pendingGroups = new Set(pending.map((w) => w.group ?? w.id));
    return {
      open: groupWagers(wagers.filter((w) => pendingGroups.has(w.group ?? w.id))),
      settled: groupWagers(wagers.filter((w) => !pendingGroups.has(w.group ?? w.id))),
      tax: summarizeTaxYear(wagers, year),
      books: summarizeByBook(wagers.filter((w) => Number(w.date.slice(0, 4)) === year)),
    };
  }, [data.wagers, year]);

  if (!ready) return <p className="text-sm text-dim">Loading your bets...</p>;

  const parsedThreshold = parseDollarsToCents(threshold);
  const gap = tax.taxableStandardCents - tax.netCents;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Sportsbook promos</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Turning sign-up offers and bonus bets into cash by betting both sides
          at two Virginia books. Virginia has no betting exchange, so the hedge
          is a back bet on the other outcome somewhere else. Log both legs and
          the profit, and the tax it creates, add themselves up.
        </p>
      </div>

      <StatRow>
        <Stat
          label={`Net profit · ${year}`}
          value={tax.netCents}
          format={formatDollars}
          tone={tax.netCents >= 0 ? 'ok' : 'danger'}
          hint={`${tax.settledCount} settled ${tax.settledCount === 1 ? 'bet' : 'bets'}`}
        />
        <Stat
          label="Gross winnings"
          value={tax.winningsCents}
          format={formatDollars}
          hint="reportable income, W-2G or not"
        />
        <Stat
          label="Taxable, itemising"
          value={tax.taxableItemizedCents}
          format={formatDollars}
          tone="warn"
          hint={year >= 2026 ? 'losses deductible at 90%' : 'losses fully deductible'}
        />
        <Stat
          label="Open bets"
          value={open.length}
          format={(v) => String(Math.round(v))}
          tone={open.length > 0 ? 'accent' : 'neutral'}
          hint="hedges waiting to settle"
        />
      </StatRow>

      <HedgeCalculator
        w2gThresholdCents={data.settings.w2gThresholdCents}
        onLog={upsertWagers}
      />

      {open.length > 0 ? (
        <OpenBets groups={open} onSettle={upsertWagers} onRemove={removeWagers} />
      ) : null}

      <Panel className="space-y-4">
        <PanelHeader
          title={`Taxes · ${year}`}
          description="Avoiding a W-2G changes the paperwork, not the tax. Every winning leg is income; the losing leg is only partly deductible, and only if you itemise."
        />
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between gap-4">
            <span className="text-muted">Gross winnings (won legs, stake excluded)</span>
            <span className="font-mono text-text">{formatCents(tax.winningsCents)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Losses (lost cash stakes)</span>
            <span className="font-mono text-text">{formatCents(tax.lossesCents)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Taxable on the standard deduction</span>
            <span className="font-mono text-warn-ink">{formatCents(tax.taxableStandardCents)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Taxable if itemising</span>
            <span className="font-mono text-warn-ink">{formatCents(tax.taxableItemizedCents)}</span>
          </li>
        </ul>
        {gap > 0 ? (
          <Note>
            You made {formatCents(tax.netCents)}, but on the standard deduction{' '}
            {formatCents(tax.taxableStandardCents)} is taxable: {formatCents(gap)} more than
            you kept. That is how every hedge works, with a winning leg and a losing
            leg. Set aside tax on the gross figure, not on the profit. Virginia taxes
            gambling winnings as ordinary income too. Run this past a tax preparer
            before you file.
          </Note>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field
            label="W-2G threshold"
            hint={`A sports wager is reported only at or over this AND at least 300x the stake (odds of about ${formatOdds(W2G_MIN_AMERICAN)}). $2,000 from 2026, $600 before. Confirm against the current IRS W-2G instructions.`}
          >
            <TextInput mono inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <div className="pb-1">
            <Button
              size="sm"
              disabled={parsedThreshold === null || parsedThreshold === data.settings.w2gThresholdCents}
              onClick={() => parsedThreshold !== null && updateSettings({ w2gThresholdCents: parsedThreshold })}
            >
              Save
            </Button>
          </div>
        </div>
      </Panel>

      {books.length > 0 ? (
        <Panel>
          <PanelHeader title={`By book · ${year}`} description="One book far ahead is the one most likely to limit you. Spreading volume helps." />
          <ul className="divide-y divide-line border-t border-line">
            {books.map((b) => (
              <li key={b.book} className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="text-text">
                  {b.book}
                  <span className="ml-2 text-xs text-dim">
                    {b.wagerCount} {b.wagerCount === 1 ? 'bet' : 'bets'}
                    {b.pendingCount > 0 ? ` · ${b.pendingCount} open` : ''}
                  </span>
                </span>
                <span className={`font-mono ${b.netCents >= 0 ? 'text-ok-ink' : 'text-danger-ink'}`}>
                  {signed(b.netCents)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {settled.length > 0 ? (
        <Panel>
          <PanelHeader title="Settled" />
          <ul className="divide-y divide-line border-t border-line">
            {settled.map((group) => {
              const net = group.legs.reduce((sum, leg) => sum + wagerNetCents(leg), 0);
              return (
                <li key={group.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-text">{group.legs[0].promo || 'Bet'}</span>
                    <span className="mt-0.5 block text-xs text-dim">
                      <span className="font-mono">{formatDate(group.legs[0].date)}</span>
                      {' · '}
                      {group.legs
                        .map((l) => `${l.book} ${formatOdds(l.americanOdds)} ${l.result}`)
                        .join(' / ')}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`font-mono text-sm ${net >= 0 ? 'text-ok-ink' : 'text-danger-ink'}`}>
                      {signed(net)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => removeWagers(group.legs.map((l) => l.id))}>
                      Remove
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : open.length === 0 ? (
        <EmptyState
          title="No bets logged yet"
          description="Work out a hedge above and log both legs. Settling them builds the profit and tax totals for the year."
        />
      ) : null}

      <Panel className="space-y-3">
        <PanelHeader title="Playbook" />
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-text">Qualifying bets:</span> cash on both sides at short, close
            odds (-110 / -110, or a near-even moneyline). Aim for a combined margin under 5%.
          </li>
          <li>
            <span className="text-text">Bonus bets and FanCash (e.g. Fanatics daily drops):</span>{' '}
            put the bonus on +300 to +500 and hedge the other side. Conversion climbs with the odds,
            and the 300x W-2G test still stays far out of reach.
          </li>
          <li>
            <span className="text-text">No-sweat tokens (e.g. BetMGM):</span> use the no-sweat mode.
            Put the token on a +200 to +400 outcome so a loss pays out a bonus bet worth converting,
            then convert that refund with the bonus mode.
          </li>
          <li>
            Use two different books for each hedge, check the offer terms (minimum odds, expiry,
            eligible markets) before betting, and expect limits. Books restrict accounts that only
            bet promos.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
