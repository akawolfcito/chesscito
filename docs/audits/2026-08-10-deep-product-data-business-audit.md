# Chesscito — Deep Product / Data / Business Audit

**Date:** 2026-08-10 · **Method:** 7 independent read-only investigators (Product, Code,
Data/Supabase, UX/Retention, Monetization, Pedagogy, Red-Team), each with an evidence ledger,
followed by an adversarial cross-review. **Nothing in production, Supabase, or on-chain was
modified.** Every load-bearing claim traces to code (`file:line`), a live SELECT against prod, or a
fresh on-chain scan — not to documentation, which drifted (see §Drift).

Agent ledgers (full evidence): `scratchpad/agent-{a-product,b-code,c-data,d-retention,e-monetization,f-pedagogy,g-redteam}.md`.

---

## 0. TL;DR — the one consequential finding

Chesscito does not have a content problem, a monetization problem, or a conversion problem. **It has
one problem, measured three independent ways: almost nobody comes back on Day 1 (≈2.6%), and the
failure is motivational, not mechanical.** Every other issue in this report is either downstream of
that, or a latent risk that only matters once Day-2 exists.

The evidence overturned two beliefs the team was operating on:

1. **"Nobody buys the expensive stuff / 0 pack sales" is false.** The revenue tool only decoded the
   Shop contract; packs, Season Pass and PRO are paid on a *different* rail (direct ERC-20 transfer)
   that the tool cannot see. Packs (8), Season Pass (13–19), and PRO (6–7) all sold. ~26 wallets
   paid real money; conversion among people who *reached* an offer is excellent. *(Agent E, Agent C
   §6)*
2. **"The daily quota wall (5 or 10) stops players" is false.** The production save limit is **100**;
   fewer than 10 wallets in the product's entire history ever reached it. No wall stops anyone.
   *(Agent C §D-1)*

---

## 1. What Chesscito really is today

**Observed, not aspirational.** Chesscito is a **six-piece chess-movement trainer** delivered as a
MiniPay mini-app. Lane 1 (59 exercises, all 177 counting stars, the entire ranking economy) teaches
**where the pieces go and how to route around friendly blockers** — movement geometry, taught well
for rook and bishop, repetitively for knight/king/queen. It is *not* yet a chess teacher (no
coordinates by design, no material value, no check, capturing only with the pawn) and *not* yet the
"daily focus ritual" the copy claims — the ritual half (Daily Tactic, Focus Days) is real
infrastructure with **15 rows of usage**. *(Agents A, F, C §8.4)*

It ships as **three deployments of one codebase** selected by a build-time env var
(`full` internal / `learn` / `play`), on **separate origins** with **non-shared localStorage**. The
Hub is a launcher; `/exercises` (a 4,652-line component) is the actual product. *(Agent A C0.1–C0.3)*

**Three surfaces tell three incompatible stories** about what it is: the live onboarding carousel
says the two modes are a free reversible choice; `/classic` says full chess is *earned* at the end of
a 5-rung ladder (one rung of which the direction doc forbids building); `/why` is a third framing in
Spanish. *(Agent A C1.1–C1.3)*

## 2. What users actually do (defensible evidence)

Cohort = 6,961 MiniPay installs, listing day 2026-08-03 → 08-09. *(Agent C, live prod)*

- **97.4% reach the hub → 89.2% finish the tour → then it collapses.** Only **36.9% ever complete
  anything at all.** By surface: PLAY installs go to the Arena (60%) and complete a puzzle 6.7% of
  the time; LEARN installs complete at 26.7%.
- **D1 return = 2.24% (install), 2.61% (wallet, wipe-proof). Ever-return ≈ 4%.** 96% one-and-done
  across three independent identifiers. Median install lifetime **42 seconds**; 55.9% under a minute.
- **The tutorial is the cliff.** 910 installs (13%) finished the onboarding tour and emitted nothing
  further; ~27% never got past the shell. **84% of accounts complete zero exercises on day 0.**
- **The 10% who do play, go deep and still leave.** Median 9 attempts / 5 distinct exercises on day
  0, and 40% play >10 — then don't return. No wall stops them.
- **Everyone plays the rook and stops.** All 532 playing wallets touched level 1; 13% reached level
  2; **1.9% reached level 6.** The content ceiling was never the constraint — the floor is.
- **Money demand is real and blocked at funding.** 806 installs tapped Purchase → "insufficient
  balance"; 645 tapped through to MiniPay top-up; **26 wallets ever paid (~$38 lifetime).** The gap
  is the wallet-funding round-trip, not the offer.
- **Signing eats ~40% of would-be savers.** 210 installs rejected a signature prompt; only 585 of
  1,256 issued write-sessions were ever authorized.
- **Traffic was a firehose into a bucket with no bottom.** 94% install decay in 6 days; DAU ≈ new
  installs. Geo: Nigeria 2,555; **Netherlands 1,227 is not credible as organic** (VPN/datacenter
  egress) and its derivation is untraced.

## 3. The biggest product problem (one)

**There is no Day-2.** Decomposed, each layer verified:

1. **The product cannot call the player back.** Zero push, zero service worker, zero email. The only
   built nudge is an in-app screen, **off by default**, and its logic early-returns for anyone who
   solved the Daily first — so it can only fire for someone who already returned. *(Agents D L1, G,
   B §8D)*
2. **The product cannot give the player back what they did.** Streak, Focus Passport, per-exercise
   progress live **only in localStorage**; the wallet — the free asset the channel hands you —
   returns a per-piece number, and `getProfileStats` returns hardcoded zeros. No cross-device
   restore. *(Agents B 4.1, D L2, G Tesis 11)*
3. **The success moment is a receipt, not an invitation.** The post-solve screen names stars, lesson,
   and *session* combo — never the daily streak, never tomorrow, never what's one solve away. The
   session-end state is a non-tappable "Come back tomorrow" band. *(Agent D L4, L5)*

The streak — the only mechanic here with loss aversion — is **invisible on Day 0** (the victory pill
is the session combo, not the streak) and reaches day 2 for **3.2% of starters**. The 21-day frame is
**entitlement-gated**: a free player looks at a "21-Day Challenge" card that never counts to 21.
*(Agents D L7, A C5.1)*

## 4. The strongest latent opportunity (one)

**The best pedagogy in the product is 6 levels long and last in line.** "A piece controls squares it
does not occupy" — the hinge between *knowing how a rook moves* and *any* chess thought — is already
built (`attackedSquares`), already has a failure/rescue loop (Safe Path), and has the best-authored
copy in the game. It sits behind piece six, a star gate, and a lane gate, in a product where 87% of
players never reach piece two. Bringing the control/threat layer **forward into piece one, and
letting lane 1 fail**, costs authoring, not engineering, and converts "a game about where pieces go"
into "a game about deciding under threat" — the thesis the product already claims. *(Agent F, S5 + T1)*

## 5. The strongest monetization opportunity (one — or none yet)

**None yet — with one free exception.** Conversion is already ~excellent among people who reach an
offer; infra is roughly at break-even (~$71/mo run-rate floor vs ~$55/mo fixed cost) with **~$0
marginal cost per user**; the binding constraint is a retention multiplier of ~2.6%. Doubling ARPU
doubles a rounding error. *(Agent E §3, §4)*

The free exception is a **distribution bug, not a price**: **PRO ($1.99, the highest-ticket product)
has no point of sale in LEARN** — it is gated off in three places and only sellable in PLAY. The
mode MiniPay lists cannot buy the flagship product. And the revenue instrument itself is broken (33%
low, believed exact); fix measurement before optimizing against it. *(Agent E M1)*

If one mechanism had to carry survival, it is the **victory mint** ($0.01–0.03, post-value, proven
≥222×) — but that is a survival mechanism, not a business, and it depends entirely on retention it
does not create.

## 6. What we should NOT build

- **Do not paywall more content.** 2 of 78 levels are paid; the one paywall in the funnel
  (`knight-tour-2/3`) cut 100% of the 10 wallets that reached it and converted 0. *(Agents G, E, F)*
- **Do not sell streak insurance / streak recovery.** Permanently forbidden and correctly so —
  monetizing the failure of the habit you're building. *(Agent E §6)*
- **Do not make Peones tradeable/redeemable/competitive**, and do not build the creator-theme
  marketplace now (2 slots exist; the bottleneck was always art, not code). *(Agent E M5, §6)*
- **Do not sell rank.** Score is client-supplied and bounded 10× above the real ceiling; selling rank
  on an unvalidated number sells a lie. *(Agents B 2.1, C §B-2)*
- **Do not build the P2P duel / spectator-gift economy yet** — three specs, zero product code, and it
  targets a Day-5 layer the product hasn't earned. *(Agents A C6.5, E §6)*
- **Do not treat the 84%-onboarding-cliff fix as a substitute for the Day-2 fix** — it grows the
  numerator of "played once" but funnels into the same broken return. Both are needed; neither
  replaces the other.

## 7–17. The ONE BET (revised after adversarial review — see §Adversarial)

The draft bet was "make the streak the spine." All four critics returned **MODIFY**, convergently,
and the synthesis accepts the modification: the *direction* (attack the Day-0 dead-ends) is right, the
*shape* was wrong. The streak addresses only the 16% who complete an exercise while the metric was
defined over 100% (D); the streak lives in localStorage and cannot carry a promise across a
wallet-WebView wipe (G, B); the nudge shows ≤3 times per lifetime and re-collides with the celebration
pile-up (B). The revised bet:

> **Fix the Day-0 dead-ends for the *engaged* cohort — activate first so the 84% get a first rep,
> then put a truthful forward hook at every app-initiated exit (session-end, the funding top-up
> round-trip, the daily wall). The streak is the reward surface at those moments, never the load-
> bearing promise. Research — do not build — whether MiniPay exposes any re-engagement primitive
> first, because that answer sets the ceiling.**

### Move 0 — Activate (prerequisite, ~free config). *Promoted from runner-up by the review.*
Turn on the already-built, currently-dark `first-activity-experiment` (`onboardingFirstActivityRolloutPct`,
default 0), ramp 10→25→50. It drops a new player straight into the one no-decision activity (today's
Daily) instead of a decision grid — attacking the measured cliff where **84% complete zero exercises
and 910 installs finish the tour and bounce**. Nothing downstream is reachable until this grows the
addressable base past 16%.

### Move 1 — The truthful forward hook (the bet; smallest shippable = copy + destination change).
Replace the "Come back tomorrow" status band **and** add a return hook to the two other
app-initiated exits — the **645 users the app itself ejected** to MiniPay top-up with no way back
(E), and the session-end banner. Each hook is **true by construction** (reuse the `consequence.ts`
honesty rule + `toCtaSlotPresentation`, both shipped): it names what is genuinely scheduled — the
streak now alive, the badge N solves away — only when that is real. **No new state, no storage key,
no migration** (B's honest scope: this is `(1)+(2)`, drop the nudge). The streak is *surfaced* here as
a reward, not relied on as durable truth, so the wipe fingerprint stops mattering.

### Gate, don't build
Resolve the platform unknown **before** committing a channel sprint: does MiniPay expose any
re-engagement primitive (notification/deeplink-back) to listed mini-apps? If yes, that is the real
Day-2 channel and the next bet. If no, this bet is Day-0-only and its ceiling is lower — itself a
finding. Do not put "build push" inside this bet; it is the push-notification question in a small hat.

### Explicitly out of scope
Turning the streak nudge on (B: a 3-lifetime-show tutorial that re-collides with the celebration
queue); server-backing the streak (that is the unshipped Slice 3, a quarter — not step 0); any
monetization change; the security fix and curriculum re-authoring (both parallel tracks, §8 and §4).

### The metric that must move
**D1 return among *engaged* wallets** — `account_ref` with ≥1 row in `score_attempts`, excluding
sub-1-minute sessions and the NL block — plus **return-after-any-app-initiated-exit**. *Not* raw-install
D1: the review showed that denominator is dominated by drive-by traffic and makes the bet unfalsifiable.
Target: engaged-D1 from its true baseline (to be measured on the clean cohort) toward a first
doubling. Guardrails: do not depress offer-conversion or the post-victory mint rate; watch the
signing-rejection rate (~40% of savers).

### What would prove this wrong
If engaged-D1 does not move after activation is ramped, the forward hook ships, and (if it exists) a
re-engagement touch is wired, then the one-day pattern is **acquisition-quality**, not product
retention — and the next move is acquisition targeting, not more product. Because the listing firehose
has decayed 94%, a fresh test cohort may have to be *bought* to run this cleanly (G's caveat).

### Prioritized backlog (condensed)
| # | Move | Class | Why |
|---|---|---|---|
| 1 | Streak-as-spine + nudge on (THE BET) | DO NOW | attacks the only measured constraint |
| 2 | Turn on `first-activity-experiment` (ramp 10→25→50) | DO NOW | free; attacks the 84% cliff |
| 3 | Fix `peones_spend` auth (required capability arg) | DO NOW | **P0 security**, §8 |
| 4 | Sell PRO in LEARN (or decide never) | DO NOW | flagship invisible to its audience |
| 5 | Fix the revenue instrument (rail + log-loss) | DO NOW | decisions on 33%-low numbers |
| 6 | Move control/threat layer into piece 1; let lane 1 fail | DO NEXT | the latent opportunity |
| 7 | Tighten score validator to per-level ceiling | DO NEXT | one forged MAX is permanent |
| 8 | Fix `pawn-3` + linter tag family | DO NEXT | intro-to-capture lies to the player |
| 9 | Server-back the streak on the wallet | LATER | makes the bet durable cross-device |
| 10 | P2P duel / themes marketplace / more paywalls | DO NOT (now) | §6 |

---

## 8. Security escalation (P0 — surface immediately)

**`/api/peones/spend` lets a third party drain any player's Peones balance.** The HTTP route is
unauthenticated (no signature, no bearer, no session) and takes the debited `wallet` from the request
body; its only gate is `enforceOrigin`, which by its own comment passes any caller omitting `Origin`
and `Referer`. The SQL `peones_spend` performs **no caller authorization** (idempotency + balance +
`FOR UPDATE` only). *(Agents B 3.2b/3.4, C §B-3)*

**Severity refinement (Agent C):** direct anonymous abuse via PostgREST is blocked by RLS
(`WITH CHECK false`), so this is not "anyone on the internet." The live exposure is the **server
route holding the `service_role` key, which bypasses RLS entirely** — behind that key the DB offers
zero defense in depth. The fix is the shape the score path already uses: a **required capability
argument** on the grantor (`save_score_attempt` takes `p_token_hash`; `peones_spend` takes nothing),
and narrowing the ACL (anon has no grant on the score functions; it does on peones). This is not a
retention issue but it ships in the same repo and should be fixed in parallel with the bet.

*Non-critical integrity note:* no score inflation exists in prod today (0 rows > 3,000), but a single
forged 30,000 would be permanent under the MAX aggregate — cheap to prevent, expensive to unwind.

---

## 9. Three things the creator may not realize

1. **The "expensive stuff never sells" narrative was an instrument artifact, and it was steering
   strategy.** `onchain-revenue.mjs` decodes only Shop `ItemPurchased`; the packs/Pass/PRO rail emits
   plain ERC-20 transfers it cannot see, *and* public-RPC `getLogs` silently drops ~33% of events
   under concurrency while reporting a clean count. The team believed a number that was low and
   believed it was exact. Fix the instrument before optimizing against it. *(Agent E E0.1–E0.2)*
2. **The players who love it and the players who pay barely overlap the players who could be
   retained — because the heaviest users split into two non-overlapping tribes.** ~130 installs (10%)
   generate 47.6% of completions, and they cleave cleanly into Arena grinders (50+ games, 0 puzzles)
   and puzzle grinders (100+ completions, 0 arena). PLAY and LEARN behave like different products
   sharing a wordmark, on separate origins with non-shared state. You are running two games and
   averaging their metrics. *(Agents C §1.2/§5, A C0.2)*
3. **The PLAY weekly leaderboard is structurally empty forever and the all-time board is one score
   row away from silently merging two products.** `weekly_ranking()` reads `score_attempts WHERE
   surface = p_surface`, and Arena never writes a `score_attempts` row — so `play` weekly can never
   produce output. Meanwhile `leaderboard_full_v` applies *no* surface filter; it's Learn-only today
   only because Play persists no score. The first Play score row merges both into one ranking with no
   code change, and the weekly path (which does filter) would then disagree with all-time about who's
   winning. *(Agent C §8.2, §B-1)*

## 10. The question you are not asking

**"Is the Day-1 cliff a retention failure, or is a large fraction of my 6,900 installs acquisition
junk I should never have counted?"**

It matters because it changes what to build. The evidence is genuinely mixed and points both ways at
once: the 10% who go deep (median 9 attempts) are unmistakably real players who unmistakably did not
return — that is a retention failure no acquisition change fixes. But 55.9% sub-minute sessions, a
non-credible NL=1,227 geo, a 94%-in-6-days decay, and DAU≈new-installs are the fingerprint of
directory drive-by traffic that was never going to convert. **Both are true**, which means the single
number "D1 = 2.6% of installs" is answering two questions at once and mis-serving both.

**The answer, actionably:** stop measuring retention on raw installs. Measure it on the
**played-≥1-exercise cohort** (the ~37% who reached a value moment), and instrument acquisition source
(even a URL param on the listing — none exists today). Do that, and the ONE BET becomes falsifiable in
practice instead of in theory. **What would change this answer:** an acquisition-source attribution
showing the deep-10% and the sub-minute-55% come from the same channel (pure retention story) vs.
different channels (mixed story requiring a targeting fix too).

---

## Documentation drift found (do not trust these docs as-is)
- Direction doc (2026-07-13, still "DIRECTRIZ VIGENTE") cites Peones cap 6 (real: 3) and shield cost
  2 (real: 5); its economy hypothesis was written against numbers Economy V1 already changed.
- A telemetry literal reports `requested: 3` where the code earns 1.
- ~6 module headers describe the live Peones economy as "DORMANT / no consumer yet."
- `session-quota.ts` advertises a B2.3b paid-unlock that never shipped (`paidUnlocked` is dev-only).
- `sync_state` (the on-chain indexer cursor) has been stale since April; `victories`/`scores` are not
  verified chain mirrors.

## Payer-count reconciliation (raised in review by Agent E)
Two payer numbers looked contradictory and are not. **26** (Agent C) counts the *high-ticket rail*
all-time — `treasury_payment_consumptions`: PRO + Season Pass + Peones packs. **≥164** (Agent E)
counts distinct wallets that sent *any* on-chain payment since the listing, which **includes the
$0.01–0.03 victory mints** (198 mint-payers all-time in `victories`). Both are correct; they measure
different things. Consequence for the bet: **"demand is blocked at funding" is overstated** — 164+
wallets *did* fund and pay. The 806 "insufficient balance" taps are real friction sitting *alongside*
a real paying population, not instead of one. Fold the 645 top-up ejections into the retention bet as
a dead-end to close, not into a monetization bet.

## Adversarial cross-review — verdicts

All four critics returned **MODIFY**; none KEEP or REJECT. The convergence is the signal.

- **Agent D (retention):** *MODIFY, reorder to activation.* Three of the four draft items require a
  completed exercise, so the bet's addressable population is 16% of arrivals while the metric was
  defined over 100%. A streak amplifies an existing habit; it cannot manufacture the first rep. Make
  activation the spine; earn the streak bet on a real activation base.
- **Agent G (red-team):** *MODIFY.* Sequencing was backwards (the only true Day-2 channel, #4, was
  last as research); the streak is a localStorage value that cannot keep its promise across eviction;
  and with 55.9% sub-minute installs + NL infra + firehose decay the falsifier cannot fire against a
  raw-install denominator. Gate on #4; redefine the metric over engaged wallets.
- **Agent E (monetization):** *MODIFY.* Reconcile 26-vs-164 first (done, above); the largest
  *instrumented* dead-end is the 645 users the app ejected to top-up, a retention defect in a payments
  costume. Funding is not the higher-leverage bet (you cannot price-solve a $0 wallet). Keep retention
  as the bet; make the funding round-trip its primary dead-end; measure return after any app-initiated
  exit.
- **Agent B (engineering):** *MODIFY.* Drop step 3 — the nudge shows ≤3×/lifetime and re-collides with
  the celebration pile-up; its `dailySolvedToday` early-return is deliberate, not a bug. Do **not**
  server-back the streak as step 0 (that is the unshipped Slice 3). Keep the streak as reward surface,
  make the forward hook the spine (no durable state → wipe stops mattering). Honest smallest-shippable
  is (1)+(2): copy + destination change via the mounted `DailyLimitBanner` and existing
  `toCtaSlotPresentation` — no new state, no migration.

**Synthesis decision: MODIFY (accepted).** Direction kept, shape changed — activation promoted into
the bet as Move 0, the forward hook (not the streak, not the nudge) as the load-bearing Move 1, the
MiniPay re-engagement primitive resolved as research-first, and the metric redefined over the engaged
cohort. The revised bet in §7 reflects all four verdicts. No critic argued the constraint was anything
other than Day-2 return, which is the finding that matters.

## Next investigation (immediately after the bet)
1. **Measure engaged-D1 on the clean cohort** (≥1 `score_attempts` row, minus sub-1-min + NL) to set
   the real baseline the bet moves against.
2. **Answer the platform question:** does MiniPay give listed mini-apps any re-engagement primitive?
   This single fact decides whether a Day-2 *channel* is even buildable.
3. **Instrument acquisition source** (a listing URL param) so retention can be read per channel and the
   acquisition-quality-vs-retention-failure ambiguity (§10) finally resolves.
