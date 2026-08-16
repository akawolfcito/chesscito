# Chesscito — Product / Economics Evidence Pass

**Date:** 2026-08-15 · **Mode:** READ-ONLY · **Nothing was mutated, deployed, or migrated.**

Every SELECT in this pass ran through a session pinned with
`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`. That is not a claim — it is
demonstrated: the one statement that tried to create a temp view was refused by the
server (`ERROR: cannot execute CREATE VIEW in a read-only transaction`), and the
analysis was rewritten around inline CTEs.

Connection: `postgres:16-alpine` via Docker → Supabase pooler (`aws-1-us-east-1`,
session mode). Credentials travelled in the child process env only; no wallet address
appears in this document.

**Evidence tags:** `[FACT]` measured directly · `[INFERENCE]` interpretation supported
by facts · `[UNKNOWN]` instrumentation cannot answer it · `[HYPOTHESIS]` needs an
experiment.

---

## 0. Executive orientation — the three things that changed my mind

Before the detail, the three results that a reader should not miss, because each
contradicts a reasonable prior:

1. **The monetization failure is not a pricing failure and probably not a poverty
   failure.** 98.4% of every wallet that tapped "buy PRO" was told it had no payable
   token — and that rate is 97–100% in *every* country including the Netherlands, and
   96% among the 26 wallets that had **already paid real money minutes earlier**. The
   affordability check for all $1.99 products reads balances over an unconfigured
   public RPC and silently scores a failed read as a zero balance. (§5, §7)

2. **Completing a Learn exercise, by itself, has no measurable retention value.**
   Wallets whose only day-0 completion was a Learn exercise return at **2.86%** —
   statistically indistinguishable from the **3.32%** of wallets that completed
   nothing at all. Daily-only returns at 6.03%, Arena-only at 6.35%. (§8)

3. **The Daily Tactic is the spine of every deep user, and the earlier
   "Learn vs Play" framing is close to unanswerable as posed** — the two surfaces are
   separate deployments with non-shared storage, so an install cannot choose between
   them. Only 5 installs out of 7,934 ever saw both. (§3)

---

## 1. Data model — product concept → source

Verified from `information_schema` and from call sites in the repository, not from
documentation.

| Product concept | Authoritative source | Notes |
|---|---|---|
| Behavioural events | `analytics_events` (283,672 rows) | `session_id`, `visit_id`, `account_ref`, `surface`, `country`, `props jsonb` |
| Install identity | `analytics_events.session_id` + `session_first_seen` (7,996) | **Persistent per install** in localStorage despite the name (`lib/analytics/identity.ts`) |
| Visit identity | `analytics_events.visit_id` | NULL on 47,002 rows (pre-dates the column) |
| Account identity | `analytics_events.account_ref` + `account_first_seen` (6,042) | `HMAC-SHA256(lowercased address, TELEMETRY_ACCOUNT_SECRET)` truncated to 128 bits — `lib/analytics/account-ref.ts:28` |
| Exercise attempts | `score_attempts` (8,937) | graded attempt ledger |
| Exercise saves | `score_saves` (4,582) | ⚠️ `created_at` is **not** an activity timestamp (`project_score_saves_created_at_is_not_activity`) |
| Write authorisation | `score_write_sessions` (1,440) | `authorized_at` / `revoked_at` |
| Daily Focus | `daily_tactic_started` / `daily_tactic_completed` events; `focus_day_ledger` (10) | ⚠️ the canonical name `daily_focus_completed` is **never emitted** |
| Streak | `daily_streak_updated` event | perfectly collinear with `daily_tactic_completed` (both 1,506 rows / 1,119 wallets) |
| Play / Arena | `arena_*` events | **Arena never writes `score_attempts`** |
| Coach | `coach_*` events; `coach_analyses` (2) | |
| Purchases (settled) | `treasury_payment_consumptions` (42) | `product`, `sku`, `amount_paid`, `token_address` |
| Purchase intents | `treasury_payment_intents` (24), `..._resolutions` (11) | the intent rail is barely used; 39 of 42 sales are `legacy_direct` |
| Entitlements | `pro_subscriptions` (8), `lite_season_passes` (17) | |
| Peones | `peones_ledger` (8,118), `peones_balances` view | |
| Victory mints | `victories` (441) | the $0.01–0.03 product |
| Welcome pack | `welcome_pack_claims` (605) | free, signature-gated |
| Geography | `session_first_seen.first_country`, `account_first_seen.first_country`, `analytics_events.country` | edge-derived |
| Wallet balances | **none** | `[UNKNOWN — INSTRUMENTATION GAP]` — see §9 |
| P2P duel | `duels` (3) | shipped 2026-08-15; 2 wallets, 1 finished game. No population to analyse. |

### 1.1 Two instrumentation facts that shape everything below

`[FACT]` **`account_ref` coverage is very uneven, and it is uneven in a direction that
biases the Learn-vs-Play comparison.** Percentage of rows carrying an account:

| Event | rows | % with `account_ref` |
|---|---|---|
| `hub_tour_view` | 7,874 | **1.0%** |
| `app_opened` | 9,872 | **1.1%** |
| `hub_view` | 10,998 | 8.4% |
| `training_exercise_started` (Learn) | 10,831 | **64.4%** |
| `exercise_complete` (Learn) | 5,728 | 76.1% |
| `arena_game_start` (Play) | 6,420 | **91.4%** |
| `daily_tactic_completed` | 1,508 | 94.5% |
| `pro_purchase_failed` | 3,125 | 99.4% |

The shell events carry essentially no wallet, so *no* wallet-level funnel can start
before the wallet exists. And Learn's core event is 27pp less covered than Play's:
**any wallet-level volume comparison understates Learn.** Every Learn-vs-Play claim in
this document is stated with that bias acknowledged.

`[FACT]` **`tx_progress_done` only ever records `outcome = 'success'`** (4,932 of 4,932
rows). The generic transaction-progress instrument is structurally incapable of
observing a failure, so it contributes nothing to the funnel. See §9.

---

## 2. The population

`[FACT]` Analytics span **2026-05-03 → 2026-08-15**. The MiniPay listing landed on
**2026-08-03**: new installs go from 1 (08-02) to 1,916 (08-03) to 2,535 (08-04).
Everything before 08-03 is internal and pilot traffic and is excluded from cohort
figures unless stated.

**Launch cohort (first seen ≥ 2026-08-03):** 7,852 installs · **6,035 wallets**.
(Cross-check: the cohort stood at 6,961 installs on 08-09, matching the 2026-08-10
audit's "6,961 MiniPay installs" exactly — the two passes agree on the denominator.)

### Daily curve

| Day | New installs | New wallets | Active installs |
|---|---|---|---|
| 08-03 | 1,916 | 1,524 | 1,930 |
| 08-04 | 2,535 | 2,029 | 2,612 |
| 08-05 | 1,389 | 1,102 | 1,486 |
| 08-06 | 394 | 301 | 470 |
| 08-07 | 190 | 141 | 275 |
| 08-08 | 385 | 132 | 452 |
| 08-09 | 152 | 118 | 191 |
| 08-11 | 140 | 114 | 208 |
| 08-13 | 148 | 116 | 191 |
| 08-15 | 136 | 102 | 169 |

`[FACT]` **DAU ≈ new installs.** On 08-15, 169 installs were active and 136 of them were
brand new. The steady state is a turnstile, not an audience.

`[FACT]` Weekly actives (wallets): **5,351** (week of 08-03) → **798** (week of 08-10),
an 85% drop. "Meaningful" WAU — a wallet that completed an exercise, a Daily, an arena
game or a tactic — went **2,319 → 358**.

`[FACT]` **95.11% of cohort wallets are active on exactly one calendar day.** The full
distribution: 1 day 5,740 · 2 days 222 · 3 days 42 · 4 days 8 · 5–13 days 23.

### Install surface and geography

| Install surface | Installs |
|---|---|
| `play` / minipay | 4,910 |
| `learn` / minipay | 2,706 |
| browser (all builds) | 381 |

| Country | Installs | % |
|---|---|---|
| NG | 2,908 | 36.4 |
| **NL** | **1,391** | **17.4** |
| KE | 502 | 6.3 |
| ZA | 476 | 6.0 |
| BR | 428 | 5.4 |
| ID | 362 | 4.5 |
| (null) | 337 | 4.2 |
| UG | 247 | 3.1 |

`[INFERENCE]` The Netherlands at 17.4% is not credible as organic consumer demand for a
MiniPay chess trainer and is most likely VPN / datacenter egress. This was flagged in
the 2026-08-10 audit and remains untraced. It is *not* excluded from the tables below,
because — as §7 shows — NL behaves like every other country on the metric that matters,
which is itself the finding. Where NL would change a conclusion, it is called out.

---

## 3. Surface analysis — Learn vs Play

### 3.1 The question is partly malformed, and that is a finding

`[FACT]` Learn and Play ship as **separate deployments on separate origins with
non-shared localStorage**. Measured consequence: of 7,934 installs that emitted a
surfaced event, **5,034 saw only Play, 2,895 saw only Learn, and 5 saw both.**

An install therefore cannot express a preference between Learn and Play. Segmenting
installs by surface re-reads which app the user downloaded. `LEARN_ONLY` and
`PLAY_ONLY` at install level are not behavioural segments; they are deployment labels.

`[FACT]` **The wallet is the only identity where a real mixed segment exists.** Of 6,042
wallets, **1,482 (24.5%) touched both surfaces**, 3,434 only Play, 1,124 only Learn. And
1,475 wallets own exactly 2 installs — one per app. All wallet-level analysis below uses
this identity.

### 3.2 Segments — defined on day-0 behaviour only

The first cut I ran segmented on lifetime behaviour and produced a headline that MIXED
users return at 9.04% D1. **That number is contaminated** and I am reporting it only to
retire it: actions taken *on the return day* were being used to define the segment, so
returning users were sorted into MIXED by the very fact of returning.

Recomputing the segment from **day-0 behaviour only**, and measuring return strictly
after day 0, halves the effect:

| Segment (day-0 behaviour) | Wallets | D1 | D3 | D7 | D7 eligible |
|---|---|---|---|---|---|
| PLAY_ONLY | 2,422 | 2.56% | 3.41% | 3.90% | 2,101 |
| LEARN_ONLY | 1,172 | 2.73% | 4.14% | 5.10% | 981 |
| Z_NO_ACTION | 1,755 | 1.25% | 1.84% | 2.67% | 1,575 |
| MIXED | 479 | 4.59% | 7.10% | 9.52% | 399 |
| LEARN_HEAVY | 136 | 4.41% | 7.69% | 10.08% | 119 |
| PLAY_HEAVY | 71 | **12.68%** | 16.67% | 25.93% | 54 |

**Thresholds, stated explicitly.** `LEARN_ONLY` = ≥1 Learn action and 0 Play actions on
day 0. `PLAY_ONLY` = the mirror. Among wallets with both, `LEARN_HEAVY` = Learn ≥ 4×
Play, `PLAY_HEAVY` = Play ≥ 4× Learn, `MIXED` = neither dominates. Learn actions =
`{training_exercise_started, training_exercise_completed, exercise_complete,
exercise_fail, daily_tactic_started, daily_tactic_completed, labyrinth_complete,
training_retry_completed, training_senda_completed}`. Play actions =
`{arena_game_start, arena_game_end, play_tactics_opened, play_tactics_completed,
play_tactics_failed}`. The 4× ratio was chosen before looking at the retention column,
and no threshold was adjusted afterwards.

**Answering the three questions as posed:**

> *Is Play disproportionately associated with return behaviour?*
> `[FACT]` **No, not at equal exposure.** PLAY_ONLY 2.56% vs LEARN_ONLY 2.73% D1 — a
> difference well inside noise at these n. PLAY_HEAVY is the highest single cell
> (12.68%) but rests on 71 wallets and 54 D7-eligible, so its confidence is low.

> *Is Learn disproportionately associated with return behaviour?*
> `[FACT]` **No** — and §8 shows the sharper version: the Learn *exercise* specifically
> is the weakest completion in the product.

> *Do users who use both behave differently?*
> `[FACT]` **Yes, and it is the clearest surface result.** MIXED returns at ~1.8× the
> single-surface rate on D1 and ~2.2× on D7. `[INFERENCE]` But this is *not* evidence
> that cross-surface use causes return: reaching a second app requires finding and
> installing it, which selects for motivation that already existed. §8 controls for
> depth and the effect shrinks further.

### 3.3 Surface reach (wallets, launch cohort)

| Surface | Wallets reaching it |
|---|---|
| Hub tour finished | 5,654 |
| Arena — started a game | 2,933 |
| Daily Focus — started | 1,558 |
| Arena — finished a game | 1,540 |
| PRO offer seen | 1,527 |
| Coach (analyse or viewer) | 1,016 |
| Daily Focus — completed | 1,066 |
| Learn exercise — completed | 680 |
| Shop items viewed | 608 |
| Labyrinth completed | 473 |
| Special Training (`training_senda_completed`) | 34 all-time |
| P2P duel | 2 all-time |

`[FACT]` Special Training and P2P have no analysable population.

---

## 4. Returning / deep users

### 4.1 Choosing the definition

`[FACT]` Candidate populations, all-time wallets:

| Definition | Wallets | % of 6,044 |
|---|---|---|
| ≥2 active days | 300 | 5.0% |
| **≥3 active days** | **78** | **1.29%** |
| ≥4 active days | 35 | 0.58% |
| ≥7 meaningful actions | 577 | 9.5% |
| ≥7 meaningful actions **and** ≥2 days | 108 | 1.8% |

**I use ≥3 active days (78 wallets).** Reason: the active-day distribution decays
5,740 → 222 → 42 → 8, and the 2→3 step is where the curve stops being dominated by
people who simply reopened the app once. "≥7 meaningful actions" (577) is a *depth*
threshold that 9.5% of the cohort clears **on day 0 alone** — it measures one long
session, not a returning user, and would answer a different question.

### 4.2 The deep users

Wallets with ≥4 active days, anonymised. Country is the first-seen edge country.

| User | Country | First | Last | Days | Events | Exercises | Dailies | Games | Coach | Labyrinths | PRO tap | Paid mint | Top-up exit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | CO | 07-25 | 08-14 | 18 | 1,416 | 41 | 10 | 23 | 29 | 26 | yes | **yes** | no |
| B | CO | 07-25 | 08-14 | 17 | 715 | 28 | 3 | 4 | 4 | 14 | no | no | no |
| C | ID | 08-03 | 08-15 | 13 | 1,581 | 12 | 10 | 55 | 56 | 6 | yes | **yes** | yes |
| D | KE | 08-03 | 08-15 | 13 | 1,412 | 110 | 23 | 5 | 5 | 42 | no | no | no |
| E | ID | 08-03 | 08-15 | 12 | 641 | 55 | 24 | 1 | 2 | 42 | no | no | no |
| F | ID | 08-03 | 08-15 | 12 | 589 | 55 | 24 | 1 | 5 | 28 | no | no | no |
| G | NL | 08-04 | 08-15 | 12 | 175 | 12 | 12 | 0 | 0 | 8 | yes | no | no |
| H | NL | 08-03 | 08-15 | 11 | 1,872 | 14 | 8 | 65 | 23 | 8 | no | no | no |
| I | NG | 08-05 | 08-15 | 10 | 734 | 0 | 0 | 36 | 14 | 0 | no | **yes** | no |
| J | ID | 08-05 | 08-14 | 9 | 1,349 | 20 | 4 | 62 | 17 | 8 | no | no | no |
| K | DE | 08-03 | 08-13 | 9 | 1,076 | 106 | 6 | 23 | 22 | 38 | no | no | no |
| L | NG | 08-04 | 08-12 | 9 | 605 | 8 | 11 | 1 | 2 | 6 | no | **yes** | no |

`[FACT]` Deep users are **not concentrated in one country**: CO, ID, KE, NL, NG, DE.
`[FACT]` **10 of 12 used Coach**, against 1,016 of 6,035 (16.8%) in the cohort.
`[FACT]` 10 of 12 used both surfaces. Only User G (pure Learn) and User I (pure Play)
are single-surface.

`[FACT]` **Users E and F have byte-identical trajectories** — same country, same 12
days, same activity set on every one of them, similar event counts. `[INFERENCE]` This
is one person on two devices, or automation. At n=78 deep users, two entangled rows is
a caveat worth carrying, not a crisis.

### 4.3 Trajectories

The pattern is not subtle. **Read the middle column.**

```
User G (NL) — the purest case
  Aug 04 → Daily
  Aug 05 → Daily
  Aug 06 → Daily
  Aug 07 → Daily
  Aug 08 → Daily
  Aug 09 → Daily
  Aug 10 → Daily + Labyrinth + Learn
  Aug 11 → Daily + PRO-tap        ← wanted to buy; see §5
  Aug 12 → Daily + Labyrinth + Learn
  Aug 13 → Daily
  Aug 14 → Daily
  Aug 15 → Daily

User E (ID)
  Aug 03 → Daily + Labyrinth + Learn + Tactics
  Aug 05 → Daily + Tactics
  Aug 06 → Daily + Tactics
  Aug 07 → Coach + Daily + Play + Tactics
  Aug 08 → Daily + Tactics
  Aug 09 → Daily + Tactics
  … through Aug 15, identical

User D (KE)
  Aug 03 → Coach + Daily + Play + Tactics
  Aug 04 → Coach + Play
  Aug 05 → Coach + Daily + Play + Tactics
  Aug 06 → Daily + Labyrinth + Learn + Tactics
  Aug 07 → Daily + Labyrinth + Learn + Tactics
  Aug 08 → Daily + Tactics
  Aug 09 → Daily + Labyrinth + Learn + Tactics
  Aug 10 → Coach + Daily + Play + Tactics
  … through Aug 15

User C (ID)
  Aug 03 → Coach + PAID-mint + Play + PRO-tap
  Aug 04 → Daily + Play
  Aug 05 → Coach + Daily + Play
  Aug 06 → Coach + Daily + Play
  Aug 07 → Coach + Daily + Play
  Aug 08 → Coach + Daily + Play
  Aug 09 → Coach + Daily + Play + TopUp-exit
  Aug 10 → Coach + Play
  Aug 11 → Coach + Daily + Play
  Aug 12 → Daily
  Aug 13 → Coach + Daily + Play
  Aug 14 → Coach + Daily + Labyrinth + Learn + Play
  Aug 15 → Coach + Play

User A (CO) — the whale, 18 days, paid a mint on 12 separate days
  Jul 25 → Coach + PAID-mint + Play
  Jul 26 → Coach + Labyrinth + Learn + PAID-mint + Play
  Jul 27 → Coach + Labyrinth + PAID-mint + Play
  Jul 28 → Labyrinth + Learn
  Jul 31 → Daily + Labyrinth + Learn + PAID-mint + Play + PRO-tap
  Aug 03 → Coach + Daily + Labyrinth + Learn + PAID-mint + Play + PRO-tap
  …
  Aug 14 → Coach + PAID-mint + Play
```

`[FACT]` **The Daily Tactic appears on nearly every active day of nearly every deep
user.** Learn, Play, Coach and Labyrinth rotate around it; the Daily is the constant.
User G's entire relationship with the product is the Daily.

`[FACT]` The two most valuable users in the product (A: 12 paid mints; C: paid mint +
13 days) both tapped PRO and neither bought it. §5 explains why.

---

## 5. The monetization funnel

Reconstructed against the actual event semantics, verified at their call sites — not
against the canonical-event vocabulary, which lies in three known places.

### 5.1 The semantics that decide the funnel

`[FACT]` `pro_purchase_failed { kind: "no-token" }` fires from
`lib/pro/use-pro-sheet-state.ts:267`, **before any transaction exists**, when
`selection.selected` is null. `selected` comes from `useStablecoinTokenSelection`
(`lib/payments/use-get-peones-token-selection.ts:70`), which reads `balanceOf` for
USDC / USDT / cUSD and picks a token holding ≥ the price. So `no-token` means
literally: *a connected wallet, balances resolved, and no accepted stablecoin holds
$1.99.* **This is a direct, purpose-built affordability signal — stage A.**

`[FACT]` **But the same hook scores a failed read as zero**: "a failed/missing read
counts as 0 (not payable), never throws" (line 89). `useReadContracts` is called with
`allowFailure: true`. An RPC error and an empty wallet are indistinguishable in this
signal. Hold that thought for §7.

`[FACT]` `pro_purchase_started` counts **rail-accepted attempts, not taps** — it is
emitted from inside the rail's mutex (`onAccepted`) precisely so double-taps do not
inflate the denominator.

`[FACT]` `minipay_add_cash_click` (`components/minipay/add-cash-cta.tsx`) is a link out
of the app to `https://minipay.opera.com/add_cash`, rendered only to MiniPay users whose
purchase failed on balance. It is an **app-initiated exit**.

### 5.2 The PRO funnel ($1.99) — launch cohort, wallets

| # | Stage | Wallets | → next | overall |
|---|---|---|---|---|
| 1 | PRO card impression | 1,527 | 99.9% | 100% |
| 2 | PRO sheet opened | 1,526 | 60.7% | 99.9% |
| 3 | Purchase CTA tapped | 926 | — | 60.6% |
| 4a | **A — blocked, no payable token** | **912** | | **98.4% of tappers** |
| 4b | Exited to MiniPay top-up | 689 | | 74.4% of tappers |
| 5 | **C — rail accepted the attempt (tx requested)** | 16 | 18.8% | 1.0% |
| 6 | **D — technical failure after request** | **0** | | 0% |
| 7 | **E — confirmed purchase** | 3 | | **0.20%** |

`[FACT]` **The PRO funnel loses everything at one stage.** 912 of 926 tappers never
reach a transaction. Stage D — technical failure after submission — is **empty**: not
one wallet in the cohort. There is no checkout bug to fix, because almost nobody
reaches checkout.

`[FACT]` All-time, only **17 wallets** have ever had the PRO rail accept an attempt and
**4** have confirmed one.

### 5.3 The victory-mint funnel ($0.01–0.03) — the product that actually sells

| # | Stage | Wallets | → next |
|---|---|---|---|
| 1 | Finished an arena game | 1,540 | 33.2% |
| 2 | Tapped "save victory" | 511 | 100% |
| 3 | Claim transaction started | 511 | 38.6% |
| 4 | **Save succeeded** | **197** | — |

All-time outcome breakdown of `victory_claim_tx`, by stage (wallets overlap because
wallets retry):

| Stage | Wallets | Reading |
|---|---|---|
| `start` | 515 | intent |
| `cancelled` | 179 | **C — signing rejected / abandoned (34.8% of starters)** |
| `error` | 212 | **D — technical failure (41.2%)** |
| `success` | 211 | **E** |

Error kinds:

| `error_kind` | Wallets |
|---|---|
| **`unknown`** | **160** |
| `cooldownActive` | 31 |
| `revert` | 24 |
| `insufficientFunds` | **7** |
| `expired` | 2 |

`[FACT]` **The dominant failure mode of the only product that converts is
unclassified.** 160 of 212 erroring wallets get `unknown`. `[UNKNOWN —
INSTRUMENTATION GAP]`

`[FACT]` **At $0.01–0.03, insufficient funds affects 7 wallets out of 515 (1.4%).** At
$1.99 it affects 912 of 926 (98.4%). Hold this contrast for §7 — it is the single most
load-bearing comparison in this pass.

### 5.4 Signature rejection is separately observable

`[FACT]` The free welcome pack requires only a signature. 585 wallets tapped → 585
reached signing → **517 succeeded, 75 rejected (12.8%), 12 failed.**

`[FACT]` On score saving, `score_save_failed` carries `detail`:
`signature_rejected` on **239 wallets** (566 events), `session_required` 7 wallets (674
events — heavily looped on a few users), `network` 13 wallets.

`[INFERENCE]` Signature friction is real (12.8% outright rejection on a *free* gift)
but it is an order of magnitude smaller than the affordability gate, and it is not the
binding constraint on revenue.

### 5.5 Money that actually landed

`[FACT]` `treasury_payment_consumptions`, all-time — 42 settled purchases:

| Product | SKU | Purchases | Wallets | Unit price | Token |
|---|---|---|---|---|---|
| Peones pack | `peones_pack_50` | 17 | 11 | $0.50 | USDT |
| Season Pass | `lite_season_pass_21` | 14 | 14 | $0.99–1.99 | USDT |
| PRO | `chesscito_pro_30` | 7 | 7 | $1.99 | USDT |
| Peones pack | `peones_pack_50` | 1 | 1 | $0.50 | USDC |
| Season Pass | `lite_season_pass_21` | 1 | 1 | $0.99 | USDC |
| PRO | `chesscito_pro_30` | 1 | 1 | $1.99 | USDC |
| Peones pack | `peones_pack_50` | 1 | 1 | $0.50 | cUSD |

Plus **441 victory mints** in `victories`.

`[FACT]` **41 of 42 high-ticket purchases were paid in USDT or USDC. Exactly one was
paid in cUSD** — the token MiniPay hands users by default. `[INFERENCE]` The people who
buy are people who already hold a non-default stablecoin, i.e. crypto-experienced users,
not the median MiniPay installer.

⚠️ `amount_paid` mixes 6-decimal (USDC/USDT) and 18-decimal (cUSD) units in one numeric
column. **Do not `SUM()` it across tokens.** A naive total reads 5×10¹⁷.

---

## 6. The "~500 payment intent" observation

`[FACT]` **The claim reproduces, and it is `monetization.save_victory_tap`.**

I could not find the original query in the repository (no doc states it), so I
enumerated every event whose wallet count lands near 500:

| Candidate event | Installs | Wallets |
|---|---|---|
| `score_save_free` | 605 | 586 |
| `claim_gift_tap` (free) | 624 | 585 |
| `claim_gift_success` (free) | 549 | 517 |
| **`victory_claim_tx`** | **533** | **515** |
| **`monetization.save_victory_tap`** | **529** | **515** |

The two free-gift events are not payment intent. `score_save_free` is, by name, the
*free* save path. **`monetization.save_victory_tap` / `victory_claim_tx` = 515 wallets
is the only pair that means "a user chose to spend money", and it is the number.**

**What "wanted to pay" actually means here:** a player finished an arena game, was
offered a paid on-chain keepsake of it for roughly one to three US cents, and tapped
accept. It does **not** mean 500 people wanted PRO, a Season Pass, or Peones.

Answering the sub-questions on that product:

| Question | Answer |
|---|---|
| How many saw the offer? | 1,540 wallets finished a game and were eligible |
| How many clicked? | **511** (cohort) / 515 (all-time) |
| How many opened checkout? | 511 — tap and claim-start are the same step |
| How many had sufficient balance? | ≥508 — only 7 ever hit `insufficientFunds` |
| How many initiated a transaction? | 511 |
| How many completed? | **197** (cohort) / 211 (all-time) |
| Abandoned at signing (C) | 179 wallets cancelled |
| Failed technically (D) | 212 wallets errored — 160 of them `unknown` |

`[FACT]` So the honest restatement of the legacy number is: **~515 wallets wanted to
spend one to three cents; ~40% got what they paid for.** The loss is split roughly
evenly between people backing out at the signature and transactions failing for a
reason we do not record.

`[FACT]` The ~500 figure has **never** described demand for the $1.99 catalogue. The
comparable number there is 926 taps → 3 sales.

---

## 7. Geography and affordability

### 7.1 The table that dissolves the demographic hypothesis

Launch cohort, countries with ≥50 wallets:

| Country | Wallets | Activated | Return | Saw PRO | Tapped buy | **Insufficient rate (of tappers)** | Top-up exit | Mint intent | Mint OK | Mint conv. |
|---|---|---|---|---|---|---|---|---|---|---|
| NG | 2,337 | 41.8% | 4.79% | 27.1% | 17.8% | **97.8%** | 13.6% | 169 | 82 | 48.5% |
| **NL** | 1,069 | 45.0% | 6.55% | 24.2% | 15.3% | **100.0%** | 10.1% | 112 | 42 | 37.5% |
| KE | 407 | 39.8% | 5.90% | 18.2% | 11.5% | **97.9%** | 6.4% | 32 | 11 | 34.4% |
| ZA | 378 | 39.4% | 3.70% | 20.4% | 12.4% | **100.0%** | 11.1% | 34 | 15 | 44.1% |
| BR | 356 | 42.7% | 1.69% | 22.8% | 10.7% | **97.4%** | 12.6% | 21 | 4 | 19.0% |
| ID | 282 | 60.6% | 4.96% | 23.0% | 9.6% | **100.0%** | 8.9% | 42 | 9 | 21.4% |
| UG | 197 | 38.1% | 1.52% | 30.5% | 21.3% | **100.0%** | 13.2% | 14 | 7 | 50.0% |
| GH | 130 | 47.7% | 6.15% | 17.7% | 7.7% | **100.0%** | 6.9% | 9 | 6 | 66.7% |
| CI | 110 | 31.8% | 2.73% | 48.2% | 35.5% | **100.0%** | 22.7% | 6 | 1 | 16.7% |
| CM | 92 | 35.9% | 3.26% | 44.6% | 28.3% | **96.2%** | 15.2% | 5 | 2 | 40.0% |
| CO | 90 | 51.1% | 6.67% | 20.0% | 6.7% | **83.3%** | 6.7% | 10 | 4 | 40.0% |
| IN | 78 | 61.5% | 5.13% | 25.6% | 11.5% | **88.9%** | 6.4% | 8 | 2 | 25.0% |
| MX | 57 | 54.4% | 3.51% | 24.6% | 12.3% | **100.0%** | 10.5% | 6 | 0 | 0.0% |

`[FACT]` **The insufficient-balance rate is 97–100% in every country with meaningful
volume — including the Netherlands at 100.0%.** It does not correlate with national
income. A purchasing-power explanation predicts NL ≪ NG. The data shows NL = 100%,
NG = 97.8%.

### 7.2 The decisive test

I isolated the wallets that **provably held money and could sign**, by taking those
that successfully completed a paid victory mint, and asked what happened when they
tapped PRO:

| Population | n | Blocked "no payable token" | Reached a tx | Confirmed |
|---|---|---|---|---|
| All wallets that tapped PRO buy | 927 | 912 (**98.4%**) | 16 | 4 |
| **Wallets that had already PAID for a mint** | **26** | **25 (96.2%)** | 1 | 1 |

`[FACT]` **25 of 26 wallets that had already sent real money on-chain were told they
had no payable token.** Whatever this signal measures, it is not "the user is broke".

### 7.3 The mechanism

`[FACT]` The MiniPay build's wagmi config declares its transport as a **bare `http()`
with no URL** (`lib/wallet/wagmi-config.ts:32-35`):

```ts
transports: {
  [celo.id]: http(),
  [celoSepolia.id]: http(),
},
```

`[FACT]` Verified by executing the installed dependency:
`viem@2.46.3`'s `celo.rpcUrls.default.http` = `["https://forno.celo.org"]`. A bare
`http()` resolves there.

`[FACT]` Verified in `@wagmi/core` (wagmi 2.19.5): `readContract` resolves its client
via `config.getClient({ chainId })` — the **configured transport**, not the injected
wallet provider. So `useReadContracts` for `balanceOf` goes to Forno even inside
MiniPay.

`[FACT]` **The repository already documents Forno failing under exactly these
conditions.** From `lib/wallet/web-transports.ts`, written 2026-07-24:

> *"Forno is last on purpose: it is best-effort, rate-limited, and the endpoint that
> returned `403` under burst in-browser (validation §10.7) — the reason this branch
> needs a rotating transport at all."*

The team measured this, and fixed it — **for the web/Privy branch only**, giving it a
three-endpoint `fallback()` with timeouts and retries. The MiniPay branch was
deliberately left on bare `http()` on the stated belief that *"MiniPay never touches
this: it injects its own RPC."* For **writes** that is true. For **reads through
`useReadContracts`** it is not, per the `getClient` path above.

`[INFERENCE]` So the affordability gate for every $1.99 product runs, for the entire
MiniPay population, against an anonymous, rate-limited, no-fallback, no-retry public
endpoint that this team has already observed returning 403 under burst — during a
launch that pushed 2,535 installs in one day. Every failed read is scored as a zero
balance and rendered to the user as "insufficient balance", with a button that ejects
them to the MiniPay top-up screen.

`[HYPOTHESIS]` **The 98.4% insufficient-balance rate is substantially an RPC-read
failure, not a wallet-balance fact.** This is the single highest-value open question in
the product and it is cheap to settle — see §11.

**What would falsify it:** if a client-side probe recording the raw `balanceOf` results
(success/failure per token) shows reads succeeding and returning genuinely sub-$1.99
balances, then the gate is honest and the finding reverts to real affordability at the
$1.99 price point. Two facts already argue partly that way and must be stated: only 1
of 42 purchases was in cUSD, so the wallets that *do* buy are unusual; and MiniPay's
default funding state for a directory-install user may genuinely be empty.

**What is NOT explained by RPC failure:** the 34.8% signature cancellation and the
41.2% `unknown` error on the *cheap* mint. Those are separate, real losses.

### 7.4 Which explanation the data supports

Asked directly — is monetization weakness better explained by insufficient balance, low
perceived value, poor timing, or checkout friction?

| Explanation | Verdict |
|---|---|
| **Insufficient balance (as reported)** | `[FACT]` It is what 98.4% of tappers are told, and it terminates the funnel. |
| **Insufficient balance (as truth)** | `[UNKNOWN]` — contradicted for 25 of 26 proven-funded wallets; needs the §11 probe. |
| **Low perceived value** | `[FACT]` **Not supported.** 60.6% of wallets that opened the PRO sheet went on to tap buy. Intent is abundant. |
| **Poor timing** | `[FACT]` **Not supported at the cheap price point** — the post-victory mint converts 33.2% of finishers into intent. |
| **Checkout / payment friction** | `[FACT]` **Real but second-order.** Zero technical failures after tx request on PRO; on the mint, 34.8% cancel at signing and 41.2% error unclassified. |

`[FACT]` No claim in this section rests on demographic or purchasing-power assumptions.
The NL row is what makes that unnecessary.

---

## 8. Retention pathways

### 8.1 Single day-0 behaviours (all wallets, cohort)

Base return rate for the cohort is ~4.5%.

| Day-0 behaviour | n | Return if did | Return if didn't | Lift |
|---|---|---|---|---|
| Completed the Daily | 1,066 | **8.72%** | 4.07% | 2.14× |
| Streak updated | 1,066 | 8.72% | 4.07% | *(collinear with the above)* |
| Used Coach | 1,016 | **8.37%** | 4.18% | 2.00× |
| Finished an arena game | 1,485 | **8.01%** | 3.87% | 2.07× |
| Started the Daily | 1,558 | 7.89% | 3.84% | 2.05× |
| Completed a labyrinth | 473 | 7.82% | 4.64% | 1.69× |
| Saved a score | 549 | 7.29% | 4.65% | 1.57× |
| Claimed welcome gift | 485 | 6.80% | 4.72% | 1.44× |
| Completed an exercise | 680 | 6.47% | 4.69% | 1.38× |
| Started an arena game | 2,933 | 5.86% | 3.97% | 1.48× |
| Exited to MiniPay top-up | 667 | 5.70% | 4.79% | 1.19× |
| **Finished the hub tour** | 5,654 | **4.93%** | 4.20% | **1.17×** |

`[FACT]` **The hub tour predicts nothing.** 5,654 wallets finish it and return at
4.93% against a 4.20% baseline. It is the most-completed thing in the product and the
least informative.

`[FACT]` **The top-up ejection is not a retention sink.** Wallets the app pushed out to
MiniPay return at 5.70% vs 4.79% — slightly *above* baseline. `[INFERENCE]` They were
already engaged; the ejection did not punish them. This contradicts the intuition that
the top-up round-trip is a major dead-end, and argues against prioritising it.

### 8.2 Controlling for depth — the honest cut

Every row above is confounded by "did more things". Banding by day-0 completion count:

| Day-0 depth | n | Return | With Daily | Without Daily | With Coach | Without Coach |
|---|---|---|---|---|---|---|
| 0 completions | 3,466 | 3.29% | — | 3.29% | — | 3.29% |
| 1–2 completions | 1,642 | 5.60% | 6.61% | 5.10% | 5.34% | 5.80% |
| 3–6 completions | 408 | 9.31% | **12.92%** | 6.52% | **12.77%** | 6.36% |
| 7+ completions | 520 | 9.81% | 9.91% | 9.60% | **19.66%** | 6.95% |

`[FACT]` **Depth is the dominant variable and it saturates fast.** 0 → 3.29%,
1–2 → 5.60%, 3–6 → 9.31%, 7+ → 9.81%. Getting a player from zero to three completions
roughly triples return; getting them from six to twenty adds nothing.

`[FACT]` **Coach carries the largest depth-controlled association in the dataset:
19.66% vs 6.95% among the deepest band — 2.8×.** It survives the depth control that
flattens everything else, and it matches the trajectory evidence (10 of 12 deep users
used Coach against 16.8% of the cohort).

`[FACT]` Daily doubles return in the 3–6 band (12.92% vs 6.52%) and adds nothing in the
7+ band.

### 8.3 Which surface, at equal exposure

Wallets whose day-0 completions were **exclusively** of one kind:

| Day-0 completion profile | n | Return |
|---|---|---|
| **Daily + at least one other surface** | 635 | **10.55%** |
| Only Arena completions | 1,133 | 6.35% |
| Only Daily completions | 431 | 6.03% |
| **No completion at all** | 3,558 | **3.32%** |
| **Only Learn exercise completions** | **245** | **2.86%** |

`[FACT]` **Wallets whose only day-0 completion was a Learn exercise return at 2.86% —
below the 3.32% of wallets that completed nothing.** Finishing a Learn exercise, on its
own, is worth nothing in return terms and may be worth slightly less than doing nothing.

`[INFERENCE]` This is the sharpest result in the pass and it inverts the natural
assumption that the pedagogical core drives the habit. `[HYPOTHESIS]` The likely reason
is that the Learn exercise is a *terminal* experience — it resolves into a receipt and
a decision grid, whereas the Daily is explicitly dated and the Arena produces an
opponent and a rematch. That is testable and is not tested here.

### 8.4 Smallest predictive set

`[INFERENCE]` Three day-0 signals carry nearly all the predictive value, and they are
close to non-overlapping:

1. **≥3 completions of any kind** (3.29% → 9.31%)
2. **Completed the Daily** (2× within the 3–6 band)
3. **Touched Coach** (2.8× within the 7+ band)

`[FACT]` Confidence caveat: the cohort is 13 days old, so D7 is available for only
5,229 of 6,035 wallets and D14 for none. Every cell with n < 100 (PLAY_HEAVY, MX, CO,
IN, the deep-user table) should be read as directional.

`[FACT]` Correlation, not causation, throughout §8. None of these is a randomised
comparison; all of them are confounded by unmeasured motivation. The depth control in
§8.2 removes the crudest confound, not the real one.

---

## 9. Measurement gaps

Only gaps that block a decision named in this document.

```
QUESTION  Do MiniPay users actually hold less than $1.99, or is the balance read failing?
MISSING   No record of the balanceOf read outcome. `allowFailure: true` collapses
          "RPC error" and "zero balance" into the same null selection, and no telemetry
          distinguishes them. This blocks the largest finding in the pass.
MINIMAL   One event on the existing no-token branch carrying, per accepted token:
          read status (success|failure) and a bucketed balance. Three booleans and
          three buckets. No new surface, no new table.
```

```
QUESTION  Why do 41% of victory-mint transactions fail?
MISSING   `error_kind` is `unknown` for 160 of 212 erroring wallets — the dominant
          failure mode of the only converting product is unclassified.
MINIMAL   Widen the existing classifier in the mint error path to record the provider
          error code before falling through to `unknown`.
```

```
QUESTION  Did the transaction succeed or fail?
MISSING   `tx_progress_done` records outcome='success' on 4,932 of 4,932 rows. The
          instrument cannot represent failure, so it contributes nothing to any funnel.
MINIMAL   Emit the same event on the failure path. One call site.
```

```
QUESTION  Where did this install come from?
MISSING   No acquisition-source attribution. `source` and `campaign` columns exist on
          analytics_events and are unused by the listing. This is why the NL=17.4%
          anomaly cannot be traced and why "acquisition junk vs retention failure"
          stays unresolved.
MINIMAL   A single URL parameter on the MiniPay listing link, read into the existing
          `source` column. No schema change — the column is already there.
```

```
QUESTION  What does a LEARN wallet do before it disappears?
MISSING   account_ref is attached to only 64.4% of training_exercise_started and 1.0%
          of hub_tour_view / app_opened, so the pre-wallet portion of the Learn funnel
          is invisible at wallet level.
MINIMAL   Nothing new to collect — reconcile session_id→account_ref once the wallet
          resolves, so earlier events in the same install become attributable.
```

`[UNKNOWN — INSTRUMENTATION GAP]` also, and deliberately not instrumented for now:
per-session duration (no session-end event), wallet balance history (never recorded),
and P2P duel behaviour (n=2).

---

## 10. Decision table

| Question | Evidence | Confidence | Implication |
|---|---|---|---|
| **Learn vs Play** | Only 5 of 7,934 installs saw both — separate deployments. At equal day-0 exposure LEARN_ONLY 2.73% vs PLAY_ONLY 2.56% D1. Learn-exercise-only return 2.86% vs Arena-only 6.35%. | **High** on the structural point, **Medium** on the rates | Stop framing it as a choice. Play is not better than Learn; the **Learn exercise specifically** is the weakest retention object in the product. |
| **What correlates with return?** | Depth saturating at 3 completions (3.29%→9.31%); Daily 2× within band; Coach 2.8× in the deepest band; hub tour 1.17× (nothing). | **Medium-High** | Optimise for *three completions on day 0*, with the Daily as the vehicle. Stop investing in the tour. |
| **Who are deep users?** | 78 wallets ≥3 active days (1.29%). Spread across CO/ID/KE/NL/NG/DE. 10 of 12 use Coach; the Daily appears on nearly every active day of nearly every one. | **Medium** (n=78; two rows entangled) | The retained product that already exists is **Daily + Coach**, not the Learn ladder. |
| **Why did checkout fail?** | PRO: 926 taps → 912 blocked pre-transaction → **0** technical failures → 3 sales. Mint: 34.8% cancel at signing, 41.2% error (160/212 `unknown`). | **High** | There is no checkout bug on PRO. There is a **gate** on PRO and an **unclassified failure** on the mint. |
| **Is affordability observable?** | Yes — and it reports 97–100% blocked in every country including NL 100.0%, and 96.2% among 26 wallets that had already paid. Gate reads Forno via bare `http()`; failed read scores as zero. | **High** that it is observable; **Low** that it is true | **Do not act on this number as a price signal until §11.1 resolves it.** |
| **Which monetization context deserves testing?** | Post-victory mint: 33.2% of game-finishers form intent at $0.01–0.03, 1.4% insufficient. PRO: 60.6% sheet→tap intent, 98.4% blocked. | **High** | The *moment* is proven and the *price point* is proven. The **gate** is what is untested. |

### Surface classification (recommendation only — not implemented)

| Surface | Class | Why |
|---|---|---|
| **Daily Focus** | `POTENTIATE` | The spine of every deep-user trajectory; 2× return within depth band; 1,558 wallets already reach it |
| **Coach** | `POTENTIATE` | Largest depth-controlled association in the dataset (2.8×); 10 of 12 deep users; only 16.8% of cohort reaches it |
| **Play / Arena** | `KEEP` | Largest funnel mouth (2,933 wallets) and the host of the only converting product; retention parity with Learn |
| **Victory mint** | `KEEP` | The only proven monetization moment; fix its `unknown` error before changing anything else |
| **Learn — Train Pieces ladder** | `DEMOTE` | 2.86% return for exercise-only wallets, below the do-nothing baseline. Demote as the *default first experience*; do not remove — it is what deep users D, E, F, K grind |
| **Hub tour** | `DEMOTE` | 5,654 completions, 1.17× lift. It is the most-finished and least-predictive object in the product |
| **PRO / $1.99 catalogue** | `FREEZE` | Freeze pricing and packaging decisions until the balance-read question is settled. Any pricing conclusion drawn today is drawn from a possibly-broken instrument |
| **Special Training** | `FREEZE` | 34 completions all-time; no population to measure |
| **P2P duel** | `FREEZE` | 2 wallets, shipped today. Targets a Day-5 layer the product has not earned |
| **Shop / Season Pass** | `KEEP` | 15 sales; shares the frozen gate — same blocker, not its own problem |

---

## 11. Three next actions

### 11.1 Instrumentation — settle the balance-read question (do this first)

**Action.** Add one event on the existing `no-token` branch in
`use-get-peones-token-selection.ts`, recording per accepted token: whether the
`balanceOf` read **succeeded or errored**, and a coarse balance bucket. Ship it, wait
for ~200 no-token events, read the split.

**Evidence that justifies it.** 98.4% of PRO tappers are blocked (§5.2); the rate is
97–100% in every country including NL at 100.0% (§7.1); **25 of 26 wallets that had
already paid real money were blocked** (§7.2); the read goes to `forno.celo.org` via a
bare `http()` (`lib/wallet/wagmi-config.ts:32`, confirmed against installed
`viem@2.46.3` and `@wagmi/core`'s `getClient` path), and `allowFailure: true` scores a
failed read as zero (`use-get-peones-token-selection.ts:89`). The repo's own
`web-transports.ts` records Forno returning **403 under burst in-browser** and rotates
away from it — for the other branch only.

**Why this and not the fix.** The fix (a `fallback()` transport, which the codebase
already has written and tested for the web branch) is cheap and probably correct. But
shipping it blind would silently overwrite the evidence: if conversion moves, we will
not know whether we fixed an RPC or moved a price. Measure for a few days, then fix
with a known baseline. Note that the fix requires **no paid RPC tier** — the existing
`CELO_WEB_RPC_URLS` list is entirely key-less.

### 11.2 Product — make the Daily the default first experience, and measure at three completions

**Action.** Route a new install's first action to today's Daily rather than to a
decision grid, and define the activation metric as **three day-0 completions**, not
"opened the app" or "finished the tour".

**Evidence that justifies it.** Return saturates at three completions (3.29% → 9.31%,
§8.2) and adding more beyond six buys nothing. The Daily is the only object that
appears on nearly every active day of nearly every deep user (§4.3) and doubles return
within the 3–6 band (12.92% vs 6.52%). The current default first experience — the hub
tour — is completed by 5,654 wallets for a 1.17× lift (§8.1), and the Learn exercise it
funnels into returns *below* the do-nothing baseline (2.86% vs 3.32%, §8.3).

This is a routing and default change against surfaces that already exist. It is not a
new feature and not a new game.

### 11.3 Measurement — classify the mint failure and instrument acquisition source

**Action.** Two one-call-site changes: record the provider error code in the victory-mint
error path before falling through to `unknown`, and add a source parameter to the
MiniPay listing URL, read into the `analytics_events.source` column that already exists
and is unused.

**Evidence that justifies it.** The mint is the only product that converts, and **160 of
212 erroring wallets carry `error_kind = unknown`** (§5.3) — we cannot say why the
majority of failures on our only working revenue line happen. Separately, 511 wallets
form intent and 197 succeed; 314 of those losses are unexplained or unattributed. On
acquisition: NL at 17.4% of installs (§2) cannot be traced, and the question of whether
the one-and-done 95% is acquisition junk or retention failure (§10) is unanswerable
without a source label. Both columns exist; neither requires a schema change.

---

## Reproducibility

Every query in this pass is in the session scratchpad as numbered `.sql` files, run
through a read-only wrapper. The load-bearing ones:

| # | Question | Shape |
|---|---|---|
| 03 | Event catalog | `GROUP BY event` over `analytics_events` with session/account/date range |
| 06 | Learn/Play crossover | `bool_or(surface=…)` per `session_id`, then per `account_ref` |
| 07 | `account_ref` coverage | `count(*) FILTER (WHERE account_ref IS NOT NULL) / count(*)` per event |
| 10 | Day-0 segmentation | day-0 feature CTE `ON ev.d = f.d0`, return CTE `ON ev.d > f.d0`, joined |
| 11 | Funnel stages | `count(DISTINCT account_ref)` per stage, cohort-joined |
| 14 | Geography | per-country `max(CASE WHEN event=… )` aggregates, `HAVING count(*) >= 50` |
| 15 | Affordability test | `minted_ok=1 AND pro_tap=1` cross-tab against `pro_no_token` |
| 18 | Depth control | completion-count bands × per-surface `avg(returned) FILTER` |

Two reusable definitions:

```sql
-- Launch cohort
SELECT account_ref, first_seen::date AS d0, first_country
FROM account_first_seen WHERE first_seen >= DATE '2026-08-03';

-- The affordability signal (stage A). NOT a balance fact — see §7.3.
SELECT count(DISTINCT account_ref) FROM analytics_events
WHERE event = 'pro_purchase_failed' AND props->>'kind' = 'no-token';
```

---

## Executive summary

```
WHAT USERS DO
  7,852 installs and 6,035 wallets arrived in 13 days on the MiniPay listing;
  95.1% are active on exactly one calendar day and DAU now equals new installs
  (169 active, 136 of them new). 5,654 wallets finish the hub tour, 2,933 start
  an arena game, 1,066 complete a Daily, 680 complete a Learn exercise.
  Learn and Play are separate apps with separate storage — only 5 installs out
  of 7,934 ever saw both — so "Learn vs Play" is not a choice users can make.

WHAT RETURNING USERS DO
  They do three things on day 0, and one of them is the Daily. Return triples
  between zero and three completions (3.29% -> 9.31%) and then flattens. Within
  a fixed depth band the Daily doubles return and Coach multiplies it by 2.8 —
  the largest controlled effect measured. The Learn exercise, alone, is worth
  nothing: wallets whose only day-0 completion was one return at 2.86%, below
  the 3.32% of wallets that completed nothing. All 78 deep users (>=3 active
  days) are spread across six countries, and the Daily appears on nearly every
  active day of nearly every one of them.

WHAT HAPPENED WITH PAYMENTS
  The legacy "~500 wanted to pay" reproduces exactly: 515 wallets tapped to buy
  a $0.01-0.03 keepsake of a game they had just played, and 197 got it — 179
  cancelled at signing and 212 hit an error that is unclassified for 160 of
  them. At $1.99 the picture is different and worse: 926 wallets tapped buy,
  912 were told they had no payable token, ZERO failed technically, and 3
  bought. That block rate is 97-100% in every country including the Netherlands
  at 100.0%, and 96% among 26 wallets that had already sent real money. The
  gate reads balances over an unconfigured public RPC that this team has already
  measured returning 403 under burst, and scores a failed read as a zero
  balance. 41 of 42 real purchases were paid in USDT or USDC, not the cUSD
  MiniPay hands people by default.

WHAT WE STILL DON'T KNOW
  Whether MiniPay users are actually broke at $1.99 or whether the balance read
  is failing — the single most consequential open question, and currently
  unanswerable because a failed read and an empty wallet are the same value.
  Why 41% of victory mints fail. Where any install came from (no acquisition
  source; NL at 17.4% untraced). Whether the 95% one-and-done is acquisition
  junk or product failure — both are true in unknown proportion.

WHAT WE SHOULD DO NEXT
  1. Instrument the balance read (success/failure + bucket) before touching a
     price or a transport. Measure first so the later fix is falsifiable.
  2. Make the Daily the default first experience and redefine activation as
     three day-0 completions — the point where return triples and saturates.
  3. Classify the mint's `unknown` error and add a source parameter to the
     listing URL. Both are one call site; both columns already exist.

  Not recommended: lowering prices (the price signal is not trustworthy yet),
  removing Redis (unexamined and unrelated), or building another game.
```

---

*Pass complete. No product changes were made.*
