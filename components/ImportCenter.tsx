'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { Badge, Button, Checkbox, EmptyState, Field, Note, Panel, PanelHeader, Select, Stat } from './ui';
import { formatDate } from '@/lib/dates';
import { cardLabel } from '@/lib/fees';
import { analyzeFile, analyzeParsedStatement, buildPlan } from '@/lib/import';
import type { FileAnalysis, FileAssignment } from '@/lib/import';
import type { ParsedStatement } from '@/lib/statement-pdf';
import { formatCents, formatCount, formatDollars } from '@/lib/money';

/**
 * A CSV is held as text and parsed on every render; a PDF is parsed once, on
 * load, because pulling text out of one is slow and asynchronous. Both end up
 * as the same FileAnalysis, so the rest of the screen cannot tell them apart.
 */
type LoadedFile =
  | { id: string; name: string; kind: 'csv'; text: string }
  | { id: string; name: string; kind: 'pdf'; parsed: ParsedStatement };

let fileCounter = 0;

/**
 * Drop in every statement at once and let one confirm update everything.
 *
 * The monthly job used to be: import each card's transactions, then update
 * each bonus separately, then record any annual fee by hand. All three read
 * off the same rows, so all three happen here in one pass -- and the preview
 * shows what each will do before anything is written.
 */
export function ImportCenter() {
  const {
    data, upsertExpenses, upsertCard, updateSettings,
  } = useData();
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [includeRefunds, setIncludeRefunds] = useState(true);
  const [applyRules, setApplyRules] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [reading, setReading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultEntityId = data.settings.defaultEntityId ?? data.entities[0]?.id ?? '';

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setResult(null);
    const list = [...incoming];
    setReading((n) => n + list.length);

    Promise.all(
      list.map(async (file): Promise<LoadedFile> => {
        fileCounter += 1;
        const id = `file-${fileCounter}`;
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

        if (!isPdf) {
          return { id, name: file.name, kind: 'csv', text: await file.text() };
        }
        // Loaded on demand so pdf.js does not weigh down anyone importing CSVs.
        const { parsePdfStatement } = await import('@/lib/pdf-extract');
        return {
          id,
          name: file.name,
          kind: 'pdf',
          parsed: await parsePdfStatement(await file.arrayBuffer()),
        };
      }),
    )
      .then((loaded) => setFiles((current) => [...current, ...loaded]))
      .catch((error: unknown) => {
        // Say what actually went wrong. A generic "could not be read" leaves
        // someone with a perfectly good statement and no idea why.
        const detail = error instanceof Error ? error.message : String(error);
        setResult(
          `That file could not be read: ${detail}. A PDF has to be a statement ` +
            'downloaded from your issuer — a scan or a photo has no text to pull out.',
        );
      })
      .finally(() => setReading((n) => Math.max(0, n - list.length)));
  }, []);

  const analyses = useMemo(
    (): FileAnalysis[] =>
      files.map((file) =>
        file.kind === 'pdf'
          ? analyzeParsedStatement(file.id, file.name, file.parsed, data.cards)
          : analyzeFile(file.id, file.name, file.text, data.cards, flipped[file.id] ?? false),
      ),
    [files, data.cards, flipped],
  );

  const assignments = useMemo(() => {
    const out: Record<string, FileAssignment> = {};
    for (const analysis of analyses) {
      const override = overrides[analysis.fileId];
      const cardId =
        override === undefined ? analysis.suggestedCardId : override === '' ? null : override;
      out[analysis.fileId] = { fileId: analysis.fileId, cardId, entityId: defaultEntityId };
    }
    return out;
  }, [analyses, overrides, defaultEntityId]);

  const plan = useMemo(
    () =>
      buildPlan(analyses, assignments, data.cards, data.expenses, data.categorizationRules, {
        includeRefunds,
        applyRules,
        leadDays: data.settings.feeReviewLeadDays,
      }),
    [
      analyses, assignments, data.cards, data.expenses, data.categorizationRules,
      includeRefunds, applyRules, data.settings.feeReviewLeadDays,
    ],
  );

  function commit() {
    upsertExpenses(plan.expenses);

    // Detected fees go onto the card they belong to, which also rolls that
    // card's next-fee prediction forward on its own.
    const byCard = new Map<string, typeof plan.feeCharges>();
    for (const entry of plan.feeCharges) {
      const list = byCard.get(entry.cardId);
      if (list) list.push(entry);
      else byCard.set(entry.cardId, [entry]);
    }
    for (const [cardId, entries] of byCard) {
      const card = data.cards.find((c) => c.id === cardId);
      if (!card) continue;
      upsertCard({
        ...card,
        feeHistory: [...card.feeHistory, ...entries.map((e) => e.charge)],
      });
    }

    const years = [...new Set(plan.expenses.map((e) => Number(e.date.slice(0, 4))))];
    if (years.length > 0) updateSettings({ activeTaxYear: Math.max(...years) });

    setResult(
      `Imported ${plan.expenses.length} ${
        plan.expenses.length === 1 ? 'transaction' : 'transactions'
      }` +
        (plan.feeCharges.length > 0
          ? `, recorded ${plan.feeCharges.length} annual ${
              plan.feeCharges.length === 1 ? 'fee' : 'fees'
            }`
          : '') +
        (plan.bonusMoves.length > 0
          ? `, and moved ${plan.bonusMoves.length} bonus ${
              plan.bonusMoves.length === 1 ? 'tracker' : 'trackers'
            } forward`
          : '') +
        '.',
    );
    setFiles([]);
    setOverrides({});
    setFlipped({});
  }

  const readable = analyses.filter((a) => !a.error);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-accent bg-accent/5' : 'border-line-strong bg-surface-2/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,text/csv,text/plain,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <h2 className="text-sm font-semibold text-text">
          Drop this month&rsquo;s statements here
        </h2>
        <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
          CSV exports or PDF statements, all of them at once. Each file is
          matched to a card by the account number printed on it, and everything
          is read in this browser — no file is uploaded anywhere.
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
        </div>
        {reading > 0 ? (
          <p className="mt-3 text-xs text-dim">
            Reading {reading} {reading === 1 ? 'file' : 'files'}…
          </p>
        ) : null}
      </div>

      {result ? <Note>{result}</Note> : null}

      {files.length === 0 ? (
        <EmptyState
          title="Nothing loaded yet"
          description="Chase, Capital One, Citi, Discover and Amex are all understood, as CSV exports or as the PDF statement itself. Grab whichever is easier from each card's account page and drop the lot in."
        />
      ) : (
        <>
          <Panel className="space-y-4">
            <PanelHeader
              title={`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFiles([]);
                    setOverrides({});
                    setFlipped({});
                  }}
                >
                  Clear all
                </Button>
              }
            />

            <ul className="divide-y divide-line border-y border-line">
              {analyses.map((analysis) => {
                const assignedCardId = assignments[analysis.fileId]?.cardId ?? '';
                return (
                  <li key={analysis.fileId} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-sm text-text">
                            {analysis.name}
                          </span>
                          <Badge>{analysis.format === 'pdf' ? 'PDF statement' : 'CSV'}</Badge>
                          {analysis.issuer ? <Badge>{analysis.issuer}</Badge> : null}
                          {analysis.error ? <Badge tone="danger">Unreadable</Badge> : null}
                          {analysis.reconciliation ? (
                            analysis.reconciliation.purchasesMatch &&
                            analysis.reconciliation.creditsMatch ? (
                              <Badge tone="ok">Totals match the statement</Badge>
                            ) : (
                              <Badge tone="danger">Totals do not match</Badge>
                            )
                          ) : null}
                          {analysis.matchedBy && !overrides[analysis.fileId] ? (
                            <Badge tone="ok">
                              matched by {analysis.matchedBy === 'row' ? 'account number' : 'filename'}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-dim">
                          {analysis.error
                            ? analysis.error
                            : `${analysis.purchaseCount} ${
                                analysis.purchaseCount === 1 ? 'purchase' : 'purchases'
                              }, ${analysis.paymentCount} ${
                                analysis.paymentCount === 1 ? 'payment' : 'payments'
                              }${
                                analysis.dateRange
                                  ? ` · ${formatDate(analysis.dateRange[0])} to ${formatDate(
                                      analysis.dateRange[1],
                                    )}`
                                  : ''
                              }`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-end gap-2">
                        {analysis.error ? null : (
                          <div className="w-52">
                            <Field label="Card">
                              <Select
                                value={assignedCardId}
                                onChange={(e) =>
                                  setOverrides((c) => ({
                                    ...c,
                                    [analysis.fileId]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Not linked to a card</option>
                                {data.cards.map((card) => (
                                  <option key={card.id} value={card.id}>
                                    {cardLabel(card)}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setFiles((current) => current.filter((f) => f.id !== analysis.fileId))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {analysis.warnings.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {analysis.warnings.map((warning) => (
                          <li key={warning} className="text-xs leading-relaxed text-warn-ink">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {analysis.format === 'pdf' && analysis.reconciliation ? (
                      <p className="mt-2 text-xs leading-relaxed text-dim">
                        Checked against the statement&rsquo;s own summary:{' '}
                        <span className="font-mono">
                          {formatCents(analysis.reconciliation.parsedPurchasesCents)}
                        </span>{' '}
                        of purchases found,{' '}
                        <span className="font-mono">
                          {formatCents(analysis.reconciliation.statedPurchasesCents)}
                        </span>{' '}
                        claimed.
                      </p>
                    ) : null}

                    {/* A PDF's section headings say what each row is, so there
                        is no sign to guess at and nothing to flip. */}
                    {!analysis.error && analysis.mapping ? (
                      <div className="mt-2">
                        <Checkbox
                          label="Flip the purchase sign for this file"
                          hint={`Reading ${
                            analysis.mapping.purchasesArePositive ? 'positive' : 'negative'
                          } amounts as purchases. Turn this on only if the totals look inverted.`}
                          checked={flipped[analysis.fileId] ?? false}
                          onChange={(v) =>
                            setFlipped((c) => ({ ...c, [analysis.fileId]: v }))
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox
                label="Apply merchant rules"
                hint="Files what it recognises. Everything still arrives for review."
                checked={applyRules}
                onChange={setApplyRules}
              />
              <Checkbox
                label="Include refunds"
                hint="Brought in negative so they net off the category and the bonus."
                checked={includeRefunds}
                onChange={setIncludeRefunds}
              />
            </div>
          </Panel>

          {readable.length > 0 ? (
            <Panel className="space-y-4">
              <PanelHeader
                title="What this will do"
                description="Nothing is written until you confirm."
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="New transactions"
                  value={plan.expenses.length}
                  format={formatCount}
                  hint={formatDollars(plan.totalCents)}
                  tone="accent"
                />
                <Stat
                  label="Auto-filed"
                  value={plan.autoFiled}
                  format={formatCount}
                  hint="by merchant rules"
                  tone="ok"
                />
                <Stat
                  label="Already imported"
                  value={plan.duplicates}
                  format={formatCount}
                  hint="skipped, not duplicated"
                />
                <Stat
                  label="Payments"
                  value={plan.payments}
                  format={formatCount}
                  hint="dropped, not expenses"
                />
              </div>

              {plan.bonusMoves.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-text">Bonus progress</h3>
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {plan.bonusMoves.map((move) => (
                      <li
                        key={move.cardId}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                      >
                        <span className="text-text">{move.cardLabel}</span>
                        <span className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-dim">{formatCents(move.fromCents)}</span>
                          <span className="text-dim">→</span>
                          <span className="text-text">{formatCents(move.toCents)}</span>
                          <span className="text-dim">of {formatCents(move.requiredCents)}</span>
                          {move.completes ? <Badge tone="ok">Completes it</Badge> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {plan.feeCharges.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-text">Annual fees found</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-dim">
                    Recording these moves each card&rsquo;s next-fee prediction on to
                    the following year automatically.
                  </p>
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {plan.feeCharges.map((entry) => (
                      <li
                        key={entry.charge.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                      >
                        <span className="text-text">{entry.cardLabel}</span>
                        <span className="font-mono text-xs text-muted">
                          {formatCents(entry.charge.amountCents)} on{' '}
                          {formatDate(entry.charge.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {plan.unassignedFiles.length > 0 ? (
                <Note>
                  {plan.unassignedFiles.join(', ')}{' '}
                  {plan.unassignedFiles.length === 1 ? 'is' : 'are'} not linked to a
                  card. Those transactions will still import as expenses, but they
                  cannot move bonus progress or pick up an annual fee — pick a card
                  above if you want that.
                </Note>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button
                  variant="primary"
                  disabled={plan.expenses.length === 0 && plan.feeCharges.length === 0}
                  onClick={commit}
                >
                  Import everything
                </Button>
                <span className="text-xs text-dim">
                  Transactions land in the review queue, not straight into your totals.
                </span>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
