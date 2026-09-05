/**
 * The line output of a real Chase statement, with the amounts, merchants and
 * account number replaced. The SHAPE is what matters and is reproduced exactly:
 * the multi-column marketing text that precedes the table, the section
 * headings, the two-line column header, the MM/DD rows with no year, and the
 * summary block the parse gets checked against.
 */
export const CHASE_STATEMENT_LINES: string[] = [
  'Manage your account online at: Customer Service:',
  '1-800-524-3880',
  'www.chase.com/cardhelp',
  'New Balance',
  'September 2026',
  'CHASE FREEDOM: ULTIMATE',
  '$120.00',
  'REWARDS® SUMMARY',
  'Previous points balance 368',
  'Late Payment Warning: If we do not receive your minimum payment',
  'ACCOUNT ACCOUNT SUMMARY SUMMARY',
  'Account Number: 4147 2020 3030 4321',
  'Previous Balance $7.41',
  'Payment, Credits -$50.00',
  'Purchases +$162.59',
  'Cash Advances $0.00',
  'Balance Transfers $0.00',
  'Fees Charged $0.00',
  'Interest Charged $0.00',
  'New Balance $120.00',
  'Opening/Closing Date 07/29/26 - 08/28/26',
  'Credit Access Line $12,500',
  'Available Credit $12,380',
  'Payment Due Date: 09/25/26',
  'ACCOUNT ACCOUNT ACTIVITY ACTIVITY',
  'Date of',
  'Transaction',
  'Merchant Name or Transaction Description $ Amount',
  'PAYMENTS AND OTHER CREDITS',
  '08/25 AUTOMATIC PAYMENT - THANK YOU -30.00',
  '08/20 STORE REFUND THANK YOU AZ -20.00',
  'PURCHASE',
  '08/05 CORNER MARKET 0033 508-270-1400 PA 45.61',
  '08/18 COFFEE MOBILE 800-447-0013 MA 10.00',
  '08/19 COFFEE MOBILE 800-447-0013 MA 10.00',
  '08/21 PP*STREAMING*P45E366973 203-318-9708 NY 7.41',
  '08/27 HARDWARE SUPPLY CO 888-000-1111 MA 89.57',
  '2026 Totals Year-to-Date',
  'Total fees charged in 2026 $0.00',
  'Total interest charged in 2026 $0.00',
  'INTEREST CHARGES',
  'Your Annual Percentage Rate (APR) is the annual interest rate on your account.',
  'Purchases 27.49%(v)(d) - 0 - - 0 -',
  '31 Days in Billing Period',
];

/** The same statement closing in January, to exercise the year rollover. */
export const JANUARY_STATEMENT_LINES: string[] = [
  'www.chase.com/cardhelp',
  'Account Number: 4147 2020 3030 4321',
  'Payment, Credits -$0.00',
  'Purchases +$150.00',
  'Opening/Closing Date 12/16/26 - 01/15/27',
  'ACCOUNT ACTIVITY',
  'PURCHASE',
  '12/28 DECEMBER PURCHASE 100.00',
  '01/04 JANUARY PURCHASE 50.00',
];
