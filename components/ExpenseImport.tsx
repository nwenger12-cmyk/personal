'use client';

import { useMemo, useRef, useState } from 'react';
import { UNCATEGORIZED_ID, getCategory } from '@/lib/categories';
import { matchRule } from '@/lib/categorize';
import { detectColumns, parseCsv, toTransactions } from '@/lib/csv';
import type { ColumnMapping } from '@/lib/csv';
import { formatDate } from '@/lib/dates';
import { importKeyFor } from '@/lib/expenses';
import { cardLabel } from '@/lib/fees';
import { formatCents } from '@/lib/money';
import { newId } from '@/lib/storage';
import type { CardAccount, CategorizationRule, Entity, Expense } from '@/lib/types';
import { Badge, Button, Checkbox, Field, Note, Panel, PanelHeader, Select } from './ui';

/**
 * Bulk-load a statement into the expense list.
 *
 * Three things make a second import cheaper than the first: merchant rules
 * file what they recognise, anything already imported is skipped by its import
 * key rather than duplicated, and everything a rule touched still arrives
 * unreviewed so the queue makes you look at it once.
 *
 * Payments to the card are dropped -- paying a balance is not an expense, and
 * counting it would double every purchase on the statement.
 */

type Prepared = {
  expense: Expense;
  duplicate: boolean;
  matchedRule: boolean;
};

export function ExpenseImport({
  entities,
  cards,
  rules,
  existing,
  defaultEntityId,
  onImport,
  onClose,
}: {
  entities: Entity[];
  cards: CardAccount[];
  rules: CategorizationRule[];
  existing: Expense[];
  defaultEntityId: string;
  onImport: (expenses: Expense[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [entityId, setEntityId] = useState(defaultEntityId);
  const [cardId, setCardId] = useState('');
  const [flipSign, setFlipSign] = useState(false);
  const [includeRefunds, setIncludeRefunds] = useState(true);
  const [applyRules, setApplyRules] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);

  const existingKeys = useMemo(
    () => new Set(existing.map((e) => e.importKey).filter(Boolean) as string[]),
    [existing],
  );

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const rows = parseCsv(text);
    if (rows.length < 2) return { error: 'That file has no data rows.' } as const;

    const detected = detectColumns(rows);
    if (!detected) {
      return {
        error:
          'Could not find a date column and an amount column in the header row. ' +
          'Export the file with headers included.',
      } as const;
    }

    const mapping: ColumnMapping = {
      ...detected,
      purchasesArePositive: flipSign
        ? !detected.purchasesArePositive
        : detected.purchasesArePositive,
    };

    const transactions = toTransactions(rows, mapping);
    let ignoredPayments = 0;
    const prepared: Prepared[] = [];

    for (const tx of transactions) {
      if (tx.kind === 'payment') {
        ignoredPayments += 1;
        continue;
      }
      if (tx.kind === 'refund' && !includeRefunds) continue;

      const merchant = tx.description || 'Imported transaction';
      const match = applyRules ? matchRule(merchant, '', rules) : null;
      const categoryId = match?.categoryId ?? UNCATEGORIZED_ID;
      const category = getCategory(categoryId);
      const importKey = importKeyFor(tx.date, tx.cents, merchant);

      prepared.push({
        duplicate: existingKeys.has(importKey),
        matchedRule: match !== null,
        expense: {
          id: newId(),
          date: tx.date,
          amountCents: tx.cents,
          merchant,
          description: '',
          entityId: match?.entityId ?? entityId,
          categoryId,
          cardId: cardId || null,
          deductiblePercent:
            match?.deductiblePercent ?? category?.defaultDeductiblePercent ?? 100,
          // Even a rule-filed row lands unreviewed. A rule decides where a
          // transaction goes; you decide whether it was right.
          reviewed: false,
          receiptNote: '',
          source: 'import',
          importKey,
          notes: '',
        },
      });
    }

    const fresh = prepared.filter((p) => !p.duplicate);
    const dates = fresh.map((p) => p.expense.date).sort();

    return {
      header: rows[0],
      mapping,
      prepared,
      fresh,
      ignoredPayments,
      duplicateCount: prepared.length - fresh.length,
      matchedCount: fresh.filter((p) => p.matchedRule).length,
      totalCents: fresh.reduce((sum, p) => sum + p.expense.amountCents, 0),
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
    } as const;
  }, [
    text, flipSign, includeRefunds, applyRules, rules, entityId, cardId, existingKeys,
  ]);

  const fileRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    setFileName(file.name);
    setReadError(null);
    file
      .text()
      .then(setText)
      .catch(() => setReadError('Could not read that file.'));
  }

  return (
    <Panel className="space-y-5">
      <PanelHeader
        title="Import a statement"
        description="Download a CSV from your card and drop it in. It is read and totalled in this browser -- the file never leaves it."
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          Choose a CSV
        </Button>
        {fileName ? (
          <span className="font-mono text-xs text-dim">{fileName}</span>
        ) : (
          <span className="text-xs text-dim">or paste the contents below</span>
        )}
      </div>

      <Field label="CSV contents">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
          }}
          rows={4}
          placeholder="Transaction Date,Post Date,Description,Category,Type,Amount"
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-text placeholder:text-dim outline-none focus:border-accent"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="File everything to" hint="A merchant rule can still override this per row.">
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.kind})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paid with" hint="Optional. Tags every row in this batch with the card.">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Not linked</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {cardLabel(card)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {readError ? <Note>{readError}</Note> : null}
      {parsed && 'error' in parsed ? <Note>{parsed.error}</Note> : null}

      {parsed && !('error' in parsed) ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-dim">To import</div>
              <div className="mt-1 font-mono text-xl font-semibold text-text">
                {parsed.fresh.length}
              </div>
              <div className="mt-0.5 font-mono text-xs text-dim">
                {formatCents(parsed.totalCents)}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-dim">Auto-filed</div>
              <div className="mt-1 font-mono text-xl font-semibold text-ok-ink">
                {parsed.matchedCount}
              </div>
              <div className="mt-0.5 text-xs text-dim">by merchant rules</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-dim">Already imported</div>
              <div className="mt-1 font-mono text-xl font-semibold text-text">
                {parsed.duplicateCount}
              </div>
              <div className="mt-0.5 text-xs text-dim">skipped, not duplicated</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-dim">Payments</div>
              <div className="mt-1 font-mono text-xl font-semibold text-text">
                {parsed.ignoredPayments}
              </div>
              <div className="mt-0.5 text-xs text-dim">dropped, not expenses</div>
            </div>
          </div>

          {parsed.firstDate && parsed.lastDate ? (
            <p className="text-xs text-dim">
              Covering <span className="font-mono">{formatDate(parsed.firstDate)}</span> to{' '}
              <span className="font-mono">{formatDate(parsed.lastDate)}</span>.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Checkbox
              label="Apply merchant rules"
              hint="Files what it recognises. Everything still arrives for review."
              checked={applyRules}
              onChange={setApplyRules}
            />
            <Checkbox
              label="Include refunds"
              hint="Brought in as negative amounts so they net off the category."
              checked={includeRefunds}
              onChange={setIncludeRefunds}
            />
            <Checkbox
              label="Flip the purchase sign"
              hint={`Reading ${
                parsed.mapping.purchasesArePositive ? 'positive' : 'negative'
              } amounts as purchases.`}
              checked={flipSign}
              onChange={setFlipSign}
            />
          </div>

          {parsed.fresh.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-text">
                Preview the first {Math.min(8, parsed.fresh.length)} rows
              </summary>
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {parsed.fresh.slice(0, 8).map((p) => (
                  <li
                    key={p.expense.importKey}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-dim">{p.expense.date}</span>{' '}
                      <span className="text-text">{p.expense.merchant}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={p.matchedRule ? 'ok' : 'neutral'}>
                        {getCategory(p.expense.categoryId)?.label ?? 'Uncategorised'}
                      </Badge>
                      <span className="font-mono text-text">
                        {formatCents(p.expense.amountCents)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button
              variant="primary"
              disabled={parsed.fresh.length === 0}
              onClick={() => onImport(parsed.fresh.map((p) => p.expense))}
            >
              Import {parsed.fresh.length}{' '}
              {parsed.fresh.length === 1 ? 'expense' : 'expenses'}
            </Button>
            <span className="text-xs text-dim">
              They land in the review queue, not straight into your totals.
            </span>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
