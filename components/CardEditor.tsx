'use client';

import { useMemo, useState } from 'react';
import { CARD_CATALOG, CATALOG_REVIEWED, getCatalogCard, searchCatalog } from '@/lib/catalog';
import { formatDate, isIsoDate, today } from '@/lib/dates';
import { bonusDeadline } from '@/lib/bonuses';
import { feeOutlook } from '@/lib/fees';
import { centsToInput, formatCents, parseDollarsToCents, parseIntegerInput } from '@/lib/money';
import { EARN_CATEGORIES } from '@/lib/earning';
import { PERK_PERIOD_LABELS, annualPerkValueCents } from '@/lib/perks';
import { PROGRAMS } from '@/lib/programs';
import { applyCatalogCard, blankBonus, newId } from '@/lib/storage';
import { ISSUER_LABELS, ISSUER_ORDER } from '@/lib/types';
import type {
  CardAccount,
  EarnRate,
  FeeCharge,
  Issuer,
  Perk,
  PerkPeriod,
  RetentionOffer,
  SignupBonus,
} from '@/lib/types';
import { Badge, Button, Checkbox, Field, Note, Panel, Select, TextInput } from './ui';

/**
 * The one place a card is created or changed. It edits a local draft and only
 * hands the finished card back on save, so a half-typed dollar amount never
 * lands in storage and a cancelled edit leaves nothing behind.
 */

type Errors = Partial<Record<'productName' | 'openedDate' | 'closedDate', string>>;

function validate(card: CardAccount): Errors {
  const errors: Errors = {};
  if (!card.productName.trim()) errors.productName = 'Give the card a name.';
  if (!isIsoDate(card.openedDate)) errors.openedDate = 'Pick the date the account opened.';
  if (card.closedDate && card.closedDate < card.openedDate) {
    errors.closedDate = 'Closed before it was opened.';
  }
  return errors;
}

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="border-b border-line pb-2">
      <h3 className="text-sm font-semibold text-text">{children}</h3>
      {hint ? <p className="mt-0.5 text-xs leading-relaxed text-dim">{hint}</p> : null}
    </div>
  );
}

export function CardEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: CardAccount;
  onSave: (card: CardAccount) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [card, setCard] = useState<CardAccount>(initial);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const patch = (changes: Partial<CardAccount>) =>
    setCard((current) => ({ ...current, ...changes }));

  const patchBonus = (changes: Partial<SignupBonus>) =>
    setCard((current) =>
      current.bonus ? { ...current, bonus: { ...current.bonus, ...changes } } : current,
    );

  const errors = validate(card);
  const catalogMatches = useMemo(() => searchCatalog(catalogQuery).slice(0, 40), [catalogQuery]);
  const catalog = getCatalogCard(card.catalogId);
  const outlook = feeOutlook(card, 45);

  const feeDiffersFromCatalog =
    catalog !== null && catalog.annualFeeCents !== card.annualFeeCents;

  function save() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    onSave({
      ...card,
      productName: card.productName.trim(),
      nickname: card.nickname.trim(),
      last4: card.last4.replace(/\D/g, '').slice(0, 4),
      status: card.closedDate ? 'closed' : card.status,
    });
  }

  const patchPerk = (id: string, changes: Partial<Perk>) =>
    patch({ perks: card.perks.map((p) => (p.id === id ? { ...p, ...changes } : p)) });

  const patchRate = (id: string, changes: Partial<EarnRate>) =>
    patch({ earnRates: card.earnRates.map((r) => (r.id === id ? { ...r, ...changes } : r)) });

  const patchOffer = (id: string, changes: Partial<RetentionOffer>) =>
    patch({
      retentionOffers: card.retentionOffers.map((o) => (o.id === id ? { ...o, ...changes } : o)),
    });

  function addFeeCharge() {
    const charge: FeeCharge = {
      id: newId(),
      date: outlook.nextChargeDate ?? today(),
      amountCents: card.annualFeeCents,
      refunded: false,
      note: '',
    };
    patch({ feeHistory: [...card.feeHistory, charge] });
  }

  function patchFeeCharge(id: string, changes: Partial<FeeCharge>) {
    patch({
      feeHistory: card.feeHistory.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    });
  }

  return (
    <Panel className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">
          {initial.productName ? `Edit ${initial.productName}` : 'Add a card'}
        </h2>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save card
          </Button>
        </div>
      </div>

      {/* ---- product ------------------------------------------------------ */}
      <div className="space-y-4">
        <SectionTitle hint={`Picking a product fills in the fee, program, and typical bonus window. Catalog values reviewed ${CATALOG_REVIEWED} -- confirm the fee against your own statement.`}>
          Product
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Find a card" hint={`${CARD_CATALOG.length} products, or leave blank and type it in below.`}>
            <TextInput
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Sapphire, Ink, Venture..."
            />
          </Field>

          <Field label="Product">
            <Select
              value={card.catalogId ?? ''}
              onChange={(e) => {
                const next = getCatalogCard(e.target.value);
                if (next) setCard((current) => applyCatalogCard(current, next));
                else patch({ catalogId: null });
              }}
            >
              <option value="">Custom / not listed</option>
              {catalogMatches.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {ISSUER_LABELS[entry.issuer]} {entry.name}
                  {entry.business ? ' (business)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {catalog?.note ? <Note>{catalog.note}</Note> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Issuer">
            <Select
              value={card.issuer}
              onChange={(e) => patch({ issuer: e.target.value as Issuer })}
            >
              {ISSUER_ORDER.map((issuer) => (
                <option key={issuer} value={issuer}>
                  {ISSUER_LABELS[issuer]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Card name"
            error={showErrors ? errors.productName : null}
          >
            <TextInput
              value={card.productName}
              onChange={(e) => patch({ productName: e.target.value })}
              placeholder="Sapphire Preferred"
            />
          </Field>

          <Field label="Nickname" hint="Optional. Shown instead of the product name.">
            <TextInput
              value={card.nickname}
              onChange={(e) => patch({ nickname: e.target.value })}
              placeholder="Travel card"
            />
          </Field>

          <Field label="Last 4" hint="Only to tell two of the same product apart.">
            <TextInput
              mono
              inputMode="numeric"
              maxLength={4}
              value={card.last4}
              onChange={(e) => patch({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4417"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="Business card"
            hint="Chase, Citi and Amex business cards stay off your personal credit report. Capital One and Discover business cards do not, so they count toward 5/24."
            checked={card.business}
            onChange={(business) => patch({ business })}
          />
          <Checkbox
            label="I'm an authorized user"
            hint="Someone else owns the account. Excluded from your fee totals, but still shows on your credit report."
            checked={card.authorizedUser}
            onChange={(authorizedUser) => patch({ authorizedUser })}
          />
        </div>
      </div>

      {/* ---- account ------------------------------------------------------ */}
      <div className="space-y-4">
        <SectionTitle hint="The open date drives the annual fee prediction and the 5/24 count, so it is the one field worth getting exactly right.">
          Account
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opened" error={showErrors ? errors.openedDate : null}>
            <TextInput
              type="date"
              value={card.openedDate}
              onChange={(e) => patch({ openedDate: e.target.value })}
            />
          </Field>

          <Field
            label="Closed"
            hint="Leave blank while the card is open."
            error={showErrors ? errors.closedDate : null}
          >
            <TextInput
              type="date"
              value={card.closedDate ?? ''}
              onChange={(e) =>
                patch({
                  closedDate: e.target.value || null,
                  status: e.target.value ? 'closed' : 'open',
                })
              }
            />
          </Field>

          <Field label="Credit limit" hint="Optional. Only used for your own reference.">
            <TextInput
              mono
              inputMode="decimal"
              value={card.creditLimitCents === null ? '' : centsToInput(card.creditLimitCents)}
              onChange={(e) =>
                patch({ creditLimitCents: parseDollarsToCents(e.target.value) })
              }
              placeholder="15000.00"
            />
          </Field>

          <Field label="Rewards program" hint="Where this card's points land. Chase cards pool into one balance.">
            <Select
              value={card.programId ?? ''}
              onChange={(e) => patch({ programId: e.target.value || null })}
            >
              <option value="">None</option>
              {PROGRAMS.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {/* ---- annual fee --------------------------------------------------- */}
      <div className="space-y-4">
        <SectionTitle hint="An annual fee posts on the statement containing your account anniversary, so the predicted date can be off by up to a cycle. Pin the exact date once you have seen it on a statement.">
          Annual fee
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Annual fee"
            hint={
              feeDiffersFromCatalog && catalog
                ? `Catalog default for this product is ${formatCents(catalog.annualFeeCents)}.`
                : undefined
            }
          >
            <TextInput
              mono
              inputMode="decimal"
              value={centsToInput(card.annualFeeCents)}
              onChange={(e) =>
                patch({ annualFeeCents: parseDollarsToCents(e.target.value) ?? 0 })
              }
            />
          </Field>

          <Field
            label="Credits you actually use"
            hint="Travel credits, statement credits, a free night -- counted at what they are worth to you, not face value. Drives the net cost of keeping the card."
          >
            <TextInput
              mono
              inputMode="decimal"
              value={centsToInput(card.annualCreditsValueCents)}
              onChange={(e) =>
                patch({ annualCreditsValueCents: parseDollarsToCents(e.target.value) ?? 0 })
              }
            />
          </Field>
        </div>

        <Checkbox
          label="First year fee waived"
          hint="Moves the first charge to the one-year anniversary."
          checked={card.firstYearFeeWaived}
          onChange={(firstYearFeeWaived) => patch({ firstYearFeeWaived })}
        />

        <Field
          label="Pin the next fee date"
          hint="Overrides the anniversary estimate. Use the date you have actually seen a fee post."
        >
          <TextInput
            type="date"
            value={card.nextFeeDateOverride ?? ''}
            onChange={(e) => patch({ nextFeeDateOverride: e.target.value || null })}
          />
        </Field>

        {card.annualFeeCents > 0 ? (
          <Note>
            {outlook.nextChargeDate ? (
              <>
                Next fee: <strong className="font-mono">{formatCents(card.annualFeeCents)}</strong>{' '}
                around <strong className="font-mono">{formatDate(outlook.nextChargeDate)}</strong>{' '}
                (year {outlook.anniversaryNumber}){outlook.predicted ? ', estimated from the open date' : ', from your pinned date'}.
                {card.annualCreditsValueCents > 0 ? (
                  <>
                    {' '}Net cost of keeping it:{' '}
                    <strong className="font-mono">{formatCents(outlook.netAnnualCostCents)}</strong>.
                  </>
                ) : null}
              </>
            ) : card.authorizedUser ? (
              'Authorized-user cards are excluded from fee tracking -- the fee is on whoever owns the account.'
            ) : (
              'No upcoming fee while the card is closed.'
            )}
          </Note>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text">Fees actually charged</span>
            <Button size="sm" onClick={addFeeCharge}>
              Record a charge
            </Button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-dim">
            Recording a real charge stops that cycle being predicted and rolls
            the estimate on to the next year.
          </p>
          {card.feeHistory.length === 0 ? (
            <p className="mt-3 text-sm text-dim">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {card.feeHistory
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((charge) => (
                  <li
                    key={charge.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 p-2"
                  >
                    <TextInput
                      type="date"
                      className="w-40"
                      value={charge.date}
                      onChange={(e) => patchFeeCharge(charge.id, { date: e.target.value })}
                    />
                    <TextInput
                      mono
                      className="w-28"
                      inputMode="decimal"
                      value={centsToInput(charge.amountCents)}
                      onChange={(e) =>
                        patchFeeCharge(charge.id, {
                          amountCents: parseDollarsToCents(e.target.value) ?? 0,
                        })
                      }
                    />
                    <label className="flex items-center gap-1.5 text-sm text-muted">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[rgb(var(--accent))]"
                        checked={charge.refunded}
                        onChange={(e) =>
                          patchFeeCharge(charge.id, { refunded: e.target.checked })
                        }
                      />
                      Refunded
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patch({
                          feeHistory: card.feeHistory.filter((c) => c.id !== charge.id),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- sign-up bonus ------------------------------------------------ */}
      <div className="space-y-4">
        <SectionTitle hint="The window is counted in calendar months from the start date, which is how issuers count it.">
          Sign-up bonus
        </SectionTitle>

        {!card.bonus ? (
          <Button onClick={() => patch({ bonus: blankBonus(card) })}>
            Add a sign-up bonus
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reward type">
                <Select
                  value={card.bonus.rewardKind}
                  onChange={(e) =>
                    patchBonus({ rewardKind: e.target.value as 'points' | 'cash' })
                  }
                >
                  <option value="points">Points / miles</option>
                  <option value="cash">Cash back</option>
                </Select>
              </Field>

              {card.bonus.rewardKind === 'points' ? (
                <Field label="Points awarded">
                  <TextInput
                    mono
                    inputMode="numeric"
                    value={card.bonus.points === 0 ? '' : String(card.bonus.points)}
                    onChange={(e) =>
                      patchBonus({ points: parseIntegerInput(e.target.value) ?? 0 })
                    }
                    placeholder="100000"
                  />
                </Field>
              ) : (
                <Field label="Cash awarded">
                  <TextInput
                    mono
                    inputMode="decimal"
                    value={centsToInput(card.bonus.cashCents)}
                    onChange={(e) =>
                      patchBonus({ cashCents: parseDollarsToCents(e.target.value) ?? 0 })
                    }
                  />
                </Field>
              )}

              <Field label="Spend required">
                <TextInput
                  mono
                  inputMode="decimal"
                  value={centsToInput(card.bonus.spendRequiredCents)}
                  onChange={(e) =>
                    patchBonus({ spendRequiredCents: parseDollarsToCents(e.target.value) ?? 0 })
                  }
                />
              </Field>

              <Field label="Spend so far">
                <TextInput
                  mono
                  inputMode="decimal"
                  value={centsToInput(card.bonus.spendProgressCents)}
                  onChange={(e) =>
                    patchBonus({
                      spendProgressCents: parseDollarsToCents(e.target.value) ?? 0,
                      progressUpdated: today(),
                    })
                  }
                />
              </Field>

              <Field label="Clock starts" hint="Usually the open date; some offers start at approval.">
                <TextInput
                  type="date"
                  value={card.bonus.startDate}
                  onChange={(e) => patchBonus({ startDate: e.target.value })}
                />
              </Field>

              <Field label="Window (months)">
                <TextInput
                  mono
                  inputMode="numeric"
                  value={String(card.bonus.spendWindowMonths)}
                  onChange={(e) =>
                    patchBonus({
                      spendWindowMonths: Math.max(1, parseIntegerInput(e.target.value) ?? 3),
                    })
                  }
                />
              </Field>

              <Field
                label="Exact deadline"
                hint="Overrides the derived date. Use what the offer letter says."
              >
                <TextInput
                  type="date"
                  value={card.bonus.deadlineOverride ?? ''}
                  onChange={(e) => patchBonus({ deadlineOverride: e.target.value || null })}
                />
              </Field>

              <Field label="Status">
                <Select
                  value={card.bonus.status}
                  onChange={(e) =>
                    patchBonus({
                      status: e.target.value as SignupBonus['status'],
                      earnedDate:
                        e.target.value === 'earned'
                          ? card.bonus?.earnedDate ?? today()
                          : card.bonus?.earnedDate ?? null,
                    })
                  }
                >
                  <option value="tracking">Still working on it</option>
                  <option value="earned">Earned</option>
                  <option value="missed">Missed</option>
                </Select>
              </Field>

              {card.bonus.status === 'earned' ? (
                <Field label="Points posted on" hint="Often a statement after you finish the spend.">
                  <TextInput
                    type="date"
                    value={card.bonus.postedDate ?? ''}
                    onChange={(e) => patchBonus({ postedDate: e.target.value || null })}
                  />
                </Field>
              ) : null}
            </div>

            <Field label="Bonus notes">
              <TextInput
                value={card.bonus.notes}
                onChange={(e) => patchBonus({ notes: e.target.value })}
                placeholder="Offer details, referral used, anything to remember"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Note>
                Deadline:{' '}
                <strong className="font-mono">{formatDate(bonusDeadline(card.bonus))}</strong>
                {card.bonus.deadlineOverride
                  ? ' (exact, from the offer)'
                  : ` (${formatDate(card.bonus.startDate)} plus ${
                      card.bonus.spendWindowMonths
                    } months)`}
              </Note>
              <Button variant="ghost" size="sm" onClick={() => patch({ bonus: null })}>
                Remove bonus
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---- credits and perks ------------------------------------------- */}
      <div className="space-y-4">
        <SectionTitle hint="Tracked per period, because that is how they are lost -- a monthly credit unused in March is gone in April, not carried forward.">
          Credits & perks
        </SectionTitle>

        {card.perks.length === 0 ? (
          <p className="text-sm text-dim">None recorded.</p>
        ) : (
          <ul className="space-y-2">
            {card.perks.map((perk) => (
              <li key={perk.id} className="grid gap-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="What it is">
                  <TextInput
                    value={perk.label}
                    onChange={(e) => patchPerk(perk.id, { label: e.target.value })}
                    placeholder="$15 Uber Cash"
                  />
                </Field>
                <Field label="Value per period">
                  <TextInput
                    mono
                    inputMode="decimal"
                    value={centsToInput(perk.valueCents)}
                    onChange={(e) =>
                      patchPerk(perk.id, { valueCents: parseDollarsToCents(e.target.value) ?? 0 })
                    }
                  />
                </Field>
                <Field label="How often">
                  <Select
                    value={perk.period}
                    onChange={(e) => patchPerk(perk.id, { period: e.target.value as PerkPeriod })}
                  >
                    {(Object.keys(PERK_PERIOD_LABELS) as PerkPeriod[]).map((period) => (
                      <option key={period} value={period}>
                        {PERK_PERIOD_LABELS[period]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="pb-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => patch({ perks: card.perks.filter((p) => p.id !== perk.id) })}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={() =>
              patch({
                perks: [
                  ...card.perks,
                  { id: newId(), label: '', valueCents: 0, period: 'monthly', usedPeriods: [], notes: '' } as Perk,
                ],
              })
            }
          >
            Add a credit
          </Button>
          {card.perks.length > 0 ? (
            <span className="text-xs text-dim">
              Worth{' '}
              <span className="font-mono text-text">{formatCents(annualPerkValueCents(card))}</span>{' '}
              a year if every period is used. Tick them off on the Cards page.
            </span>
          ) : null}
        </div>
      </div>

      {/* ---- earning rates ------------------------------------------------- */}
      <div className="space-y-4">
        <SectionTitle hint="Used to work out which card to reach for. A multiplier only means something next to what the point is worth, so these are compared in cents per dollar.">
          Earning rates
        </SectionTitle>

        {card.earnRates.length === 0 ? (
          <p className="text-sm text-dim">
            None recorded — this card is assumed to earn 1x everywhere.
          </p>
        ) : (
          <ul className="space-y-2">
            {card.earnRates.map((rate) => (
              <li key={rate.id} className="grid gap-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Category">
                  <Select
                    value={rate.categoryId}
                    onChange={(e) => patchRate(rate.id, { categoryId: e.target.value })}
                  >
                    {EARN_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Multiplier">
                  <TextInput
                    mono
                    inputMode="decimal"
                    value={String(rate.multiplier)}
                    onChange={(e) => {
                      const value = Number(e.target.value.replace(/[^\d.]/g, ''));
                      patchRate(rate.id, {
                        multiplier: Number.isFinite(value) ? value : 0,
                      });
                    }}
                  />
                </Field>
                <Field label="Annual cap" hint="Blank if uncapped.">
                  <TextInput
                    mono
                    inputMode="decimal"
                    value={rate.capCents === null ? '' : centsToInput(rate.capCents)}
                    onChange={(e) =>
                      patchRate(rate.id, { capCents: parseDollarsToCents(e.target.value) })
                    }
                  />
                </Field>
                <div className="pb-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patch({ earnRates: card.earnRates.filter((r) => r.id !== rate.id) })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          size="sm"
          onClick={() =>
            patch({
              earnRates: [
                ...card.earnRates,
                { id: newId(), categoryId: 'everything', multiplier: 1, capCents: null, notes: '' } as EarnRate,
              ],
            })
          }
        >
          Add a rate
        </Button>
      </div>

      {/* ---- retention offers ---------------------------------------------- */}
      <div className="space-y-4">
        <SectionTitle hint="Logged so the next call has last year's number to hand -- what they offered, and whether you took it.">
          Retention offers
        </SectionTitle>

        {card.retentionOffers.length === 0 ? (
          <p className="text-sm text-dim">None logged.</p>
        ) : (
          <ul className="space-y-2">
            {card.retentionOffers
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((offer) => (
                <li key={offer.id} className="grid gap-2 rounded-xl bg-surface-2/50 p-3 ring-1 ring-line sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
                  <Field label="When">
                    <TextInput
                      type="date"
                      value={offer.date}
                      onChange={(e) => patchOffer(offer.id, { date: e.target.value })}
                    />
                  </Field>
                  <Field label="What they offered">
                    <TextInput
                      value={offer.description}
                      onChange={(e) => patchOffer(offer.id, { description: e.target.value })}
                      placeholder="$95 statement credit, or 10k points"
                    />
                  </Field>
                  <Field label="Value">
                    <TextInput
                      mono
                      inputMode="decimal"
                      value={centsToInput(offer.valueCents)}
                      onChange={(e) =>
                        patchOffer(offer.id, {
                          valueCents: parseDollarsToCents(e.target.value) ?? 0,
                        })
                      }
                    />
                  </Field>
                  <div className="flex items-center gap-2 pb-1">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[rgb(var(--accent))]"
                        checked={offer.accepted}
                        onChange={(e) => patchOffer(offer.id, { accepted: e.target.checked })}
                      />
                      Took it
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patch({
                          retentionOffers: card.retentionOffers.filter((o) => o.id !== offer.id),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}

        <Button
          size="sm"
          onClick={() =>
            patch({
              retentionOffers: [
                ...card.retentionOffers,
                { id: newId(), date: today(), description: '', valueCents: 0, points: 0, accepted: false } as RetentionOffer,
              ],
            })
          }
        >
          Log an offer
        </Button>
      </div>

      {/* ---- notes -------------------------------------------------------- */}
      <div className="space-y-4">
        <SectionTitle>Notes</SectionTitle>
        <textarea
          value={card.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={3}
          placeholder="Downgrade path, retention offers, which credits you actually use..."
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-dim outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {onDelete ? (
          confirmingDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-muted">Delete this card for good?</span>
              <Button variant="danger" size="sm" onClick={onDelete}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete card
            </Button>
          )
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save card
          </Button>
        </span>
      </div>

      {showErrors && Object.keys(errors).length > 0 ? (
        <p className="text-sm text-danger-ink">
          Fix the highlighted fields and try again.
        </p>
      ) : null}
    </Panel>
  );
}
