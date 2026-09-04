/**
 * Expense categories, mapped to the Schedule C lines they end up on.
 *
 * The mapping is the whole point. Categorising spend into invented buckets
 * produces a spreadsheet someone has to re-sort at tax time; categorising it
 * into the lines that already exist on the form produces a total that gets
 * typed straight in. Every category here names its line, and the tax summary
 * groups by line so the output matches the form.
 *
 * `defaultDeductiblePercent` is a starting value, not a ruling. Most business
 * spend defaults to 100; the exceptions carry the statutory limit that catches
 * people out (business meals at 50). Every expense can override it, because
 * the split between business and personal use is a judgement about your
 * particular purchase that no lookup table can make.
 */

export type CategoryGroup =
  | 'operating'
  | 'production'
  | 'travel'
  | 'professional'
  | 'facilities'
  | 'financing'
  | 'other';

export type ExpenseCategory = {
  id: string;
  label: string;
  group: CategoryGroup;
  /** The Schedule C line this rolls up to, as printed on the form. */
  scheduleCLine: string;
  /** Sort key so the summary comes out in form order. */
  lineOrder: number;
  defaultDeductiblePercent: number;
  note: string;
};

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  operating: 'Operating',
  production: 'Production & equipment',
  travel: 'Travel & meals',
  professional: 'Professional services',
  facilities: 'Facilities & vehicle',
  financing: 'Financing & fees',
  other: 'Other',
};

const c = (
  id: string,
  label: string,
  group: CategoryGroup,
  scheduleCLine: string,
  lineOrder: number,
  note = '',
  defaultDeductiblePercent = 100,
): ExpenseCategory => ({
  id, label, group, scheduleCLine, lineOrder, defaultDeductiblePercent, note,
});

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // ---- Schedule C, in form order ------------------------------------------
  c('advertising', 'Advertising & marketing', 'operating', 'Line 8 — Advertising', 8,
    'Ads, promoted posts, marketplace listing fees, portfolio site costs.'),

  c('vehicle', 'Car & truck', 'facilities', 'Line 9 — Car and truck expenses', 9,
    'Either actual costs or the standard mileage rate -- not both. Mileage needs a contemporaneous log of dates, miles, and business purpose.'),

  c('commissions', 'Commissions & fees', 'operating', 'Line 10 — Commissions and fees', 10,
    'Marketplace revenue share, agency commissions, referral fees paid out.'),

  c('contract-labor', 'Contract labor', 'professional', 'Line 11 — Contract labor', 11,
    'Editors, colorists, assistants, VAs. Anyone paid $600+ in a year needs a 1099-NEC from you.'),

  c('depreciation', 'Depreciation / capitalized equipment', 'production', 'Line 13 — Depreciation and section 179', 13,
    'Cameras, drones, lenses, computers -- assets with a life beyond this year. Section 179 or bonus depreciation can often take it all in year one, but that is a return-level election, not something to decide here.'),

  c('insurance', 'Insurance', 'operating', 'Line 15 — Insurance (other than health)', 15,
    'Equipment, liability, drone coverage. Not health insurance -- that goes elsewhere on the 1040.'),

  c('interest', 'Interest', 'financing', 'Line 16b — Interest, other', 16,
    'Interest carried on a business card or loan. The interest, not the principal.'),

  c('legal-professional', 'Legal & professional', 'professional', 'Line 17 — Legal and professional services', 17,
    'Attorneys, accountants, bookkeeping, tax prep for the business.'),

  c('office', 'Office expense', 'operating', 'Line 18 — Office expense', 18,
    'Postage, printing, small office supplies, general office software.'),

  c('rent-equipment', 'Rent — equipment', 'facilities', 'Line 20a — Rent or lease: vehicles, machinery, equipment', 20,
    'Rented bodies, lenses, lighting, grip, vehicles for a shoot.'),

  c('rent-property', 'Rent — property', 'facilities', 'Line 20b — Rent or lease: other business property', 21,
    'Studio, storage unit, coworking. A home office is NOT this line -- it goes on Form 8829.'),

  c('repairs', 'Repairs & maintenance', 'production', 'Line 21 — Repairs and maintenance', 22,
    'Sensor cleaning, gimbal service, camera repair, drone parts.'),

  c('supplies', 'Supplies', 'production', 'Line 22 — Supplies', 23,
    'Consumables: memory cards, batteries, filters, gaffer tape, props.'),

  c('taxes-licenses', 'Taxes & licenses', 'operating', 'Line 23 — Taxes and licenses', 24,
    'Business licenses, FAA Part 107 fees, permits, state filing fees.'),

  c('travel', 'Travel', 'travel', 'Line 24a — Travel', 25,
    'Airfare, lodging, rental cars, baggage on a trip whose primary purpose is business. The trip has to be mostly business for the transport to be deductible at all.'),

  c('meals', 'Meals', 'travel', 'Line 24b — Deductible meals', 26,
    'Business meals are limited to 50% by statute. Enter the full amount you paid -- the percentage does the rest.',
    50),

  c('utilities', 'Utilities', 'facilities', 'Line 25 — Utilities', 27,
    'Business phone and internet. If a line is shared with personal use, drop the percentage to the business share.'),

  c('wages', 'Wages', 'professional', 'Line 26 — Wages', 28,
    'W-2 payroll. Not contractors -- those are contract labor.'),

  // ---- Line 27a, "Other expenses" -----------------------------------------
  // Everything below lands on the same line, but stays separate here because
  // the return wants them itemised in Part V rather than as one lump.
  c('software', 'Software & subscriptions', 'operating', 'Line 27a — Other expenses', 30,
    'Adobe, DaVinci, Frame.io, plugins, AI tools. Annual plans belong in the year you paid.'),

  c('cloud-hosting', 'Cloud storage & hosting', 'operating', 'Line 27a — Other expenses', 31,
    'S3/R2, backups, domains, Vercel, Supabase, CDN.'),

  c('stock-licensing', 'Stock & licensing', 'production', 'Line 27a — Other expenses', 32,
    'Music licences, sound effects, stock you buy in, font and LUT licences, model and property releases.'),

  c('education', 'Education & training', 'professional', 'Line 27a — Other expenses', 33,
    'Courses, workshops, books that maintain or improve skills for the work you already do. Training for a *new* trade is not deductible.'),

  c('dues', 'Dues & memberships', 'professional', 'Line 27a — Other expenses', 34,
    'Trade associations, professional memberships. Not country clubs -- explicitly barred.'),

  c('bank-fees', 'Bank & card fees', 'financing', 'Line 27a — Other expenses', 35,
    'Annual fees, foreign transaction fees, merchant processing, wire fees -- on business accounts.'),

  c('shipping', 'Shipping & freight', 'operating', 'Line 27a — Other expenses', 36,
    'Sending drives, shipping gear to a location, courier.'),

  c('home-office', 'Home office', 'facilities', 'Form 8829 — Home office', 40,
    'Kept apart because it is its own form, computed from square footage or the simplified rate. Do not also claim the same rent or utilities above.'),

  c('uncategorized', 'Uncategorised', 'other', '— not yet assigned', 99,
    'Where imported rows land until you file them. Anything left here is excluded from the tax summary totals.',
    100),
];

export const UNCATEGORIZED_ID = 'uncategorized';

const BY_ID = new Map(EXPENSE_CATEGORIES.map((cat) => [cat.id, cat]));

export function getCategory(id: string | null | undefined): ExpenseCategory | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function categoryLabel(id: string): string {
  return getCategory(id)?.label ?? 'Unknown';
}

/** Categories grouped for a picker, in the order the groups are declared. */
export function categoriesByGroup(): { group: CategoryGroup; categories: ExpenseCategory[] }[] {
  const groups: CategoryGroup[] = [
    'operating', 'production', 'travel', 'professional', 'facilities', 'financing', 'other',
  ];
  return groups.map((group) => ({
    group,
    categories: EXPENSE_CATEGORIES.filter((cat) => cat.group === group),
  }));
}
