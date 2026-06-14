# Spec v2 — Coach Analysis: explicit-tap, reliable render, visual cost

**Date:** 2026-06-13
**Status:** Approved (brainstorm + red-team) — pending implementation plans
**Author:** Wolfcito + Claude
**References:** RCA `docs/handoffs/2026-06-13-coach-victory-flow-bug-rca.md` ·
Red-team `docs/superpowers/specs/2026-06-13-coach-analysis-value-redteam.md`

> **v2 supersedes v1.** v1 was red-teamed and found to have P0 holes in all three
> pillars (unbuildable `after()` primitive, non-existent viewer poller, neutered
> redirect, no on-chain charge boundary, false currency model, missing UI states).
> v2 reflects the founder's decisions on each fork.

## Problem (unchanged)

After winning + saving a victory on-chain, tapping "Why did you win?" does not
deliver the coach analysis (lands on an empty Match Review; must re-tap), and the
Match Review re-offers "Save Victory" on an already-saved game (repeat-charge path).

## Context

- **Pre-launch:** production is a stable personal/MiniPay snapshot with NO real users
  (MEMORY `prelaunch-mode`). The double-charge is P0-for-launch, not an active
  incident — which is why the on-chain hardening can be deferred to a pre-launch
  hardening pass while the off-chain gate ships now.

## Founder decisions (this session)

| Fork | Decision |
|---|---|
| Trigger | Explicit tap + visual cost signal (no auto-run) |
| Tap UX | One tap → renders with no re-tap |
| Render approach | **Render-A (lean)** — no new dependency, no viewer poller |
| Action buttons | **4 independent, always-present:** Play Again · Save · Share · Ask Coach — on BOTH the victory popup AND Match Review |
| Save semantics | **Unlimited re-save is intended** (each save mints a collectible; user pays knowingly). Save is NOT hidden after a save. Guard = single-tap idempotency only |
| Share semantics | **Independent of Save** — generates its own match share-card from gameId, no mint-receipt dependency |
| Cost indicator | Treatment A (corner ribbon) on the Ask Coach button |
| Ribbon currency | **Peón unified** — treat Coach credits as Peones to the user |
| Loss/draw copy | **Outcome-specific** — win/lose/draw/resigned variants |
| Economy | Peones + PRO only; no per-analysis TX (backlog) |

> **Reframe (founder, post-red-team):** the "double-charge" the red-team flagged is
> NOT a bug — the founder intends unlimited on-chain saves (and unlimited PRO
> re-purchase, which extends time). The real bug was **UI honesty**: after saving, the
> UI conflated "Trophy/Share" as REPLACING "Save", so on cold reopen it showed Save
> again and looked broken. Fix = decouple into 4 independent always-present buttons.
> Do NOT build any guard that blocks re-saving or PRO re-purchase.

## Scope: three sequential plans

The red-team established these are independently risky and must ship in order.
Each becomes its own implementation plan.

---

## PLAN 1 — 4-button action model + single-tap idempotency, ships FIRST

**Goal:** four independent, always-present action buttons — **Play Again · Save ·
Share · Ask Coach** — consistent across the victory popup AND Match Review. This kills
the Save↔Trophy mutual exclusivity that produced the confusing "Save reappeared" state
the founder hit. Re-saving is allowed; only a single tap is guarded from firing twice.

**Root cause recap (reframed):** the bug was NOT a forbidden double-charge. The UI
treated "Share/Trophy" as REPLACING "Save" once `mintedTokenId` existed
(`game-actions-bar.tsx:172` `isWin && !isMinted`), so a cold reopen with an unpersisted
receipt showed Save again and looked broken. Decoupling the buttons removes the
mint-state dependency from the button SET entirely.

**Changes:**
1. **Match Review (`game-actions-bar.tsx`):** replace the state-driven slate with a
   fixed button set. **Wins:** Play Again · Save · Share · Ask Coach. **Loss / draw /
   resigned:** Play Again · Share · Ask Coach (no Save — Save = mint a victory
   collectible, only meaningful on a win; confirm with founder if losses should be
   saveable). Save is shown on wins **regardless of `mintedTokenId`** (unlimited
   re-save).
2. **Victory popups (`victory-celebration.tsx` + `victory-claim-success.tsx`):** align
   to the same 4 buttons. Because Save no longer changes the button set, the pre-save
   vs post-save popup distinction collapses — **evaluate converging the two variants
   into one** post-win popup with the 4 fixed buttons (reduces divergence; confirm
   scope during planning).
3. **Independent Share:** Share builds its own match share-card from `gameId` via the
   existing `/api/og/match` + share-URL path, with NO dependency on the mint receipt.
   (Verify the gameId→card/link path exists without a mint; reuse the OG recipe.)
4. **Single-tap idempotency on Save:** an in-flight/disabled guard + debounce so ONE
   tap produces exactly ONE mint TX (prevent a re-render or double-submit from
   requesting two signatures / two charges). This does NOT block a deliberate second
   Save — it only collapses a single intent to a single charge.
5. **Receipt persistence (supporting, not gating):** keep `await postMintReceipt` with
   bounded retry (transient → retry; 404 → fix ordering: persist `gameRecord` before
   the receipt write) so the saved-collectible state is durable for Share-of-trophy and
   for acknowledgment. It no longer gates Save visibility.

**Backlog correction:** the v2 "deterministic nonce per gameId" idea is **dropped** —
it would block legitimate re-saves, which the founder wants. The only chain-adjacent
concern is single-tap idempotency (client/server side, above); no contract change.

**Tests:** all 4 buttons render on a win across popup + Match Review; Save stays
visible after a save (re-save possible); loss/draw shows Play Again · Share · Ask
Coach; Share works with no prior save; a single Save tap fires exactly one TX (double
-submit guarded); receipt retry on transient but not 404; ordering guarantees no 404.

---

## PLAN 2 — Render-A (lean), ships SECOND

**Goal:** one tap delivers the analysis with no re-tap, with NO new dependency and NO
viewer poller. Directly fixes the observed empty-Match-Review bug.

**Key insight (verified):** `/api/coach/analyze` persists the analysis key BEFORE
returning `status:"ready"` (`route.ts:339-361` then `:391`). So on phase `result`,
the analysis IS readable. The bug is that the redirect ALSO fires on phase `fallback`
(`arena/page.tsx:745`), and the client-only fallback is never persisted → empty viewer.

**Changes:**
1. **Redirect only on persisted result:** in `arena/page.tsx` redirect effect (`:737`),
   gate navigation on `phase === "result"` with a renderable persisted analysis ONLY.
   **Remove `fallback` from the redirect condition.**
2. **Fallback renders inline:** when phase is `fallback` (offline/error/quick review),
   render it inline in the arena coach surface (the existing degraded path) — do NOT
   navigate to the viewer. The user sees their review where they are; no empty screen.
3. **Loading stays in the arena popup:** the existing `CoachLoading` poller
   (`arena/page.tsx:1440`) handles the async `jobId` case; navigation happens only
   after `result`. The function is not killed because the client stays on the popup
   until persistence completes.
4. **Viewer cold-load unchanged:** `/coach/[gameId]` reads the persisted analysis
   (30-day key, `getGameRecord` merge) and renders inline — no poller, no
   `pendingJobId`, no `jobByGame` TTL change. The 2026-06-09 no-auto-run gate stays.
5. **Empty-gameId guard (P2):** in `use-coach-analysis.ts`, move the `!analyzeGameId`
   not-persisted check BEFORE `attemptCoachSpendWithPeones` so a no-gameId tap never
   debits a Peón/credit against `gameId=""`.

**UX note:** the "Coach is thinking" state shows in the arena popup, then Match Review
opens already showing the analysis. One tap, no re-tap. (Differs from v1's "loading
inside Match Review" — accepted by founder as the lean trade-off.)

**Deferred (not needed for Render-A):** `waitUntil`/`@vercel/functions` durability
against mid-loading navigation, and viewer-side job resume. If we later want loading to
survive the user closing the popup, that's a follow-up (Render-B).

**Tests:** redirect fires on `result` (persisted) and lands on a rendered viewer;
`fallback` renders inline and does NOT navigate (regression-guards the empty-viewer
bug); no-gameId tap spends nothing; 2026-06-09 no-silent-spend rule still holds.

---

## PLAN 3 — Cost ribbon (Treatment A), ships LAST

**Goal:** every coach trigger shows, visually, that the analysis costs and is covered —
honestly, across all outcomes and balance states.

**Currency model (Peón unified):** to the user, the coach currency is the **Peón**.
The backend's credits-first consumption (3 seeded credits → Peones → paywall) is an
implementation detail; the ribbon shows the Peón. **Debt logged:** unify Coach
credits into Peones in the backend (aligns with the planned "Coach Credits → Peones"
rename). Until then, "1 Peón" visually represents "1 unit of coach currency."

**Ribbon states (Treatment A — corner ribbon), enumerated per the UI-states HARD RULE:**
| State | Ribbon |
|---|---|
| PRO active | Crown "PRO" (covered/included) |
| Free, has balance (credit or Peón) | Peón "♟ 1" |
| Free, zero balance | Peón "♟ 1" + locked affordance; tap → existing Get-Peones/paywall |
| Guest / no wallet | No ribbon (free quick review; no charge until wallet connects) |
| PRO status unsettled (first paint) | Neutral/skeleton ribbon until `proActive` resolves, then swap (avoid flicker per MEMORY `pro-recognition-pattern`) |

**Outcome-specific copy (EN + ES), on the coach CTA across all three call-sites
(`victory-celebration.tsx`, `victory-claim-success.tsx`, `game-actions-bar.tsx`):**
| Outcome | EN | ES |
|---|---|---|
| Win | "Why did you win?" | (existing ES) |
| Lose | "What went wrong?" | "¿Qué salió mal?" |
| Draw | "How was the draw?" | "¿Cómo fue el empate?" |
| Resigned | "What went wrong?" | "¿Qué salió mal?" |

ES strings authored in `editorial.ts` + i18n catalogs, anti-AI-prose compliant
(no em/en-dashes per MEMORY `anti-ai-prose`).

**Implementation:** reuse the `arena-result-treasure-price-ribbon` pattern + CTA
tokens; mint a coach-ribbon variant class in `globals.css` (multi-surface). Real
`w-pawn` sprite for the Peón. `proActive` already a prop on the two arena popups; on
the viewer it is `useIsProActive()`-sourced (`coach-game-client.tsx:45`) — render the
neutral state until it resolves.

**Tests:** ribbon renders correct state for PRO / free-with-balance / free-zero /
guest across all three call-sites; outcome-specific copy renders per result; VR
baselines refreshed; em-dash gate stays green.

---

## Error handling (cross-plan)

- Analyze job fails / LLM error / offline → inline `CoachFallback` in the arena popup
  (Plan 2), never a blank viewer.
- Poll timeout (60s) → inline fallback + re-tap.
- `postMintReceipt` persisted failure → retry affordance (Plan 1).

## Out of scope / backlog

1. **Direct pay-per-analysis TX + PRO ($1.99) price-tuning** — founder: discuss later.
2. **Backend credit→Peón unification** — aligns with the planned rename.
3. **Render-B durability** (`waitUntil` + viewer resume) — only if we need loading to
   survive the user leaving the popup mid-analysis.

> Note: NO on-chain per-game mint guard — unlimited re-save is a product feature.
> PRO re-purchase (extends time) and repeat on-chain save are both intended and
> additive; no guard may block them.

## Files touched (anticipated)

- Plan 1: `components/coach/game-actions-bar.tsx` (4-button slate),
  `components/arena/victory-celebration.tsx` + `victory-claim-success.tsx` (align/
  converge to 4 buttons), Share path (`/api/og/match` + share URL), `arena/page.tsx`
  + `lib/coach/post-mint-receipt.ts` + `api/games/[id]/mint-receipt/route.ts` (receipt
  ordering/retry + single-tap idempotency)
- Plan 2: `arena/page.tsx` (redirect effect), `lib/coach/use-coach-analysis.ts`
- Plan 3: `victory-celebration.tsx`, `victory-claim-success.tsx`,
  `game-actions-bar.tsx`, `lib/content/editorial.ts` + i18n, `globals.css`
