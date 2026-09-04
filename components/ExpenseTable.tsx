'use client';

import { CATEGORY_GROUP_LABELS, categoriesByGroup, getCategory } from '@/lib/categories';
import { formatDayMonth } from '@/lib/dates';
import { deductibleCentsFor } from '@/lib/expenses';
import { formatCents } from '@/lib/money';
import { withCategory } from '@/lib/storage';
import type { Entity, Expense } from '@/lib/types';
import { Badge, Button, EmptyState } from './ui';

/**
 * The working list. Entity and category are editable in the row because those
 * are the two fields that get changed hundreds of times when filing a year of
 * imported transactions -- routing that through a modal would make the review
 * queue unusable. Everything else is behind Edit.
 */
export function ExpenseTable({
  expenses,
  entities,
  cardLabels,
  onChange,
  onEdit,
  emptyMessage,
}: {
  expenses: Expense[];
  entities: Entity[];
  cardLabels: Record<string, string>;
  onChange: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  emptyMessage?: { title: string; description: string };
}) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title={emptyMessage?.title ?? 'Nothing here'}
        description={emptyMessage?.description ?? 'No expenses match these filters.'}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-dim">
            <th scope="col" className="pb-2 pr-3 font-medium">Date</th>
            <th scope="col" className="pb-2 pr-3 font-medium">Merchant</th>
            <th scope="col" className="pb-2 pr-3 text-right font-medium">Amount</th>
            <th scope="col" className="pb-2 pr-3 font-medium">Entity</th>
            <th scope="col" className="pb-2 pr-3 font-medium">Category</th>
            <th scope="col" className="pb-2 pr-3 text-right font-medium">Deductible</th>
            <th scope="col" className="pb-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {expenses.map((expense) => {
            const category = getCategory(expense.categoryId);
            const isRefund = expense.amountCents < 0;
            return (
              <tr key={expense.id} className={expense.reviewed ? '' : 'bg-warn/5'}>
                <td className="py-2 pr-3 align-middle">
                  <span className="whitespace-nowrap font-mono text-xs text-muted">
                    {formatDayMonth(expense.date)}
                  </span>
                  <span className="block font-mono text-xs text-dim">
                    {expense.date.slice(0, 4)}
                  </span>
                </td>

                <td className="max-w-[16rem] py-2 pr-3 align-middle">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-text">{expense.merchant || 'Untitled'}</span>
                    {expense.reviewed ? null : <Badge tone="warn">Review</Badge>}
                    {isRefund ? <Badge tone="ok">Refund</Badge> : null}
                  </span>
                  {expense.description || expense.cardId ? (
                    <span className="mt-0.5 block truncate text-xs text-dim">
                      {expense.description}
                      {expense.description && expense.cardId ? ' · ' : ''}
                      {expense.cardId ? cardLabels[expense.cardId] ?? '' : ''}
                    </span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap py-2 pr-3 text-right align-middle font-mono">
                  {formatCents(expense.amountCents)}
                </td>

                <td className="py-2 pr-3 align-middle">
                  <select
                    aria-label={`Entity for ${expense.merchant}`}
                    value={expense.entityId}
                    onChange={(e) =>
                      onChange({ ...expense, entityId: e.target.value, reviewed: true })
                    }
                    className="w-full max-w-[9rem] rounded-md border border-line bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
                  >
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="py-2 pr-3 align-middle">
                  <select
                    aria-label={`Category for ${expense.merchant}`}
                    value={expense.categoryId}
                    onChange={(e) =>
                      onChange({ ...withCategory(expense, e.target.value), reviewed: true })
                    }
                    className="w-full max-w-[13rem] rounded-md border border-line bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
                  >
                    {categoriesByGroup().map(({ group, categories }) => (
                      <optgroup key={group} label={CATEGORY_GROUP_LABELS[group]}>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {category && category.scheduleCLine !== '— not yet assigned' ? (
                    <span className="mt-0.5 block truncate text-xs text-dim">
                      {category.scheduleCLine}
                    </span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap py-2 pr-3 text-right align-middle">
                  <span className="block font-mono text-text">
                    {formatCents(deductibleCentsFor(expense, entities))}
                  </span>
                  {expense.deductiblePercent !== 100 ? (
                    <span className="block font-mono text-xs text-dim">
                      {expense.deductiblePercent}%
                    </span>
                  ) : null}
                </td>

                <td className="py-2 text-right align-middle">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(expense)}>
                    Edit
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
