# P0-4 Runtime Results — MiniPay Zero-Click

**Status:** ✅ **CLOSED — PASS**

## Context

- **Date:** 2026-06-03
- **Environment:** Production
- **URL:** `https://www.chesscito.com`
- **Production HEAD at validation close:** `08a50a72` (sign-routes labyrinth env fix + revert debug logs, FF-promoted from main)
- **Devices:** Android (primary) + iOS (smoke)
- **Tester:** Wolfcito
- **Cluster precedent:** triggered the sign-routes labyrinth env regression discovery (`8c28c3d4`); validation re-run after fix promoted to production.

## Golden path — 6/6 PASS

| Step | Surface | Expected | Observed | Result |
|---|---|---|---|---|
| 1.1 | Open URL in MiniPay | Landing renders, 390px aligned, no horizontal scroll | Confirmed | ✅ PASS |
| 1.2 | Detect MiniPay context | Wallet auto-injected, no Connect modal | Confirmed (no modal seen anywhere in flow) | ✅ PASS |
| 1.3 | Auto-route → `/hub` | Lands on `/hub` without manual tap | Confirmed | ✅ PASS |
| 1.4 | `/hub` HUD without Connect | HUD shows truncated address / ProBadge instead of Connect CTA | Confirmed (no Connect surface visible) | ✅ PASS |
| 1.5 | Account/Profile sheet shows wallet | Sheet opens, address rendered | Confirmed | ✅ PASS |
| 1.6 | Shop reads live balance | Pricing visible, purchase flow functional | Confirmed (purchased multiple items in-session) | ✅ PASS |

## Out-of-band findings during validation

Validation surfaced a separate production bug that was repaired in-session:

- `/api/sign-score` and `/api/sign-victory` returned 400 on iOS + Android due to `getDemoConfig()` eagerly requiring `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`, an env var legitimately absent on mainnet pending Labyrinth D.2 promote.
- Root cause: shared signing config contaminated by chain-specific env req introduced in `ac149a1e`.
- Fix: split into dedicated `getLabyrinthBadgesAddress()` getter so labyrinth env requirement is scoped to `/api/sign-labyrinth` only.
- Shipped: `8c28c3d4 fix(api): scope labyrinth env requirement to sign-labyrinth route` + `08a50a72 revert(debug): remove temp 400 logs`.
- Validation post-fix: Save Victory + Save Score both returned 200 with valid signature payloads against `www.chesscito.com`.
- Memory captured: `feedback_sign_routes_labyrinth_env_fix.md`.

## iOS anexo (optional smoke)

- Same golden path exercised on iOS during the failure-mode session against preview; UI rendered correctly and wallet detection worked.
- iOS is NOT a P0-4 sign-off requirement per session brief (Android-first MiniPay distribution).
- Recorded here only as supplementary evidence that the fix benefits both platforms.

## MiniPay readiness checklist — updated

| # | Item | Prior | New | Notes |
|---|---|---|---|---|
| P0-1 | PageSpeed 90+ mobile | 🟡 79-83 | 🟡 79-83 (unchanged) | Gap to 90+ pending HubDailyTile SSR cluster |
| P0-2 | Canonical `www.chesscito.com` | ✅ | ✅ | — |
| P0-3 | 360×640 viewport coverage | ✅ | ✅ | — |
| **P0-4** | **Zero-click connect runtime** | ⏳ | **✅** | **Closed this session** |
| P1-5 | `/stats` page MVP | ✅ | ✅ | — |
| P1-6 | CELO hidden on MiniPay | ✅ | ✅ | — |
| P1-7 | Identity ODIS phone-first | ❌ | ❌ | Scope mayor, deferred |
| P1-8 | Copy sweep extended | ✅ | ✅ | — |
| P1-9 | Low-balance → Add Cash | ✅ | ✅ | — |

**Count: 7 of 9 closed** (was 6/9). Remaining open: P0-1 partial gap, P1-7 scope mayor.

## Sign-off

P0-4 closed at production HEAD `08a50a72`. No further validation required for this checklist item. Next blocker on the MiniPay readiness path is P0-1 perf gap (HubDailyTile SSR cluster decision pending).
