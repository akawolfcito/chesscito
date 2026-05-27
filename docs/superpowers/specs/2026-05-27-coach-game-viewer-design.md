# Coach Game Viewer — Design Spec

**Date:** 2026-05-27
**Author:** Wolfcito + Claude (brainstorm session)
**Status:** draft — pending red-team review
**Cluster:** post arena-end-state-polish (2026-05-27)

---

## Problem statement

After today's `arena-end-state-popup-polish` ship, three UX gaps remain on the post-game flow:

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
| `GET /api/games/[id]` | **New.** Returns `GameRecord` for owner-only read. Validates `walletAddress` against session/cookie. 404 if not owner (no leak). Cache: `no-store` (game state can mutate via mint). |
| `POST /api/games` | Existing (Cluster E). No change. |

**Auth posture for `GET /api/games/[id]` — Fase 1 decision:** owner-only via the same wallet-binding used by `runPersist` (cookie or header carrying wallet address validated by server). No public read. Fase 2 will introduce a signed share-token query param for public read-only viewing.

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
| `useCoachAnalysis` | ~300-1090 (coach phase machine: idle → review → paywall → result → history; coach request lifecycle; abort handling; locale & reanalyze; pro bypass) | Reuse from `/coach/[gameId]`. Testable in isolation. Reduces `arena/page.tsx` size. |
| `useMintVictory` | ~866-1072 (claim phase machine: ready → claiming → success/error/cancelled/timeout; EIP-712 signature request; approve + mint tx; receipt confirmation; share-card generation; rate-limit handling) | Reuse from `/coach/[gameId]`. Testable in isolation. |

**Refactor invariant:** the extracted hooks must preserve the exact behavior of `arena/page.tsx` — the existing arena page tests (including any race-condition coverage from Cluster E) must remain green after extraction. Comparison test pass required as part of Fase 2 sign-off.

### Reused unchanged

- `<CoachPanel>` (mounted inside `CoachGameClient` when `gameRecord.analysis` exists)
- `<CoachLoading>`, `<CoachPaywall>`, `<CoachFallback>` (mounted by `useCoachAnalysis`)
- `<VictoryClaiming>`, `<VictoryClaimSuccess>`, `<VictoryClaimError>` (mounted by `useMintVictory`)
- `<CandyGlassShell>` (chrome of the page)
- `<ContextualHeader variant="back-control">` (header with BACK)
- `<BoardThumbnail>` (visual base for the larger viewer board)

### Removed

- `/coach/history/page.tsx` lines 122-150 (the `if (selected)` branch that mounted `<CoachPanel>` inline). Replaced by `router.push("/coach/${entry.gameId}")` in `handleSelect`.

---

## Section 3 — Data flow and state

### Server load

```
GET /api/games/[gameId]
→ GameRecord {
    gameId: string,
    walletAddress: `0x${string}`,
    result: "win" | "loss" | "draw" | "resigned" | "stalemate" | "checkmate",
    difficulty: "easy" | "medium" | "hard",
    moves: string[],                   // SAN, source of truth
    startingFen: string,               // defaults to chess.js startpos if absent
    elapsedMs: number,
    totalMoves: number,                // = moves.length, redundant for safety
    mintedTokenId: bigint | null,      // null if not minted
    claimTxHash: string | null,
    shareCardUrl: string | null,
    analysis: CoachAnalysisRecord | null   // null if not analyzed
  }
```

### Replay derivation

```ts
// useGameReplay(moves: string[], startingFen?: string)
//
// On mount, build:
//   fenList[0] = startingFen ?? STARTPOS
//   fenList[i] = fen after replaying moves[0..i-1]
//   fenList.length = moves.length + 1
//
// Expose:
//   currentIndex     // default = moves.length (final position)
//   currentFen       // = fenList[currentIndex]
//   currentMove      // = moves[currentIndex - 1] or null if index 0
//   goPrev / goNext / goTo(i) / goStart / goEnd
//   canPrev = currentIndex > 0
//   canNext = currentIndex < moves.length
//   totalMoves = moves.length
//
// Invalid SAN in moves[] → throw in fenList build; CoachGameClient
// catches and renders the error fallback (per Section 4).
```

### State ownership

| State | Owner | Notes |
|---|---|---|
| `currentIndex` | `useGameReplay` (component-local) | Not synced to URL in Fase 1. Deep-link to a specific move is Fase 2. |
| `coachPhase` + `coachResponse` | `useCoachAnalysis` hook | Same shape as today in `/arena`. Locale-aware, abort-safe. |
| `claimPhase` + `claimData` + `claimError` | `useMintVictory` hook | Same shape as today in `/arena`. EIP-712 signature, approve, mint, receipt. |
| `gameRecord` | Server-fetched, client-immutable | Re-fetched only after mint `success` to refresh `mintedTokenId`. |

### Key interactions

- **Tap "Ask Coach"** → `useCoachAnalysis.start(gameId)`. Opens `<CandyGlassShell>` modal with paywall / loading / result phases. If `gameRecord.analysis` is already present, `<CoachPanel>` mounts inline directly (no fresh request).
- **Tap "Save / Mint Victory"** → `useMintVictory.start({ gameId, difficulty, result, totalMoves, elapsedMs })`. Same state machine as today. On `success`, the page re-fetches `gameRecord`; the CTA mutates to "View NFT" with a Celoscan link and a gold ribbon (no price).
- **Tap "Share"** → only enabled when `mintedTokenId != null`. Opens the existing share-card flow with `shareCardUrl`. Share before mint is Fase 2.
- **Tap "Play Again"** → `router.push("/arena?fresh=1")`. No local state cleanup needed; the page unmounts.
- **Tap BACK** (header) → `router.back()`. From `/arena` exits to selector (because `/arena` is the previous entry in history). From `/coach/history` goes back to the list.

### Edge cases handled in component logic

- `moves.length === 0` (resign without moving): viewer renders only `startingFen`, controls disabled, banner *"Nothing to review — play another match"* sits above the board. Visible CTAs: Play Again primary, Ask Coach hidden, Mint hidden (result is loss/resigned), Share hidden.
- `mintedTokenId != null`: "Save" CTA replaced by "View NFT" (Celoscan link + gold ribbon). Share enabled.
- `result !== "win"`: Mint CTA hidden entirely. (Mint is gated to wins via the contract.)
- `gameRecord.analysis != null`: Coach section renders `<CoachPanel>` inline. If pro, "Reanalyze" CTA is offered (same wiring as today in `/coach/history`).

---

## Section 4 — Routing policy and edge cases

### X-close decision table (popup in `/arena`)

| Condition | X behavior | Toast |
|---|---|---|
| Wallet connected + `persistState === "persisted"` + `gameId` valid | `router.push("/coach/${gameId}")` | — |
| Wallet connected + `persistState === "persisting"` | X disabled, `aria-busy`, spinner. Auto-navigate when state transitions to `persisted`. | — |
| Wallet connected + `persistState === "failed"` | X enabled. Tap → `router.push("/arena?fresh=1")` and dispatch toast. | `"Match couldn't be saved · play another?"` |
| Guest (no wallet) | X enabled. Tap → `router.push("/arena?fresh=1")`. | — (transition alone communicates) |
| Backdrop tap | Same policy as X. | Same. |

**Implementation note:** today's `onClose = () => setShowEndOverlay(false)` is replaced by a `handleEndStateClose()` handler in `arena/page.tsx` that applies this decision table.

### `handleBack` (BACK in `ArenaHud` during game)

**Bug fix:** simplify to `handleBack = () => router.push("/hub")`. Remove the synchronous `resetArenaState()` + `game.reset()` calls. Rationale: `/arena`'s unmount cleanup already aborts in-flight refs (`claimingRef`, `coachAbortRef`, `persistAbortRef`); calling `game.reset()` before navigation causes `game.status` to flip to `"selecting"` for one frame before the route transition completes, producing the visible selector flash.

**Regression coverage:** `arena-handle-back-no-flash.test.tsx` asserts that `queryByTestId("difficulty-selector")` returns null between the BACK tap and the navigation completion.

### Coach phase residual at popup close

Today's behavior: if `coachPhase !== "idle"`, the popup is hidden (`opacity-0 pointer-events-none`) and the `<CandyGlassShell>` coach overlay mounts above the arena. This pattern is preserved — the new viewer at `/coach/[gameId]` is only relevant when the user explicitly closes the popup via X. If they tap Ask Coach inside the popup, the existing coach overlay flow handles it. Compatible.

### Persistence in-flight + rapid tap

Decision: while `persistState === "persisting"`, the X is **non-interactive but registers intent**. Cosmetically it shows a spinner. When `persisted` arrives, the page **auto-navigates** to `/coach/[gameId]` without requiring a second tap. Rationale: more forgiving than the alternative of "tap, nothing happens visibly, tap again". Implementation: a `pendingNavRef` set on the first tap is consumed by the `persistState` effect.

### `GET /api/games/[id]` failure on the new route

`CoachGamePage` (server) throws on fetch failure → page renders a friendly fallback: `<ContextualHeader>` with BACK + message *"Couldn't load this match"* + CTA *"Play another"* → `/arena?fresh=1`. The user never bounces to `/hub`.

### Direct navigation to a non-owner gameId

Server component compares `gameRecord.walletAddress` against the session-bound wallet. Mismatch → `notFound()` (404 boundary). Same response as a truly nonexistent gameId — no information leak about existence.

### Invalid SAN in stored `moves[]`

`useGameReplay` throws during `fenList` construction. `CoachGameClient` wraps the hook call in a try/catch and renders the corrupt-record fallback: header + message *"This match is corrupted and can't be reviewed"* + Play Again CTA. Telemetry event `coach_viewer_corrupt_record { gameId }` fires for backend follow-up.

---

## Section 5 — Testing strategy

### Unit tests (Vitest + RTL)

| Suite | Coverage |
|---|---|
| `use-game-replay.test.ts` | Replay derivation from SAN[]; `goPrev/goNext/goTo/goStart/goEnd` correctness and bounds; `currentMove` null at index 0; `moves.length === 0` renders only startingFen; invalid SAN throws and is catchable. |
| `use-coach-analysis.test.ts` | Phase machine (idle → review → paywall → result); abort on unmount; pro bypasses paywall; locale switch + reanalyze; server error → fallback. |
| `use-mint-victory.test.ts` | Phase machine (ready → claiming → success / error / cancelled / timeout); sig timeout; wrong chain; wallet disconnect mid-flow; rate-limit response; receipt confirmation. |
| `game-viewer.test.tsx` | Board renders at each index; ← / → disable at bounds; SAN list highlights current move; slider syncs with index; zero-moves banner shown. |
| `game-actions-bar.test.tsx` | CTA visibility per result (win / loss / draw / resigned / stalemate); "View NFT" when `mintedTokenId` present; Ask Coach disabled when `moves === 0`; Share enabled only when minted (Fase 1). |

### Integration tests (RTL + msw)

| Suite | Coverage |
|---|---|
| `coach-game-page.test.tsx` | Mount with valid gameRecord → viewer + CTAs; mount with `analysis` present → `CoachPanel` inline; zero-move record → fallback banner; API 404 → friendly error fallback; auth mismatch → `notFound` boundary (asserted via thrown). |
| `arena-end-state-close-policy.test.tsx` | X during `persisting` → disabled; X after `persisted` → `router.push("/coach/${gameId}")`; X during `failed` → `/arena?fresh=1` + toast; X without wallet → `/arena?fresh=1`; backdrop tap = same. |
| `arena-handle-back-no-flash.test.tsx` | Tap BACK during `isEndState` → no `DifficultySelector` in DOM between tap and unmount. |
| `coach-history-tap-entry.test.tsx` | Tap entry on list → `router.push("/coach/${gameId}")`; selected branch absent from rendered output. |

### VR baselines (Playwright, minipay viewport only)

Fixture harness per the VR-5/7/8 pattern in memory. New fixtures in `apps/web/src/app/dev/`:

| Fixture | Snapshots |
|---|---|
| `dev/coach-game-viewer/` | viewer-initial-last-move · viewer-mid-slider · viewer-start-position · viewer-zero-moves |
| `dev/coach-game-actions/` | actions-win-unminted · actions-win-minted · actions-loss · actions-zero-moves |

Baselines live in `apps/web/tests/visual/`. Single baseline run after merging the cluster. Adheres to the `vr-baseline-discipline` memory rule.

### Smoke checklist (post-deploy preview, MiniPay viewport 390x844)

- [ ] Win match → popup → X → `/coach/[gameId]` loads viewer + Mint visible
- [ ] Mint succeeds → CTA mutates to "View NFT" without reload
- [ ] Loss with moves → popup → X → viewer + Ask Coach visible, no Mint
- [ ] Resign with zero moves → popup → X → viewer banner + Play Again
- [ ] Guest (disconnect wallet) → popup → X → `/arena?fresh=1` direct, no flash
- [ ] BACK from active game → `/hub` direct, no selector flash
- [ ] Tap entry on `/coach/history` → routes to `/coach/[gameId]`, same layout as post-game
- [ ] Direct URL to a non-owner gameId → 404
- [ ] Slow network: X tapped during `persisting` → disabled spinner → auto-navigates on completion

---

## Section 6 — Implementation phases and commit plan

Estimated effort: ~4 days focused work, 14 atomic commits across 5 phases. Each commit ships green (full test suite passes locally).

### Phase 1 — Bug fix + foundation (independent, mergeable solo)

| # | Commit | Type | Notes |
|---|---|---|---|
| 1 | `fix(arena): handleBack no flash selector — direct router.push to /hub` | fix | + test `arena-handle-back-no-flash.test.tsx` |
| 2 | `feat(api): GET /api/games/[id] — owner-only gameRecord fetch` | feat | route + zod schema + auth guard + test |
| 3 | `feat(lib/game): useGameReplay hook — SAN[] → fenList navigator` | feat | + `use-game-replay.test.ts` |

### Phase 2 — Hooks extraction (refactor without behavior change)

| # | Commit | Type | Notes |
|---|---|---|---|
| 4 | `refactor(arena): extract useCoachAnalysis from page.tsx` | refactor | + unit tests; arena page tests remain green |
| 5 | `refactor(arena): extract useMintVictory from page.tsx` | refactor | + unit tests; arena page tests remain green |

### Phase 3 — Viewer components + page

| # | Commit | Type | Notes |
|---|---|---|---|
| 6 | `feat(coach): GameViewer component — board + slider + SAN list` | feat | + RTL test |
| 7 | `feat(coach): GameActionsBar — 4 CTAs with result-aware visibility` | feat | + RTL test |
| 8 | `feat(coach): /coach/[gameId] page — viewer + CoachPanel + actions` | feat | composes 6 + 7 + hooks; + integration test |

### Phase 4 — Wiring + history update

| # | Commit | Type | Notes |
|---|---|---|---|
| 9 | `feat(arena): X-close routing policy → /coach/[gameId] or /arena?fresh=1` | feat | applies decision table from Section 4; + integration test |
| 10 | `refactor(coach/history): tap entry routes to /coach/[gameId], drop selected branch` | refactor | -28 lines in `/coach/history/page.tsx` |

### Phase 5 — VR + smoke + handoff

| # | Commit | Type | Notes |
|---|---|---|---|
| 11 | `test(vr): fixtures dev/coach-game-viewer + dev/coach-game-actions` | test | fixture harness, no product code touched |
| 12 | `test(vr): baselines coach-game-viewer × 4 phases (minipay only)` | test | 8 PNGs (viewer × 4 + actions × 4) |
| 13 | `docs: handoff coach-game-viewer cluster` | docs | `docs/handoffs/2026-XX-XX-coach-game-viewer-handoff.md` |
| 14 | `chore: memory sync — coach-game-viewer cluster pointer + index entry` | chore | new `project_coach_game_viewer.md` + MEMORY.md line |

### Mergeability checkpoints

- After Phase 1: bug fix can land on `main` standalone if urgent.
- After Phase 2: refactor mergeable; `/arena` behaves identically.
- After Phase 3: new route exists but only reachable by direct URL.
- After Phase 4: cluster functionally complete; preview deploy + smoke can run.
- After Phase 5: cluster closed, handoff written, memory synced.

### Live risks

1. **Hooks extraction may break subtle parity.** Race conditions involving `claimingRef`, `coachAbortRef`, and `persistAbortRef` are not obvious from a unit test alone. Mitigation: Phase 2 includes a comparison pass against the real arena page (re-run the existing arena integration tests in their full form, including any Cluster E race coverage).
2. **`GET /api/games/[id]` auth posture must be settled before Phase 1 commit #2.** The cookie/session vs wallet-signature decision shapes how the server validates ownership. Today `runPersist` sends the wallet address from wagmi; the server must validate it bound to a session, not just trust the request body. Resolve as part of Phase 1 design.
3. **Share Fase 1 is mint-gated.** Sharing a position without a mint requires a separate share-card pipeline that doesn't exist yet. Decision documented as Fase 2 scope; if Share-CTA-when-not-minted surfaces in user testing as a real ask, escalate.

---

## Open questions for red-team review

The following are explicitly called out for the red-team pass. Each is a place where the spec made a decision that could be wrong:

1. **Auth posture for `GET /api/games/[id]`** — is wallet-bound session enough, or do we need a signature challenge? What's the existing pattern in `/api/coach/*`?
2. **Persisting-state X behavior** — is "disabled + auto-navigate on completion" actually friendlier than "X enabled and navigates as soon as state catches up"? Consider a user who tapped X 5 seconds ago and forgot about it.
3. **Hooks extraction risk** — is the comparison-test strategy in Phase 2 sufficient, or should we add a manual smoke pass to MiniPay before merging Phase 2 standalone?
4. **`/coach/history` empty state after refactor** — when the list is empty (no analyzed sessions), the page still has a banner. Does removing the "selected" branch change anything visible? Verify there's no other code path that relied on it.
5. **Zero-move resign edge case from the new route** — if a user opens `/coach/[gameId]` for a zero-move match (cold path, not from the popup), does the banner-only state feel like a dead-end or is the Play Again CTA enough?
6. **Mint flow ownership of `gameRecord` refetch** — after `useMintVictory` reaches `success`, who triggers the refetch of `gameRecord`? The hook itself or the consumer page? Decide explicitly to avoid double-fetch.
7. **`router.back()` from BACK button** — what happens if the user opens `/coach/[gameId]` as the first page in their history (e.g., from a future share deep-link)? `router.back()` falls through to browser history; if empty, MiniPay might close the webview. Need a fallback to `/hub`.
8. **VR baseline scope** — 8 snapshots covers the viewer and actions bar variants but not the coach-overlay-active state nor the mint-flow phases. Are those covered by existing VR baselines, or do they need new ones in this cluster?
9. **`shareCardUrl` lifecycle** — today `shareCardUrl` is generated during the post-mint flow in `/arena`. From `/coach/[gameId]`, when the user mints, the same generation must trigger. Is the generation tied to `useMintVictory` or to a separate effect in arena page that won't be present on the new route?
10. **Telemetry event surface** — Section 4 mentions `coach_viewer_corrupt_record`. What's the full list of new telemetry events for this cluster? Audit needed for parity with existing arena/coach telemetry conventions.

---

## References

- `apps/web/src/app/[locale]/arena/page.tsx` (1996 lines — the source of the bugs and the extraction target)
- `apps/web/src/components/arena/arena-end-state.tsx` (X-close handler and persistence overlay)
- `apps/web/src/app/[locale]/coach/history/page.tsx` (the "selected" branch to remove)
- `apps/web/src/lib/game/use-chess-game.ts` (exposes `moveHistory: string[]`, the source data for replay)
- `apps/web/src/components/coach/coach-panel.tsx` (reused inline when analysis exists)
- `apps/web/src/components/board/board-thumbnail.tsx` (visual base for the larger viewer board)
- Cluster E spec (game persistence + Coach re-entry) — relevant for `runPersist` lifecycle
- Sally's retention-loop guidance (memory: `arena-end-state-popup-polish`) — X never goes to `/hub`
- Memory: `arena-fresh-param` — every "enter arena" CTA carries `?fresh=1`
- Memory: `vr-baseline-discipline` — VR baseline workflow
- Memory: `bundle-dont-defer` — adjacent tasks bundle into current cluster
