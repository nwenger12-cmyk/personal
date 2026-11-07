# Sportsbook Promo Playbook: Concepts, Mission and Method

A briefing for an agent reviewing or taking over this project. **Live balances, open bets and promo inventory are in `matched-betting-handoff.md`**; this document explains the *why* and *how*.

---

## 1. Mission
Turn sportsbook and pick'em sign-up offers and recurring promotions into the **largest possible cash profit**, with the constraint that the user **must never finish below their total deposits**.

**User:** 21, Virginia resident, legally verified on every app. Wants plain-English, step-by-step instructions with exact bets in tables. Willing to deposit more than $500 extra as working capital. Checks apps daily.

**Success means:**
1. Every available promo is used before it expires.
2. Final profit is about **+$1,400–1,650** (current projection; see the handoff scoreboard).
3. Zero chance of a net loss of principal.
4. Accurate records for tax time.

---

## 2. Core concepts

### Matched betting (not arbitrage)
- **Arbitrage:** profit from price disagreements between books with no promos. Edges of 1–3%, rare, quickly limited.
- **Matched betting:** the **promo is the edge**. Bets are hedged across different apps so the outcome is fixed whichever team wins, which converts bonus value into cash. Virginia has no betting exchange, so the "lay" is a back bet on the opposite outcome at a second book.

### Expected value (EV)
EV = Σ (probability × payoff). Normal bets carry a house edge, so EV < 0. Promos flip the sign. Use **no-vig market probabilities** (remove the margin from both sides of a market) to estimate *p*.

### Variance and hedging
Opposite sides of one game are perfectly negatively correlated, so sizing them to equal outcomes drives variance to about 0. Hedging costs a little EV (both books' margin). It's worth paying when cash is at risk, and not worth paying on free bets that can't lose cash.

### Law of large numbers
About 50+ independent promos per month means realized profit converges toward total EV. A single night is noisy; the campaign as a whole is predictable.

### Pace (luck check)
**Pace = realized profit − EV of settled promos.** Within about ±$100 is normal noise. Below −$150, flag it and switch cash-risk promos back to fully hedged until it recovers.

### Cushion rule (risk-of-ruin constraint)
The sum of worst-case losses on **open unhedged cash bets** must be ≤ **profit already banked**. This keeps P(finish below deposits) ≈ 0.

---

## 3. Promo types and how to play each

Notation: S = stake, B = decimal odds on the promo side, H = decimal odds on the hedge side, x = hedge stake, c = cash value of a bonus bet (use 0.70), R = refund amount.

| Promo type | Default play | Hedged formula | Typical value |
|---|---|---|---|
| **Qualifying bet** (cash both sides) | Short, close odds (−110 to −200) | x = S·B / H | Costs about 2–5% of stake |
| **Bonus bet / FanCash / bonus entry** (stake not returned) | **Unhedged on +300 to +600** | x = S·(B−1) / H | Hedged about 60–67%; unhedged EV about 75–85% |
| **No-sweat / second chance** (loss refunded as a bonus) | Underdog +200 to +350; unhedged within the cushion | x = (S·B − c·R) / H | About 35–48% of stake |
| **Two no-sweats on opposite sides** | Near-even game (+100/−120) | Solve so both outcomes are equal, counting each refund at c | About $25–60 per pair; little cash needed |
| **Profit boost** (k% more winnings) | Underdog +150 to +250, unhedged within the cushion | B′ = 1 + (1+k)(B−1), then the qualifying formula | 100% boost on $25 ≈ +$14 |
| **Odds-tiered welcome** (e.g., Bally: +500 or longer, wins → $500 bonus) | Minimum stake at the top tier, unhedged | n/a | +$55 on $10 |
| **Bet & Get** (wager $X, get a bonus) | Put the required cash wager on the opposite side of another promo bet | n/a | About +$18 per $25 |
| **Pick'em no-sweat** (Betr, Underdog) | 3-pick "Perfect"; only legs a sportsbook prices at −130 or stronger; **legs uncorrelated (different games, or unrelated stats)** | n/a | About +$20–35 per $50 |

**Generally skip:** parlay boosts on 5+ leg same-game parlays (the house edge is larger than the boost), deposit-match offers with heavy playthrough, and boosts worth under about $3 that need extra deposits.

---

## 4. Cross-app optimization (required: never plan one promo in isolation)
Each day:
1. **Inventory** every live promo across all apps, with its expiry and the app's cash.
2. **Spend the soonest-expiring first:** 24h items (Fanatics FanCash, Underdog entries, BetMGM token) → same-day (Hard Rock token by 11:59pm) → 7-day bonuses → long-dated boosts.
3. **Pair promos against each other** (no-sweat vs no-sweat, boost vs required cash wager) so one bet does double duty.
4. **Diversify:** each unhedged promo goes on a **different game and team**. Never stack several promos on one underdog.
5. **Avoid opposite sides of a game at the same app** (bet365 explicitly bans it, and others flag it).
6. **Route cash:** deposit only each app's shortfall for the day's tokens; withdraw from apps whose promos are finished.
7. **Check the cushion and pace** before adding unhedged cash risk.

---

## 5. Daily operating procedure
1. **Morning:** collect screenshots of balances, new bonuses and refunds from every app, plus odds from 2–3 apps.
2. **Claim:** log in to BetMGM (daily token), opt in to Fanatics FanCash, check for the Hard Rock token and the Underdog entry.
3. **Plan:** build the cross-app lineup (Section 4) as a table: App | Game | Market | Stake & promo | Payout. Show each outcome's result and the day's worst case.
4. **Verify each slip before placing:**
   - The correct promo/token is toggled **on**, or every bonus is toggled **off** when cash is required (a bonus-bet slip has already been placed by mistake once).
   - Odds meet the promo minimum.
   - It's a straight moneyline unless stated otherwise.
5. **Place promo-side bets first, then hedges immediately**, before odds move.
6. **Never Cash Out.** Let everything settle.
7. **Evening:** reconcile settled results against expected values, update the scoreboard (real money in, banked profit, pace, pending EV, projected finish) and the handoff file.

---

## 6. Hard rules
- Only moneylines or simple props; no long parlays. Odds beyond about +600 are avoided, which also keeps W-2G's 300× test out of reach.
- Avoid NFL spreads on key numbers (pushes can void qualifiers).
- Read each offer's terms before the **first bet at a new app**, since that bet usually triggers the welcome offer.
- Use full-dollar stakes and popular markets to look like a normal customer and reduce limiting. **The user declined deliberate "noise" (non-promo) bets; don't add them.**
- **Never fabricate balances.** When something doesn't reconcile, ask the user.
- Excluded apps: **BetRivers** (user ruled it out) and **Sporttrade** (out of business). Don't suggest them. No online casino (not legal in VA).

---

## 7. Taxes and compliance
**User profile:** accounting/CPA-track student; expects to take the **standard deduction** for 2026. Keep tax-grade records.

- **W-2G (sports wager):** issued only if winnings (payout less stake) ≥ **$2,000** (from 2026, under the 2025 law; $600 before) **and** ≥ **300×** the stake. The $5,000 figure is the withholding/poker-tournament threshold, not the sports reporting threshold. No bet here comes close to 300×.
- **No W-2G ≠ no tax.** All gambling winnings go on Schedule 1 (other income), whether or not reported.
- **Standard deduction ⇒ losses are not deductible.** Taxable income is the **gross winnings** of every winning bet, not net profit. (Itemizers deduct losses on Schedule A up to winnings, and from 2026 only **90%** of losses, per the 2025 law's change to IRC §165(d).)
- **Per-wager vs session:** for sports betting the conservative position is per-wager reporting (each winning bet's profit is a separate winning). The IRS session-netting safe harbor (Notice 2015-21) addresses slots. Track both, and file per-wager unless a preparer approves otherwise.
- **Virginia** taxes winnings as ordinary income.
- **The tax consequence for strategy (standard deduction):** every hedge creates a taxable winning leg plus a non-deductible losing leg. So:
  - Prefer **free-bet conversions** (no losing cash leg) and **minimal hedge sizes**.
  - Avoid unnecessary qualifying hedges and churn. A $100 vs $100 qualifier at −110 makes about $91 of taxable winnings for about a −$9 result.
  - Track **gross winnings** as its own running total next to net profit.
- **Possible $0 federal tax:** if the user's total 2026 income (wages + gross winnings) stays under the standard deduction (about $16,000 single), federal tax may be $0. State tax differs. Confirm with the user's income picture.
- **Records:** export each app's year-end win/loss statement, and keep the per-bet log (the Card Hub "Betting" tab already computes gross winnings, net, and taxable under standard vs itemized).

## 8. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Account limits or closure | Spread volume, round stakes, mainstream markets, no same-app two-sided bets |
| Missed expiries | Daily claim routine; reminders in chat (user declined calendar reminders) |
| Wrong toggle on a slip | Verification step before every bet |
| Bad-luck streak with unhedged EV | Cushion rule; hedge when pace < −$150 |
| Withdrawal friction | Complete ID verification early; withdraw to the original deposit method |
| Bank flags | Fund through Venmo, PayPal, the EDGE Boost card or Trustly; keep it on one account |
| Tax surprise | Track gross winnings; set aside funds |

---

## 9. Where things stand (summary; see the handoff for detail)
- Apps: BetMGM, DraftKings, Fanatics, Hard Rock, bet365, Caesars, theScore Bet, Betr, Bally Bet, Underdog.
- Real money in: **$691.83**. Banked profit: **+$187.03**. Pace: about −$2 (on track).
- About $1,135 of promo EV remaining; projected finish **+$1,390–1,640**.

---

## 10. External review notes (Nov 7)
Accepted: keep pick'em legs uncorrelated; re-check hedge-book odds right before submitting; aim for at least 70–75% conversion on larger bonus bets.
Rejected (incorrect):
- "W-2G threshold is $5,000 for 2026." Wrong; it's $2,000 (with the 300× test).
- "Verify the 90% loss rule." The rule is real (2025 law, effective 2026).
- "Expected Return = Stake × B/H." Wrong for bonus bets (stake not returned); the correct hedged value is Stake × (B−1)/H.
Declined by the user: noise bets.

## 11. Reviewer checklist
- [ ] Is every hedge sized so that both outcomes are about equal (or deliberately unhedged within the cushion)?
- [ ] Are free bets placed at +300 to +600 rather than short odds?
- [ ] Are promos diversified across games, with no same-app two-sided bets?
- [ ] Is the soonest-expiring promo always used first?
- [ ] Does the cushion rule hold right now?
- [ ] Do the scoreboard numbers reconcile with deposit histories and settled bets?
- [ ] Are tax implications explained correctly (gross winnings, 90% loss cap, W-2G thresholds)?
- [ ] Are any recommendations based on assumed rather than confirmed terms? Flag them.
