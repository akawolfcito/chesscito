# Coach Game Viewer — Design Spec

**Date:** 2026-05-27
**Author:** Wolfcito + Claude (brainstorm session)
**Status:** revised — red-team integrated 2026-05-27 (4 critical + 9 high + 8 medium + 2 low findings applied; review at `docs/reviews/2026-05-27-coach-game-viewer-redteam.md`)
**Cluster:** post arena-end-state-polish (2026-05-27)

---

## Problem statement

After the 2026-05-27 `arena-end-state-popup-polish` ship, three UX gaps remain on the post-game flow:

1. **Dead-board after X-close.** When the win/loss popup is dismissed via the X corner button, the underlying arena board lingers with `ArenaActionBar` (resign disabled, no Play Again CTA). The only escape is the top `BACK` button, which has its own bug (see #2). The player can't review the game, save it, ask Coach, or restart — they're stuck.
2. **`handleBack` flashes the difficulty selector before navigating to `/hub`.** Cause: `resetArenaState()` + `game.reset()` run synchronously before `router.push("/hub")`. `game.reset()` flips `game.status` back to `"selecting"`, so the page re-renders the selector for one frame before client-side navigation completes.
3. **Zero-move loss / resign feels "blank".** When the player resigns without moving, the popup shows but the Coach CTA is disabled (`isTooShort = moves === 0`). Closing the popup lands them on the initial board position with no clear next action.

Beyond these bugs, there's a deeper retention gap: the player has no way to **review the game move-by-move** without leaving the play loop, and the conversion path "played → analyze → mint → share" is only accessible inside the victory popup. From `/coach/history`, the same conversion path is unreachable.

## Goals

- Eliminate the dead-board state. Every X-close lands on a productive surface.
- Fix the `handleBack` flash.
- Provide a single canonical screen for "review a played game" — reachable from the end-state popup, from `/coach/history`, and from future entry points (share deep-link, badge tile, etc.).
- Wire the conversion path (Ask Coach + Save/Mint + Share + Play Again) into that canonical screen so it works whether the player just finished the match (hot) or comes back later (cold).
- Fold the existing `/coach/history` "selected entry" branch into the new screen so there's one place to view a game, not two.

## Non-goals (Fase 1)

- Deep-link to a specific move via URL (e.g., `/coach/[gameId]?move=8`).
- Share-position without mint (Fase 1 ships Share only when minted; ephemeral position-share is Fase 2).
- Ephemeral viewer for guests without a wallet. Guests fall back to `/arena?fresh=1`.
- Cross-game navigation inside the viewer ("next game", "previous game in history").
- Desktop visual polish — mobile-first per project rules.

---

## Section 1 — Route architecture and entry points

### Route map

```
┌─ /arena (game in progress) ─────────────────┐
│  popup end-state                            │
│  └─ X close ──> X-close routing policy ─┐   │
└─────────────────────────────────────────┼───┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                  gameId persisted?              no gameId
                              │                       │
                              ▼                       ▼
                  /coach/[gameId]            /arena?fresh=1
                  ▲    ▲    ▲                (selector)
                  │    │    │
                  │    │    └── share deep-link (Fase 2)
                  │    │
                  │    └── tap entry in /coach/history
                  │        (list-only; selected branch removed)
                  │
                  └── share-card landing (Fase 2)
```

### Routes affected

| Route | Change | Type |
|---|---|---|
| `/coach/[gameId]` | **New.** Canonical "centro de partida". Server component reads `/api/games/[id]`, client renders viewer + 4 CTAs. Wallet-gated, owner-only. | Add |
| `/coach/history` | "Selected" branch removed. Tap entry → `router.push("/coach/${gameId}")`. List-only. | Refactor (subtraction) |
| `/arena/[locale]/page.tsx` | (a) X-close policy applied; (b) `handleBack` simplified; (c) `useCoachAnalysis` + `useMintVictory` extracted to hooks. | Refactor (extraction + simplification) |

### API surface

| Endpoint | Change |
|---|---|
| `GET /api/games/[id]?wallet=0x…` | **New.** Returns `GameRecord` from `coach:game:<wallet>:<gameId>` cache. Validates `isAddress(wallet)` + UUID-format `gameId`, 404 on cache miss. Cache: `no-store`. |
| `POST /api/games/[id]/mint-receipt` | **New.** Writes `{mintedTokenId, claimTxHash, shareCardUrl, shareLinkUrl}` into the persisted `coach:game:<wallet>:<gameId>` record so cold-loaded viewers reflect the minted state. See §3 mint-receipt contract. |
| `POST /api/games` | Existing (Cluster E). No change. |

**Auth posture for `GET /api/games/[id]` — Fase 1 decision:** wallet-asserted, NOT proof-of-ownership. The caller passes `?wallet=0x…` and the server trusts it (same as `POST /api/games`, `/api/coach/analyze`, `/api/coach/history`, every other endpoint). The threat model is **unguessable-UUID gating + origin check + read-rate-limit**, not OAuth-style ownership. Verified posture: `apps/web/src/lib/server/demo-signing.ts:83-113` (`enforceOrigin`) allows null-Origin MiniPay requests; no signed session exists in the repo. A future SIWE / signed-cookie session is a cross-cluster spec — explicitly out of scope here. The `notFound()` response to a wrong-wallet+correct-gameId combo therefore reflects "cache miss" rather than "ownership denied"; functionally equivalent for v1 because `gameId` is UUIDv4 (unguessable), but the spec must not promise an "owner-only" or "no-leak" guarantee stronger than this.

**Locale prefixing:** all client routes mount under `/[locale]/` via next-intl middleware. `/coach/[gameId]` resolves as `/en/coach/[gameId]` or `/es/coach/[gameId]` in practice; the route file lives at `apps/web/src/app/[locale]/coach/[gameId]/page.tsx`.

---

## Section 2 — Component decomposition

### New components

| Component | Path | Responsibility |
|---|---|---|
| `CoachGamePage` | `app/[locale]/coach/[gameId]/page.tsx` | Server component: fetches `GameRecord`. Renders `<CoachGameClient>` with hydration props. |
| `CoachGameClient` | `app/[locale]/coach/[gameId]/coach-game-client.tsx` | Client wrapper: composes header + viewer + CoachPanel slot + actions bar; owns `useCoachAnalysis` and `useMintVictory` hook instances. |
| `GameViewer` | `components/coach/game-viewer.tsx` | Move-by-move viewer: large board (BoardThumbnail-derived) + ← / → controls + horizontal slider + scrollable SAN list with current-move highlight. |
| `GameActionsBar` | `components/coach/game-actions-bar.tsx` | The 4 CTAs (Ask Coach / Save / Share / Play Again) with result-aware visibility (no Mint if loss; "View NFT" if already minted; Ask Coach disabled if `moves === 0`). |
| `useGameReplay` | `lib/game/use-game-replay.ts` | Hook: `(moves: SAN[], startingFen?: string) => { currentIndex, currentFen, currentMove, goPrev, goNext, goTo, goStart, goEnd, canPrev, canNext, totalMoves }`. Memoizes `fenList` once on mount. |

### Hooks extracted from `apps/web/src/app/[locale]/arena/page.tsx`

| Hook | Origin lines (approx.) | Reason for extraction |
|---|---|---|
| `useCoachAnalysis` | ~300-767 + 1090+ (coach phase machine: idle → review → paywall → result → fallback → history → welcome → loading; coach request lifecycle; abort handling; locale + reanalyze; pro bypass) | Reuse from `/coach/[gameId]`. Testable in isolation. **Excludes** `handleBuyCredits` — that becomes `useCoachCreditsPurchase` (next row) to keep this hook portable to the viewer. |
| `useCoachCreditsPurchase` | ~768-862 (`handleBuyCredits`: wagmi `useWriteContract` + `usePublicClient` + token-balance selection + receipt timeout + purchase verification + error classification) | Owns wagmi dependencies that would otherwise drag into `useCoachAnalysis` and break dev-fixture portability. Consumed alongside `useCoachAnalysis` on both arena and viewer surfaces. |
| `useMintVictory` | ~866-1072 (claim phase machine: ready → claiming → success/error/cancelled/timeout; EIP-712 signature request; approve + mint tx; receipt confirmation; share-card construction; rate-limit handling) | Reuse from `/coach/[gameId]`. Testable in isolation. Owns sessionStorage writes (see Side-effects audit below). |

**Hook return discipline (HARD RULE — see C-3 + memory `hook-ref-stability`):** every function in each hook's return object MUST be wrapped in `useCallback` with the minimal stable dep set. Consumers will list these in `useEffect` deps and any unstable reference will collapse the arena's 400ms PLAY timer (memory: `arena-play-timer-fragility`). Document the contract in each hook's docstring with a pointer to `feedback_hook_ref_stability.md`.

**Refactor invariant:** the extracted hooks must preserve the exact behavior of `arena/page.tsx`. Existing arena tests are NECESSARY-BUT-INSUFFICIENT — they do not exercise the 400ms PLAY timer. Phase 2 sign-off requires the new regression test `arena-play-timer-resilience.test.tsx` (see §5) green, AND a feature-flag preview cycle (see §6 Phase 2 mitigation) before flipping on for production.

### Hook responsibility boundary

Hooks return state + memoized callbacks. **They do NOT mount React components.** The consumer renders the matching surface for each phase using its own chrome. Concretely: today `arena/page.tsx:1679-1991` renders six coach-phase branches (result / fallback / history / welcome / loading / paywall), each with its own `<CandyGlassShell>` wrapper and translations. `/coach/[gameId]` will render the same six phases inside the viewer chrome (no popup). Branch tables are duplicated by design; the comparison test in §6 Live risk #1 asserts they stay aligned.

### Side-effects audit

Every persistent side-effect the hooks touch, with explicit owner per item:

| Side-effect | Owner | Notes |
|---|---|---|
| `sessionStorage["chesscito:claim"]` (set on `claiming`/`success`, removed on cancel/error) | `useMintVictory` | Hook-internal lifecycle. Consumer doesn't read. |
| `sessionStorage["chesscito:optimistic-victory"]` (set on `success`, consumed by `trophies-body.tsx:56`) | `useMintVictory` | Cross-page contract — keep ownership inside the hook so both arena and viewer write identically. |
| `localStorage["chesscito:coach-welcomed"]` (set at three sites in the coach phase machine) | `useCoachAnalysis` | All three writes move with the hook. |
| `localStorage["chesscito:arena-last-difficulty"]` (set in `handleStartWithLoading`) | **Stays in arena** | Arena-only, not a coach concern. Not extracted. |
| `analyzeSourceRef` (mutated by `handleAskCoach`/`handleAnalyzeFromHistory`, read in `startCoachAnalysis`) | `useCoachAnalysis` (internal) | Hook return exposes a setter `setAnalyzeSource(source: AnalyzeSource)` so consumers can tag entry points. |
| `coachPreviewViewedRef` + `arenaCoachSignalViewedRef` (telemetry one-shot gates) | **Stays in arena** | These gate arena-popup-specific telemetry. Viewer fires its own `coach_viewer_view` event (see §5 telemetry). |
| Telemetry events (`coach_analyze_request`, `coach_buy_tx{stage}`, `victory_claim_tx{stage}`, etc.) | **Consumer fires** | Hook is side-effect-free for telemetry. Consumer wraps callbacks with `track(..., { surface: "arena_endgame" \| "coach_viewer" })`. Prevents duplicate or mis-tagged events. |

### Dev-fixture prop contract (for VR baselines)

Per memory `vr-baseline-discipline` + the VR-5/7/8 fixture harness, dev fixtures mount components OUTSIDE a `WagmiProvider`. Both new hooks must accept optional injection of wagmi-derived inputs so fixtures render without a provider:

| Hook | Wagmi reads | Injection prop |
|---|---|---|
| `useCoachAnalysis` | `useAccount().address`, `useChainId()`, `useReadContract` (PRO check via `useIsProActive`) | `injected?: { address?, chainId?, proActive? }` — when set, hook uses these; otherwise reads wagmi. |
| `useCoachCreditsPurchase` | `useAccount().address`, `useChainId()`, `useWriteContract`, `usePublicClient`, `useReadContracts` (token balances) | `injected?: { address?, chainId?, sendPurchase? (mock writer), tokenBalances? }`. |
| `useMintVictory` | `useAccount().address`, `useChainId()`, `useWriteContract`, `useSignTypedData`, `usePublicClient`, `useReadContract` (USDC balance + allowance) | `injected?: { address?, chainId?, sendSig?, sendApprove?, sendMint?, balances? }`. |

VR fixtures (`apps/web/src/app/dev/coach-game-viewer/`, `dev/coach-game-actions/`) wire `injected` with deterministic values per snapshot. No product-code wagmi mocking required.

### Reused unchanged

- `<CoachPanel>` — mounted **by the consumer** of `useCoachAnalysis` when the hook reports `phase === "result"` AND the underlying response is `kind === "full"`. For `kind === "quick"` analyses (cold-load via `gameRecord.analysis`), the consumer mounts `<CoachFallback>` instead (see §3 quick-kind branch).
- `<CoachLoading>`, `<CoachPaywall>`, `<CoachFallback>` — mounted by the consumer on matching phases.
- `<VictoryClaiming>`, `<VictoryClaimSuccess>`, `<VictoryClaimError>` — mounted by the consumer on matching `claimPhase` states.
- `<CandyGlassShell>` (chrome of the page)
- `<ContextualHeader variant="back-control">` (header with BACK)
- `<BoardThumbnail>` (visual base for the larger viewer board)

### Removed

- `/coach/history/page.tsx` lines 122-150 (the `if (selected)` branch that mounted `<CoachPanel>` inline). Replaced by `router.push("/coach/${entry.gameId}")` in `handleSelect`.

---

## Section 3 — Data flow and state

### Server load + GameRecord shape extension

Today's `GameRecord` (`apps/web/src/lib/coach/types.ts:25-34`) lacks mint-outcome fields. This cluster extends it (additive only, no breaking change to existing readers):

```
GET /api/games/[gameId]?wallet=0x…
→ GameRecord {
    gameId: string,                       // existing
    walletAddress: `0x${string}`,         // existing
    result: ArenaStatus | "win",          // existing
    difficulty: "easy" | "medium" | "hard", // existing
    moves: string[],                      // existing — SAN, source of truth
    startingFen?: string,                 // NEW (Fase 1) — forward-leaning; defaults to chess.js startpos when absent. Server does NOT write it today (only standard Chess); reserved for Chess960 / future variants.
    elapsedMs: number,                    // existing
    totalMoves: number,                   // existing
    mintedTokenId?: string,               // NEW (Fase 1) — populated via POST /api/games/[id]/mint-receipt after mint success. Serialized as decimal string (bigint not JSON-safe).
    claimTxHash?: `0x${string}`,          // NEW (Fase 1) — same write path as mintedTokenId.
    shareCardUrl?: string,                // NEW (Fase 1) — full URL to OG share card; written by mint-receipt endpoint.
    shareLinkUrl?: string,                // NEW (Fase 1) — canonical share link (https://www.chesscito.com/v/...).
    analysis?: CoachAnalysisRecord        // existing — may be `{ kind: "full" } | { kind: "quick" }`
  }
```

**Mint-receipt write contract:** when `useMintVictory` reaches `claimPhase === "success"`, the consumer (CoachGameClient OR arena/page.tsx) POSTs to `/api/games/[id]/mint-receipt` with `{ wallet, tokenId, claimTxHash, shareCardUrl, shareLinkUrl }`. The server appends these fields onto the existing `coach:game:<wallet>:<gameId>` Redis record (no new key). Idempotent — repeated calls with the same `tokenId` are no-ops. This lets a cold-load of `/coach/[gameId]` after closing+reopening the WebView render the post-mint state.

**CTA mutation contract (NOT refetch-based):** the hot path (immediately after a successful mint) does NOT refetch `gameRecord`. Instead, the viewer reads `useMintVictory.claimData.tokenId` (in-memory) and renders "View NFT" while `useMintVictory.claimPhase === "success"`. The mint-receipt POST runs in the background for cold-load persistence; if it fails, the warm session still shows "View NFT" correctly, and a subsequent cold-load might show "Mint" again (recoverable by re-tapping → contract rejects "already claimed" → user dropped into the View NFT path). Telemetry `coach_viewer_mint_receipt_write{outcome}` captures failures for ops follow-up.

### Replay derivation

```ts
// useGameReplay(moves: string[], startingFen?: string)
//
// On mount, build fenList lazily with try/catch (mirrors movesToFen
// pattern at apps/web/src/lib/game/moves-to-fen.ts:48):
//
//   fenList[0] = startingFen ?? chess.js DEFAULT_POSITION
//   for i in 1..moves.length:
//     try game.move(moves[i-1])
//     fenList[i] = game.fen()
//     on chess.js throw → stop. Record { error: { atIndex: i, badSan: moves[i-1] } }.
//
// fenList may be shorter than moves.length + 1 when a partial corruption
// is encountered. The viewer renders up to lastValidIndex and shows an
// inline banner "match replay stopped at move N · this position couldn't
// be replayed: <badSan>". Telemetry coach_viewer_corrupt_record fires
// once per mount.
//
// Expose:
//   currentIndex      // default = lastValidIndex (final renderable position)
//   currentFen        // = fenList[currentIndex]
//   currentMove       // = moves[currentIndex - 1] or null if index 0
//   goPrev / goNext   // bounded to [0, lastValidIndex]
//   goTo(i)           // clamped to [0, lastValidIndex] silently — no throw
//   goStart           // → index 0
//   goEnd             // → lastValidIndex
//   canPrev           // = currentIndex > 0
//   canNext           // = currentIndex < lastValidIndex
//   totalMoves        // = moves.length (unchanged regardless of corruption)
//   lastValidIndex    // = fenList.length - 1
//   error?            // { atIndex, badSan } when partial corruption
```

**Why lazy + partial:** chess.js v1.4.0 throws on illegal SAN (`apps/web/package.json:40`); a single corrupt move out of 60 would otherwise wipe the entire game from review. Mirroring the `movesToFen` precedent lets the user see their valid moves and gives ops a telemetry signal to investigate the corruption. The `startingFen` field is a forward-leaning ABI for future Chess960 support; today the server never writes it and the hook defaults to `chess.js.DEFAULT_POSITION`.

### State ownership

| State | Owner | Notes |
|---|---|---|
| `currentIndex` | `useGameReplay` (component-local) | Not synced to URL in Fase 1. Deep-link to a specific move is Fase 2. |
| `coachPhase` + `coachResponse` | `useCoachAnalysis` hook | Same shape as today in `/arena`. Locale-aware, abort-safe. |
| `claimPhase` + `claimData` + `claimError` | `useMintVictory` hook | Same shape as today in `/arena`. EIP-712 signature, approve, mint, receipt. |
| `gameRecord` | Server-fetched on mount, client-immutable thereafter | **NOT refetched on mint success.** Hot-mint mutations are reflected via `useMintVictory.claimPhase === "success"` + `claimData.tokenId` in memory. Cold-load (next mount) reflects the persisted state populated by the mint-receipt POST. See "Mint-receipt write contract" above. |

### Key interactions

- **Tap "Ask Coach"** → `useCoachAnalysis.start(gameId)`. Opens `<CandyGlassShell>` modal with paywall / loading / result phases. If `gameRecord.analysis` is already present, `<CoachPanel>` mounts inline directly (no fresh request).
- **Tap "Save / Mint Victory"** → `useMintVictory.start({ gameId, difficulty, result, totalMoves, elapsedMs })`. Same state machine as today. On `success`, the page re-fetches `gameRecord`; the CTA mutates to "View NFT" with a Celoscan link and a gold ribbon (no price).
- **Tap "Share"** → only enabled when `mintedTokenId != null`. Opens the existing share-card flow with `shareCardUrl`. Share before mint is Fase 2.
- **Tap "Play Again"** → `router.push("/arena?fresh=1")`. No local state cleanup needed; the page unmounts.
- **Tap BACK** (header) → `if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/hub");`. **Hard fallback to `/hub` when history is empty** to prevent MiniPay WebView close on deep-link entry (verified: `router.back()` falls through to `window.history.back()` which closes the WebView on a single-entry history). Smoke checklist asserts this on a fresh deep-link mount.

### Edge cases handled in component logic

- `moves.length === 0` (resign without moving): **filtered at the history-list level**, NOT at the viewer level. `coach-history.tsx` excludes (or renders as inert non-tappable) entries with `totalMoves === 0`. The viewer's own zero-move branch is a defensive fallback for direct URL access — renders header + message *"This match was too short to review"* + Play Again CTA. **No banner above a half-rendered board** (drops H-9's dead-end pattern).
- `mintedTokenId` present (cold-load OR `claimPhase === "success"` hot-mint): "Save" CTA replaced by "View NFT" (Celoscan link + gold ribbon). Share enabled.
- `result !== "win"`: Mint CTA hidden entirely. (Contract gates mint to wins; reflected in client to avoid wasted tap.)
- `gameRecord.analysis != null` AND `response.kind === "full"`: Coach section renders `<CoachPanel>` inline. On mount, the consumer seeds `coachReanalyzeGameId = gameRecord.gameId` so the pro "Reanalyze" CTA has the right target (today this state is only set during a fresh kick-off in arena; cold-load path needs the seed).
- `gameRecord.analysis != null` AND `response.kind === "quick"`: Coach section renders `<CoachFallback>` inline (NOT `<CoachPanel>` — the latter only accepts full responses per `apps/web/src/lib/coach/types.ts:63`). CTA "Get full analysis" offered if user qualifies.
- Partial-replay error (`useGameReplay.error` is set): viewer renders up to `lastValidIndex`, inline banner above the SAN list communicates the truncation, Coach CTA disabled (incomplete moves), Mint stays available if `result === "win"` (mint is independent of review integrity).

---

## Section 4 — Routing policy and edge cases

### X-close state machine (popup in `/arena`)

The X behavior is a function of two state variables: `persistState` (Cluster E lifecycle) and `claimPhase` (mint lifecycle). Encoded as a state machine, not narrative prose:

| `persistState` | `claimPhase` | Wallet | X behavior | Toast |
|---|---|---|---|---|
| `persisted` | `ready` / `error` / `cancelled` / `timeout` | connected | `router.push("/coach/${gameId}")` | — |
| `persisting` | any | connected | X disabled + `aria-busy` + spinner. Tap registers `pendingNavRef.current = true`. | — |
| `failed` | any | connected | X enabled. Tap → `router.push("/arena?fresh=1")`. | `"Match couldn't be saved · play another?"` |
| `dismissed` | any | connected | X enabled. Tap → `router.push("/arena?fresh=1")`. (User explicitly dismissed the failure pill.) | — |
| any | `claiming` | connected | **X locked** (no `onClose` prop on `VictoryClaiming` — mirrors today's arena-end-state.tsx win-branch). | — |
| any | `success` | connected | X behaves per `persistState` row (claim is done; persistence still drives navigation eligibility). | — |
| `idle` / `persisted` | any | **guest** (no wallet) | X enabled. Tap → `router.push("/arena?fresh=1")`. | — |
| any | any | any | Backdrop tap = same policy as X. | Same. |

**`pendingNavRef` consumer (one for every terminal `persistState`):** when `persistState` transitions while `pendingNavRef.current === true`:

| Transition | Action |
|---|---|
| `persisting` → `persisted` | Push `/coach/${gameId}`. Clear ref. |
| `persisting` → `failed` | Push `/arena?fresh=1` + dispatch failure toast. Clear ref. |
| `persisting` → `dismissed` | Clear ref. Leave X in its decision-table default state — user explicitly opted out. |

**Implementation note:** today's `onClose = () => setShowEndOverlay(false)` is replaced by a `handleEndStateClose()` handler in `arena/page.tsx` that applies this state machine. The persistence-state effect grows a `pendingNavRef` consumer (added to the deps of the existing `useEffect` tied to `persistState`, no new effect).

### `handleBack` (BACK in `ArenaHud` during game)

**Bug fix:** simplify to `handleBack = () => router.push("/hub")`. Remove the synchronous `resetArenaState()` + `game.reset()` calls. Rationale: `/arena`'s unmount cleanup already aborts in-flight refs (`claimingRef`, `coachAbortRef`, `persistAbortRef`); calling `game.reset()` before navigation causes `game.status` to flip to `"selecting"` for one frame before the route transition completes, producing the visible selector flash.

**Regression coverage:** `arena-handle-back-no-flash.test.tsx` asserts that `queryByTestId("difficulty-selector")` returns null between the BACK tap and the navigation completion.

### Coach phase residual at popup close

Today's behavior: if `coachPhase !== "idle"`, the popup is hidden (`opacity-0 pointer-events-none`) and the `<CandyGlassShell>` coach overlay mounts above the arena. This pattern is preserved — the new viewer at `/coach/[gameId]` is only relevant when the user explicitly closes the popup via X. If they tap Ask Coach inside the popup, the existing coach overlay flow handles it. Compatible.

### Persistence in-flight + rapid tap

Decision: while `persistState === "persisting"`, the X is **non-interactive but registers intent**. Cosmetically it shows a spinner. When `persisted` arrives, the page **auto-navigates** to `/coach/[gameId]` without requiring a second tap. Rationale: more forgiving than the alternative of "tap, nothing happens visibly, tap again". Implementation: a `pendingNavRef` set on the first tap is consumed by the `persistState` effect.

### `GET /api/games/[id]` failure on the new route

Branched by HTTP status:

- **`?wallet=` missing OR wallet disconnected at render** (likely 400/401 from the server): client renders `<ConnectPromptToast>` (already imported in arena/page.tsx) plus `<ContextualHeader>` BACK. Copy: *"Reconnect your wallet to view this match."* Tapping Connect kicks the wagmi connect flow; on success, refetch.
- **404 cache miss** (wrong wallet, wrong gameId, or expired record): friendly fallback — `<ContextualHeader>` with BACK + message *"Couldn't load this match"* + CTA *"Play another"* → `/arena?fresh=1`. Never to `/hub`.
- **5xx / network**: same friendly fallback as 404, but the message is *"Couldn't reach the server — try again"* with a Retry CTA that re-fetches.

In all branches the user never bounces to `/hub`.

### Direct-mount `endOverlayTimer` lifecycle (pre-popup state)

Today's `arena/page.tsx:1124-1145` defers the popup by 800ms after `isEndState` becomes true (lets the user see the final position before the overlay). If the user backgrounds the WebView during that 800ms gap, `setShowEndOverlay(true)` may never fire on resume. **Add to the same effect:** on `document.visibilitychange` → `visible` while `isEndState && !showEndOverlay`, force `setShowEndOverlay(true)` immediately (skip the pause). The user has already been on the result screen during the background; the dramatic pause has elapsed.

### Direct navigation to a non-owner gameId

Server component compares `gameRecord.walletAddress` against the session-bound wallet. Mismatch → `notFound()` (404 boundary). Same response as a truly nonexistent gameId — no information leak about existence.

### Invalid SAN in stored `moves[]`

`useGameReplay` throws during `fenList` construction. `CoachGameClient` wraps the hook call in a try/catch and renders the corrupt-record fallback: header + message *"This match is corrupted and can't be reviewed"* + Play Again CTA. Telemetry event `coach_viewer_corrupt_record { gameId }` fires for backend follow-up.

---

## Section 5 — Testing strategy

### Unit tests (Vitest + RTL)

| Suite | Coverage |
|---|---|
| `use-game-replay.test.ts` | Replay derivation from SAN[]; `goPrev/goNext/goTo/goStart/goEnd` correctness; **`goTo` clamps to `[0, lastValidIndex]` silently — no throw**; `currentMove` null at index 0; `moves.length === 0` exposes `lastValidIndex = 0`; **partial-replay-on-bad-SAN** — replay stops at first illegal move, exposes `{ error: { atIndex, badSan }, lastValidIndex }`. |
| `use-coach-analysis.test.ts` | Phase machine (idle → review → paywall → result → fallback → history → welcome → loading); abort on unmount; pro bypasses paywall; locale switch + reanalyze; server error → fallback; **all returned functions are referentially stable across renders with the same inputs (memoization contract)**. |
| `use-coach-credits-purchase.test.ts` | (New hook per H-3.) Purchase flow happy path; insufficient balance; wrong chain; receipt timeout; idempotent retry; **stable callback refs**. |
| `use-mint-victory.test.ts` | Phase machine (ready → claiming → success / error / cancelled / timeout); sig timeout; wrong chain; wallet disconnect mid-flow; rate-limit response; receipt confirmation; **sessionStorage["chesscito:claim"] and ["chesscito:optimistic-victory"] writes asserted at the right lifecycle points**; **stable callback refs**. |
| `arena-play-timer-resilience.test.tsx` | **(NEW — C-3 regression guard.)** Drive PLAY → `playing` status within 800ms of `setIsPreparing(true)` across N intervening commits/effects from the extracted hooks. Uses `vi.useFakeTimers()` + `act()`. Asserts the 400ms `setTimeout` schedules and fires regardless of sibling effect churn from `useCoachAnalysis` / `useMintVictory` consumers. |
| `game-viewer.test.tsx` | Board renders at each index; ← / → disable at bounds; SAN list highlights current move; slider syncs with index; **partial-replay banner shown above SAN list when `error` is set**. |
| `game-actions-bar.test.tsx` | CTA visibility per result (win / loss / draw / resigned / stalemate); "View NFT" when `claimPhase === "success"` OR `gameRecord.mintedTokenId` cold-load; Ask Coach disabled when partial-replay error present; **Play Again CTA asserts `router.push("/arena?fresh=1")` (memory `arena-fresh-param`)**. |

### Integration tests (RTL + msw)

| Suite | Coverage |
|---|---|
| `coach-game-page.test.tsx` | Mount with valid gameRecord → viewer + CTAs; mount with `analysis` present → `CoachPanel` inline; zero-move record → fallback banner; API 404 → friendly error fallback; auth mismatch → `notFound` boundary (asserted via thrown). |
| `arena-end-state-close-policy.test.tsx` | X during `persisting` → disabled; X after `persisted` → `router.push("/coach/${gameId}")`; X during `failed` → `/arena?fresh=1` + toast; X without wallet → `/arena?fresh=1`; backdrop tap = same. |
| `arena-handle-back-no-flash.test.tsx` | Tap BACK during `isEndState` → no `DifficultySelector` in DOM between tap and unmount. |
| `coach-history-tap-entry.test.tsx` | Tap entry on list → `router.push("/coach/${gameId}")`; selected branch absent from rendered output. |

### VR baselines (Playwright, minipay viewport only)

Fixture harness per the VR-5/7/8 pattern in memory, using the `injected` prop contract from §2 dev-fixture table (no wagmi provider). New fixtures in `apps/web/src/app/dev/`:

| Fixture | Snapshots |
|---|---|
| `dev/coach-game-viewer/` | viewer-initial-last-move · viewer-mid-slider · viewer-start-position · viewer-partial-replay-error |
| `dev/coach-game-actions/` | actions-win-unminted · actions-win-minted · actions-loss · actions-stalemate · actions-resigned-too-short-fallback |
| `dev/coach-viewer-mint/` | mint-ready · mint-claiming · mint-success-with-share · mint-error-pill |
| `dev/coach-viewer-overlay/` | coach-loading · coach-result-inline · coach-fallback-inline · coach-paywall-inline |

**Total: ~16 snapshots** (up from 8 in v1 of the spec). Coverage rationale: the mint and coach overlay phases existed previously inside the popup chrome; they now also render inside the viewer chrome. VR-5/7/8 baselines from the arena fixture do NOT apply transitively — the chrome is different. Baselines live in `apps/web/tests/visual/`. Single baseline run after merging the cluster. Adheres to the `vr-baseline-discipline` memory rule.

### Telemetry events (new + reused)

**New events emitted by `/coach/[gameId]`** (consumer fires; hooks are side-effect-free per §2 audit):

| Event | Properties |
|---|---|
| `coach_viewer_view` | `{ gameId, source: "arena_endgame" \| "history" \| "deep_link", has_analysis: boolean }` |
| `coach_viewer_play_again_tap` | `{ gameId }` |
| `coach_viewer_ask_coach_tap` | `{ gameId, has_existing_analysis: boolean }` |
| `coach_viewer_mint_tap` | `{ gameId, difficulty }` |
| `coach_viewer_share_tap` | `{ gameId, tokenId? }` |
| `coach_viewer_back_tap` | `{ gameId, history_depth }` — `history_depth` for H-2 diagnostics |
| `coach_viewer_corrupt_record` | `{ gameId, last_valid_index, bad_san }` |
| `coach_viewer_mint_receipt_write` | `{ gameId, outcome: "ok" \| "fail", status_code? }` |

**Reused with extended `source` dim:** `coach_analyze_request{source: "viewer"}` — extend the `AnalyzeSource` union at `apps/web/src/lib/coach/analyze-telemetry.ts` to include `"viewer"`. `victory_claim_tx{stage, surface: "arena" \| "viewer"}` — extend `victory_claim_tx` payload with `surface`.

### Smoke checklist (post-deploy preview, MiniPay viewport 390x844)

- [ ] Win match → popup → X → `/coach/[gameId]` loads viewer + Mint visible
- [ ] Mint succeeds (hot path) → CTA mutates to "View NFT" without reload
- [ ] Mint succeeds → close + reopen WebView → cold-load `/coach/[gameId]` shows "View NFT" (mint-receipt POST persisted)
- [ ] **X is LOCKED while `claimPhase === "claiming"` — no close possible during sig + tx**
- [ ] Loss with moves → popup → X → viewer + Ask Coach visible, no Mint
- [ ] Resign with zero moves → entry **not shown / inert in `/coach/history`**; viewer at direct URL shows "too short to review" fallback (defensive)
- [ ] Guest (disconnect wallet) → popup → X → `/arena?fresh=1` direct, no flash
- [ ] BACK from active arena game → `/hub` direct, no selector flash
- [ ] Tap entry on `/coach/history` → routes to `/coach/[gameId]`, same layout as post-game
- [ ] Direct URL to non-owner gameId → 404 fallback page (Play Again)
- [ ] Direct deep-link to `/coach/[gameId]` as first WebView entry → BACK navigates to `/hub`, **NOT WebView close**
- [ ] Wallet disconnected at viewer mount → `<ConnectPromptToast>` rendered; reconnect → page refetches
- [ ] Slow network: X tapped during `persisting` → disabled spinner → auto-navigates on `persisted`
- [ ] Persist FAIL: X tapped during `persisting` → state goes to `failed` → auto-navigates to `/arena?fresh=1` + toast fires
- [ ] User backgrounds WebView during 800ms `endOverlayTimer` gap → resume → popup renders immediately (no stuck pre-popup state)
- [ ] Partial-replay corruption (synthetic test via injected bad SAN) → viewer renders up to lastValidIndex + banner + telemetry fires

---

## Section 6 — Implementation phases and commit plan

Estimated effort: ~5-6 days focused work (revised up from 4 after red-team), 17 atomic commits across 5 phases. Each commit ships green (full test suite passes locally). Adds: new `POST /api/games/[id]/mint-receipt` endpoint (Phase 1), `useCoachCreditsPurchase` hook (Phase 2), feature flag gating + cleanup commit (Phases 2+5), partial-replay support in `useGameReplay` (Phase 1).

### Phase 1 — Bug fix + foundation (independent, mergeable solo)

| # | Commit | Type | Notes |
|---|---|---|---|
| 1 | `fix(arena): handleBack no flash selector — direct router.push to /hub` | fix | + test `arena-handle-back-no-flash.test.tsx`. **Ship-ready today**, independent of all other commits. |
| 2 | `feat(api): GET /api/games/[id] — wallet-asserted gameRecord fetch` | feat | route + zod schema + origin gate + rate limit + test. Auth model is "wallet-asserted, NOT proof-of-ownership" (matches every existing endpoint — see §1 auth posture). |
| 3 | `feat(api): POST /api/games/[id]/mint-receipt — persist mint outcome` | feat | extends `coach:game:<wallet>:<gameId>` record with `mintedTokenId/claimTxHash/shareCardUrl/shareLinkUrl`. Idempotent. Required for cold-load viewer to show post-mint state. |
| 4 | `feat(lib/game): useGameReplay hook — SAN[] → fenList navigator with partial-replay` | feat | + `use-game-replay.test.ts`. Mirrors `movesToFen` lazy-with-try/catch pattern. |

### Phase 2 — Hooks extraction (refactor without behavior change, feature-flag-gated)

| # | Commit | Type | Notes |
|---|---|---|---|
| 5 | `refactor(arena): extract useCoachAnalysis + useCoachCreditsPurchase from page.tsx` | refactor | Behind `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS=true`. Two hooks because credits-purchase pulls wagmi writes that would break viewer portability (H-3). Unit tests + `arena-play-timer-resilience.test.tsx` green. |
| 6 | `refactor(arena): extract useMintVictory from page.tsx` | refactor | Behind `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK=true`. Unit tests + arena page tests + timer-resilience test green. |

**Phase 2 gating rule:** each hook ships behind its own feature flag for **at least one preview deploy cycle** with manual MiniPay smoke before flipping the flag to true in production. Memory `bundle-dont-defer` defaults to bundling — this is the documented exception (production-impact-risk gating per `arena-play-timer-fragility` precedent). Roll-back path: flip the flag back to false; the legacy inline path stays compiled until commit 13 cleans it up.

### Phase 3 — Viewer components + page

| # | Commit | Type | Notes |
|---|---|---|---|
| 7 | `feat(coach): GameViewer component — board + slider + SAN list + partial-replay banner` | feat | + RTL test |
| 8 | `feat(coach): GameActionsBar — 4 CTAs with result-aware visibility` | feat | + RTL test |
| 9 | `feat(coach): /coach/[gameId] page — viewer + CoachPanel/Fallback inline + actions` | feat | composes 7 + 8 + hooks; + integration test. Handles quick-vs-full analysis branch per H-8. |

### Phase 4 — Wiring + history update

| # | Commit | Type | Notes |
|---|---|---|---|
| 10 | `feat(arena): X-close state machine → /coach/[gameId] or /arena?fresh=1` | feat | applies state machine from §4 + `pendingNavRef` consumer + `endOverlayTimer` background-resume; + integration test. |
| 11 | `refactor(coach/history): tap entry routes to /coach/[gameId], drop selected branch, filter zero-move rows` | refactor | -28 lines in selected branch; +zero-move filter at list level (H-9). |
| 12 | `feat(coach): mint-receipt wiring in CoachGameClient + arena/page.tsx consumer of useMintVictory` | feat | Both consumers POST `/api/games/[id]/mint-receipt` on `claimPhase === "success"`. Idempotent so double-fire is harmless. |

### Phase 5 — Flag flip, cleanup, VR + handoff

| # | Commit | Type | Notes |
|---|---|---|---|
| 13 | `chore: flip feature flags ON + delete legacy inline coach/mint paths` | chore | Once Phase 2 hooks have soaked one preview cycle with green smoke, flip flags + remove the legacy branches in `arena/page.tsx`. -~500 LOC net. |
| 14 | `test(vr): fixtures dev/coach-game-{viewer,actions,mint,overlay}` | test | 4 fixture pages, no product-code touch beyond `injected` props. |
| 15 | `test(vr): baselines coach-game-viewer × 16 phases (minipay only)` | test | 16 PNGs covering viewer × 4 + actions × 5 + mint × 4 + overlay × 4. |
| 16 | `docs: handoff coach-game-viewer cluster` | docs | `docs/handoffs/2026-XX-XX-coach-game-viewer-handoff.md` |
| 17 | `chore: memory sync — coach-game-viewer cluster pointer + index entry` | chore | new `project_coach_game_viewer.md` + MEMORY.md line |

### Mergeability checkpoints

- After Phase 1: bug fix can land on `main` standalone if urgent.
- After Phase 2: refactor mergeable; `/arena` behaves identically.
- After Phase 3: new route exists but only reachable by direct URL.
- After Phase 4: cluster functionally complete; preview deploy + smoke can run.
- After Phase 5: cluster closed, handoff written, memory synced.

### Live risks

1. **Hooks extraction can collapse the `arena-play-timer-fragility` (PLAY → playing 400ms render-density window).** Mitigations: (a) HARD RULE memoize every hook return function via `useCallback` per `feedback_hook_ref_stability.md`; (b) `arena-play-timer-resilience.test.tsx` regression test runs in Phase 2 and asserts PLAY advances within 800ms across N intervening commits; (c) feature-flag gating ships each extracted hook behind `NEXT_PUBLIC_USE_EXTRACTED_*` for one preview cycle before production flip. The existing arena page tests are necessary but not sufficient — they do not exercise the PLAY timer.
2. **Auth posture for `GET /api/games/[id]` is wallet-asserted, NOT proof-of-ownership.** Matches every existing endpoint (no SIWE / signed-session primitive exists in the repo today). Threat model: unguessable-UUID gating + origin check + read-rate-limit. SIWE upgrade is a cross-cluster spec — out of scope. Spec language updated to stop promising "owner-only" guarantees that are not implementable as written.
3. **Side-effects coupling on hook extraction.** sessionStorage / localStorage / refs / telemetry are enumerated in §2 Side-effects audit with explicit owner per item. Partial extraction will silently drop a coupling (e.g., welcome modal showing on one surface but not the other); the audit table is the gating contract for Phase 2 PR review.
4. **`gameRecord` mint-receipt write must precede cold-load reliance.** Phase 1 commit #3 (`POST /api/games/[id]/mint-receipt`) ships BEFORE Phase 4 commit #12 (consumer wiring). If the mint-receipt write fails (network drop after success tx), the warm session still renders correctly (in-memory state) but a cold-load shows pre-mint state. Recoverable: re-tap Mint → contract rejects "already claimed" → user falls into "already minted" path. Telemetry `coach_viewer_mint_receipt_write{outcome}` surfaces ops signal.
5. **Share Fase 1 is mint-gated.** Sharing a position without a mint requires a separate share-card pipeline that doesn't exist yet. Loss / draw players have no canonical OG-image generator. Decision documented as Fase 2 scope; if Share-CTA-when-not-minted surfaces in user testing as a real ask, escalate to a separate Fase 2 cluster.
6. **`router.back()` deep-link fallback is HARD-CODED to `/hub`.** When `/coach/[gameId]` is the first WebView entry, BACK falls through to `window.history.back()` which would close MiniPay. The `history.length > 1 ? router.back() : router.push("/hub")` pattern is mandatory at every BACK handler in this cluster's surfaces.

---

## Open questions — RESOLVED in red-team pass

All 10 questions were resolved in the adversarial review at `docs/reviews/2026-05-27-coach-game-viewer-redteam.md`. Resolutions integrated into the body of this spec above. Quick index:

1. **Auth posture** → wallet-asserted, NOT proof-of-ownership. §1 + §6 risk #2. See C-1.
2. **Persisting-state X behavior** → state machine with `pendingNavRef` consumer for every terminal `persistState`. §4. See H-1.
3. **Hooks extraction risk** → comparison-test insufficient; add `arena-play-timer-resilience.test.tsx` + feature flag gating + `useCallback` HARD RULE. §2 + §5 + §6 Phase 2. See C-3.
4. **`/coach/history` empty state** → no regression. Empty branch (`!address`) unaffected; `<CoachHistoryDeletePanel>` still renders. Verified.
5. **Zero-move resign from cold path** → filtered at history-list level; viewer fallback is defensive only. §3 + H-9.
6. **Mint-flow `gameRecord` refetch** → no refetch. CTA mutation is in-memory via `useMintVictory` state; cold-load persistence via new `POST /api/games/[id]/mint-receipt`. §3 + §6 risk #4. See C-2.
7. **`router.back()` deep-link** → mandatory `history.length > 1 ? router.back() : router.push("/hub")` pattern at every BACK handler. §4. See H-2.
8. **VR baseline scope** → bumped from 8 to 16 snapshots covering viewer/actions/mint-phases/coach-overlay. §5.
9. **`shareCardUrl` lifecycle** → owned by `useMintVictory` (full {tokenId, txHash, shareCardUrl, shareLinkUrl} produced by the hook); SSR-safe origin via a `getOrigin()` util. Persisted via mint-receipt endpoint.
10. **Telemetry surface** → consumer fires, hook is side-effect-free. 8 new events + 2 reused-with-extended-surface dim documented in §5.

---

## References

- `apps/web/src/app/[locale]/arena/page.tsx` (1996 lines — the source of the bugs and the extraction target)
- `apps/web/src/components/arena/arena-end-state.tsx` (X-close handler and persistence overlay)
- `apps/web/src/app/[locale]/coach/history/page.tsx` (the "selected" branch to remove)
- `apps/web/src/lib/game/use-chess-game.ts` (exposes `moveHistory: string[]`, the source data for replay)
- `apps/web/src/components/coach/coach-panel.tsx` (reused inline when analysis exists)
- `apps/web/src/components/board/board-thumbnail.tsx` (visual base for the larger viewer board)
- `apps/web/src/lib/server/demo-signing.ts:83-113` — `enforceOrigin` posture; null-Origin MiniPay passes through. Anchors §1 auth model.
- `apps/web/src/lib/coach/types.ts:25-34` — current `GameRecord` shape, extended by this cluster (additive only).
- `apps/web/src/lib/game/moves-to-fen.ts:48` — partial-replay precedent that `useGameReplay` mirrors.
- Cluster E spec (game persistence + Coach re-entry) — relevant for `runPersist` lifecycle.
- Adversarial review at `docs/reviews/2026-05-27-coach-game-viewer-redteam.md` (this spec's red-team).
- Memory file: `project_arena_end_state_popup_polish.md` — Sally's retention-loop guidance (X never to `/hub`).
- Memory file: `project_arena_fresh_param.md` — every "enter arena" CTA carries `?fresh=1`.
- Memory file: `project_arena_play_timer_fragility.md` — 400ms PLAY timer collapse precedent. Anchors Phase 2 mitigation.
- Memory file: `feedback_hook_ref_stability.md` — `useCallback` HARD RULE for hook return functions.
- Memory file: `feedback_vr_baseline_discipline.md` — VR baseline workflow.
- Memory file: `feedback_bundle_dont_defer.md` — bundling default; Phase 2 feature flag is the documented exception.
