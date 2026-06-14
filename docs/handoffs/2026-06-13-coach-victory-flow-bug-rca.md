# RCA — Coach analysis lost + Save/Trophy tile wrong after on-chain save

**Date:** 2026-06-13
**Reporter:** Founder (PRO account, MiniPay "Mini App Test" build)
**Surface:** Win → Save Victory on-chain → "Victory Saved" popup → tap "Why did you win?"
**Severity:** P1 (one money-adjacent bug = repeat-charge risk)

## Repro (founder, with screenshots)

1. Won match, saved Victory **on-chain** → "Victory Saved" popup (`VictoryClaimSuccess`).
2. Tapped purple **"Why did you win?"** CTA.
3. Saw **"Coach is thinking… Keep this screen open."** (`CoachLoading`, jobId polling).
4. Redirected to **`/coach/[gameId]` "Match review"** — board + MOVES rendered, **but NO analysis panel**, and the **middle action tile was absent** (neither Save nor Trophy).
5. Closed and re-opened the same game from history → **"Save Victory $0.005" tile appeared** — even though it was already saved on-chain. Expected **"Share Trophy"**. Analysis still never appeared.

## What is BY DESIGN (not a bug)

- **Redirect to `/coach/[gameId]` ("Match review")** — single-coach-surface architecture since 2026-06-05 (`arena/page.tsx:719-757`). The arena coach analysis, once it resolves to `result`/`fallback`, pushes to the persisted viewer.
- **Save tile hidden / Trophy shown after mint** — `game-actions-bar.tsx:172` renders Save Victory only on `isWin && !isMinted`; after mint, Share Trophy replaces it. Correct *when* `mintedTokenId` is present.

## Bug A — analysis never appears (analysis-loss race)

**Root cause (confirmed in code):** `/api/coach/analyze/route.ts` runs the LLM call **synchronously inside the request handler** (line 292) and persists the analysis to `coach:analysis:<wallet>:<gameId>:<locale>` (line 340) **with no `waitUntil` / `after`**.

Chain of events:
1. `coach.askCoach("victory-mint")` → `startCoachAnalysis` (`use-coach-analysis.ts:142`). On every (re)entry it calls `coachAbortRef.current?.abort()` (line 153), aborting any prior in-flight analyze fetch.
2. A second analyze hit returns the existing `{ jobId }` (idempotency short-circuit `analyze/route.ts:138-140`) → client shows `CoachLoading` polling `/api/coach/job/{jobId}`.
3. The analysis (and the `coach:analysis:` key write) only lands **if the original request's function survives to completion**. If the client aborts/navigates before the LLM returns, Vercel can terminate the function → **analysis never persisted**, job stays `pending`, expires at 60s.
4. The viewer (`coach-game-client.tsx:283-296`) **no longer auto-runs** analysis on mount (2026-06-09 gate) and reads `gameRecord.analysis` from Redis — which is empty → **empty Match review**. The in-memory `coach.response` from the arena React tree is discarded on the route change.

**Net:** the async/aborted analysis result lives only in client state or never completes; the redirect lands the user on a cold-loaded viewer with no persisted analysis and no auto-run, so the review the user waited for vanishes.

## Bug B — Save Victory offered on an already-saved game (repeat-charge risk)

**Symptom:** after on-chain save, the viewer (cold-load from history) shows **Save Victory $0.005** instead of Share Trophy.

**Mechanism:** the viewer decides minted-state from `gameRecord.mintedTokenId` (`coach-game-client.tsx:332` → `game-actions-bar.tsx:122 isMinted`). That field is written ONLY by `postMintReceipt` → `POST /api/games/[id]/mint-receipt` (`route.ts:123-128`), fired from `arena/page.tsx:335` on `mint.phase === "success"` as **fire-and-forget**.

Suspected failure (needs telemetry confirmation):
- The receipt POST **failed or never landed** (network, or game not yet persisted → 404 from the endpoint's `existing` guard), so `mintedTokenId` stayed null. The in-memory mint state still rendered "Victory Saved" in arena, masking the failure.
- Check telemetry `coach_viewer_mint_receipt_write { outcome: "fail" }` for that session to confirm.

**Why it matters:** offering Save Victory ($0.005) on an already-saved game is a **repeat on-chain charge path**. Money-adjacent → must fix with care + a guard.

## Open questions (need telemetry or repro to close)

1. Did `coach_viewer_mint_receipt_write` fire `fail` for that gameId? (confirms Bug B mechanism)
2. Did the analyze function complete server-side (analysis key present in Redis) or get killed mid-LLM? (confirms Bug A is abort-driven vs. a different persistence gap)
3. First Match-review entry showed NO middle tile at all (neither Save nor Trophy) — hydration/result-not-settled timing on first paint vs. cold reopen showing Save. Same root as Bug B or separate.

## Fix options (NOT yet implemented — founder to choose)

### Bug A
- **A1 (robust, recommended):** make analyze durable — wrap the LLM+persist in `after()`/`waitUntil()` so completion survives client navigation; OR don't redirect until `coach:analysis:` key is confirmed written (poll readback) — never redirect on a fallback that isn't persisted.
- **A2 (simpler):** render the resolved analysis **inline in the arena coach surface** (already exists as degraded fallback, `arena/page.tsx:733`) and DROP the redirect for the `victory-mint` flow — show review where the user is, no cold-load dependency.
- **A3 (carry state):** pass the just-fetched `coach.response` into the viewer via store/query so it paints immediately without depending on the Redis readback.

### Bug B
- **B1 (recommended):** await `postMintReceipt` (or retry-with-backoff) before the redirect / before showing Victory Saved as terminal; on persisted failure, surface a retry, never let the viewer offer Save again.
- **B2 (guard, do regardless):** in `game-actions-bar`, gate Save Victory off a server-authoritative mint check, not just `gameRecord.mintedTokenId` cold value; OR have the Save handler re-verify on-chain ownership before charging (idempotency at the charge boundary).

## Decision needed from founder

Pick fix direction for A (A1 durable analyze vs A2 inline-no-redirect vs A3 carry-state) and confirm B1+B2 as the money guard. Then: spec → TDD → atomic commits.
