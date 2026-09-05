import { taxYearOf } from './expenses';
import type { Expense } from './types';

/**
 * Contractors approaching or past the 1099-NEC threshold.
 *
 * Pay a contractor $600 or more in a calendar year and you owe them a
 * 1099-NEC, and yourself the penalty if you miss it. The information needed to
 * spot that is already in the contract-labor expenses -- it just has to be
 * grouped by who was paid rather than by what it cost.
 *
 * Payments through a card or a third-party network (Upwork, PayPal, Venmo for
 * business) are generally reported by the processor on a 1099-K instead, so
 * these are a prompt to check who you actually owe a form to, not a filing
 * list. Cash and cheque payments are the ones that land on you.
 */

export const FORM_1099_THRESHOLD_CENTS = 60_000;

/** Flag a vendor once they are within this much of the threshold. */
const APPROACHING_CENTS = 45_000;

const CONTRACTOR_CATEGORIES = new Set(['contract-labor', 'legal-professional']);

export type VendorTotal = {
  merchant: string;
  entityId: string;
  totalCents: number;
  paymentCount: number;
  firstPaid: string;
  lastPaid: string;
  crossesThreshold: boolean;
  approaching: boolean;
};

function normalize(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function vendorTotals(expenses: Expense[], year: number): VendorTotal[] {
  const groups = new Map<string, VendorTotal>();

  for (const expense of expenses) {
    if (taxYearOf(expense) !== year) continue;
    if (!CONTRACTOR_CATEGORIES.has(expense.categoryId)) continue;
    if (expense.amountCents <= 0) continue;

    // Group per vendor per entity: two businesses paying the same contractor
    // each owe their own form.
    const key = `${expense.entityId}|${normalize(expense.merchant)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalCents += expense.amountCents;
      existing.paymentCount += 1;
      if (expense.date < existing.firstPaid) existing.firstPaid = expense.date;
      if (expense.date > existing.lastPaid) existing.lastPaid = expense.date;
    } else {
      groups.set(key, {
        merchant: expense.merchant,
        entityId: expense.entityId,
        totalCents: expense.amountCents,
        paymentCount: 1,
        firstPaid: expense.date,
        lastPaid: expense.date,
        crossesThreshold: false,
        approaching: false,
      });
    }
  }

  return [...groups.values()]
    .map((v) => ({
      ...v,
      crossesThreshold: v.totalCents >= FORM_1099_THRESHOLD_CENTS,
      approaching:
        v.totalCents >= APPROACHING_CENTS && v.totalCents < FORM_1099_THRESHOLD_CENTS,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function vendorsNeeding1099(expenses: Expense[], year: number): VendorTotal[] {
  return vendorTotals(expenses, year).filter((v) => v.crossesThreshold);
}
