# E0 (First-Activity / Activation) — ramp runbook 10% → 50%

**Date:** 2026-08-10 · **Status:** PREPARED, NOT EXECUTED. Nothing changed; no deploy.
**Context doc:** `docs/experiments/2026-08-10-activation-retention-experiment-design.md`.

## Confirmed pre-conditions (all verified against current prod, 2026-08-10)

| Fact | Value | Source |
|---|---|---|
| E0 already live | **~10%** first-activity, control the rest | telemetry: 32/324 assignments `first-activity`, ~100% of LEARN tour-finishers assigned from 08-06 |
| `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` | present on `lite-chesscito` **production**; deployed behaves as **10** | Vercel API (exists) + telemetry (behaves 10%) |
| `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` | present on production+preview; **5** (empirical cliff 4-5 + 2026-08-05 direct read) | Vercel API (exists) + completion-cliff query + prior audit |
| Daily auto-opened by E0 consumes session quota? | **NO** — `?slot=daily` is excluded from the quota ledger by design | `session-quota.ts:10` |
| account_ref coverage on assignment | **100%** (324/324) → return is wipe-proof per arm | telemetry |
| Treatment functioning | 32 requested → 32 ready, **0** `onboarding_activity_failed` in 5 days | telemetry |
| Recent traffic | ~52-55 LEARN tour-finishers/day (post-firehose, decaying) | telemetry |
| T2 measurability | SAFE WITH QUERY NORMALIZATION (existence of ≥1 canonical completion; render events excluded) | code + telemetry |

**Read: the 10% smoke has effectively passed (clean, 5 days). This runbook ramps to 50% for power. Skip 25% (costs 2.8× traffic, buys nothing).**

---

## THE CHANGE (execute later, not now)

- **Project:** `lite-chesscito` (LEARN) **ONLY**. Do **NOT** touch `chesscito` (PLAY) — E0 is LEARN-only.
- **Env / target:** Production. Set `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = 50`.
- **⚠️ It is `NEXT_PUBLIC_` = baked at BUILD time.** Changing the env value **does nothing until a
  production REDEPLOY of lite-chesscito**. Order: set env → redeploy.
- Dashboard path: lite-chesscito → Settings → Environment Variables → edit the var (Production) → 50
  → then Deployments → Redeploy the latest production deployment. (Or `vercel --prod` from a
  lite-chesscito-linked checkout, or push to its production branch.)

## VERIFY THE NEW BUNDLE ACTUALLY CONTAINS 50 (the load-bearing check)

Do **not** trust the dashboard value — a stale build or shell-vs-dotenv precedence can leave the old
value baked in. The **ground truth is the assignment split in telemetry**:

1. Confirm the redeploy finished and note the new production deployment SHA + timestamp.
2. Over the **first ~1 hour of post-deploy LEARN traffic** (≥ ~20-30 new assignments), run the
   assignment-split query below. **first-activity share must jump from ~10% toward ~50%.**
   - If it stays ~10% → the new value did **not** reach the bundle (stale build / env not applied /
     wrong project). **Roll back / investigate; do not keep running** — you'd be measuring the old arm mix.
3. Belt-and-braces (optional): open the deployed LEARN app in a fresh install and confirm the tour
   auto-opens the Daily more often than before; but the telemetry split is authoritative.

### Assignment-split verification query (run 1h+ post-deploy, then daily)

```sql
select created_at::date d, props->>'variant' variant, count(*) n,
  round(100.0*count(*)/sum(count(*)) over (partition by created_at::date),1) pct,
  count(*) filter (where account_ref is not null) with_acct
from public.analytics_events
where event='onboarding_variant_assigned' and created_at >= '<deploy_timestamp, e.g. 2026-08-10 12:23:56-05>'::timestamptz
group by 1,2 order by 1,2;
```

Expect: post-deploy days show `first-activity` pct ≈ 50; `with_acct` ≈ n (coverage stays 100%).
Also confirm **no** `onboarding_activity_failed` rows appear above ~5% of first-activity assignments:

```sql
select props->>'variant' v, event, count(*) n
from public.analytics_events
where event in ('onboarding_variant_assigned','onboarding_activity_failed','onboarding_fallback_to_hub')
  and created_at >= '<deploy_timestamp, e.g. 2026-08-10 12:23:56-05>'::timestamptz
group by 1,2 order by 1,2;
```

## READOUT — primary metric T2 activation (ITT, by arm, wipe-proof)

Read **only at the observation target** (~750 assigned both arms; inspect daily for guardrails only —
no peeking for efficacy). T2 = existence of ≥1 canonical completion per `account_ref`, never a SUM.

```sql
with assigned as (          -- one row per assigned account, its arm and day-0
  select distinct on (account_ref) account_ref, props->>'variant' variant, created_at::date d0
  from public.analytics_events
  where event='onboarding_variant_assigned' and account_ref is not null
    and created_at >= '<ramp_start_timestamp>'::timestamptz
  order by account_ref, created_at
),
act as (                    -- accounts with >=1 canonical value action (existence, not sum)
  select distinct account_ref, created_at::date d
  from public.analytics_events
  where event in ('exercise_complete','training_exercise_completed','daily_tactic_completed','arena_game_end')
    and account_ref is not null
)
select a.variant,
  count(*) assigned,
  count(*) filter (where exists (select 1 from act where act.account_ref=a.account_ref and act.d=a.d0)) activated_d0,
  round(100.0*count(*) filter (where exists (select 1 from act where act.account_ref=a.account_ref and act.d=a.d0))/count(*),2) t2_pct
from assigned a
where a.variant is not null
group by a.variant order by a.variant;
```

Pre-registered exclusions (apply in the final query): `first_country` = NL; the symmetric
`already-done` stratum. Report a **CI on the difference**, not two point estimates. Secondary
(accumulate, no decision): T3 depth, engaged-D1 (underpowered — never claim a D1 effect here).

**Falsifier:** at target, the 95% CI on the T2 difference **excludes +10pp** → decision-load is not
the cliff. CI containing 0 and +10pp = underpowered, not falsified.

## KILL SWITCH

Set `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = 0` on lite-chesscito Production → **redeploy**.
Effect once the build ships; does **not** reassign anyone already bucketed (tour seen-flag written).
Returns everyone to control = the byte-for-byte pre-experiment hub. Partial: set back to `10`.

## ROLLBACK TRIGGERS (stop for harm; never stop for good news)

- `onboarding_activity_failed` > 5% of first-activity assignments (any reason).
- Assignment split does **not** move toward 50% in the first hour post-deploy (value didn't reach the
  bundle — investigate the build).
- Daily opening for already-done players (a `daily-already-done` logic break).
- Guardrail breach traced to E0: offer-conversion or victory-mint rate down >20% relative;
  signature-rejection rate up; any crash on the auto-open on the LEARN origin.

## HOLD (pause ramp, keep arm)

- LEARN tour-finishers fall below ~30/day (observation target recedes — accept a larger MDE or pause).
- Any second change ships to the LEARN hub or the Daily → restart the observation count.

## OBSERVATION TARGET & SEQUENCING

- ~750 assigned (both arms) for a +10pp MDE at 50/50 → ~2 weeks at ~55/day (traffic decaying — if it
  keeps falling, decide whether to accept a larger detectable effect).
- Freeze E0 at its final % before starting E1 (a moving ramp changes E1's denominator composition).
- Session-limit exact value (5) only affects the **secondary** T3 read; confirm with one
  `vercel env` read on lite-chesscito if T3 is to be reported. Not required for the T2 primary.
