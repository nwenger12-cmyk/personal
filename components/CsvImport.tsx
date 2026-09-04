'use client';

import { useMemo, useRef, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { detectColumns, parseCsv, summarizeSpend, toTransactions } from '@/lib/csv';
import type { ColumnMapping } from '@/lib/csv';
import { formatCents } from '@/lib/money';
import type { TrackedBonus } from '@/lib/bonuses';
import { Button, Checkbox, Field, Note, Select } from './ui';

/**
 * Total a transaction export against a bonus window.
 *
 * Nothing is applied automatically. The point of showing the counts and the
 * date range it actually found is that you can check the number against your
 * statement before it becomes the progress figure everything else is derived
 * from.
 */
export function CsvImport({
  tracked,
  onApply,
  onClose,
}: {
  tracked: TrackedBonus;
  onApply: (cents: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [subtractRefunds, setSubtractRefunds] = useState(true);
  const [flipSign, setFlipSign] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const summary = summarizeSpend(
      transactions,
      tracked.bonus.startDate,
      tracked.outlook.deadline,
      { subtractRefunds },
    );
    return { rows, mapping, header: rows[0], transactions, summary } as const;
  }, [text, flipSign, subtractRefunds, tracked.bonus.startDate, tracked.outlook.deadline]);

  function readFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    file
      .text()
      .then(setText)
      .catch(() => setParseError('Could not read that file.'));
  }

  const summary = parsed && !('error' in parsed) ? parsed.summary : null;

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-text">Import transactions</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-dim">
            Download a CSV from {tracked.card.issuer === 'other' ? 'your issuer' : 'your account'} and
            drop it in. Nothing leaves this browser -- the file is read and totalled locally.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

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

      {parseError ? <Note>{parseError}</Note> : null}
      {parsed && 'error' in parsed ? <Note>{parsed.error}</Note> : null}

      {parsed && !('error' in parsed) && summary ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-3">
              <div className="text-xs uppercase tracking-wide text-dim">
                Qualifying spend in the window
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-text">
                {formatCents(summary.qualifyingCents)}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-dim">
                {summary.purchaseCount} purchases
                {summary.refundCount > 0
                  ? `, less ${summary.refundCount} refund${
                      summary.refundCount === 1 ? '' : 's'
                    } worth ${formatCents(summary.refundCents)}`
                  : ''}
                {summary.firstDate && summary.lastDate
                  ? ` · ${formatDate(summary.firstDate)} to ${formatDate(summary.lastDate)}`
                  : ''}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
              <p>
                Window checked:{' '}
                <span className="font-mono">{formatDate(tracked.bonus.startDate)}</span> to{' '}
                <span className="font-mono">{formatDate(tracked.outlook.deadline)}</span>.
              </p>
              <p className="mt-1">
                Skipped {summary.outsideWindowCount} rows outside it and{' '}
                {summary.ignoredCount} payments or balance credits.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox
              label="Subtract refunds and returns"
              hint="Issuers do subtract them, so leaving this on matches how they count."
              checked={subtractRefunds}
              onChange={setSubtractRefunds}
            />
            <Checkbox
              label="Flip the purchase sign"
              hint={`Reading ${
                parsed.mapping.purchasesArePositive ? 'positive' : 'negative'
              } amounts as purchases. Turn this on if the total looks inverted.`}
              checked={flipSign}
              onChange={setFlipSign}
            />
          </div>

          <details className="text-xs text-dim">
            <summary className="cursor-pointer">Columns it matched</summary>
            <ul className="mt-2 space-y-0.5 font-mono">
              <li>date: {parsed.header[parsed.mapping.dateIndex]}</li>
              <li>
                amount:{' '}
                {parsed.mapping.debitIndex !== -1
                  ? `${parsed.header[parsed.mapping.debitIndex]} / ${
                      parsed.header[parsed.mapping.creditIndex] ?? '--'
                    }`
                  : parsed.header[parsed.mapping.amountIndex]}
              </li>
              {parsed.mapping.descriptionIndex !== -1 ? (
                <li>description: {parsed.header[parsed.mapping.descriptionIndex]}</li>
              ) : null}
              {parsed.mapping.typeIndex !== -1 ? (
                <li>type: {parsed.header[parsed.mapping.typeIndex]}</li>
              ) : null}
            </ul>
          </details>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Button variant="primary" size="sm" onClick={() => onApply(summary.qualifyingCents)}>
              Set progress to {formatCents(summary.qualifyingCents)}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                onApply(tracked.bonus.spendProgressCents + summary.qualifyingCents)
              }
            >
              Add to existing progress
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-dim">
            Use &ldquo;set&rdquo; when the export covers the whole window, and
            &ldquo;add&rdquo; when it is just the latest statement.
          </p>
        </div>
      ) : null}
    </div>
  );
}
