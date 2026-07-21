# 21-Day Mind Challenge Entitlements Audit

Date: 2026-07-18  
Scope: Chesscito LEARN / Lite, 21-Day Mind Challenge, Season Pass, Focus Passport, Daily Focus, Shields, PRO inclusion, payment and persistence behavior.

## 1. Executive Summary

The implemented product is a Lite-only wallet-bound Training Pass purchase plus a local daily habit loop. The $0.99 direct Season Pass creates a 21-day server entitlement for the paying wallet, grants up to +3 durable Shields via Redis, and changes the Challenge card state from offer to active. It does not currently unlock a separate pool of exercises, a server-backed Focus Passport, a missed-day recovery mechanic, or on-chain "Proof of Consistency".

Focus Passport and focus days are local-only derivations from Daily Tactic completions in `localStorage`. A user can play Daily Focus, build a streak, earn Focus Passport slots, and progress through training without buying the Challenge. PRO is treated as an effective Training Pass source and outranks direct Season Pass in status resolution, but PRO does not receive the direct-purchase +3 Shields bonus.

The highest-risk overpromise is "Unlimited challenge practice for 21 days": the codebase has daily session quota logic that is not lifted by Season Pass, and the Challenge has no dedicated gated challenge-practice catalog. "Proof of Consistency" is not implemented for the Challenge. The technically accurate promise is: "21-day wallet entitlement, Focus Passport status, and +3 direct-purchase Shields; Daily Focus and training remain playable without the pass."

## 2. Veredicto: Qué Compra Realmente El Usuario Por $0.99

For a connected wallet on Celo mainnet in Lite mode, $0.99 buys:

- A direct stablecoin `ERC20.transfer(treasury, amount)` Season Pass SKU `lite_season_pass_21`.
- A row in `lite_season_passes`, with `expires_at = now + 21 days`.
- A Redis active-pass TTL key `lite:season-pass:<wallet>`.
- A direct-purchase Shield credit of 3 via `coach:shields:credited:<wallet>`, unless Redis credit fails, in which case the API returns `shieldsPending`.
- UI status: Challenge card changes from offer to active and displays Day N/21 derived from expiry.

It does not buy:

- Server-persisted Focus Passport days.
- A Challenge-exclusive Daily Tactic.
- Extra exercises beyond the current Lite quota implementation.
- Missed-day recovery.
- On-chain consistency proof.
- A separate account identity beyond the wallet address.
- The PRO entitlement; PRO is a separate $1.99 / 30d product that includes effective Training Pass access.

## 3. Entitlements Table

| Functionality | Real classification | Evidence | Notes |
|---|---:|---|---|
| 21-day duration | Implemented for direct Season Pass | `rail-config.ts:145-154`; `verify-payment/route.ts:240`; migration `20260625120000_lite_season_passes.sql:11-31` | TTL starts at payment verification, not first focus day. |
| Challenge active state | Implemented | `use-hub-data.ts:387-420`; `challenge-card.tsx:127-179` | Active from direct pass or PRO source. |
| Focus Passport | Available to all Lite users, local-only | `daily/progress.ts:58-97`; `daily/passport.ts:1-9`; `focus-passport.tsx:31-36` | Not wallet-bound; lost on device/storage loss. |
| Focus days | Available to all, local-only | `challenge-card.tsx:131-145`; `use-hub-data.ts:287-312` | `done = min(streak, 21)`, not completed calendar days. |
| Daily Focus / Daily Tactic | Available to all | `hub-daily-tile.tsx:150-248`; `challenge-daily-client.tsx:61-70` | Solving records local daily completion regardless of pass. |
| Daily gifts | Implemented as daily gift trigger + Welcome Package gift | `hub-lite-scaffold.tsx:162-180`; `hub-daily-tile.tsx:311-345`; `welcome-package-modal.tsx:37-190` | Daily gift is not exclusive to Challenge. |
| +3 Shields | Direct Season Pass only | `rail-config.ts:145-154`; `verify-payment/route.ts:271-300`; `season-pass-celebration.tsx:13-18` | PRO inclusion does not grant +3. |
| Shield use | Implemented for failure rescue | `fail-rescue-modal.tsx:123-143`; `exercises-screen.tsx:1740-1833` | Shields rescue failed exercises/streak context, not missed days. |
| Season Pass direct purchase | Implemented | `season-pass-sheet.tsx:168-293`; `use-season-pass-rail.ts:162-217`; `verify-payment/route.ts:227-317` | Requires connected wallet, Celo mainnet, configured treasury and payable token. |
| PRO includes Season Pass | Implemented as effective Training Pass access | `effective-training-pass.ts:18-43`; `season-pass/status/route.ts:35-52`; `challenge-card.tsx:167-178` | PRO wins as source; direct pass purchase rejected for active PRO wallet. |
| Direct purchase exclusive | +3 Shields only | `season-pass-sheet.tsx:147-167`; `verify-payment/route.ts:158-164`, `271-300` | Offer copy correctly names "direct-purchase +3 Shields bonus". |
| Unlimited challenge practice | Visually shown, not supported as stated | `editorial.ts:3435-3438`; `daily/session-quota.ts:21-37`, `95-113`; `exercises-screen.tsx:635-655`, `3196-3205` | No pass check in quota gate; Challenge slot bypass exists only by `slot=challenge`, not proven used by pass. |
| Challenge expiration | Implemented for direct pass status | `season-pass/status/route.ts:90-118`; `effective-training-pass.ts:31-40` | Expired pass returns inactive; no completion/end ceremony found. |
| Day 21 completion | Not implemented as lifecycle moment | No completion event or overlay found; day display clamps via `challenge-day.ts:1-19` | No distinction between expired and completed. |
| Proof of Consistency | Not implemented for Challenge | `editorial.ts:3388-3392` explicitly avoids proof/on-chain wording | There are generic proof/save paths, but not Challenge consistency proof. |
| On-chain actions for Challenge | Payment only | `use-season-pass-rail.ts:178-207`; `verify-payment/route.ts:186-225` | Passport/progress are off-chain local. |

## 4. Comparative Matrix

| User state | Can play Daily Focus | Focus Passport | Training progress | Join Challenge CTA | Season Pass access | +3 Shields | PRO access | Persistence |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Guest / visitor | Yes | Yes, local | Yes, local | Button can open sheet, but payment unavailable without wallet | No | No | No | Device `localStorage`; ephemeral if storage fails. |
| Signed-in user | No separate signed-in account found | Same as guest | Same as guest | Same as guest unless wallet exists | No account entitlement | No | No | No social auth implementation found. |
| Wallet-connected user | Yes | Yes, still local | Local plus server writes for some rewards/saves | Yes if Lite, no active pass, status resolved | No until purchase | No until purchase | Maybe, if Redis PRO key active | Wallet-bound backend entitlements; progress mostly local. |
| Direct Season Pass holder | Yes | Yes, local | Same content; active card | Hidden/disabled | Yes, `source=season_pass` | Yes, direct bonus | No unless separately bought | Entitlement backend; Passport local. |
| PRO holder | Yes | Yes, local | Same content; PRO cosmetics/access | Hidden/disabled | Yes, `source=pro` | No direct bonus | Yes | PRO Redis; Passport local. |

## 5. Lifecycle Map

1. Visitor lands on LEARN. WalletProvider auto-connects only in MiniPay if an injected MiniPay provider exists (`wallet-provider.tsx:39-56`). Outside MiniPay, user may remain guest.
2. Guest identity is generated locally if needed (`guest-id.ts:37-47`; `use-guest-identity.ts:22-32`).
3. First session hydrates local progress, daily progress, session quota, shields and season status (`use-hub-data.ts:245-333`, `387-420`).
4. Challenge candidate sees offer card with 21 days, +3 Shields, price, Join Challenge (`challenge-card.tsx:234-290`).
5. Purchase attempt opens `SeasonPassSheet` from `onJoinChallenge` only when status is not loading and inactive (`learn-hub-client.tsx:428-434`, `587-598`).
6. Wallet/auth requirement: if no wallet, wrong chain, missing treasury or unsupported token, rail is unavailable and sheet shows "Connect your wallet on Celo to purchase" (`season-pass-sheet.tsx:181-188`; `use-season-pass-rail.ts:77-79`).
7. Successful purchase sends direct stablecoin transfer, waits for receipt, verifies backend, inserts pass, credits Shields and refreshes status (`use-season-pass-rail.ts:178-207`; `verify-payment/route.ts:227-317`).
8. Day 1 active state is derived from expiry (`challenge-day.ts:1-19`), not from first Daily Focus completion.
9. Later focus days are Daily Tactic completions that update local `chesscito:daily-progress` (`daily/progress.ts:81-97`; `hub-daily-tile.tsx:150-170`).
10. Missed day resets streak to 1 on next completion if last date is older than yesterday (`daily/progress.ts:70-78`).
11. Shield use occurs on failed exercises, via `/api/shields/spend`, and can reset board while preserving streak context (`exercises-screen.tsx:1740-1833`).
12. Day 21 is only a display clamp. No end-of-challenge completion, badge, proof, or renewal flow found (`challenge-day.ts:15-18`).
13. Expiration: Redis key expires; Supabase fallback returns only active rows with `expires_at > now`; effective pass becomes inactive (`season-pass/status/route.ts:55-118`; `effective-training-pass.ts:31-40`).

## 6. Real Gates

| Gate | Real behavior | Evidence |
|---|---|---|
| Challenge content blocked | No Challenge-exclusive content gate found | `deriveContentLoopAction` ignores Season Pass; `content-loop.ts:318-382`. |
| Recommended content | Start Focus routes to Daily Focus or next path action | `learn-hub-client.tsx:435-463`; `content-loop.ts:329-382`. |
| Focus day increment | Daily Tactic solve only | `recordDailyCompletion` in `hub-daily-tile.tsx:150-170`; `daily/progress.ts:81-97`. |
| Passport stamp | Derived from streak count | `daily/passport.ts:65-95`; `challenge-card.tsx:136-145`. |
| Rewards | Daily Peones only when connected; Lite suppresses Peones block | `hub-daily-tile.tsx:170-228`; `daily-tactic-sheet.tsx:214-269`. |
| Shields consumed | Failed exercise rescue via `/api/shields/spend` | `exercises-screen.tsx:1740-1833`. |
| Actions requiring tx | Season Pass purchase, PRO purchase, badge claim, on-chain proof/save paths | `use-season-pass-rail.ts:178-207`; `exercises-screen.tsx:1853-1935`, `3319-3433`. |
| Off-chain actions | Daily progress, training stars, session quota, Passport | `daily/progress.ts:58-97`; `daily/session-quota.ts:155-193`; `lite-progress-storage.ts:18-39`. |
| Optional on-chain | Score proof/save and badge claim, not Focus Passport | `editorial.ts:166-171`; `exercises-screen.tsx:3248-3258`. |

## 7. Copy Promise Validation

| Claim | Where it appears | Code backing | Verdict | Technically correct wording |
|---|---|---|---|---|
| "21 days" | Challenge card stats, tour, checkout, celebration | `rail-config.ts:145-154`; `challenge-card.tsx:238-241`; `editorial.ts:3490-3492` | True for entitlement TTL | "21-day wallet pass from purchase verification." |
| "+3 Shields" | Challenge card stats, tour value, checkout, celebration | `rail-config.ts:148-150`; `verify-payment/route.ts:271-300`; `season-pass-celebration.tsx:50-55` | True for direct purchase; false for PRO source | "+3 Shields with direct pass purchase." |
| "Focus Passport" | Card label, Passport component | `challenge-card.tsx:181-206`; `focus-passport.tsx:31-36`; `daily/passport.ts:1-9` | True as local streak UI | "Local Focus Passport streak." |
| "Unlimited challenge practice for 21 days" | Checkout offer | `editorial.ts:3435-3438` | Engañoso / unsupported | "21-day Challenge status and daily habit tracking." |
| "Build a daily chess habit" | Checkout, tour, celebration | `editorial.ts:3435-3437`, `3449`, `3490` | Partially true | "Use Daily Focus to build a local daily streak." |
| "Keep your Focus Passport active" | Checkout | `editorial.ts:3436`; `daily/progress.ts:70-78` | Partially true | "Keep your local streak active by solving Daily Focus each UTC day." |
| "Daily gifts" | Tour and hub corner icon | `hub-lite-scaffold.tsx:162-180`; `editorial.ts:3474-3479` | True as UI trigger; not pass-exclusive | "Daily gift opens today's free tactic." |
| "Proof of Consistency" | Requested audit claim; no matching implemented Challenge copy found | `editorial.ts:3388-3392` explicitly avoids proof/on-chain claims | Not implemented | "Local focus streak; optional on-chain proofs are separate." |
| "Coach PRO includes the Season Pass" | Active card and checkout included state | `effective-training-pass.ts:18-43`; `season-pass/status/route.ts:35-52`; `season-pass-sheet.tsx:147-156` | True as effective access, not as direct pass row or +3 Shields | "PRO includes Training Pass access; direct-purchase Shield bonus is separate." |

## 8. Payment Flow Real

1. `Join Challenge` opens `SeasonPassSheet` only when inactive and status resolved (`learn-hub-client.tsx:428-434`).
2. Sheet selects a payable stablecoin from balances (`season-pass-sheet.tsx:77-84`).
3. Rail is available only with configured treasury, Celo mainnet chain ID 42220, and supported token (`use-season-pass-rail.ts:74-79`).
4. `pay()` builds a direct Season Pass transfer and calls `writeContractAsync` (`use-season-pass-rail.ts:162-207`).
5. Backend verifies treasury, chain, SKU, token, direct transfer, amount and anti-replay (`verify-payment/route.ts:135-225`).
6. Season Pass branch rejects active PRO (`verify-payment/route.ts:158-164`), writes Supabase via RPC and credits Redis Shields + TTL key (`verify-payment/route.ts:227-317`).
7. Client syncs Shields from server and refreshes Season Pass status (`use-season-pass-rail.ts:117-139`; `learn-hub-client.tsx:591-597`).

No pending purchase intent is stored before signature. If the user closes the sheet or reloads after broadcast but before verify, recovery depends on manually retrying with the tx hash, which the UI does not expose as a resumable intent.

## 9. Wallet Flow Real

- MiniPay is detected from `window.ethereum.isMiniPay` or `window.provider.isMiniPay` (`minipay.ts:28-35`).
- WalletProvider auto-connects in MiniPay if provider exists (`wallet-provider.tsx:39-56`).
- Outside MiniPay, the Connect chip calls `useConnectWallet`, which silently no-ops if no injected connector exists (`use-connect-wallet.ts:21-32`).
- Account sheet hides copy/disconnect controls in MiniPay because wallet is not interchangeable there (`account-sheet.tsx:85-90`, `174-201`, `382-392`).

## 10. Expiration And Completion Flow

Expiration exists; completion does not. Active status requires non-expired PRO or Season Pass (`effective-training-pass.ts:31-40`). Direct Season Pass status is cached in Redis with TTL and falls back to Supabase active-row query (`season-pass/status/route.ts:55-118`). Day display clamps to 1...21 from expiry (`challenge-day.ts:15-18`). No code was found for "challenge completed", "Day 21 complete", end ceremony, renewal prompt, or historical completed Challenge record.

## 11. Functional Gaps

- No Challenge-exclusive unlocks or gates.
- No server-backed Focus Passport.
- No wallet migration for local Passport/progress across devices.
- No missed-day Shield mechanic.
- No 21-day completion state.
- No Challenge-specific proof/mint.
- No pending transaction intent for interrupted Season Pass checkout.
- No social login/account binding.
- Session quota does not appear to honor Season Pass despite "Unlimited" copy.

## 12. UX Gaps

- Guest can reach checkout but unavailable state says connect wallet, not why web without provider cannot proceed.
- PRO inclusion and direct-purchase bonus are easy to conflate.
- "Focus Passport active" implies a durable pass-backed object; implementation is local streak.
- Day N/21 can advance with wall-clock expiry even if user never completes focus days.
- Expired state collapses to offer without explaining what happened.

## 13. Instrumentation Gaps

- No `season_pass_sheet_opened`, `season_pass_pay_clicked`, `season_pass_unavailable_view`, `season_pass_cancelled`, or `season_pass_resumed` found in the rail.
- No explicit expiration/completion events.
- Challenge link telemetry exists for shared Daily Challenge (`challenge-daily-client.tsx:53-74`), but not the paid pass lifecycle.
- Wallet connect no-provider no-op has no telemetry.

## 14. Conversion Risks

- Unavailable checkout can look like a dead end on web without wallet.
- "Unlimited" claim can convert the wrong expectation and create refund/support risk.
- No resumable checkout after a broadcast or reload.
- PRO users are blocked from direct pass purchase, but the user may not understand that +3 Shields are direct-purchase-only.

## 15. Overpromise Risks

- "Unlimited challenge practice" conflicts with Lite quota and absence of pass-specific unlock.
- "Proof of Consistency" is not present in Challenge code.
- "Focus Passport" may be read as durable/account-backed, but it is local-only.
- "+3 Shields" is true only for direct purchase, not PRO-included pass access.

## 16. Open Questions

- Is Season Pass intended to remove/extend `DailySession` quota? If yes, no implemented gate was found.
- Is `slot=challenge` expected to be a pass-exclusive practice lane? No route or CTA confirmed it.
- Should a PRO user receive +3 Shields when PRO includes Training Pass? Current code says no.
- Should Day N/21 represent paid-pass age or completed focus days? Current UI shows both, from different sources.
- Should Challenge completion create a badge, proof, or shareable record? No implementation found.

## 17. Recommendations

P0:

- Remove or replace "Unlimited challenge practice for 21 days" unless pass-aware quota/unlock is implemented.
- Add pending transaction intent for Season Pass checkout before wallet signature.
- Clarify copy: PRO includes access; +3 Shields are direct-purchase-only.
- Add a web-without-wallet recovery state instead of relying on connect no-op.

P1:

- Decide whether Focus Passport is local-only or wallet-backed. If wallet-backed, add server model before monetizing it as durable.
- Add expiration/completion UI states for direct pass and PRO-included access.
- Instrument the full Season Pass funnel.

P2:

- Consider a Challenge completion reward only after the product has a real completion model.
- Add cross-device progress restore if Challenge habit is core monetization.

## 18. Files Inspected

- `apps/web/src/components/hub/challenge-card.tsx`
- `apps/web/src/components/hub/focus-passport.tsx`
- `apps/web/src/components/hub/learn-hub-client.tsx`
- `apps/web/src/components/hub/hub-lite-scaffold.tsx`
- `apps/web/src/components/hub/use-hub-data.ts`
- `apps/web/src/components/hub/hub-tour.tsx`
- `apps/web/src/lib/hub/hub-tour.ts`
- `apps/web/src/lib/hub/content-loop.ts`
- `apps/web/src/components/payments/season-pass-sheet.tsx`
- `apps/web/src/components/payments/season-pass-celebration.tsx`
- `apps/web/src/lib/season-pass/use-season-pass-status.ts`
- `apps/web/src/lib/season-pass/use-season-pass-rail.ts`
- `apps/web/src/lib/season-pass/challenge-day.ts`
- `apps/web/src/lib/entitlements/effective-training-pass.ts`
- `apps/web/src/app/api/season-pass/status/route.ts`
- `apps/web/src/app/api/verify-payment/route.ts`
- `apps/web/src/lib/payments/rail-config.ts`
- `apps/web/src/lib/daily/progress.ts`
- `apps/web/src/lib/daily/passport.ts`
- `apps/web/src/lib/daily/session-quota.ts`
- `apps/web/src/components/daily/daily-tactic-sheet.tsx`
- `apps/web/src/components/daily/hub-daily-tile.tsx`
- `apps/web/src/components/daily/daily-tactic-slot.tsx`
- `apps/web/src/components/exercises/exercises-screen.tsx`
- `apps/web/src/components/exercises/fail-rescue-modal.tsx`
- `apps/web/src/components/daily/daily-limit-banner.tsx`
- `apps/web/src/lib/minipay.ts`
- `apps/web/src/components/wallet-provider.tsx`
- `apps/web/src/lib/wallet/use-connect-wallet.ts`
- `apps/web/src/lib/identity/guest-id.ts`
- `apps/web/src/lib/identity/identity-lite.ts`
- `apps/web/src/lib/identity/use-guest-identity.ts`
- `apps/web/src/lib/lite-progress-storage.ts`
- `apps/web/src/lib/content/editorial.ts`
- `apps/web/src/lib/content/messages/en.ts`
- `apps/web/supabase/migrations/20260625120000_lite_season_passes.sql`
- `apps/web/supabase/migrations/20260630120000_get_peones_treasury_canary_foundation.sql`

## 19. Evidence Index

- Challenge card states and stats: `apps/web/src/components/hub/challenge-card.tsx:16-22`, `127-145`, `167-178`, `234-290`.
- Hub data hydration and Season Pass derivation: `apps/web/src/components/hub/use-hub-data.ts:287-333`, `387-420`.
- Join CTA opens pass sheet: `apps/web/src/components/hub/learn-hub-client.tsx:428-434`, `587-598`.
- Season Pass constants: `apps/web/src/lib/payments/rail-config.ts:125-159`.
- Payment rail phases: `apps/web/src/lib/season-pass/use-season-pass-rail.ts:29-49`, `77-79`, `162-217`.
- Payment verification: `apps/web/src/app/api/verify-payment/route.ts:135-225`, `227-317`.
- Status API and PRO inclusion: `apps/web/src/app/api/season-pass/status/route.ts:35-52`, `55-118`.
- Effective entitlement priority: `apps/web/src/lib/entitlements/effective-training-pass.ts:18-43`.
- Focus Passport local-only: `apps/web/src/lib/daily/progress.ts:58-97`; `apps/web/src/lib/daily/passport.ts:1-9`, `65-95`.
- Session quota: `apps/web/src/lib/daily/session-quota.ts:21-37`, `95-113`, `177-193`.
- Exercise consumption and quota banner: `apps/web/src/components/exercises/exercises-screen.tsx:314-335`, `635-655`, `1576-1579`, `3196-3205`.
- Shields rescue: `apps/web/src/components/exercises/exercises-screen.tsx:1740-1833`; `apps/web/src/components/exercises/fail-rescue-modal.tsx:123-143`.
- Copy source: `apps/web/src/lib/content/editorial.ts:3388-3450`, `3462-3503`.
