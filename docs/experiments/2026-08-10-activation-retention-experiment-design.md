# Chesscito — Activation / Retention experiment design

**Date:** 2026-08-10 · **Method:** 6 independent phase-2 investigators (experiment design,
product/UX, data/Supabase, engineering, acquisition/platform, red-team), each with an evidence
ledger, reconciled here. **Nothing was changed in production or Supabase (read-only SELECT
only). No experiment is enabled by this document.**

Prior evidence: the deep audit `docs/audits/2026-08-10-deep-product-data-business-audit.md`;
phase-2 ledgers in the session scratchpad (`phase2-{a-expdesign,b-engineering,c-baseline,
d-hooks,e-acquisition,g-redteam}.md`). Full per-claim evidence lives there; this doc is the
decision layer.

The separable **security P0** (`/api/peones/spend`) is fixed on its own branch and documented
in `docs/security/2026-08-10-peones-spend-authz.md` — it deliberately does not touch anything
below.

---

## 0. The question this turns into an experiment

The audit's hypothesis: *Chesscito's dominant failure is that users don't transition from first
use into a return loop.* The unresolved causal fork: **how much of the ~2.6% Day-1 cliff is
product-retention failure vs acquisition quality, activation failure, or a missing re-engagement
channel?** The design below is built to answer *which transition moved*, not "did a number
change."

---

## 1. Four transitions, four primary metrics (measured, current)

One number ("D1 = 2.6%") was answering four questions and mis-serving all four. Split it:

| Layer | Question | Primary metric | Baseline (2026-08-10, live) |
|---|---|---|---|
| **T1 ACQUISITION** | did a person with intent arrive? | installs emitting ≥1 activity-start, **by source** | 20.0% ex / 21.2% daily / 37.6% arena (union unmeasured; no source split exists) |
| **T2 ACTIVATION** | did they reach first value? | share of installs completing ≥1 value action on day 0 | **38.1%** (2,511/6,585); LEARN 31% vs PLAY 6.7% puzzle |
| **T3 SESSION SUCCESS** | enough value to continue day 0? | share meeting `va≥3 OR ≥15 min` | **13.6%** (895/6,585) |
| **T4 RETURN** | come back after value? | share of `account_ref` returning UTC D+1 | **2.56%** (134/5,229) |

**T4b (secondary, the only powered return metric): return-after-app-initiated-exit** — share
emitting any event after `minipay_add_cash_click`. Baseline **30.4%** (645 exits; terminal for
449; 196 returned). *Source: phase2-c §1–§3.*

**Return metric, frozen definition** (phase2-c §1): `account_ref` (HMAC wallet pseudonym,
server-derived, **survives a localStorage wipe**), calendar UTC D+1, cohort limited to arrivals
whose D+1 has elapsed. **Baseline 2.56%.** Publish the rolling `[+24h,+48h)` variant (1.53%)
beside it as a robustness check, never instead. ⚠️ The window choice alone swings the number 67%
relative — freeze it in code before any arm opens; freeze `TELEMETRY_ACCOUNT_SECRET` too (rotating
it orphans every historical `account_ref`).

**Split ACTIVATION by surface, always; RETURN may be pooled** (surfaces differ z≈0.94 on return,
n.s.; but activation is 31% LEARN vs 6.7% PLAY — pooling it is meaningless). LEARN and PLAY are
separate origins/products; `score_attempts.surface` is `learn` for all 7,714 rows (Arena writes
none), so any activation metric on `score_attempts` measures LEARN only.

---

## 2. The five cohorts (live, 2026-08-03…08-08 arrivals, D1 elapsed)

*Source: phase2-c §2. Keyed on `account_ref` unless noted.*

| | Cohort | Definition | Size | D1 | Median D0 |
|---|---|---|---:|---:|---:|
| A | RAW ARRIVAL | `session_first_seen`, `container=minipay` | 6,585 | 2.19% | — |
| B | AUTHENTICATED | `account_ref` exists (wallet resolved — **not a login**) | 5,229 | 2.56% | 1.1 min |
| C | ACTIVATED | ≥1 value action D0 (**not** `score_attempts≥1` — that's LEARN-only) | 2,141 | **4.11%** | 5.5 min |
| D | ENGAGED | `va≥3 OR D0≥15 min` (from the distribution, admits Arena + puzzle shapes) | 828 | **6.64%** | — |
| E | DEEP-D0, NEVER RETURNED | cohort D minus returners | **753** | 0% | 11.5 min / 6 actions |

**Cohort E is the population the bet must move** — 753 people who played >10 min, completed 6
things, and never returned. No market retains (NG 9.4%, NL 9.3%, ID 15.2%): acquisition quality
does not explain them. **But D/E are defined by post-randomization behaviour → using them as an
experiment denominator is a collider (§4).**

---

## 3. Causal model (confounder named at each edge)

```
        [ACQUISITION QUALITY]  ← unmeasured: no source attribution on the listing
                 │
   T1 ─► ACTIVATION ─► FIRST VALUE ─► SESSION DEPTH ─► FORWARD INTENTION ─► RETURN ─► RETENTION ─► MONETIZATION
          (E0)          (celebration)   (quota-capped)      (E1)            (E2*)    (converts well)
                                                              └ no channel exists ─┘
```

- **ACQUISITION→everything:** no source attribution → every cross-time comparison is confounded
  by channel mix; 94% traffic decay makes before/after designs invalid → **randomize everything**.
- **FIRST VALUE→SESSION DEPTH:** the session quota caps T3; if the Daily consumes quota the
  treatment arm's ceiling is lower → a mechanical arm-differential cap. Read the quota value first.
- **FORWARD INTENTION→RETURN:** **near-severed.** MiniPay exposes **zero origination** — no push,
  no notification, no scheduled callback (phase2-e §1.10, from official docs). A hook can only
  plant intent inside a session the player is leaving; nothing carries it to tomorrow. This is the
  ceiling on the entire bet, and it is a distribution fact, not a copy problem.
- **RETURN→RETENTION (measurement):** localStorage wipe re-randomizes a wiped returner (arm keys
  on install id). Mitigation: join arm to `account_ref` (wipe-proof) — **coverage on the assignment
  event must be measured (pre-flight)**. If poor, the wipe is non-differential → attenuates toward
  null (a positive result still trustworthy; a null ambiguous).

---

## 4. Experiment matrix

Rules for all: **randomize (never before/after); salt every bucket; intention-to-treat; pre-register
one primary metric + observation target + exclusion list; exclusions use pre-randomization variables
only.**

### E0 — First Activity / Activation — **THE ONE TO RUN FIRST (free, already an RCT, powered)**
- **Hypothesis:** a LEARN tour-finisher dropped into today's Daily (no decision) activates more than
  one left on a decision grid.
- **Control:** left on hub (`variant=control`). **Treatment:** Daily auto-opens.
- **Mechanism:** `first-activity-experiment.ts` — stable FNV-1a assignment over the persistent
  install id, both arms instrumented (7 events), ships dark at 0%, kill switch = set pct 0. **Never
  run.** ⚠️ **It already emits `variant=control` rows at 0%** — the pre-period baseline is measurable
  on the exact denominator (phase2-a P-1). ⚠️ One **measurement caveat** (re-verified in code, correcting phase2-b's "stop-ship"
  framing): on a full reload between tour-finish and daily-finish, the client refs reset
  (`onboardingVariantRef`, `onboardingAutoOpenedRef`) and the daily sheet closes, so the
  **secondary funnel-tail events** `closure_shown` + `hub_reached` (`learn-hub-client.tsx:558-585`)
  silently drop. **The PRIMARY metric T2 is unaffected** — it is measured by joining the persisted
  `onboarding_variant_assigned` row (emitted at tour-finish, before any reload) to the persisted
  completion events on the shared identity, not from these refs. phase2-b's proposed 5-line
  "re-derive the arm on mount" is **incomplete** (it fixes `variant` but not the `autoOpened`/
  `dailyOpen` reset); a correct fix needs persisting the funnel state, which is disproportionate for
  secondary events. **Recommendation: document the funnel-tail gap, do NOT ship an untestable
  instrumentation change; T2 readout stands.**
- **Eligible:** LEARN tour-finishers with an install id (≈46/day at 150 installs/day). Pre-registered
  exclusions: `first_country=NL`; the symmetric `already-done` stratum (phase2-a P-3). **No sub-1-min
  filter** — session length is post-treatment (collider).
- **Primary:** T2 Day-0 activation, ITT, among assigned. **Secondary (no decision):** T3 depth, time
  to activity-ready, T4 engaged-D1 (underpowered).
- **Guardrails:** `onboarding_activity_failed` <5%; offer-conversion & mint rate not down >20% rel;
  signature-rejection not up; no rise in `fallback_to_hub` as terminal event. (E0 routes new players
  *away* from the hub's paid card → a predicted, acceptable drop in offer impressions.)
- **Power (phase2-a §4.2):** +10pp lift needs ~750 assigned (~16 days @46/day, 50/50). **Skip the 25%
  step** (costs 2.8× traffic); hold 10% as a smoke test (~150 assignments) then go straight to 50%.
- **Falsifier:** at the target, the 95% CI on the T2 difference **excludes +10pp** → "decision load is
  not the cliff." CI containing 0 *and* +10pp = underpowered, not falsified.

### E1 — Truthful Forward Hook — **SHIP AS TRUTH-RESTORATION, DO NOT A/B FOR D1**
- **The best hook is already built and hidden** (phase2-d): `classifyStreakChange` +
  `daily-tactic-slot.tsx:121` compute `streakType`, copy exists for all three states, but the sheet
  gates it off in LEARN (`!CHESSCITO_LITE_MODE`, lines 207-222). A **gate flip, zero new state**, on
  the highest-population exit; also fixes an `aria-hidden` a11y hole.
- **A live false promise to fix regardless:** `DailyLimitBanner` says the day is over while a free,
  unplayed Daily still sits there (`?slot=daily` is quota-exempt). Truth-restoration, not a bet.
- **Do not A/B on D1:** power says detecting 2.6%→8% needs ~3,400 arrivals — underpowered ~8× (phase2-d,
  phase2-a §4.2: D1 endpoint can't see <3× effect in a month; a powered D1 answer needs ~17,000 installs
  → buy traffic). Ship the hooks; read T4b/D1 **pre/post, explicitly non-causal**.
- **If E1 is ever randomized:** it **must** use a **salted** bucket (`"e1:"+installId`) or it is
  perfectly confounded with E0 (phase2-a P-4); and verify the exit rate is equal across arms
  (conditioning on "reached the exit" is a collider otherwise). Primary would be T4b (base 30.4%),
  not D1. **Leave the streak nudge OFF** (`computeNudgeOwed` early-returns on `dailySolvedToday`;
  daily-first routing makes it structurally unreachable — phase2-d).
- **Exit E5 (MiniPay Add Cash) is out of scope & unmeasurable:** `<a target="_self">` navigates fully
  out, no return event exists; any "come back" copy is a promise the app can't keep. Do **not** report
  an R5 return rate.

### E2 — Re-engagement channel — **DOES NOT EXIST inside MiniPay**
- **Platform answer (phase2-e §1.10, official docs):** MiniPay origination ceiling = **ZERO**. No
  notification API, no scheduled/background callback, no platform messaging. Only *re-entry* exists
  (`link.minipay.xyz/browse?url=`, Discover tab, `minipay_requestContact`, `minipay_scanQrCode` —
  the last two unused). The only originating channel is negotiated co-branded promotion (gated on
  transaction volume — a reflexive trap for a low-retention app).
- **Consequence:** any real Day-2 channel requires a contact identifier we own **outside** MiniPay
  (email/phone + outbound medium). We collect none today. **This is the headline finding: the severed
  edge cannot be repaired inside MiniPay.**
- **Open, cheap, decisive:** does the MiniPay webview support **service workers / Web Push**? (phase2-e
  §1.8 Q6). If yes, we can push *inside* MiniPay and the ceiling lifts cheaply. One device-hour to settle.

### E3 — Web Early Access — **NOT an experiment. RUN SEPARATELY as a channel + research instrument.**
- As a retention experiment it's **contaminated**: 9 of 10 confounders bias Web retention UP, one
  (localStorage durability) corrupts the D1 metric itself, n≈25 gives ±20pp CI (phase2-e §2.5).
  Including it manufactures a comforting false positive → worse than no experiment.
- **But it has real standalone value:** Privy `loginMethods:["email","google"]` makes Web the **only
  surface that acquires a reachable identifier** — the only path to an owned re-engagement channel that
  §1.10 proves MiniPay will never supply.
- ⚠️ **Correction:** there is **no allowlist** today — the gate is a mandatory public login wall, not
  selective admission; "hand-approve 25" is net-new surface. And `createOnLogin:"users-without-wallets"`
  provisions a wallet at login → cost scales with applicants, not admits. At ~25 users Privy is **$0**
  (free ≤499 MAU); a public gate at MiniPay scale crosses into $299–499/mo — the curated cohort is the
  *cheap* option (phase2-e §2.1–§2.3).
- **Sequencing:** attribution first → close platform unknowns on one device → build admission
  (`createOnLogin:"off"` + approval before provisioning) → recruit ~25 as **interview subjects, not a
  control group** → report numbers with the confound list attached or not at all.
- **Tripwire to promote:** if MiniPay tags Discover launches distinguishably (phase2-e §1.8 Q2), run the
  acquisition-vs-retention split **within MiniPay** at full scale — no Privy needed; makes Web redundant
  as a comparison.

---

## 5. Sequencing

1. **E0 alone, first** — free, powered, causally upstream, and it *grows the engaged population* every
   other experiment needs (~11→~16/day if activation 35→45%).
2. **Freeze E0 at its final %, then E1** — a moving E0 ramp continuously changes E1's denominator
   composition (Simpson's-paradox generator). Not because concurrency breaks E0 (it can't — E0's metric
   is upstream), but for interpretive hygiene. With independent salts, E0+E1 concurrent is a valid 2×2
   for main effects; the interaction is not estimable at this traffic — don't report one.
3. **E1 and E2 must not run simultaneously** — both act on return, which can barely detect one effect.
4. **Attribution instrumentation** runs in parallel with E0 (content change, no traffic cost) and is the
   real acquisition-vs-retention experiment (§7).
5. **E3 / platform device-probe** off the critical path.

---

## 6. Pre-flight (all four are STOP-SHIP for E0) — phase2-a §5, phase2-c

| # | Check | Pass condition | Fails ⇒ |
|---|---|---|---|
| 1 | `onboarding_variant_assigned` rows exist in prod since 08-05, ~all `control` | count ≳ 0.9× LEARN tour-finishers | **Do not flip the flag** — you'd enable a treatment you can't measure. Ship the deploy carrying `990b527c` first. |
| 2 | `account_ref` coverage on the assignment event | report %, no threshold | Low ⇒ return is install-level (wipe-contaminated); write the caveat into the readout template now. |
| 3 | `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` on both projects (disputed 5 vs 10) + does `?slot=daily` consume quota | value recorded | Unknown ⇒ T3 uninterpretable; read T2 only. |
| 4 | Baseline T2 on the assigned denominator, by surface, NL excluded | a number with a CI | Missing ⇒ can't set the observation target. |

Also: **write and freeze the readout template** — primary metric, exclusion list, observation target,
and the literal sentence *"we will not claim a D1 effect from this experiment."*

---

## 7. Acquisition attribution — built end-to-end, zero producers (phase2-e §4)

The pipeline exists (capture → allow-list vocabulary → first-touch persistence → universal propagation
→ server sanitation → `analytics_events.source` + `session_first_seen.first_source`). **Nothing sets a
param** → every arrival is `direct`. Smallest durable mechanism, in cost order:
1. **Tag every outbound link we own** (`editorial.ts:2370` + `es.ts:69` + `/share/*` + challenge links)
   with the allow-list tokens already waiting (`share_generic`, `challenge_link`, `qr`). Content change.
2. **Campaigns work today, zero code** — `?utm_source=&utm_campaign=` is wired end to end and unused.
3. **MiniPay directory vs organic** can't be tagged (MiniPay owns the link) → harden the client-asserted
   `container` with a **server-side** `X-Requested-With = com.opera.minipay` check, stored as
   `server_container` **alongside** (never replacing) the client value. Needs one day of header logging
   to confirm the webview forwards it.
4. **Highest-value schema change:** add `first_source` (+ `server_container`) to `account_first_seen`
   (the durable wallet-keyed cohort currently lacks the acquisition dimension) — one column.

**Attribution strictly dominates Web EA as the instrument** for "acquisition vs product": it partitions
one real population (n≈7,124 + every future install) holding device/geo/container/auth/payment/storage
constant; Web EA varies all ten at once on n≈25. *One is an experiment; the other is an anecdote with a
control group drawn on it.*

---

## 8. Reproducible queries & tests

- **Queries:** phase2-c ships `p2a-return-def.sql … p2e-fix.sql` (return-definition comparison, boundary
  exposure, the five cohorts, four-layer metrics, guardrails) — each a self-contained CTE, re-runnable.
  The pre-flight counts (P-1 assignment rows, P-2 account_ref coverage, the `first_source`/`container`
  distributions) are the remaining pulls, blocked only by the account session-limit reset.
- **Tests for the code changes:** E0 measurement fix needs a unit test that the arm is stable across a
  simulated remount (assignment is a pure function of the install id — assert same input → same arm, and
  that the two late emitters no longer early-return on a null ref). E1 hook needs: streakType renders in
  LEARN, honesty guard (no hook when nothing moved), a11y (`aria-hidden` removed), and telemetry emission.
  All reuse existing harnesses.

---

## 9. What ships, what doesn't (this iteration)

| Item | Decision | Why |
|---|---|---|
| P0 `/api/peones/spend` authz | **SHIPPED** (flag-gated, separate branch) | security, separable |
| E0 funnel-tail gap (closure/hub-reached drop on reload) | **DOCUMENT, don't code** | affects only secondary funnel events; primary T2 (join-based) survives; the naive fix is incomplete and untestable |
| Attribution producers (tag owned links; campaigns) | **DO NOW** | content change; makes the real acq-vs-retention experiment possible |
| E0 enable (flag ramp) | **PREPARE, don't flip** | gated on the 4 pre-flight checks (need the account-limit reset to run the prod counts) |
| E1 hooks (streakType gate flip + DailyLimitBanner truth fix) | **DO NEXT** | truth-restorations, ship after E0 freezes; not A/B'd |
| `account_first_seen.first_source` + `server_container` | **PREPARE (migration, founder OK)** | durable attribution; needs prod migration |
| Add Cash deeplink host (`opera.com`→`link.minipay.xyz`) | **HAND TO PAYMENTS OWNER** | one-line, revenue path, independent |
| E2 channel | **BLOCKED** — no MiniPay primitive | needs an owned channel (Web/email) or the service-worker probe |
| E3 Web Early Access | **RUN SEPARATELY** later | channel + research, not an experiment |
| streak nudge | **DO NOT enable** | structurally unreachable under daily-first routing |
| Web EA folded into the retention test | **DO NOT BUILD** | contaminated; manufactures a false positive |

---

## 10. Standing unknowns (blocked on the account session-limit reset or a device)

1. True T2 baseline on the assigned denominator (sets the real MDE). *(prod query)*
2. `account_ref` coverage on the assignment event (wipe-proof return or not). *(prod query)*
3. Are `onboarding_variant_assigned` rows live in prod? — stop-ship. *(prod query)*
4. Session limit value + whether `?slot=daily` consumes quota. *(one `vercel env` read + code trace)*
5. Does the MiniPay webview support service workers / Web Push? — lifts the E-e ceiling. *(one device)*
6. Does `link.minipay.xyz/browse?url=` preserve query params, and does MiniPay tag Discover launches?
   — decides whether attribution reaches the re-entry channel and whether the within-MiniPay acq split
   is possible. *(ask MiniPay BD / one device)*
