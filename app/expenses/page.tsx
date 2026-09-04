'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { ExpenseEditor } from '@/components/ExpenseEditor';
import { ExpenseImport } from '@/components/ExpenseImport';
import { ExpenseTable } from '@/components/ExpenseTable';
import { Button, Field, Panel, PanelHeader, Select, Stat, TextInput } from '@/components/ui';
import { CATEGORY_GROUP_LABELS, categoriesByGroup } from '@/lib/categories';
import { today } from '@/lib/dates';
import {
  EMPTY_FILTER,
  deductibleCentsFor,
  filterExpenses,
  pendingFeeExpenses,
  taxYears,
} from '@/lib/expenses';
import type { ExpenseFilter } from '@/lib/expenses';
import { cardLabel } from '@/lib/fees';
import { formatDollars } from '@/lib/money';
import { blankExpense } from '@/lib/storage';
import type { Expense } from '@/lib/types';

export default function ExpensesPage() {
  const {
    data, ready, upsertExpense, upsertExpenses, removeExpense, updateSettings,
  } = useData();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState<ExpenseFilter>({
    ...EMPTY_FILTER,
    year: data.settings.activeTaxYear,
  });

  const cardLabels = useMemo(
    () => Object.fromEntries(data.cards.map((c) => [c.id, cardLabel(c)])),
    [data.cards],
  );

  const defaultEntityIdForFees =
    data.settings.defaultEntityId ?? data.entities[0]?.id ?? '';
  const pendingFees = useMemo(
    () => pendingFeeExpenses(data.cards, data.expenses, defaultEntityIdForFees),
    [data.cards, data.expenses, defaultEntityIdForFees],
  );

  const { visible, totals, years, reviewCount } = useMemo(() => {
    const rows = filterExpenses(data.expenses, filter);
    return {
      visible: rows,
      totals: {
        gross: rows.reduce((sum, e) => sum + e.amountCents, 0),
        deductible: rows.reduce((sum, e) => sum + deductibleCentsFor(e, data.entities), 0),
      },
      years: taxYears(data.expenses),
      reviewCount: data.expenses.filter((e) => !e.reviewed).length,
    };
  }, [data.expenses, data.entities, filter]);

  if (!ready) return <p className="text-sm text-dim">Loading your spending...</p>;

  const defaultEntityId = data.settings.defaultEntityId ?? data.entities[0]?.id ?? '';

  if (editing) {
    return (
      <ExpenseEditor
        initial={editing}
        entities={data.entities}
        cards={data.cards}
        onSave={(expense) => {
          upsertExpense(expense);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onDelete={
          data.expenses.some((e) => e.id === editing.id)
            ? () => {
                removeExpense(editing.id);
                setEditing(null);
              }
            : undefined
        }
      />
    );
  }

  const patchFilter = (changes: Partial<ExpenseFilter>) =>
    setFilter((current) => ({ ...current, ...changes }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Spending</h1>
          <p className="mt-1 text-sm text-muted">
            {data.expenses.length} transactions
            {reviewCount > 0 ? ` · ${reviewCount} waiting for review` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setImporting((v) => !v)}>
            {importing ? 'Hide import' : 'Import statement'}
          </Button>
          <Button
            variant="primary"
            onClick={() => setEditing(blankExpense(defaultEntityId, today()))}
          >
            Add an expense
          </Button>
        </div>
      </div>

      {importing ? (
        <ExpenseImport
          entities={data.entities}
          cards={data.cards}
          rules={data.categorizationRules}
          existing={data.expenses}
          defaultEntityId={defaultEntityId}
          onImport={(expenses) => {
            upsertExpenses(expenses);
            setImporting(false);
            patchFilter({ needsReviewOnly: true, year: null });
          }}
          onClose={() => setImporting(false)}
        />
      ) : null}

      {pendingFees.length > 0 ? (
        <Panel className="border-accent/30 bg-accent/5">
          <PanelHeader
            title={`${pendingFees.length} recorded annual ${
              pendingFees.length === 1 ? 'fee is' : 'fees are'
            } not in your expenses`}
            description="Annual fees you have already logged against a card are deductible business expenses too. Bring them across as bank and card fees rather than typing them again."
            action={
              <Button size="sm" onClick={() => upsertExpenses(pendingFees)}>
                Add {pendingFees.length} to spending
              </Button>
            }
          />
        </Panel>
      ) : null}

      {reviewCount > 0 && !filter.needsReviewOnly ? (
        <Panel className="border-warn/30 bg-warn/5">
          <PanelHeader
            title={`${reviewCount} ${reviewCount === 1 ? 'transaction needs' : 'transactions need'} a category`}
            description="Imported rows land here first. Anything left uncategorised is excluded from the tax summary totals rather than quietly folded in."
            action={
              <Button size="sm" onClick={() => patchFilter({ needsReviewOnly: true, year: null })}>
                Review them
              </Button>
            }
          />
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Shown"
          value={formatDollars(totals.gross)}
          hint={`${visible.length} ${visible.length === 1 ? 'transaction' : 'transactions'}`}
        />
        <Stat
          label="Deductible"
          value={formatDollars(totals.deductible)}
          tone="ok"
          hint="after each percentage; personal counts as zero"
        />
        <Stat
          label="Needs review"
          value={String(reviewCount)}
          tone={reviewCount > 0 ? 'warn' : 'ok'}
          hint={reviewCount > 0 ? 'excluded from totals if left uncategorised' : 'all filed'}
        />
      </div>

      <Panel className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tax year">
            <Select
              value={filter.year === null ? '' : String(filter.year)}
              onChange={(e) =>
                patchFilter({ year: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Entity">
            <Select
              value={filter.entityId ?? ''}
              onChange={(e) => patchFilter({ entityId: e.target.value || null })}
            >
              <option value="">All entities</option>
              {data.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category">
            <Select
              value={filter.categoryId ?? ''}
              onChange={(e) => patchFilter({ categoryId: e.target.value || null })}
            >
              <option value="">All categories</option>
              {categoriesByGroup().map(({ group, categories }) => (
                <optgroup key={group} label={CATEGORY_GROUP_LABELS[group]}>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <Field label="Search">
            <TextInput
              value={filter.query}
              onChange={(e) => patchFilter({ query: e.target.value })}
              placeholder="Merchant or note"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              checked={filter.needsReviewOnly}
              onChange={(e) => patchFilter({ needsReviewOnly: e.target.checked })}
            />
            Only what needs review
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFilter({ ...EMPTY_FILTER, year: data.settings.activeTaxYear })}
          >
            Reset filters
          </Button>
          {filter.year !== null ? (
            <Link
              href="/taxes"
              className="ml-auto text-sm text-accent-ink underline underline-offset-2"
              onClick={() => updateSettings({ activeTaxYear: filter.year as number })}
            >
              Tax summary for {filter.year}
            </Link>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <ExpenseTable
          expenses={visible}
          entities={data.entities}
          cardLabels={cardLabels}
          onChange={upsertExpense}
          onEdit={setEditing}
          emptyMessage={
            data.expenses.length === 0
              ? {
                  title: 'No spending recorded yet',
                  description:
                    'Import a statement from one of your cards, or add an expense by hand. Merchant rules file what they recognise so the second import is mostly done for you.',
                }
              : {
                  title: 'Nothing matches these filters',
                  description: 'Widen the year, entity, or category to see more.',
                }
          }
        />
      </Panel>
    </div>
  );
}
