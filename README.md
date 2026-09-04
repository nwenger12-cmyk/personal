# Card Hub

A personal dashboard for the three things about a credit card that cost real
money if you forget them:

- **Annual fees** — when each one posts, and how long you have left to decide
  whether to keep, downgrade, or cancel before it does.
- **Sign-up bonuses** — how much spend is left, how many days remain, and the
  dollars-per-day you have to keep spending to finish in time.
- **Points** — what each balance is actually worth, priced every way you can
  redeem it.

Plus a **Chase 5/24 counter** computed from your own card list, since that is
the constraint that decides what you can apply for next.

Everything lives in your browser. There is no server, no account, and nothing
is sent anywhere.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build && npm run start   # production
npm test                          # the date, fee, bonus, 5/24 and CSV math
```

No environment variables, no database, no API keys. It deploys to Vercel (or
any static Next.js host) as-is.

## Why you type the cards in

The obvious ask is "connect my accounts and figure it out." It is worth being
precise about why that is not what this does.

Bank aggregators like Plaid can read **balances and transactions**. They cannot
read the three things this dashboard is built around:

| What you want | Can an aggregator get it? |
|---|---|
| When your annual fee posts | No — not exposed by any issuer |
| Your sign-up bonus terms and progress | No — lives on the offer, not the account |
| Your points balance | No — no issuer offers a points API |
| Your transactions | Yes |

The services that *do* show points balances (AwardWallet and similar) work by
storing your actual card logins and signing in as you. That is a real security
trade, and not one worth making to avoid typing an open date once.

So the design is: **type the card once, derive everything after.** Pick the
product from the built-in catalog and the annual fee, rewards program, and
typical bonus window are filled in for you — you supply the open date, and the
fee schedule, 5/24 count, and bonus deadlines all follow from it.

Transactions are the one piece that genuinely helps, because totalling them is
how bonus progress gets tracked. So the Bonuses tab **imports the CSV your
issuer already lets you download** — no credentials involved. It handles the
Chase, Capital One, Citi, Discover, and Amex export formats, works out which
sign means a purchase, excludes payments, and subtracts refunds the way an
issuer does. Nothing is applied until you have seen the total and the date
range it matched.

## How the numbers are worked out

**Annual fees.** A fee posts on the statement containing your account
anniversary, so the anniversary of the open date is the date to plan around —
give or take a cycle. That is why the dashboard leads with *review by* rather
than the charge date: you want to have decided before it posts, because issuers
generally refund a fee only within about 30 days of the charge. Record a real
charge from a statement and that cycle stops being predicted.

First-year-waived cards start at the one-year anniversary. Authorized-user
cards are excluded from fee totals — the fee is on whoever owns the account.

**Bonus pace.** A raw percentage is not enough: 60% is comfortable with two
months left and a lost bonus with nine days left. Every status is computed
against the time remaining, and the progress bar carries a marker showing where
even spending would have put you by now. Being behind that line is what
actually predicts a miss.

**5/24.** Counts personal cards opened anywhere in the last 24 months, plus
business cards from the issuers that report them to the personal bureaus
(Capital One and Discover — Chase, Citi, and Amex business cards stay off your
personal report). Authorized-user cards are counted but reported separately,
since Chase will sometimes discount them if you ask. Each card's fall-off date
is shown, so you can see when a slot opens up.

Other issuer rules (Capital One's six-month spacing, Citi's 1/8 and 2/65, Amex
once-per-lifetime) are included as reference text rather than logic. Only 5/24
is computed, because only 5/24 follows honestly from your own card list.

**Points valuations.** Fixed rates — cash back, a travel portal multiplier —
are what the issuer publishes. Transfer-partner rates are marked as *estimates*
because what a point is worth depends entirely on the award you book. Every
rate is editable in Settings; replace them with what you actually get.

## A caution on the card catalog

The catalog is a **typing shortcut, not a source of truth.** Annual fees change,
and several issuers repriced their premium cards recently. Values were reviewed
in early 2026 and are copied onto your card exactly once — editing a card never
reaches back into the catalog. Confirm the fee against your own statement.

## Your data

One key in `localStorage`, never transmitted. That means:

- Clearing site data deletes it.
- It does not follow you to another device or browser.
- A private window will not keep it.

**Export a copy from Settings.** Import takes it back, on any device.

The trade is deliberate: this file describes the shape of your wallet — which
cards, opened when, with what limits — which is exactly the material an
account-takeover attempt is built from. There is no server to breach because
there is no server.

## Layout

```
app/          dashboard, cards, bonuses, points, settings
components/   UI primitives + the card editor, timeline, CSV import
lib/
  dates.ts    UTC date math -- an open date is a calendar fact, not an instant
  fees.ts     annual fee prediction and review windows
  bonuses.ts  spend progress, pace, deadlines
  rules.ts    5/24 and issuer application rules
  csv.ts      issuer transaction imports
  points.ts   balances priced by redemption route
  catalog.ts  card catalog (starting values)
  programs.ts rewards programs and valuations
  storage.ts  localStorage, validation, import/export
tests/        91 tests over the math above
```
