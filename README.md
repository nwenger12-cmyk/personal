# Card Hub

A personal dashboard for the things that cost real money if you forget them:

- **Annual fees** — when each one posts, and how long you have left to decide
  whether to keep, downgrade, or cancel before it does.
- **Sign-up bonuses** — how much spend is left, how many days remain, and the
  dollars-per-day you have to keep spending to finish in time.
- **Points** — what each balance is actually worth, priced every way you can
  redeem it.

- **Spending** — every transaction categorised against the Schedule C line it
  lands on, split by business, and totalled for the tax year.

Plus the things that decide what you can apply for and which card to pull out:
a **Chase 5/24 counter**, **bonus eligibility clocks**, and a **which-card-to-use**
ranking.

Everything lives in your browser. There is no server, no account, and nothing
is sent anywhere.

## Cards

**Which card to use.** Every open card, ranked for a spending category by what
you actually get back per dollar — the multiplier times what a point is worth
in that programme. That comparison is the whole point: 3x Chase points at 1.8c
returns 5.4c per dollar, and 2% cash back returns 2c, and a multiplier alone
cannot tell you that. Type a merchant and it guesses the category. Because the
valuations are yours to edit, so is the ranking.

**Credits and perks, per period.** A monthly credit is not one benefit worth
$180 a year — it is twelve separate ones, each of which vanishes if the month
closes unused. So every period is its own checkbox, the unused total is on the
card, and one about to expire is flagged. Annual, semiannual, quarterly and
monthly periods are all supported.

**Bonus eligibility clocks.** Issuers gate a repeat bonus on when you last
*earned* one, not when you opened or closed the card. Computed from your own
bonus history: the Chase Sapphire pair as one 48-month family, Ink per product,
the Citi ThankYou family, Capital One's Venture line, and Amex once per product
for life. Like 5/24 this is community-documented behaviour, so treat a date as
a prompt to check.

**Retention offers**, logged with what was offered and whether you took it, so
next year's call has last year's number to hand.

**Dormant card warnings.** Issuers close accounts that sit unused, and a closed
card takes its age and its limit with it. A card with no activity in about a
year gets flagged.

## Points

**Expiry.** Transferable currencies mostly do not expire while an account is
open — the real risk is closing your last card in the programme and forfeiting
the lot. Hotel programmes are the opposite: Hyatt, Marriott and IHG expire on
inactivity, and any qualifying transaction resets the clock. Both are tracked,
and they are different warnings. Activity date is kept separately from when you
last *looked* at the balance, because it is activity that resets the clock.

## Reminders

**Calendar export (.ics).** Push notifications need a server, an account and a
device token. A calendar file needs none of those and lands in the calendar you
already check every morning. The export covers annual fees, the decision date
before each one, bonus deadlines, unused credits, and eligibility clocks — each
as an all-day event with a one-day alarm. It is a snapshot, not a subscription,
so re-import after anything that moves a date.

## The interface

Dark by default, one accent, and structure carried by space and hairlines
rather than by boxes inside boxes. Light is available in Settings; "System"
follows the OS.

Colour comes only from semantic tokens defined once in `app/globals.css` —
no literal hex, no `text-white`, nothing that has to be kept in sync by hand.
Exactly one thing decides the theme: the `data-theme` attribute on `<html>`.
`:root` carries the dark palette, so the first paint is dark with no attribute
and no flash, and a stored preference of "system" is resolved to a concrete
`light` or `dark` in JS. There is no `prefers-color-scheme` block, because two
sources of truth is how a theme ends up disagreeing with itself, and no
component branches on theme.

### Motion

Animation uses [Motion](https://motion.dev) (`motion/react`), and all of it
lives in `components/motion.tsx`:

- content fades and rises on mount, lists stagger their rows in
- headline figures count up to their value, driven through a MotionValue so a
  60-frame count is not 60 React re-renders
- progress bars spring to their ratio — the slight overshoot is what makes a
  value feel like it landed
- the active nav item's indicator travels between tabs via `layoutId` rather
  than cross-fading, which is the one place motion actually carries meaning:
  it shows where you came from

Two rules keep it from becoming a liability:

**Everything animates on mount, never on scroll.** A scroll-triggered reveal
leaves content at opacity zero until an intersection fires, so a missed
trigger, a print, or a full-page capture loses it outright. Nothing gates
content on having been seen.

**Every animated component calls `useReducedMotion()`.** The
`prefers-reduced-motion` sweep in `globals.css` is CSS-only and cannot reach
anything JS-driven, so each component degrades to an instant, final-state
render — not to a shorter animation, and never to a missing element. A new
animated component that skips that hook silently opts the app out of an
accessibility behaviour the rest of it honours.

## Keeping it current

The design goal after the first setup is that maintenance is one step a month.

**Drop every statement into Import at once.** Each file is matched to a card by
the account number in its rows (Capital One and Amex put it there) or by the
last four in the download filename (Chase names its export
`Chase7730_Activity….CSV`). One confirm then updates three things at once,
because all three are read off the same transactions:

- **Spending** — new rows only. Anything already imported is skipped by import
  key, including two files that overlap each other in the same run. Payments to
  the card are dropped; refunds come in negative.
- **Bonus progress** — adds itself up from the transactions on that card inside
  the window. There is no second number to keep in step, and no separate import.
- **Annual fees** — a charge described as an annual fee is recorded against the
  card, which rolls its next-fee prediction on to the following year by itself.

The preview shows exactly what each will do before anything is written, and
nothing is committed until you confirm.

**The dashboard tells you what has gone stale.** The failure mode of a tracker
is not wrong arithmetic, it is that you stopped feeding it in July and did not
notice. So the "Needs you" panel leads the dashboard and covers absence as well
as deadlines:

- a card with no imported transactions for over 40 days
- a recurring charge that billed every month for three months and then stopped —
  usually a statement that never got imported
- a card that has never fed spending at all
- transactions waiting for a category
- a points balance nobody has touched in 45 days
- fees inside their review window, and bonuses behind pace or near their deadline

**What still has to be typed.** One thing: points balances. No issuer exposes a
points API, and the services that show balances do it by storing your card
login. Everything else follows from the statements.

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

Progress itself is derived from the transactions imported for that card inside
the window, so it maintains itself. A bonus can be switched to a hand-typed
figure for a card whose statements are not being imported, or when the issuer's
own tally disagrees with the arithmetic. A bonus set to derive with nothing yet
imported falls back to the typed figure and says so, rather than showing a zero
that reads as "no progress".

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

## Spending and tax categorisation

**Categories map to Schedule C lines.** Sorting spend into invented buckets
produces a spreadsheet someone has to re-sort at tax time. Every category here
names the line it prints on, and the summary groups by line, so the total is
one you type straight in. Several categories share line 27a (Other expenses);
those stay separate on screen because the return itemises them in Part V.

**Entities keep businesses apart.** Expenses are attributed to an entity —
LocusStock, another business, personal — and each one gets its own set of
totals, because each business files its own Schedule C. Entities are yours to
name and classify in Settings.

**Deductible percentages.** Most business spend defaults to 100%; the
exceptions carry the statutory limit that catches people out (business meals at
50%). Override it per expense for anything used partly personally — a phone
line, a tank of gas half spent scouting locations.

Two things are always zero in a deductible total, and are zero everywhere
consistently — list view, summary, and both exports:

- anything filed to a **personal** entity, since personal spending is not
  deductible on a business return. Its gross is still tracked so the year is
  complete and the split is visible. If something genuinely belongs to a
  business, file it to a business entity — that choice is what the entity kind
  is for.
- anything still **uncategorised**, so unfiled spend never gets quietly folded
  into a number you copy onto a form. The count and the amount are reported
  next to the totals instead.

**Importing.** The Spending tab takes the same issuer CSVs. Merchant rules file
what they recognise — the built-in set covers Adobe, AWS, Cloudflare, B&H,
Lensrentals, the airlines and the usual subscriptions — and you can add your
own, which are tried first so they override a shipped rule for the same
merchant. Re-importing a statement that overlaps one already loaded skips the
rows it has seen rather than duplicating them. Payments to the card are dropped;
refunds come in negative so they net off the category. Everything a rule
touched still arrives unreviewed: a rule decides where a transaction goes, you
decide whether it was right.

Annual fees you have already recorded against a card can be pulled into the
expense list as bank and card fees in one click, rather than typed twice.

**Mileage log.** Business miles at the standard rate, which the IRS sets and
changes every year — so it is a setting to confirm before filing, not a
constant. The log matters as much as the total: the substantiation rules want
date, miles and business purpose recorded at the time, and a mileage claim
without them is the classic audit loss, so trips missing a purpose are flagged.
You take the standard rate or actual vehicle costs, never both.

**Contractor / 1099 watch.** Pay a contractor $600 or more in a year and a
1099-NEC is likely owed. Contract-labor spend is grouped by vendor and entity
and flagged at the threshold — a prompt to check whether the form falls to you
or to the payment processor, not a filing list.

**Exports.** Two CSVs: the line totals for the return itself, and every
transaction behind them — with gross, percentage, and deductible amount as
separate columns, so whoever signs the return can see the judgement that was
applied and not just its result.

**What this is not.** It is a categorised record of what you spent, not tax
advice and not a filed return. Several categories carry rules a summary cannot
apply for you: mileage needs a contemporaneous log, equipment over the de
minimis threshold gets capitalised rather than expensed, home office runs on
its own form, and a business meal needs the business purpose recorded.

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
app/            dashboard, cards, bonuses, points, import, spending, taxes, settings
components/     UI primitives, motion, the editors, timeline, import center
lib/
  dates.ts      UTC date math -- an open date is a calendar fact, not an instant
  fees.ts       annual fee prediction and review windows
  bonuses.ts    spend progress (derived or pinned), pace, deadlines
  rules.ts      5/24 and issuer application rules
  csv.ts        parsing the shapes issuers actually export
  import.ts     file-to-card matching, fee detection, the one-confirm plan
  attention.ts  what has gone stale, including what has stopped appearing
  points.ts     balances priced by redemption route
  catalog.ts    card catalog (starting values)
  programs.ts   rewards programs and valuations
  categories.ts expense categories mapped to Schedule C lines
  categorize.ts merchant rules for filing imported rows
  expenses.ts   tax-year totals, entity splits, CSV exports
  earning.ts    category multipliers priced in cents per dollar
  perks.ts      recurring credits, tracked per period
  eligibility.ts when each bonus clock runs out
  mileage.ts    the standard-rate mileage log
  vendors.ts    contractors over the 1099 threshold
  calendar.ts   the .ics export
  storage.ts    localStorage, validation, import/export
tests/          231 tests over the math above
```

## Deliberately not built

Comparable apps have these; each was left out for a reason rather than
forgotten.

- **Receipt image storage.** Files would have to live in `localStorage` as
  base64, which blows the quota after a handful of photos and would make the
  export unusable. The receipt field records *where* a receipt lives instead.
- **Splitting one transaction across categories or entities.** Genuinely useful
  and genuinely fiddly; worth doing properly rather than bolting on.
- **Quarterly estimated tax.** Needs income, and this app only tracks spending.
  Half the calculation would be worse than none.
- **Credit score tracking.** Needs a bureau connection, which means credentials.
- **Household / second-player tracking.** The data model assumes one person; it
  would want its own pass.
- **Automatic push notifications.** Needs a server and an account. The calendar
  export is the honest substitute.
