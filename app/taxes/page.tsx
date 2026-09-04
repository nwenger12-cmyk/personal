'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { Badge, Button, EmptyState, Field, Note, Panel, PanelHeader, Select, Stat } from '@/components/ui';
import { formatCents, formatDollars } from '@/lib/money';
import {
  deductibleCents,
  expensesToCsv,
  monthlyTotals,
  summaryToCsv,
  taxSummary,
  taxYearOf,
  taxYears,
} from '@/lib/expenses';
import type { EntitySummary } from '@/lib/expenses';
import { cardLabel } from '@/lib/fees';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function MonthlyStrip({ totals }: { totals: number[] }) {
  const peak = Math.max(...totals, 1);
  return (
    <div>
      <div className="flex h-16 items-end gap-1">
        {totals.map((cents, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-accent/70"
            style={{ height: `${Math.max(2, (cents / peak) * 100)}%` }}
            title={`${MONTHS[i]}: ${formatCents(cents)}`}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {MONTHS.map((label, i) => (
          <span key={i} className="flex-1 text-center font-mono text-[10px] text-dim">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EntityBlock({ summary }: { summary: EntitySummary }) {
  return (
    <Panel className="space-y-4">
      <PanelHeader
        title={summary.entity.name}
        description={
          summary.entity.kind === 'personal'
            ? 'Marked personal. Kept separate so it is never mixed into a business return by accident.'
            : summary.entity.notes || 'Business — totals below map to Schedule C lines.'
        }
        action={
          <span className="text-right">
            <span className="block font-mono text-xl font-semibold text-text">
              {summary.entity.kind === 'personal'
                ? formatCents(summary.grossCents)
                : formatCents(summary.deductibleCents)}
            </span>
            <span className="block font-mono text-xs text-dim">
              {summary.entity.kind === 'personal'
                ? 'spent, none deductible'
                : `deductible · ${formatCents(summary.grossCents)} spent`}
            </span>
          </span>
        }
      />

      {summary.entity.kind === 'personal' ? (
        <Note>
          Personal spending is not deductible on a business return. This total is
          here so the year is complete and the split is visible -- it is not
          included in any Schedule C figure above.
        </Note>
      ) : null}

      {summary.unreviewedCount > 0 || summary.uncategorizedCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          {summary.uncategorizedCount > 0 ? (
            <Badge tone="danger">
              {summary.uncategorizedCount} uncategorised ({formatCents(summary.uncategorizedCents)}) — excluded
            </Badge>
          ) : null}
          {summary.unreviewedCount > 0 ? (
            <Badge tone="warn">{summary.unreviewedCount} not yet reviewed — counted anyway</Badge>
          ) : null}
        </div>
      ) : null}

      {summary.lines.length === 0 ? (
        <p className="text-sm text-dim">Nothing categorised for this entity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">
              {summary.entity.name} expense totals by Schedule C line
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
                <th scope="col" className="pb-2 pr-3 font-medium">Line / category</th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">Gross</th>
                <th scope="col" className="pb-2 pr-3 text-right font-medium">Deductible</th>
                <th scope="col" className="pb-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.lines.map((line) => (
                <>
                  <tr key={line.scheduleCLine} className="bg-surface-2/60">
                    <th scope="rowgroup" className="py-2 pr-3 text-left font-medium text-text">
                      {line.scheduleCLine}
                    </th>
                    <td className="py-2 pr-3 text-right font-mono text-muted">
                      {formatCents(line.grossCents)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold text-text">
                      {summary.entity.kind === 'personal'
                        ? '—'
                        : formatCents(line.deductibleCents)}
                    </td>
                    <td className="py-2 text-right font-mono text-dim">{line.count}</td>
                  </tr>
                  {/* Only worth breaking out when a line carries more than one
                      category -- otherwise it just repeats the row above. */}
                  {line.categories.length > 1
                    ? line.categories.map((total) => (
                        <tr key={`${line.scheduleCLine}-${total.category.id}`}>
                          <td className="py-1.5 pl-4 pr-3 text-muted">{total.category.label}</td>
                          <td className="py-1.5 pr-3 text-right font-mono text-dim">
                            {formatCents(total.grossCents)}
                          </td>
                          <td className="py-1.5 pr-3 text-right font-mono text-muted">
                            {formatCents(total.deductibleCents)}
                          </td>
                          <td className="py-1.5 text-right font-mono text-dim">{total.count}</td>
                        </tr>
                      ))
                    : null}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-text">
                  Total
                </th>
                <td className="py-2 pr-3 text-right font-mono text-muted">
                  {formatCents(summary.grossCents)}
                </td>
                <td className="py-2 pr-3 text-right font-mono font-semibold text-text">
                  {summary.entity.kind === 'personal'
                    ? '—'
                    : formatCents(summary.deductibleCents)}
                </td>
                <td className="py-2 text-right font-mono text-dim">{summary.count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function TaxesPage() {
  const { data, ready, updateSettings } = useData();
  const year = data.settings.activeTaxYear;

  const { summary, years, months, businessDeductible } = useMemo(() => {
    const s = taxSummary(data.expenses, data.entities, year);
    return {
      summary: s,
      years: taxYears(data.expenses),
      months: monthlyTotals(data.expenses, year),
      businessDeductible: s.entities
        .filter((e) => e.entity.kind === 'business')
        .reduce((sum, e) => sum + e.deductibleCents, 0),
    };
  }, [data.expenses, data.entities, year]);

  if (!ready) return <p className="text-sm text-dim">Loading your totals...</p>;

  function download(filename: string, contents: string) {
    const blob = new Blob([contents], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const yearExpenses = data.expenses.filter((e) => taxYearOf(e) === year);
  const cardLabels = Object.fromEntries(data.cards.map((c) => [c.id, cardLabel(c)]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Tax summary</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Totals for the year, grouped by the Schedule C line each category
            prints on, and split by entity so each business gets its own set.
          </p>
        </div>
        <div className="w-36">
          <Field label="Tax year">
            <Select
              value={String(year)}
              onChange={(e) => updateSettings({ activeTaxYear: Number(e.target.value) })}
            >
              {(years.includes(year) ? years : [year, ...years]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {summary.entities.length === 0 ? (
        <EmptyState
          title={`Nothing recorded for ${year}`}
          description="Import a statement or add an expense, and the totals build up here as you file them."
          action={
            <Link href="/expenses">
              <Button variant="primary">Go to spending</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total spend"
              value={formatDollars(summary.grossCents)}
              hint={`${summary.count} categorised transactions`}
            />
            <Stat
              label="Business deductible"
              value={formatDollars(businessDeductible)}
              tone="ok"
              hint="across your business entities"
            />
            <Stat
              label="Uncategorised"
              value={formatDollars(summary.uncategorizedCents)}
              tone={summary.uncategorizedCount > 0 ? 'danger' : 'ok'}
              hint={
                summary.uncategorizedCount > 0 ? (
                  <Link href="/expenses" className="underline underline-offset-2">
                    {summary.uncategorizedCount} left to file — excluded above
                  </Link>
                ) : (
                  'everything is filed'
                )
              }
            />
            <Stat
              label="Entities"
              value={String(summary.entities.length)}
              hint="each files its own totals"
            />
          </div>

          <Panel>
            <PanelHeader
              title={`Spending through ${year}`}
              description="Every entity together, by month. Useful for spotting the month you forgot to import."
            />
            <MonthlyStrip totals={months} />
          </Panel>

          {summary.entities.map((entitySummary) => (
            <EntityBlock key={entitySummary.entity.id} summary={entitySummary} />
          ))}

          <Panel className="space-y-4">
            <PanelHeader
              title="Hand it over"
              description="Two exports: the line totals for the return itself, and every transaction behind them for anyone who wants to check the work."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => download(`tax-summary-${year}.csv`, summaryToCsv(summary))}
              >
                Export {year} summary
              </Button>
              <Button
                onClick={() =>
                  download(
                    `expenses-${year}.csv`,
                    expensesToCsv(yearExpenses, data.entities, cardLabels),
                  )
                }
              >
                Export {year} transactions ({yearExpenses.length})
              </Button>
            </div>
            <Note>
              These totals are a categorised record of what you spent, not tax
              advice or a filed return. Several categories here carry rules a
              summary cannot apply for you — mileage needs a contemporaneous log,
              equipment over the de minimis threshold gets capitalised rather than
              expensed, home office runs on its own form, and a business meal
              needs the business purpose recorded. Worth handing this to whoever
              signs the return.
            </Note>
          </Panel>
        </>
      )}
    </div>
  );
}
