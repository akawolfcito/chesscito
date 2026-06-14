# Red-team — Coach Analysis Value Design Spec

**Date:** 2026-06-13
**Reviews spec:** `2026-06-13-coach-analysis-value-design.md`
**Method:** 2 independent adversarial agents (technical correctness + product/economy/money), all findings cross-checked against code by the author. Pivotal findings re-verified directly (see Verification).

## Verdict

The spec has **P0 holes in all three pillars**. Do NOT proceed to implementation as written. Two claims that the design rests on are FALSE against the installed code.

## Verification (author-confirmed)

- **Next 14.2.35**: `next/server` exports neither `after` nor `unstable_after` (`typeof` both = undefined). `@vercel/functions` is NOT installed. → Unit 1's durability primitive does not exist without a new dependency or a Next major upgrade.
- **`sign-victory` random nonce, no gameId**: `createNonce()` = `BigInt(hexlify(randomBytes(8)))` (`demo-signing.ts:180-181`); `/api/sign-victory/route.ts` has no `gameId` param (creates a fresh random nonce at `:95`). → Nothing ties a mint to a game. The same victory can be minted/charged twice (after the 30s `mintCooldown`). The spec's "idempotency at the charge boundary" has no boundary to attach to.

## P0 findings

1. **`after()`/`waitUntil` unavailable (Unit 1 unbuildable as written).** Fix needs an explicit dependency decision: add `@vercel/functions` (`waitUntil`) or upgrade to Next 15 (`after`). Until chosen, the route stays terminable pre-persist and the render bug stands. The spec listed this as "open question #2" — it is actually a blocking prerequisite.

2. **No charge boundary for the money guard (double-mint is real).** `/api/sign-victory` signs a fresh random nonce every call with no gameId; `VictoryNFTUpgradeable.sol` dedups only by `usedNonces[sender][nonce]` + a 30s global cooldown — **no per-game guard, no gameId on-chain**. Tapping Save twice on the same game (30s apart) = two payments + two NFTs. The spec's "re-verify on-chain ownership before charging" is unimplementable: "did THIS game mint?" is not queryable on-chain. Real fixes (need a decision): (a) deterministic nonce derived from gameId → `usedNonces` becomes a per-game guard; (b) on-chain `mintedGames` mapping; (c) accept a soft off-chain gate and harden `mint-receipt` persistence as authoritative. **This needs its own spec — money + on-chain.**

3. **Viewer has no job poller (Unit 2 assumes reuse that doesn't exist).** `CoachLoading` (the only poller, `coach-loading.tsx`) is rendered ONLY in `arena/page.tsx:1440`; `coach-game-client.tsx` renders 0 pollers and never consumes `coach.jobId`. There is no `pendingJobId` prop on the page loader or client. Unit 2 is net-new wiring, not "existing mechanism."

4. **The arena redirect won't fire under the new `{jobId}` flow.** `arena/page.tsx:737` gates on `phase==="result"||"fallback"`. If analyze returns `{jobId}` → `phase="loading"`, the redirect never triggers from loading. Today it fires because analyze is synchronous (`status:"ready"`→result). Making analyze async neuters the navigation. The tap handler has no co-located `router.push`; the spec says to "remove dependence on" the redirect but never adds the replacement. (Note: the arena popup HAS its own poller, so the analysis would actually resolve *in the arena popup*, then redirect — meaning the loading happens on the wrong surface vs. the founder's "creates while in Match Review" intent.)

## P1 findings

5. **Cost ribbon "♟ 1 Peón" is economically false for credit-holders.** Consumption order is **Redis Coach credits FIRST** (`paywall-gate.ts:11-12`, `shouldShowPaywall` false while `credits>0`); free users get 3 seeded credits (`analyze/route.ts:149-155`); Peones spend only when `credits===0`. So the ribbon must have THREE states: "1 credit" / "1 Peón" / "PRO" — the spec enumerates two. The "1 Peón/analysis" headline is wrong for the common case.

6. **Fallback never persists → original bug recurs in the viewer.** `generateQuickReview` output lives only in client `coach.fallbackResponse` (`use-coach-analysis.ts:221`), never written to Redis. On the durable-job flow, a `failed`/offline job that navigates to `/coach/[gameId]` hits Unit 2's "no analysis, no job → idle" → empty Match Review = the ORIGINAL bug. The spec's error-handling assumes the viewer "shows CoachFallback" but nothing persists it.

7. **`await postMintReceipt` retry doesn't close the 404 ordering hole.** `mint-receipt/route.ts:101-104` returns 404 when the gameRecord isn't persisted yet (ordering race). Retrying a 404 burns retries and still fails → Save re-offered on cold reopen. Retry must distinguish transient vs 404; the real fix is ordering the gameRecord write before the receipt write.

8. **`jobByGame` TTL race.** `job`/`jobByGame`/`pendingJob` set `ex:60`; the success path flips `job`→ready (30d) and dels `pendingJob` but NOT `jobByGame`. With `LLM_TIMEOUT_MS=45_000` + mobile cold load, `jobByGame` can expire before the viewer reads it → no `pendingJobId` → idle, despite a running/ready job. The 30d analysis key survives, so a *reload* renders — but the watched session shows nothing.

9. **Silent-spend invariant not airtight.** Resume-guard = "is there a `jobByGame`?" — a 60s wallet+game-scoped key, not a per-surface intent record. A cross-tab/bookmark refresh within 60s resumes+renders without a tap on that surface. No double-charge (spend already happened), but the stated invariant is false and the regression test wouldn't catch it.

## P2 findings

10. **Empty-gameId spends a Peón against `""`.** `use-coach-analysis.ts:196` spends with `gameId: analyzeGameId ?? ""` BEFORE the `!analyzeGameId` not-persisted branch (`:213`). A no-gameId tap can debit a Peón for a never-persisted quick review.

## Missing UI states (violates project HARD RULE "enumerate all UI states")

- **Loss/draw/resigned + ribbon + copy.** Coach IS offered on non-wins (`game-actions-bar.tsx:210-212`); the "Why did you win?" frame has no loss/draw counterpart, and the ribbon's loss-state cost is unspecced.
- **Credit-holder ribbon** (state #3, finding 5).
- **0-credits + 0-Peones free user** — spec says ribbon still shows "♟ 1" then bounces to paywall = dishonest; needs a locked/insufficient variant.
- **Guest / no-wallet** — ribbon state undefined (no credits/Peones/PRO query).
- **PRO hook unsettled on first paint** — viewer's `proActive` comes from `useIsProActive()` (`coach-game-client.tsx:45`), a localStorage-cached hook → flicker (MEMORY `pro-recognition-pattern`). No skeleton specced.

## Recommended scope split + order

1. **Money guard (re-spec first).** Only true P0 to users. Needs its own spec deciding deterministic-nonce vs on-chain `mintedGames` vs hardened soft-gate. Don't ship render polish over a live double-charge.
2. **Render fix (Units 1+2+3, one plan).** Blocked until the `waitUntil`/Next decision is made. Add viewer poller + `pendingJobId` + explicit `router.push` + `jobByGame` TTL fix + persist-fallback-or-don't-redirect-on-fallback.
3. **Cost ribbon (last).** Rebuild on the real currency model (credit/Peón/PRO) + enumerate all missing UI states + loss/draw copy.

Worst ordering to avoid: shipping the ribbon first (easy, visible) while the double-charge stands.

## Decisions needed from founder

- **Money guard approach** (deterministic nonce / on-chain mapping / soft-gate) — on-chain, money, needs founder call.
- **Render durability primitive** — add `@vercel/functions` vs Next 15 upgrade.
- **Ribbon currency truth** — show real currency (credit vs Peón vs PRO) or simplify the economy so "1 Peón" becomes true.
- **Loss/draw coach framing** — copy + cost for non-win reviews.
