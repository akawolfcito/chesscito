---
target: docs/superpowers/specs/2026-05-27-coach-game-viewer-design.md
reviewer: cynical-adversarial
date: 2026-05-27
verdict: revise — significant rework on auth, hook extraction, and X-close racing required before Phase 4
severity_distribution:
  critical: 4
  high: 9
  medium: 11
  low: 5
total_findings: 29
---

# Adversarial Review — Coach Game Viewer Design

The spec lands a real UX bug (dead board after X-close, `handleBack` flash) and proposes the right shape — a canonical `/coach/[gameId]` viewer. But it confuses several invented primitives with shipped ones (a "wallet-bound session" that does not exist), under-specifies the post-mint refetch contract (Risk #6 IS Section 3 — the contradiction the brief asks me to find), and proposes a hook extraction that walks straight into the documented `arena-play-timer-fragility` minefield with no mitigation other than "tests should still pass". Open questions are mostly real, several are deferred to red-team without doing the homework, and the test plan has structural gaps. The bug fix in Phase 1 is the cleanest commit in the plan and could ship today; everything past Phase 2 needs another pass.

---

## CRITICAL — block before any commit

### C-1. "Wallet-bound session" auth posture for `GET /api/games/[id]` does not exist as a primitive in this repo
**Section:** §1 API surface, §3 server-load row, §4 "Direct navigation to a non-owner gameId", §6 Live risk #2.
**Claim:** "Owner-only via the same wallet-binding used by `runPersist` (cookie or header carrying wallet address validated by server)."
**Why suspect:** No such session exists. Verified across the entire `apps/web/src/lib/server/` and `apps/web/src/app/api/` tree:
- `apps/web/src/lib/server/demo-signing.ts:83-113` (`enforceOrigin`) checks the `Origin`/`Referer` header host against `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL`. **The MiniPay WebView is explicitly allowed through with NO origin** (lines 89-91 — `if (!source) return;`). So a curl with no Origin header passes the gate.
- `runPersist` in `apps/web/src/app/[locale]/arena/page.tsx:1187-1204` sends the wallet address in the request body. The server (`apps/web/src/app/api/games/route.ts:21-37`) reads it from the body and trusts it. There is no cookie, no JWT, no signature, no SIWE, no session table. The body wallet is the wallet of record.
- Every Coach endpoint (`/api/coach/analyze`, `/api/coach/history`, `/api/coach/credits`, `/api/pro/status`) follows the same pattern: wallet in body or query, no signature.
- The single existing wallet-bound action that does signature-recover is `POST /api/coach/history` (delete-self): `apps/web/src/app/api/coach/history/route.ts:3` imports `recoverMessageAddress` — that's the only existing precedent for proving wallet ownership server-side, and it ships a per-request EIP-191 nonce flow specifically because read auth is otherwise unsolved.

**Consequence as spec is written:** any caller knowing a victim's `walletAddress` and a `gameId` will fetch the GameRecord by passing them in. `gameId` is a UUIDv4 (unguessable), so this is not catastrophic, BUT (a) the spec promises "404 if not owner (no leak)" which it cannot deliver without proof of ownership, and (b) the spec's Section 4 also says "Direct navigation to a non-owner gameId → notFound() — Same response as a truly nonexistent gameId — no information leak about existence." That guarantee is impossible against an attacker that *has* a stolen gameId+wallet pair (e.g., shared in a chat). The endpoint is approximately as secure as today's by-wallet endpoints, which is fine for v1 with read-only data — but the spec must stop describing it as "owner-only" and start describing it as "wallet-asserted, unguessable-gameId-gated."

**Resolution:** rewrite §1 + §3 + §4 as: "Server-side, the caller passes `?wallet=0x…` and `gameId` in the URL. The server reads the cached `coach:game:<wallet>:<gameId>` (or analysis record) and 404s if either is missing. There is no server-side proof that the caller controls `walletAddress`; this matches every other current endpoint in the app. The threat model is unguessable-UUID gating, not OAuth-style ownership. A future SIWE / signed-cookie session is out of scope for Fase 1." If the spec wants real owner-only, Phase 1 must add a signature challenge endpoint plus a server-side nonce/session store — that's a new cluster, not a sub-task of commit #2.

---

### C-2. The Section 3 / Risk #6 contradiction asked about IS the contradiction — and worse, the chosen refetch contract is undefined
**Section:** §3 "State ownership" row 4 + §6 Live risk #6 (the brief calls this out explicitly).
**Claim:** §3 says `gameRecord` is "client-immutable, re-fetched only after mint `success`". §6 says "After `useMintVictory` reaches `success`, who triggers the refetch of `gameRecord`? The hook itself or the consumer page? Decide explicitly to avoid double-fetch."
**Why suspect:** Both. §3 makes a behavioral claim ("re-fetched after success") without naming the actor. §6 admits that actor is undefined. The two paragraphs are in the same document. There is no "client-immutable" — if it's re-fetched after mint, the consumer must be hot. There is also no "useMintVictory triggers a refetch" — the hook has no reference to the parent's data, and even if it did, the page already has a stale `gameRecord` in render so the next render after mint will show pre-mint state for one paint.

**Concrete production failure scenario:**
1. User taps Mint. `useMintVictory` enters `claiming`, signs, approves, mints, gets receipt. `claimPhase` → `success`.
2. Whoever owns the refetch (let's say `CoachGameClient`) fires `fetch("/api/games/" + gameId)`. The Upstash Redis read for `coach:game:<wallet>:<gameId>` was written by `runPersist` at game-end — **it never had `mintedTokenId`, `claimTxHash`, or `shareCardUrl` in it because GameRecord doesn't have those fields** (`apps/web/src/lib/coach/types.ts:25-34`). The refetch returns the same payload it had at mount. The CTA never mutates to "View NFT". The spec's §3 row "mintedTokenId: bigint | null" is a fiction.
3. To make this work, `useMintVictory.success` needs a server-side write of `mintedTokenId`/`claimTxHash` into the `coach:game` record OR a sibling table. There is no spec for that write. The closest existing wire is `/api/cache-victory` (`arena/page.tsx:1009-1020`) which writes a separate `victory_records` row but NOT back into `coach:game:<wallet>:<gameId>`.
4. App background + return: user backgrounds the WebView after `claimPhase=success` but before the refetch resolves. iOS WKWebView suspends the fetch. On resume, the refetch fires again or never resolves. The page renders with the stale, pre-mint `gameRecord`. CTA still says Mint. Tapping Mint hits the contract again — the nonce is consumed, but the user paid gas to learn that.

**Resolution:** the spec must define a NEW endpoint (e.g., `POST /api/games/[id]/mint-receipt` or extend `/api/cache-victory`) that writes the mint outcome into the persisted game record. The viewer's gameRecord shape needs to include `mintedTokenId` + `shareCardUrl` only after that endpoint settles. Then either (a) `useMintVictory` exposes a `mintReceiptWritten` flag and the consumer refetches on its transition, or (b) `useMintVictory` accepts a `onMintSuccess(tokenId, txHash)` callback and the consumer commits the in-memory mutation while also kicking off the refetch for confirmation. Pick one; document it.

---

### C-3. `useCoachAnalysis` extraction sits on top of a known timer-fragility minefield with no mitigation
**Section:** §2 hooks extraction, §6 Live risk #1 "Hooks extraction may break subtle parity."
**Claim:** "Reuse from `/coach/[gameId]`. Testable in isolation. Reduces `arena/page.tsx` size." Risk #1: "Mitigation: Phase 2 includes a comparison pass against the real arena page (re-run the existing arena integration tests in their full form, including any Cluster E race coverage)."
**Why suspect:** The project memory `arena-play-timer-fragility` is explicit: "any neighboring useEffect with unstable refs collapses render gap < 400ms and PLAY never reaches the board" and "Add effects to `arena/page.tsx` ONLY with stable deps." `useCoachAnalysis` as proposed will:
- Return an object holding `coachPhase`, `coachResponse`, `coachJobId`, `coachFallbackResponse`, `coachCredits`, `coachProActive`, `coachAnalysisLocale`, `coachReanalyzeGameId`, `isReanalyzing`, `coachServerError`, plus handlers `startCoachAnalysis`, `handleAskCoach`, `handleReanalyze`, `handleAnalyzeFromHistory`, `handleClaimWelcome`, `handleBuyCredits`. That is a ~16-field object. Today `arena/page.tsx` already declares each handler with `useCallback` and carefully scoped deps. Re-exporting them as a hook return must memoize EVERY function (see `feedback_hook_ref_stability.md` — "Default `useCallback` for ALL returned functions").
- `startCoachAnalysis` depends on `[game.status, game.difficulty, game.moveHistory, game.elapsedMs, isPlayerWin, address, persistedGameId, proActiveCached, activeLocale, tEntry]` (line 654). If the hook is consumed as `const coach = useCoachAnalysis({ game, address, ... })` and the consumer effect on `/arena` lists `coach.startCoachAnalysis` as a dep, it WILL re-run every commit unless every nested function in the hook is memoized AND the consumer destructures the stable property name. The 400ms PLAY-button setTimeout will collapse and PLAY will silently fail. The memory file calls this exact regression "PLAY no longer reaches the board" and dates it 2026-05-25.

**The "run the existing arena tests" mitigation is insufficient:** the arena page tests live at `apps/web/src/components/arena/__tests__/*.test.tsx` and only cover ArenaHud, ArenaBoard, ArenaSelectScaffold — NONE of them exercise the 400ms PLAY timer or the render-density failure mode. The bug was found in MiniPay smoke, not unit tests, and there is still no test that would catch a regression. The spec's promise that "existing arena page tests must remain green" is technically true and *useless*.

**Resolution:** before Phase 2 lands, add a regression test that asserts the PLAY flow advances to `playing` status within 800ms of `setIsPreparing(true)` even in the face of N sibling commits during the wait. RTL with `act()` + `vi.useFakeTimers()` can do this. The hook signature must take memoized inputs (game state slice + address + locale) and return only memoized callbacks. Document the contract in the hook docstring with a pointer back to `feedback_hook_ref_stability.md`. Without these guards, Phase 2 will look green in CI and break PLAY in MiniPay on first user.

---

### C-4. `useGameReplay` throws-on-invalid-SAN is incompatible with chess.js v1.4.0 semantics and renders the viewer non-mountable for stalemate-by-claim, threefold-repetition, and 50-move-rule draws
**Section:** §3 "Replay derivation" + §4 "Invalid SAN in stored moves[]".
**Claim:** "Invalid SAN in moves[] → throw in fenList build; CoachGameClient catches and renders the error fallback (per Section 4)." "Memoizes `fenList` once on mount."
**Why suspect:**
- Verified: chess.js v1.4.0 pinned at `apps/web/package.json:40` (`"chess.js": "1.4.0"`). v1.x `game.move(san)` **throws** on illegal moves (per the docstring at `apps/web/src/lib/game/moves-to-fen.ts:48`). The existing `movesToFen` wraps the loop in `try/catch` and returns `null` on failure, which the BoardThumbnail caller treats as "render empty board". That's the precedent the new hook should follow.
- The spec's "throw and let CoachGameClient catch + render fallback" path means: ONE corrupted move out of 60 wipes the entire game from review. That's an over-correction. The user's good moves should still render up to the bad one. The spec's design is "all or nothing" because `useGameReplay` builds `fenList` eagerly on mount. Lazily building per-index would let the viewer skip the bad slot and render up to N-1.
- The "moves source of truth" path: `useChessGame` builds `moveHistory` via `chess.js .history()` (no `verbose: true`). SAN format. **However** game.history() in chess.js v1 changes its disambiguation behavior based on capture annotations. SAN with `+` (check) and `#` (mate) is included. A SAN string of `Nxe5+` re-parses fine; one of `O-O-O` (long castle) re-parses fine. Promotion is `e8=Q`. All standard. BUT: `chess.js` v1.4.0 has a known quirk where `.history()` after `.move()` returns the normalized SAN, not the original input — meaning a game replayed will produce identical normalized SAN, so the lossless-replay property holds for moves that the same chess.js instance produced. **As long as it's only chess.js producing the input**, the replay is safe.
- The terminal `resigned` case stores `moveHistory` at the time of resign — but there's no resign marker in the SAN list. The viewer will render the position at the resign moment and stop. The `currentIndex` default `moves.length` correctly points at the last actual move position. Fine.
- The terminal `draw` case (threefold repetition, 50-move rule) likewise leaves moveHistory intact and is fine.

**The real issue:** the spec says the viewer renders with `startingFen ?? STARTPOS` as `fenList[0]`. **Today `GameRecord` does NOT contain `startingFen`** (`apps/web/src/lib/coach/types.ts:25-34`). The chess.js default startpos is the only starting position used, and that's fine until someone adds Chess960 — at which point the spec's `startingFen` field is the right ABI but the server-side write doesn't populate it. The spec's `startingFen: string` row reads as a future-ready stub; document it as such (defaults to `chess.js.DEFAULT_POSITION`).

**Resolution:** mirror the `movesToFen` pattern. `useGameReplay` builds `fenList` lazily-or-with-try/catch and returns a partial replay + an `error: { atIndex, san }` shape when chess.js rejects. The viewer renders up to the last valid index and shows a "this match is partially corrupt — replay stops at move N" banner inline, not a full-screen fallback. Telemetry `coach_viewer_corrupt_record { gameId, lastValidIndex, badSan }` fires once. Drop the eager-throw contract.

---

## HIGH — block before merge

### H-1. The X-close decision table races persistState transitions; "pendingNavRef set on first tap" mitigation is under-specified
**Section:** §4 "Persistence in-flight + rapid tap."
**Claim:** "while `persistState === 'persisting'`, the X is non-interactive but registers intent. Cosmetically it shows a spinner. When `persisted` arrives, the page auto-navigates to `/coach/[gameId]` without requiring a second tap."
**Why suspect:** the brief explicitly asks "What if persistState transitions to `failed` AFTER the user already tapped X while it was `persisting`?" The spec does not answer:
- Scenario: user taps X at t=0 (state `persisting`). `pendingNavRef.current = true`. At t=2s, `runPersist` rejects (network drop) → state → `failed`. Current spec says the `persistState` effect "consumes" the pending nav on `persisted`. Nothing fires on `failed`. The X is still non-interactive (last instruction was "shows spinner"). The user is now stuck inside an "intent-registered but unfulfillable" state with no visible affordance.
- Worse: `arena/page.tsx:1271-1283` already exposes `handleDismissPersistError` → setPersistState("dismissed"). If the user dismisses the failure toast, persistState transitions `failed` → `dismissed`. Still no nav. The pendingNavRef is never consumed.
- Worst: the user re-taps X (now enabled because the failed pill is dismissable). The decision table says "X during failed → /arena?fresh=1 + toast". So the user effectively gets the same outcome as a fresh start. OK — but the spec needs to SAY that. Today it implies auto-navigation will resolve everything; in practice the only resolution path is a second user tap after a state transition.

**Resolution:** add an explicit `pendingNavRef` consumer for every terminal `persistState`: on `persisted` → push to `/coach/[gameId]`; on `failed` → push to `/arena?fresh=1` with toast; on `dismissed` → clear pendingNavRef (user opted out). Encode this as a state machine table in §4, not narrative prose.

### H-2. `router.back()` from `/coach/[gameId]` falls through to webview-close on deep-link entry, with no fallback specified
**Section:** §3 "Tap BACK (header) → `router.back()`" + open question #7.
**Claim:** "From `/arena` exits to selector (because `/arena` is the previous entry in history). From `/coach/history` goes back to the list." Open #7 admits: "if the user opens `/coach/[gameId]` as the first page in their history (e.g., from a future share deep-link)? `router.back()` falls through to browser history; if empty, MiniPay might close the webview. Need a fallback to `/hub`."
**Why suspect:** Verified — `useRouter` here is the next-intl wrapper (`apps/web/src/i18n/navigation.ts:22`) which forwards to `next/navigation`'s router. `router.back()` calls `window.history.back()`. In a fresh WebView session with one entry, that closes the WebView (MiniPay) or exits the embedded tab (in-app browser). For a fresh deep-link landing in MiniPay, this is the FIRST visible action of the cluster and it nukes the session. Open #7 names the problem but the spec doesn't ship a resolution.
**Resolution:** every BACK handler in `CoachGameClient` and `CoachGamePage` must use the pattern `if (history.length > 1) router.back(); else router.push("/hub");`. Test it in a Playwright mobile context where the route is mounted at index 0. Add to smoke checklist.

### H-3. The shop/coach-pack/PRO upgrade flow inside `useCoachAnalysis.handleBuyCredits` does not transplant to `/coach/[gameId]`
**Section:** §2 "Hooks extracted from arena/page.tsx" + §3 paywall mention.
**Claim:** "Coach phase machine (~300-1090)" is one cohesive hook. Section 3 mentions paywall + reanalyze + locale, but not the credit-purchase pathway.
**Why suspect:** `apps/web/src/app/[locale]/arena/page.tsx:768-862` (`handleBuyCredits`) is part of the coach phase machine but pulls in: `publicClient`, `writeContractAsync`, `chainId`, `address`, `shopAddress`, `isCorrectChain`, `selectPaymentToken`, `tokenBalances`, `waitForReceiptWithTimeout`, `COACH_PACK_ITEMS`, `verifyPurchase`, plus error classification. Extracting it as part of `useCoachAnalysis` means the hook now takes 8 wagmi-derived props OR it owns wagmi hooks itself (and breaks the dev fixture pattern from VR-5/7/8 where wagmi is mocked via `page.route()`). The spec doesn't tell me which.
**Resolution:** the credit-purchase pathway should be ITS OWN hook (`useCoachCreditsPurchase`) consumed inside the same surface as `useCoachAnalysis`. Document it as a sibling extraction in §2. Mark `handleBuyCredits` lines explicitly so the implementer doesn't sweep them into `useCoachAnalysis` blindly.

### H-4. `runPersist` is referenced as "owner-bound" but its body validation is missing from the spec's threat model
**Section:** §6 Live risk #2.
**Claim:** "today `runPersist` sends the wallet address from wagmi; the server must validate it bound to a session, not just trust the request body."
**Why suspect:** This sentence is correct as a critique but the spec never resolves it. `runPersist` (arena/page.tsx:1170-1229) uses `address` from `useAccount()`. The MiniPay WebView returns the user's wallet to `useAccount` reliably, but at the network layer the body is plain JSON. A malicious page that loads `/arena` and intercepts the wagmi cache could post any wallet to `/api/games`. The server (lines 21-37) does `isAddress(walletAddress)` and `UUID_RE.test(game.gameId)` — that's it. Anyone can POST a game record for any address. **This is a pre-existing condition, not introduced by the spec, but the spec assumes it's "owner-bound" which it isn't.** Same threat applies to the proposed `GET /api/games/[id]` if implemented as the spec describes.
**Resolution:** §6 risk #2 must be re-scoped from "decide auth posture" to "document that wallet ownership is asserted-not-proven for v1, matching every other endpoint; future SIWE is a cross-cluster spec." Then drop the false claim of "owner-bound" elsewhere.

### H-5. Hooks extraction silently drops sessionStorage couplings and ref invariants
**Section:** §2 "Reused unchanged" + §6 Live risk #1.
**Claim:** "the existing arena page tests must remain green after extraction."
**Why suspect:** The arena page has side effects that the spec's hook signature does not surface:
1. `sessionStorage.setItem("chesscito:claim", ...)` on `claimPhase === "success"` (arena/page.tsx:351-364) and `"claiming"` (line 907) and `removeItem` on cancel/error (lines 1040, 1079). If `useMintVictory` lives in two pages (arena + viewer), sessionStorage namespace is shared and the viewer mounting can wipe the arena's mid-claim state. Decide explicitly: does `useMintVictory` write sessionStorage, or does the consumer? The spec doesn't say.
2. `sessionStorage.setItem("chesscito:optimistic-victory", ...)` on success (lines 1024-1034) is consumed by `trophies-body.tsx:56` — a sibling page. If the hook owns this write, the contract is fine. If the consumer owns it, the viewer's consumer needs to know.
3. `localStorage.setItem("chesscito:coach-welcomed", ...)` at three call sites inside the coach phase machine (lines 680, 686, 760). The hook must own all three writes or none — partial extraction yields a welcome-modal that shows on /arena but not on /coach/[gameId] (or vice versa).
4. `analyzeSourceRef` (line 326) is a hook-local ref that's mutated by `handleAskCoach`, `handleAnalyzeFromHistory`, and consumed inside `startCoachAnalysis`. If `startCoachAnalysis` moves to the hook but `handleAskCoach` source-selection logic stays in the consumer, the ref must be exposed. The spec doesn't list this as part of the hook return.
5. The `coachPreviewViewedRef` + `arenaCoachSignalViewedRef` (lines 176-177) gates the `coach_preview_viewed` and `arena_coach_signal_viewed` telemetry events. These ARE arena-specific. The viewer needs its own equivalents OR an explicit no-emission rule.

**Resolution:** add a "Side-effects audit" subsection to §2 that enumerates every sessionStorage, localStorage, ref, and telemetry-key the extracted hooks touch. Resolve owner per item. Without this list the extraction is gold-plated to break in production.

### H-6. The dev fixture (`apps/web/src/app/dev/coach-game-viewer/`) is described but not designed
**Section:** §5 "VR baselines (Playwright, minipay viewport only)" + memory `vr-baseline-discipline`.
**Claim:** "Fixture harness per the VR-5/7/8 pattern in memory. New fixtures in `apps/web/src/app/dev/`."
**Why suspect:** The VR-5/7/8 pattern (per `MEMORY.md` line 105) relied on `page.route()` + hardcoded dev wallet prop, "zero product-code touch beyond `export PersistOverlay`". The new viewer mounts `CoachGameClient` which transitively pulls `useCoachAnalysis` + `useMintVictory` + wagmi hooks. To render in a wagmi-less dev page, EVERY wagmi hook the new hooks call must be guarded by a prop fallback (the `proActive` prop on `<VictoryCelebration>` per arena-end-state.tsx:69 is the precedent). The spec doesn't enumerate which wagmi reads need to become props. Without that list the dev fixture will throw on mount.
**Resolution:** §5 add a sub-table: "Dev-fixture prop contract for `useCoachAnalysis` + `useMintVictory`." List every wagmi/intl call the hook makes and the corresponding optional injection point.

### H-7. Hook extraction parity with the existing arena phase-machine inline mounts is asserted, not modeled
**Section:** §2 "Reused unchanged" claims `<CoachLoading>`, `<CoachPaywall>`, `<CoachFallback>` are "mounted by `useCoachAnalysis`."
**Why suspect:** Hooks don't mount components in React. The hook returns phase state; the consumer renders the matching surface. Today `arena/page.tsx:1679-1991` renders six different full-screen branches (coachPhase === "result" / "fallback" / "history" / "welcome" / "loading" / "paywall"), each with its own `<CandyGlassShell>` wrapper, close handler, prop set, and translations bundle. If `CoachGameClient` doesn't replicate all six branches AND the `coachPhase` mounting logic stays in the consumer, the hook is a state container — not a "drop-in replacement". The wording "mounted by `useCoachAnalysis`" is wrong as a contract.
**Resolution:** rewrite §2 as: "`useCoachAnalysis` returns the phase + handlers. Consumer renders the six phase surfaces. The arena consumer and the viewer consumer render different chrome around the same surfaces; their branch tables are duplicated by design." Then the comparison test in §6 risk #1 becomes "branch tables match" which is testable.

### H-8. The `/coach/history` "selected branch removal" loses the `kind === "quick"` fast-path
**Section:** §2 "Removed" + §4 "/coach/history empty state" question.
**Claim:** "/coach/history/page.tsx lines 122-150 (the `if (selected)` branch that mounted `<CoachPanel>` inline). Replaced by `router.push("/coach/${entry.gameId}")` in `handleSelect`."
**Why suspect:** `apps/web/src/app/[locale]/coach/history/page.tsx:113` reads `if (entry.response.kind !== "full") return;` — the selected branch only fires for `full` kind. `coach-history.tsx:148` shows the row distinguishes `quick` vs `full` for display. Today, tapping a `quick`-kind row is a no-op (no panel mount). After the refactor as proposed, tapping a `quick` row → `router.push("/coach/" + gameId)` → viewer mounts → does the viewer support `quick` kind? §3 says `<CoachPanel>` is "mounted inline when `gameRecord.analysis` exists". `CoachAnalysisRecord.response` can be `CoachResponse | BasicCoachResponse` per `apps/web/src/lib/coach/types.ts:63`. `<CoachPanel>` only accepts `CoachResponse` (kind: "full"). So mounting `<CoachPanel>` for a `quick` analysis throws.
**Resolution:** §3 must specify: "if `gameRecord.analysis.response.kind === 'quick'`, render `<CoachFallback>` inline, not `<CoachPanel>`." Or guard the tap on history at the entry point so quick rows never route to the viewer.

### H-9. Zero-move "viewer" is logically dead; spec's "Play Again" banner papers over the wrong problem
**Section:** §3 "Edge cases" + open question #5.
**Claim:** "moves.length === 0 (resign without moving): viewer renders only startingFen, controls disabled, banner *'Nothing to review — play another match'* sits above the board. Visible CTAs: Play Again primary, Ask Coach hidden, Mint hidden, Share hidden."
**Why suspect:** open question #5 asks the right thing: "if a user opens `/coach/[gameId]` for a zero-move match (cold path, not from the popup), does the banner-only state feel like a dead-end or is the Play Again CTA enough?" Per `arena/page.tsx:1232-1235`, zero-move games ARE persisted ("Cluster E §0.1 — persistence is the sole writer. … 0-move games STILL post"). So a user can revisit a 0-move resign from history. They will tap → land on the viewer → see "Nothing to review · play another match". That's worse than not surfacing the entry at all. The history list should filter `totalMoves === 0` from displayed rows, OR the row should be inert (not tappable). The viewer should not be the gate that catches this case — the history list should.
**Resolution:** drop the zero-move banner from the viewer (Section 3). Make `coach-history.tsx` filter `entry.game.totalMoves === 0` from the list (or render them as inert "no review available" rows). Decide and document.

---

## MEDIUM — should address in this cluster

### M-1. Phase 1 commits #2 and #3 are sequenced before the auth decision is settled
**Section:** §6 Phase 1, Live risk #2.
**Claim:** Commit #2 (`GET /api/games/[id]`) lands in Phase 1; Live risk #2 says "Auth posture must be settled before Phase 1 commit #2."
**Why suspect:** The phase plan says Phase 1 is "Bug fix + foundation (independent, mergeable solo)." Auth posture is non-trivial — per C-1 it requires re-scoping the threat model OR adding a signature challenge cluster. The plan can't be "mergeable solo" while also gating on an undefined decision. Either move commit #2 to Phase 2 with the hook extractions, or define auth posture before the spec ships to review.

### M-2. The `kind === "quick"` reanalyze path drops the reanalyze ref
**Section:** §3 "gameRecord.analysis != null: Coach section renders <CoachPanel> inline. If pro, 'Reanalyze' CTA is offered."
**Why suspect:** Today `<CoachPanel>` takes `onReanalyze` + `coachReanalyzeGameId` (arena/page.tsx:1702-1705). The viewer's `gameRecord` carries the `gameId` natively, so the prop is straightforward. BUT `handleReanalyze` (arena/page.tsx:1350-1388) is part of the coach phase machine being extracted into `useCoachAnalysis`. If the hook owns `handleReanalyze` but the result-phase data comes from `gameRecord.analysis`, the hook needs to be told which gameId to reanalyze. Today this is inferred from `coachReanalyzeGameId` state which only gets set during the kick-off path or the polling path. From `/coach/[gameId]`, that state is `null` at mount — reanalyze would no-op. Spec needs to specify: on `CoachGameClient` mount, if `gameRecord.analysis`, seed `coachReanalyzeGameId = gameRecord.gameId`.

### M-3. `endOverlayTimer` and `showEndOverlay` lifecycle ignored in close decision
**Section:** §4 X-close decision table.
**Why suspect:** `arena/page.tsx:1124-1145` has a separate 800ms `setShowEndOverlay(true)` timer that fires AFTER `isEndState` becomes true. The end popup only renders inside this window (`isEndState && showEndOverlay && ...`, line 1870). If the user backgrounds the app during the 800ms gap, `showEndOverlay` may stay false on resume, the popup never shows, and there's no X to tap. The spec's X-close decision table assumes the popup is mounted. The pre-popup state is undefined. Add: if `isEndState` AND NOT `showEndOverlay`, force-render the popup on resume from background OR shorten the gap.

### M-4. Telemetry surface is asserted as "audit needed" without doing the audit
**Section:** Open question #10.
**Claim:** "What's the full list of new telemetry events for this cluster? Audit needed for parity with existing arena/coach telemetry conventions."
**Why suspect:** Open #10 is a deflection — the spec proposes new events `coach_viewer_corrupt_record` (§4) and implies others. Existing arena page emits: `arena_select_view`, `arena_coach_signal_viewed`, `arena_game_start`, `arena_game_end`, `arena_difficulty_tap`, `arena_color_tap`, `arena_start_tap`, `arena_back_tap`, `victory_claim_tx{stage}`, `game_persist_attempt`, `game_persist_outcome`, `coach_preview_viewed`, `coach_preview_cta_tap`, `coach_review_opened`, `coach_buy_tx{stage}`, `modal_open{id}`, `coach_analyze_request`, `coach_analyze_idempotent_hit`, `coach_analyze_failed`. After hook extraction, who fires which? If the hook fires, every consumer surface gets the same event with the same `surface` dim — useless. If the consumer fires, every consumer must wire 8+ track() calls duplicate. **Resolve in §2 hook extraction docs: the hook returns "side-effect-free" state; the consumer fires telemetry tagged with `surface: "arena_endgame" | "coach_viewer"`.**

### M-5. Open question #2 (persisting-state X behavior) is answered by H-1 above but spec leaves it adrift
**Section:** Open #2.
**Resolution per H-1.** Drop the open question once H-1 is incorporated.

### M-6. Smoke checklist misses the in-flight-claim case
**Section:** §5 smoke checklist.
**Why suspect:** No bullet covers "user taps X during `claimPhase === claiming`" (i.e., the mint sig is signed but the receipt hasn't arrived). The current arena page renders `<VictoryClaiming>` (arena-end-state.tsx:199-204) which does NOT expose an X by design (no `onClose` set in that branch — see ArenaEndState's win-path branch logic). Spec needs to either keep that behavior (X locked during claiming) and SAY SO in §4, or define new behavior.
**Resolution:** add to §4 decision table: "claimPhase === 'claiming' → X disabled (mirrors today). User can still tap the popup outside but no close." Add smoke bullet "X is locked during claiming."

### M-7. `?fresh=1` regression risk on every "Play Again" wire
**Section:** §3 "Tap Play Again → `router.push('/arena?fresh=1')`."
**Why suspect:** This is correct per memory `arena-fresh-param` (verified — all current entry points carry `?fresh=1`, see Bash grep above). The spec mentions it briefly. Make it explicit + add a test: `coach-game-viewer.test.tsx` asserts `pushMock.toHaveBeenCalledWith('/arena?fresh=1')` on Play Again tap. Mass router edits in this cluster could trivially strip the flag (per memory: 4 entries dropped it during the i18n migration).

### M-8. Hook extraction commit boundaries imply behavior-preserving refactor across two large commits — too risky to fail-roll-forward
**Section:** §6 Phase 2 commits #4 + #5.
**Why suspect:** Commit #4 extracts `useCoachAnalysis` (16-field hook); commit #5 extracts `useMintVictory` (10+-field hook). Each is ~700-1000 LOC moved. If commit #4 ships green and commit #5 introduces a regression (per C-3 timer fragility), rolling back commit #5 must NOT undo commit #4. Today the spec implies a single feature branch; if either commit corrupts the arena flow, the rollback is "revert the merge". **Resolution:** each phase 2 commit lands behind a feature flag (`NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOK=true`) for one preview deploy. If the flag-off path matches today's behavior in smoke, flip the flag. Memory `bundle-dont-defer` favors bundling — this is the exception (production-impact-risk gating).

### M-9. `useGameReplay` `goTo(i)` bounds undefined
**Section:** §3 replay derivation.
**Why suspect:** "`goTo(i)`" is listed without bounds semantics. What does `goTo(-1)` do? `goTo(moves.length + 5)`? Throw, clamp, no-op? React state setters silently accept any value. Today's similar primitive doesn't exist — this is greenfield.
**Resolution:** spec the bounds: clamp to `[0, moves.length]`. Add to `use-game-replay.test.ts` (already listed in §5).

### M-10. The new fallback "Couldn't load this match · Play another" misses the "wallet disconnected mid-session" branch
**Section:** §4 "GET /api/games/[id] failure on the new route."
**Why suspect:** What does the server return if `walletAddress` is missing from the request (e.g., user disconnected wallet between mounting `/coach/[gameId]` and the fetch)? `getCachedAnalysisWithFallback` requires the wallet in the key — no wallet means no cache hit, which the spec maps to "Couldn't load." But the actionable copy should be "Reconnect to view" not "Play another."
**Resolution:** add a 401/403 branch to the fallback: detect wallet-missing → render `<ConnectPromptToast>` (already imported in arena/page.tsx) instead of the generic "Couldn't load."

### M-11. VR baseline scope omits the post-mint state mutation transition
**Section:** §5 VR baselines + open question #8.
**Claim:** 8 snapshots (viewer × 4 + actions × 4).
**Why suspect:** Open #8 admits: "8 snapshots covers the viewer and actions bar variants but not the coach-overlay-active state nor the mint-flow phases. Are those covered by existing VR baselines, or do they need new ones in this cluster?"
**Verified:** `MEMORY.md` line 105 lists VR-5 (mint pills × 4 phases) + VR-7 (persist overlay) — these were shot AGAINST the arena page's dev fixture. From `/coach/[gameId]`, the same mint pills render but inside a different chrome (no popup, just inline). VR-5 baselines do NOT apply transitively. New cluster needs: viewer-during-claiming, viewer-after-mint-success (CTA mutated), viewer-mint-error pill.
**Resolution:** bump §5 from 8 snapshots to ~14: add 4 mint-phase snapshots (ready / claiming / success / error) and 2 coach-overlay-active snapshots (loading / result). Or accept the gap explicitly in `deferred-work.md`.

---

## LOW — nice-to-have polish

### L-1. The route map ASCII diagram in §1 is decorative
**Section:** §1 route map. The diagram doesn't show `useRouter` wrapping (the next-intl locale prefix); a reader could miss that `/coach/[gameId]` is really `/[locale]/coach/[gameId]`. Add a line noting locale prefixing.

### L-2. "Share Fase 1 is mint-gated" hides a real friction
**Section:** §3 "Tap Share → only enabled when mintedTokenId != null."
**Why suspect:** Loss-screen users have nothing to share except a "I played and lost" boast. Mint-gated is correct for v1, but the spec calls Share-without-mint "Fase 2" without justifying why now. Add one line: "Loss/draw players: Share is hidden in v1 because there's no canonical OG-image generator for non-mint outcomes. Build that pipeline in Fase 2."

### L-3. "Pause" and "speed control" not mentioned in `useGameReplay`
**Section:** §3 replay.
**Why suspect:** The hook exposes single-step nav but not auto-play. A common review pattern (chess.com, lichess) is auto-play at 1× / 2× / 4×. The spec implicitly defers. Document it explicitly under "Non-goals (Fase 1)."

### L-4. Memory pointer in §References mis-cites `arena-end-state-popup-polish`
**Section:** References last 3 bullets.
**Why suspect:** Cites "Sally's retention-loop guidance (memory: `arena-end-state-popup-polish`) — X never goes to `/hub`." The actual memory file is `project_arena_end_state_popup_polish.md`. Path-naming nit only.

### L-5. Spec opens with "After today's arena-end-state-popup-polish ship" — temporal anchor decays
**Section:** Problem statement.
**Why suspect:** Once this spec is merged, "today" stops referring to 2026-05-27. Use the dated cluster name everywhere ("After the 2026-05-27 arena-end-state-popup-polish ship") so future readers can locate the precedent.

---

## Open questions resolved

### #1 — Auth posture for `GET /api/games/[id]`
**Resolved:** wallet-bound session does NOT exist in this repo (verified: `apps/web/src/lib/server/demo-signing.ts`, `apps/web/src/app/api/games/route.ts`, `apps/web/src/app/api/coach/analyze/route.ts`). Every endpoint trusts the wallet from query/body, with origin check + rate limit. **Recommendation:** mirror this exactly. Accept `?wallet=` query param, validate `isAddress`, look up `coach:game:<wallet>:<gameId>`, 404 on miss. Threat model = unguessable-UUID gating, NOT proof of ownership. Do NOT introduce signature challenges in this cluster — that's a cross-cluster spec change. **See C-1, H-4.**

### #2 — Persisting-state X behavior
**Resolved:** the disabled+auto-navigate pattern is forgiving but the spec under-models the `failed` and `dismissed` transitions. Implement as a state machine with explicit `pendingNavRef` consumers per terminal state: `persisted → /coach/[gameId]`, `failed → /arena?fresh=1` + toast, `dismissed → clear ref + leave X enabled in its decision-table default`. **See H-1.**

### #3 — Hooks extraction risk
**Resolved:** comparison-test strategy is insufficient because the existing arena tests do NOT exercise the 400ms PLAY timer or render-density failure mode. **Add** (a) a fake-timer test that drives PLAY → playing across N intervening renders, (b) memoize EVERY function in the hook return, (c) ship Phase 2 commits behind a feature flag for one preview cycle. **See C-3, M-8.**

### #4 — `/coach/history` empty state after refactor
**Resolved:** verified via Read of `apps/web/src/app/[locale]/coach/history/page.tsx:103-167`. The empty state branch is `if (!address)` (lines 103-110) which renders `connectWalletForHistory`. The deleted `if (selected)` branch (lines 122-150) does NOT participate in the empty path. **No regression** to the empty state. But the `<CoachHistoryDeletePanel>` (line 164) sits inside the `tj-content` div — verify it still renders below the (possibly empty) `<CoachHistory>` list after refactor. Also: the `showAskLuzBanner` logic (line 69) depends on `credits === 0`, NOT on the selected branch — unaffected.

### #5 — Zero-move resign from cold path
**Resolved:** today such games ARE persisted (per arena/page.tsx:1232-1235 spec comment) but the viewer's banner-only state is a dead-end. **Filter `totalMoves === 0` from the history list display** — these rows should not be tappable. Mark them as "match too short to review" inline. The viewer's `moves.length === 0` branch becomes a defensive fallback for direct URL access, not a primary surface. **See H-9.**

### #6 — Mint-flow `gameRecord` refetch ownership
**Resolved:** the spec's contradiction is real (Section 3 vs Risk #6) AND the chosen design is incomplete (per C-2). **Recommendation:**
- The CTA mutation is purely client state — `useMintVictory.claimPhase === "success"` + `claimData.tokenId` is sufficient to render "View NFT" without any refetch.
- `gameRecord.mintedTokenId` is a future field — populate it via a NEW server write (extend `/api/cache-victory` or add `/api/games/[id]/mint-receipt`) so cold-loaded viewers (re-entry path) show the minted state.
- Refetch on `success`? NO. Trust the in-memory mint outcome until next mount.
- Document: "The hook does not refetch. Cold-load via `GET /api/games/[id]` reflects the persisted state at fetch time. Hot-mint mutations are reflected via hook state, not server re-read." **See C-2.**

### #7 — `router.back()` from `/coach/[gameId]` as first history entry
**Resolved:** real risk — MiniPay WebView will close on `history.length === 1` + back. Implement BACK as `if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/hub");`. **See H-2.**

### #8 — VR baseline scope
**Resolved:** 8 snapshots are insufficient. The coach-overlay-active surface (loading/result phases inside the viewer) and the mint-flow phases (claiming/success/error) need their own baselines because they render in a NEW chrome (no popup, inline) — VR-5/7/8 from MEMORY.md line 105 do NOT apply. Bump to ~14 snapshots OR defer to `deferred-work.md` with explicit "viewer mint-phase baselines absent" entry. **See M-11.**

### #9 — `shareCardUrl` lifecycle
**Resolved:** verified — `shareCardUrl` is constructed from `tokenId` inside `handleClaimVictory` (`arena/page.tsx:986-995`). If the URL construction stays inside `useMintVictory`, it travels naturally to the viewer. **Recommendation:** put the URL construction inside the hook. The hook's `success` output carries `{ tokenId, claimTxHash, shareCardUrl, shareLinkUrl }`. The hook is self-contained. **No coupling to the page's window.location read** beyond the `origin` constant — extract that as a `getOrigin()` util to keep the hook SSR-safe.

### #10 — Telemetry event surface
**Resolved per M-4 above.** Hook returns side-effect-free state; consumer fires telemetry with explicit `surface` dim. New events introduced by this cluster: `coach_viewer_view{gameId, source: "arena" | "history" | "deep-link"}`, `coach_viewer_play_again_tap{gameId}`, `coach_viewer_corrupt_record{gameId, lastValidIndex?, badSan?}`, `coach_viewer_back_tap{gameId, history_depth}` (for H-2 diagnostics), `coach_viewer_share_tap{gameId, tokenId?}`. Reuse existing `victory_claim_tx{stage}` and `coach_analyze_request{source: "viewer"}` for sub-flows — extend the existing `AnalyzeSource` union to include `"viewer"` in `apps/web/src/lib/coach/analyze-telemetry.ts`. Document the full list in §5.

---

## Spec edits suggested

- **§1 API surface, "Auth posture" paragraph:** rewrite as: "`GET /api/games/[id]?wallet=0x…` returns the cached `coach:game:<wallet>:<gameId>` record. The server validates `isAddress(wallet)` + UUID-format `gameId`, then 404s on cache miss. Threat model: unguessable-UUID gating + origin check + read-rate-limit. No SIWE / signed-cookie session in v1 — matches every other current endpoint. See `apps/web/src/lib/server/demo-signing.ts:83-113` for origin policy."
- **§2 hooks extracted table, add a third row:** `useCoachCreditsPurchase` — extracts `handleBuyCredits` (arena/page.tsx:768-862). Owns wagmi `useWriteContract` + `usePublicClient` + token-balance selection. Keeps `useCoachAnalysis` viewer-portable.
- **§2 "Reused unchanged":** clarify that `<CoachLoading>`, `<CoachPaywall>`, `<CoachFallback>` are mounted BY THE CONSUMER on the phase the hook reports, NOT by the hook itself. Hooks don't render.
- **§2 new sub-section "Side-effects audit":** enumerate every sessionStorage / localStorage / ref / telemetry write the hooks own vs consumer owns. Cover: `chesscito:claim`, `chesscito:optimistic-victory`, `chesscito:coach-welcomed`, `chesscito:arena-last-difficulty`, `analyzeSourceRef`, `coachPreviewViewedRef`, `arenaCoachSignalViewedRef`.
- **§3 "State ownership" gameRecord row:** rewrite as "Server-fetched on mount, client-immutable thereafter. Cold-load reflects persisted state. Hot mints are reflected via `useMintVictory` state, not via re-fetch. A server write to populate `mintedTokenId` happens via `/api/cache-victory` extension (see §6 risk #6 resolution)."
- **§3 "Replay derivation" block:** drop "throw on invalid SAN"; replace with "partial-replay-with-error" pattern mirroring `apps/web/src/lib/game/moves-to-fen.ts`. Document `startingFen` as a forward-leaning field defaulting to chess.js startpos.
- **§3 edge case for `gameRecord.analysis.response.kind === "quick"`:** mount `<CoachFallback>` not `<CoachPanel>`.
- **§4 X-close decision table:** add row "claimPhase === claiming → X disabled (mirrors today)". Add row "persistState === persisting + user taps X → register intent; on `persisted` → push viewer; on `failed` → push `/arena?fresh=1` + toast; on `dismissed` → release intent."
- **§4 "GET /api/games/[id] failure":** add 401/403 branch → render `<ConnectPromptToast>` instead of generic "Couldn't load."
- **§4 BACK handler:** replace `router.back()` with the `history.length > 1 ? router.back() : router.push("/hub")` pattern.
- **§5 VR baselines:** bump from 8 to ~14 snapshots covering mint-flow phases inside the viewer. Or add explicit deferred-work entry.
- **§5 smoke checklist:** add bullets for "X locked during claiming", "post-mint refetch behavior", "BACK from deep-link mount with single history entry".
- **§5 unit tests:** add `arena-play-timer-resilience.test.tsx` per C-3 — fake-timer test that PLAY → playing within 800ms across N intervening commits.
- **§6 Phase 2 commits #4 and #5:** ship each behind a `NEXT_PUBLIC_USE_EXTRACTED_*` flag for one preview cycle.
- **§6 Live risk #1 mitigation:** add "memoize every hook return function via `useCallback`; document the contract pointing to `feedback_hook_ref_stability.md`."
- **§6 Live risk #6:** rewrite per resolution to #6 above. Hook does not refetch; CTA mutation is in-memory.
- **§References:** correct memory path `arena-end-state-popup-polish` → `project_arena_end_state_popup_polish.md`.

---

## Cross-cutting themes (meta-findings)

1. **Auth-on-paper is invented.** Two of four criticals (C-1, H-4) trace to the spec describing a "wallet-bound session" as if it shipped. It didn't. The repo's actual posture is "wallet-asserted + origin-gated + rate-limited" — that's defensible for v1, but the spec must NAME the actual primitive instead of fabricating a stronger one.
2. **Hook extraction is treated as mechanical.** The spec's "the existing arena page tests must remain green" is the kind of mitigation that catches typos, not regressions. The actual risk surface — render-density timer collapse, sessionStorage/ref ownership, telemetry duplication — is unmodeled. The project has an explicit prior incident (`arena-play-timer-fragility` 2026-05-25) that this spec walks back into.
3. **Open questions are partly red-team debt.** Five of the ten open questions (#1, #2, #6, #7, #10) describe problems the spec already had enough information to resolve. Punting them to the red-team pass shifts implementation risk forward.
4. **VR baseline coverage scope is reflexively scoped to "what's new" instead of "what's at risk of regressing".** The mint-flow phases existed in the popup chrome; they now also exist in the inline-viewer chrome. Same component, different parent — both need locked baselines.

---

**Bottom line:** the spec ships one good bug fix (Phase 1 commit #1, `handleBack` flash) that could merge today. The route + viewer architecture is the right shape but built on three invented primitives (wallet-bound session, owner-only fetch, behavior-preserving extraction) and one unspecified contract (`gameRecord` refetch ownership). Resolve C-1 through C-4 before any commit past #1. Resolve H-1 through H-9 before merging Phase 4. The mediums are PR-review fodder, the lows are polish.

The strong work on the X-close decision table and the explicit non-goals (Fase 2 scope) deserves the rigor of one more pass with the §6 auth + refetch contracts re-anchored to what actually exists in the repo.
