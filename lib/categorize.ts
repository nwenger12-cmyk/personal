import { getCategory } from './categories';
import type { CategorizationRule } from './types';

/**
 * Filing imported transactions by merchant.
 *
 * The first import of a year is unavoidably manual. The second should not be,
 * which is what these are for: a substring match on the merchant text that
 * assigns a category, and optionally an entity and a deductible percentage.
 *
 * Your own rules always win over the shipped ones, newest first, because a
 * rule you wrote is a decision about your business and a shipped rule is a
 * guess about everyone's. The shipped set covers the merchants a video and
 * stock-footage business hits constantly; it is a head start, not a policy.
 *
 * Every rule-assigned expense still lands unreviewed. A rule decides where a
 * row goes; you decide whether it was right.
 */

type Seed = [match: string, categoryId: string, deductiblePercent?: number];

const SEEDS: Seed[] = [
  // Creative software and subscriptions
  ['adobe', 'software'],
  ['frame.io', 'software'],
  ['blackmagic', 'software'],
  ['davinci', 'software'],
  ['final cut', 'software'],
  ['topaz labs', 'software'],
  ['quickbooks', 'software'],
  ['notion', 'software'],
  ['figma', 'software'],
  ['openai', 'software'],
  ['anthropic', 'software'],
  ['github', 'software'],

  // Cloud, hosting, domains
  ['amazon web services', 'cloud-hosting'],
  ['aws ', 'cloud-hosting'],
  ['cloudflare', 'cloud-hosting'],
  ['vercel', 'cloud-hosting'],
  ['supabase', 'cloud-hosting'],
  ['backblaze', 'cloud-hosting'],
  ['dropbox', 'cloud-hosting'],
  ['google cloud', 'cloud-hosting'],
  ['godaddy', 'cloud-hosting'],
  ['namecheap', 'cloud-hosting'],
  ['squarespace', 'cloud-hosting'],
  ['webflow', 'cloud-hosting'],

  // Licensing and stock
  ['artlist', 'stock-licensing'],
  ['epidemic sound', 'stock-licensing'],
  ['musicbed', 'stock-licensing'],
  ['soundstripe', 'stock-licensing'],
  ['shutterstock', 'stock-licensing'],
  ['pond5', 'stock-licensing'],
  ['envato', 'stock-licensing'],

  // Gear: consumables default to supplies. A body or a lens is capitalised
  // instead, which is a decision per purchase, so no rule guesses at it.
  ['b&h photo', 'supplies'],
  ['bhphoto', 'supplies'],
  ['adorama', 'supplies'],
  ['sandisk', 'supplies'],
  ['lensrentals', 'rent-equipment'],
  ['borrowlenses', 'rent-equipment'],
  ['sharegrid', 'rent-equipment'],

  // Travel
  ['delta air', 'travel'],
  ['united airlines', 'travel'],
  ['southwest air', 'travel'],
  ['american airlines', 'travel'],
  ['alaska air', 'travel'],
  ['jetblue', 'travel'],
  ['marriott', 'travel'],
  ['hilton', 'travel'],
  ['hyatt', 'travel'],
  ['airbnb', 'travel'],
  ['booking.com', 'travel'],
  ['expedia', 'travel'],
  ['hertz', 'travel'],
  ['enterprise rent', 'travel'],
  ['avis', 'travel'],
  ['turo', 'travel'],
  ['uber trip', 'travel'],
  ['lyft', 'travel'],

  // Meals -- capped at 50% by statute, carried by the category default
  ['doordash', 'meals'],
  ['uber eats', 'meals'],
  ['grubhub', 'meals'],
  ['starbucks', 'meals'],
  ['chipotle', 'meals'],

  // Vehicle
  ['shell oil', 'vehicle'],
  ['chevron', 'vehicle'],
  ['exxon', 'vehicle'],
  ['jiffy lube', 'vehicle'],

  // Office, shipping, admin
  ['staples', 'office'],
  ['office depot', 'office'],
  ['usps', 'shipping'],
  ['fedex', 'shipping'],
  [' ups ', 'shipping'],
  ['upwork', 'contract-labor'],
  ['fiverr', 'contract-labor'],

  // Advertising
  ['google ads', 'advertising'],
  ['meta platforms', 'advertising'],
  ['facebk', 'advertising'],
  ['linkedin', 'advertising'],

  // Fees and licences
  ['annual fee', 'bank-fees'],
  ['annual membership fee', 'bank-fees'],
  ['foreign transaction fee', 'bank-fees'],
  ['faa', 'taxes-licenses'],
];

export const BUILT_IN_RULES: CategorizationRule[] = SEEDS.map(
  ([match, categoryId, deductiblePercent]) => ({
    id: `builtin-${match.trim().replace(/[^a-z0-9]+/g, '-')}`,
    match,
    categoryId,
    entityId: null,
    deductiblePercent: deductiblePercent ?? null,
    builtIn: true,
  }),
);

export type RuleMatch = {
  rule: CategorizationRule;
  categoryId: string;
  entityId: string | null;
  deductiblePercent: number | null;
};

/**
 * The first rule whose text appears in the merchant or description. User rules
 * are tried newest-first before any built-in, so adding a rule for a merchant
 * a shipped rule already covers overrides it without having to find and delete
 * the original.
 */
export function matchRule(
  merchant: string,
  description: string,
  userRules: CategorizationRule[],
): RuleMatch | null {
  const haystack = ` ${merchant} ${description} `.toLowerCase();
  const ordered = [...userRules].reverse().concat(BUILT_IN_RULES);

  for (const rule of ordered) {
    const needle = rule.match.trim().toLowerCase();
    if (!needle) continue;
    if (!haystack.includes(needle)) continue;
    if (!getCategory(rule.categoryId)) continue;
    return {
      rule,
      categoryId: rule.categoryId,
      entityId: rule.entityId,
      deductiblePercent: rule.deductiblePercent,
    };
  }
  return null;
}

/** How many of a batch a rule set would file, for the import preview. */
export function matchCount(
  rows: { merchant: string; description: string }[],
  userRules: CategorizationRule[],
): number {
  return rows.filter((row) => matchRule(row.merchant, row.description, userRules) !== null)
    .length;
}
