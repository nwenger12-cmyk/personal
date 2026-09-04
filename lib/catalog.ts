import type { Issuer } from './types';

/**
 * A starting-values catalog so adding a card is "pick the product, type the
 * open date" instead of looking up six fields.
 *
 * READ THIS BEFORE TRUSTING A NUMBER: annual fees change, and several issuers
 * repriced their premium cards recently. Everything here is a *default that
 * gets copied onto your card once* -- editing a card never reaches back into
 * this file, and the card detail view flags a fee you have not confirmed.
 * Treat the catalog as a typing shortcut, and your statement as the truth.
 *
 * `firstYearFeeWaived` is the offer that is usually attached to the product,
 * not a guarantee; your own approval letter wins.
 */

export const CATALOG_REVIEWED = 'early 2026';

export type CatalogCard = {
  id: string;
  issuer: Issuer;
  name: string;
  business: boolean;
  annualFeeCents: number;
  firstYearFeeWaived: boolean;
  programId: string | null;
  /** Typical spend window on the public offer, in calendar months. */
  bonusWindowMonths: number;
  note: string;
};

const c = (
  id: string,
  issuer: Issuer,
  name: string,
  annualFeeDollars: number,
  programId: string | null,
  opts: Partial<Omit<CatalogCard, 'id' | 'issuer' | 'name' | 'annualFeeCents' | 'programId'>> = {},
): CatalogCard => ({
  id,
  issuer,
  name,
  business: false,
  annualFeeCents: Math.round(annualFeeDollars * 100),
  firstYearFeeWaived: false,
  programId,
  bonusWindowMonths: 3,
  note: '',
  ...opts,
});

const biz = { business: true } as const;

export const CARD_CATALOG: CatalogCard[] = [
  // ---- Chase, personal -----------------------------------------------------
  c('chase-sapphire-preferred', 'chase', 'Sapphire Preferred', 95, 'chase-ur', {
    note: 'The cheapest way to unlock transfer partners for pooled Chase points.',
  }),
  c('chase-sapphire-reserve', 'chase', 'Sapphire Reserve', 795, 'chase-ur', {
    note: 'Repriced upward recently -- confirm the fee on your own statement.',
  }),
  c('chase-freedom-unlimited', 'chase', 'Freedom Unlimited', 0, 'chase-ur'),
  c('chase-freedom-flex', 'chase', 'Freedom Flex', 0, 'chase-ur', {
    note: 'Rotating 5% categories need activating each quarter.',
  }),
  c('chase-freedom-rise', 'chase', 'Freedom Rise', 0, 'chase-ur'),
  c('chase-united-gateway', 'chase', 'United Gateway', 0, 'united'),
  c('chase-united-explorer', 'chase', 'United Explorer', 95, 'united', {
    firstYearFeeWaived: true,
  }),
  c('chase-united-quest', 'chase', 'United Quest', 350, 'united'),
  c('chase-united-club-infinite', 'chase', 'United Club Infinite', 525, 'united'),
  c('chase-southwest-plus', 'chase', 'Southwest Rapid Rewards Plus', 69, 'southwest'),
  c('chase-southwest-premier', 'chase', 'Southwest Rapid Rewards Premier', 99, 'southwest'),
  c('chase-southwest-priority', 'chase', 'Southwest Rapid Rewards Priority', 149, 'southwest'),
  c('chase-hyatt', 'chase', 'World of Hyatt', 95, 'hyatt'),
  c('chase-ihg-premier', 'chase', 'IHG One Rewards Premier', 99, 'ihg', {
    note: 'Anniversary free night is usually worth more than the fee.',
  }),
  c('chase-marriott-boundless', 'chase', 'Marriott Bonvoy Boundless', 95, 'marriott'),
  c('chase-marriott-bold', 'chase', 'Marriott Bonvoy Bold', 0, 'marriott'),
  c('chase-aeroplan', 'chase', 'Aeroplan', 95, null),
  c('chase-amazon-prime', 'chase', 'Prime Visa', 0, 'cash'),
  c('chase-disney-premier', 'chase', 'Disney Premier Visa', 49, 'cash'),

  // ---- Chase, business -----------------------------------------------------
  c('chase-ink-cash', 'chase', 'Ink Business Cash', 0, 'chase-ur', {
    ...biz,
    note: '5% on office supply and telecom, up to the annual cap.',
  }),
  c('chase-ink-unlimited', 'chase', 'Ink Business Unlimited', 0, 'chase-ur', biz),
  c('chase-ink-preferred', 'chase', 'Ink Business Preferred', 95, 'chase-ur', biz),
  c('chase-ink-premier', 'chase', 'Ink Business Premier', 195, 'chase-ur', biz),
  c('chase-united-business', 'chase', 'United Business', 99, 'united', {
    ...biz,
    firstYearFeeWaived: true,
  }),
  c('chase-united-club-business', 'chase', 'United Club Business', 450, 'united', biz),
  c('chase-southwest-premier-business', 'chase', 'Southwest Premier Business', 99, 'southwest', biz),
  c('chase-southwest-performance-business', 'chase', 'Southwest Performance Business', 199, 'southwest', biz),
  c('chase-marriott-business', 'chase', 'Marriott Bonvoy Business', 99, 'marriott', biz),
  c('chase-ihg-business', 'chase', 'IHG One Rewards Business', 99, 'ihg', biz),

  // ---- Capital One ---------------------------------------------------------
  c('capitalone-venture-x', 'capital-one', 'Venture X', 395, 'capitalone-miles', {
    note: 'Annual travel credit plus anniversary miles offset most of the fee.',
  }),
  c('capitalone-venture', 'capital-one', 'Venture Rewards', 95, 'capitalone-miles'),
  c('capitalone-ventureone', 'capital-one', 'VentureOne', 0, 'capitalone-miles'),
  c('capitalone-savor', 'capital-one', 'Savor', 0, 'cash'),
  c('capitalone-quicksilver', 'capital-one', 'Quicksilver', 0, 'cash'),
  c('capitalone-venture-x-business', 'capital-one', 'Venture X Business', 395, 'capitalone-miles', biz),
  c('capitalone-spark-miles', 'capital-one', 'Spark Miles', 95, 'capitalone-miles', {
    ...biz,
    firstYearFeeWaived: true,
  }),
  c('capitalone-spark-cash-plus', 'capital-one', 'Spark Cash Plus', 150, 'cash', {
    ...biz,
    note: 'Charge card -- balance is due in full each month.',
  }),
  c('capitalone-spark-cash-select', 'capital-one', 'Spark Cash Select', 0, 'cash', biz),

  // ---- Citi ----------------------------------------------------------------
  c('citi-strata-premier', 'citi', 'Strata Premier', 95, 'citi-typ'),
  c('citi-strata-elite', 'citi', 'Strata Elite', 595, 'citi-typ'),
  c('citi-double-cash', 'citi', 'Double Cash', 0, 'citi-typ', {
    note: 'Earns ThankYou points, so it feeds a Strata Premier if you hold one.',
  }),
  c('citi-custom-cash', 'citi', 'Custom Cash', 0, 'citi-typ'),
  c('citi-rewards-plus', 'citi', 'Rewards+', 0, 'citi-typ'),
  c('citi-aadvantage-platinum', 'citi', 'AAdvantage Platinum Select', 99, null, {
    firstYearFeeWaived: true,
  }),
  c('citi-aadvantage-executive', 'citi', 'AAdvantage Executive', 595, null),
  c('citi-costco', 'citi', 'Costco Anywhere Visa', 0, 'cash', {
    note: 'Rewards arrive once a year as a certificate, not as a running balance.',
  }),
  c('citi-simplicity', 'citi', 'Simplicity', 0, null),

  // ---- Discover ------------------------------------------------------------
  c('discover-it-cash-back', 'discover', 'Discover it Cash Back', 0, 'discover-cashback', {
    note: 'Rotating 5% categories need activating each quarter.',
  }),
  c('discover-it-chrome', 'discover', 'Discover it Chrome', 0, 'discover-cashback'),
  c('discover-it-miles', 'discover', 'Discover it Miles', 0, 'discover-cashback'),
  c('discover-it-secured', 'discover', 'Discover it Secured', 0, 'discover-cashback'),
  c('discover-it-business', 'discover', 'Discover it Business', 0, 'discover-cashback', biz),

  // ---- American Express ----------------------------------------------------
  c('amex-gold', 'amex', 'Gold Card', 325, 'amex-mr', { bonusWindowMonths: 6 }),
  c('amex-platinum', 'amex', 'Platinum Card', 695, 'amex-mr', {
    bonusWindowMonths: 6,
    note: 'Repriced upward recently -- confirm the fee on your own statement.',
  }),
  c('amex-green', 'amex', 'Green Card', 150, 'amex-mr', { bonusWindowMonths: 6 }),
  c('amex-blue-cash-preferred', 'amex', 'Blue Cash Preferred', 95, 'cash', {
    bonusWindowMonths: 6,
  }),
  c('amex-blue-business-plus', 'amex', 'Blue Business Plus', 0, 'amex-mr', {
    ...biz,
    bonusWindowMonths: 6,
  }),
  c('amex-business-gold', 'amex', 'Business Gold', 375, 'amex-mr', {
    ...biz,
    bonusWindowMonths: 6,
  }),
  c('amex-business-platinum', 'amex', 'Business Platinum', 695, 'amex-mr', {
    ...biz,
    bonusWindowMonths: 6,
  }),
];

const BY_ID = new Map(CARD_CATALOG.map((card) => [card.id, card]));

export function getCatalogCard(id: string | null | undefined): CatalogCard | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function searchCatalog(query: string): CatalogCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return CARD_CATALOG;
  return CARD_CATALOG.filter((card) =>
    `${card.issuer} ${card.name}`.toLowerCase().includes(q),
  );
}
