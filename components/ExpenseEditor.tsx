'use client';

import { useState } from 'react';
import { categoriesByGroup, CATEGORY_GROUP_LABELS, getCategory } from '@/lib/categories';
import { formatDate, isIsoDate } from '@/lib/dates';
import { deductibleCentsFor, taxYearOf } from '@/lib/expenses';
import { cardLabel } from '@/lib/fees';
import { centsToInput, formatCents, parseDollarsToCents, parseIntegerInput } from '@/lib/money';
import { withCategory } from '@/lib/storage';
import type { CardAccount, Entity, Expense } from '@/lib/types';
import { Button, Checkbox, Field, Note, Panel, Select, TextInput } from './ui';

/**
 * The full form for one expense. The list view handles the two fields that get
 * changed constantly -- entity and category -- inline; this is for everything
 * else, and for entering something by hand that never came through an import.
 */
export function ExpenseEditor({
  initial,
  entities,
  cards,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Expense;
  entities: Entity[];
  cards: CardAccount[];
  onSave: (expense: Expense) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [expense, setExpense] = useState<Expense>(initial);
  const [amountDraft, setAmountDraft] = useState(centsToInput(initial.amountCents));
  const [showErrors, setShowErrors] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const patch = (changes: Partial<Expense>) =>
    setExpense((current) => ({ ...current, ...changes }));

  const parsedAmount = parseDollarsToCents(amountDraft);
  const dateValid = isIsoDate(expense.date);
  const amountValid = parsedAmount !== null;
  const category = getCategory(expense.categoryId);
  const percentDiffersFromDefault =
    category !== null && category.defaultDeductiblePercent !== expense.deductiblePercent;

  function save() {
    if (!dateValid || !amountValid) {
      setShowErrors(true);
      return;
    }
    onSave({
      ...expense,
      amountCents: parsedAmount,
      merchant: expense.merchant.trim(),
      reviewed: true,
    });
  }

  const preview = { ...expense, amountCents: parsedAmount ?? 0 };

  return (
    <Panel className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">
          {initial.merchant ? `Edit ${initial.merchant}` : 'Add an expense'}
        </h2>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save expense
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Date"
          hint={dateValid ? `Tax year ${taxYearOf(expense)}` : undefined}
          error={showErrors && !dateValid ? 'Pick the transaction date.' : null}
        >
          <TextInput
            type="date"
            value={expense.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </Field>

        <Field
          label="Amount"
          hint="Enter a refund as a negative number so it nets off the category."
          error={showErrors && !amountValid ? 'Enter a dollar amount.' : null}
        >
          <TextInput
            mono
            inputMode="decimal"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
          />
        </Field>

        <Field label="Merchant">
          <TextInput
            value={expense.merchant}
            onChange={(e) => patch({ merchant: e.target.value })}
            placeholder="B&H Photo Video"
          />
        </Field>

        <Field label="Description" hint="What it was for. This is the memory jog at tax time.">
          <TextInput
            value={expense.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="ND filters for the Moab shoot"
          />
        </Field>

        <Field label="Entity" hint="Which business, or personal. Each files its own totals.">
          <Select
            value={expense.entityId}
            onChange={(e) => patch({ entityId: e.target.value })}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.kind})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Category" hint={category ? category.scheduleCLine : undefined}>
          <Select
            value={expense.categoryId}
            onChange={(e) => setExpense((c) => withCategory(c, e.target.value))}
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
          </Select>
        </Field>

        <Field
          label="Deductible %"
          hint={
            percentDiffersFromDefault && category
              ? `Category default is ${category.defaultDeductiblePercent}%.`
              : 'Drop this to the business share for anything used partly personally.'
          }
        >
          <TextInput
            mono
            inputMode="numeric"
            value={String(expense.deductiblePercent)}
            onChange={(e) => {
              const value = parseIntegerInput(e.target.value);
              if (value !== null) patch({ deductiblePercent: Math.max(0, Math.min(100, value)) });
              else if (e.target.value === '') patch({ deductiblePercent: 0 });
            }}
          />
        </Field>

        <Field label="Paid with" hint="Optional. Links the expense to one of your cards.">
          <Select
            value={expense.cardId ?? ''}
            onChange={(e) => patch({ cardId: e.target.value || null })}
          >
            <option value="">Not linked</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {cardLabel(card)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Receipt"
          hint="Where the receipt lives. Substantiation is what an audit actually turns on."
        >
          <TextInput
            value={expense.receiptNote}
            onChange={(e) => patch({ receiptNote: e.target.value })}
            placeholder="Drive / 2026 / receipts / bh-0412.pdf"
          />
        </Field>

        <Field label="Notes">
          <TextInput
            value={expense.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Business purpose, who was there, anything to remember"
          />
        </Field>
      </div>

      {category ? (
        <Note>
          {category.note ? `${category.note} ` : ''}
          {entities.find((e) => e.id === expense.entityId)?.kind === 'personal' ? (
            <>
              Filed to a personal entity, so none of the{' '}
              <strong className="font-mono">{formatCents(preview.amountCents)}</strong> counts
              as deductible. Move it to a business entity if it belongs to one.
            </>
          ) : (
            <>
              Deducting{' '}
              <strong className="font-mono">
                {formatCents(deductibleCentsFor(preview, entities))}
              </strong>{' '}
              of <strong className="font-mono">{formatCents(preview.amountCents)}</strong> on{' '}
              <strong>{category.scheduleCLine}</strong>.
            </>
          )}
        </Note>
      ) : null}

      <Checkbox
        label="Reviewed"
        hint="Saving from this form marks it reviewed anyway -- this is here so you can push one back into the queue."
        checked={expense.reviewed}
        onChange={(reviewed) => patch({ reviewed })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {onDelete ? (
          confirmingDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-muted">Delete this expense?</span>
              <Button variant="danger" size="sm" onClick={onDelete}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete expense
            </Button>
          )
        ) : (
          <span className="text-xs text-dim">
            {initial.source === 'import'
              ? 'Imported from a statement'
              : initial.source === 'card-fee'
                ? `Generated from a recorded annual fee on ${formatDate(initial.date)}`
                : ''}
          </span>
        )}
        <span className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save expense
          </Button>
        </span>
      </div>
    </Panel>
  );
}
