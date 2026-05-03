# Product / UX / Gameplay — Triage (2026-05-02)

> **Status**: Phase 2 layout-primitives work is **HALTED**. No further canary work, no `<ProChip>` deletion, no new primitives until the issues below are closed (or explicitly deferred).
> **Source of complaints**: manual `/hub` review on mobile after the GlobalStatusBar canary landed.
> **Method**: source-recon audit only — code paths read, hypotheses formed. **No fixes applied in this document** (one tiny exception called out in §3 per the user's "trivial bug in test path / docs" carve-out).
> **Reading window**: `pro-sheet.tsx`, `cognitive-disclaimer.tsx`, `mini-arena-sheet.tsx`, `daily-tactic-sheet.tsx`, `lib/daily/puzzles.ts`, `lib/game/mini-arena.ts`, `lib/daily/__tests__/puzzles.test.ts`, `arena/page.tsx`, `mission-panel-candy.tsx` (disclaimer placement), `globals.css` arena-piece animations, `visual-snapshot.spec.ts`.

---

## 1. Triage table (P0 must close before PRO smoke test)

| # | Issue | Severity | Surface | Evidence | Impact | Hypothesis (technical) | Recommended fix | Tests required | Owner | Blocks PRO smoke? |
|---|---|---|---|---|---|---|---|---|---|---|
| **P0-1** | PRO not discoverable after purchase | P0 | `/hub` after first PRO buy, then opening ProSheet | `pro-sheet.tsx:166-173` only renders "PRO Active — Nd days left" + perks list. No "Use your Coach" CTA. No "Analyze a game" CTA. No route to `/coach` or coach surface. `arena/page.tsx:56` gates Coach behind `NEXT_PUBLIC_ENABLE_COACH !== "false"` (default ON), but Coach lives only inside the **Arena post-game flow** — Play Hub never surfaces it. | New PRO buyers see a celebration banner and no next step. Conversion-to-engagement gap is total. | The Coach feature exists inside `/arena` only (CoachPanel, CoachLoading, CoachFallback, CoachPaywall, CoachWelcome, CoachHistory imported). Play Hub does not import any Coach surface. ProSheet has no follow-up CTA in the active state — the "Active perks" list mentions "AI Coach with no daily limit" as text but no link. | **Audit-first**: (a) decide where Coach lives end-to-end (Arena post-game only? new dock slot? PRO sheet drill-down?). (b) Add an "Active state" CTA to ProSheet that points the user there ("Go to Coach", "Play & analyze in Arena"). (c) If Coach stays Arena-only in v1, the active ProSheet should explicitly say "Play a match in Arena → Coach analyzes after the game." | Unit test on ProSheet: when `status.active === true`, an active-state CTA renders, points to a route the test can intercept. | Wolfcito + UX | **YES — must close before PRO smoke** |
| **P0-2** | Mini Arena K+R vs K freezes after first move | P0 | Play Hub → Mini Arena bridge (12+ stars on rook unlocks it) → first white move | `mini-arena-sheet.tsx:121-143` (`triggerAi`) wraps `aiMove(game.fen(), setup.aiLevel)` in try/catch. Catch silently `setStatus("playing")` without flipping turn back to white. `mini-arena.ts:39` has `aiLevel: 0` (random legal moves). | Player makes one move, sees `Movimientos: 1 / 16` indefinitely. Cannot make a second move because chess.js still believes it's black's turn → `game.moves({ square })` for any white piece returns `[]`. Mini Arena is the pedagogical bridge between Play Hub and Arena — a frozen bridge breaks the learning loop. | **Most likely**: `js-chess-engine` at `aiLevel: 0` returns an empty/malformed result on the K+R vs K position (random-move endgame edge case), or `game.move(...)` of the AI move throws because of a notation mismatch (engine returns uppercase squares; lowercased in the spec). The `catch { setStatus("playing"); }` block hides the error and leaves the turn flipped to black. The board renders as if the player can move, but cannot. | (a) Replace silent `catch` with a logged `console.error` + `setStatus("won")` fallback OR retry path. (b) When AI cannot produce a move, fall back to **forfeit AI turn** (concede the move) so the player can continue learning. (c) Investigate whether `js-chess-engine` at level 0 actually plays K+R-vs-K endgames; if not, raise `aiLevel: 1` for this setup specifically. (d) Optionally: replace js-chess-engine for mini-arena with a deterministic "random legal move" pass (pure JS, no engine) since the design intent is "random legal moves" anyway. | E2E or unit test that replays first legal white move + asserts AI responds within 1s OR player turn restored. Test failure on freeze. | Wolfcito + Game | **NO** (but P0 to keep on the floor — the bridge is broken) |
| **P0-3** | Daily Tactic — invalid starting positions in 3 of 7 puzzles | P0 | Play Hub → Daily Tactic Slot → opens `DailyTacticSheet` for today's puzzle | `lib/daily/puzzles.ts` defines 7 puzzles. Manual position-legality check: **mt-002** (`7k/8/6KQ/8/8/8/8/8 w`) has Qh6 attacking h-file → Kh8 already in check on white's turn (illegal). **mt-005** (`7k/8/6K1/8/8/8/8/Q7 w`) has Qa1 attacking the a1-h8 diagonal → Kh8 in check on white's turn (illegal). **mt-007** (`8/8/8/8/8/3K1Q2/8/3k4 w`) has Qf3 attacking the f3-d1 diagonal → Kd1 in check on white's turn (illegal). Description hardcoded to "White to move, mate in one." in `daily-tactic-sheet.tsx:187`. | Player sees opponent's king already in check on their own turn — feels like the puzzle is misgenerated. ~43% (3/7) of puzzles affected. Daily streak surface looks broken. | The `puzzles.test.ts` validator only confirms (a) FEN parses, (b) the solution is a legal move, (c) the result is checkmate. **It does NOT check that the starting position is legal** (i.e., that the side NOT to move is not in check). chess.js accepts illegal-but-parseable FENs and computes moves from them. | Add a starting-position legality check to `puzzles.test.ts`: for each puzzle, after `new Chess(fen)`, swap turn and assert `!game.isCheck()` for the opponent. Then either fix the 3 broken FENs (likely intent: rotate king/queen positions so opponent is NOT in check at start) or remove them from the seed. The hash-mod selection means the affected days will rotate through these 3 puzzles ~3/7 of the time. | New test: "starting position is legal — opponent not pre-checked." Each existing test stays. | Wolfcito + Game | **YES** if the broken puzzles surface during the smoke window. Recommended: hide the slot OR drop to `[mt-001, mt-003, mt-004, mt-006]` until fixes land. |
| **P1-1** | Cognitive disclaimer overlaps gameplay zone | P1 | `/hub` and `/arena` — disclaimer renders ABOVE dock, inside the same `z-[60] pointer-events-auto` wrapper | `mission-panel-candy.tsx:409-414` wraps `<CognitiveDisclaimer variant="short" />` + `{persistentDock}` inside one `z-[60] pointer-events-auto` div with `padding-bottom: env(safe-area-inset-bottom, 0px)`. `arena/page.tsx:878` does the same. The disclaimer is `<p>` with `px-4 pt-2 pb-1 text-[11px]` — adds ~28-32px of vertical space above the dock. | Disclaimer eats vertical space that should belong to gameplay (Z3 board) or to the dock's safe-area. On `360×640` (Pixel-4 baseline) where Z1+Z2+Z4+Z5+safe-area already steal ~306px, the extra 28-32px from the disclaimer pushes board to ≤306px (per spec §12 risks #4 already razor-thin). User reports it covering buttons / contadores in Mini Arena and Daily Tactic — those sheets reuse `mission-shell` so likely inherit the same disclaimer placement. | The disclaimer is a legal/marketing footnote, not a gameplay element. It belongs on landing / `/about` / legal pages, not as a near-permanent fixture on the gameplay surface. **Fix options (audit-first; no implementation here)**: (a) Remove from `mission-panel-candy.tsx` and `arena/page.tsx` entirely; keep `variant="full"` on landing + `/about` + legal. (b) Convert the in-app footnote to a small icon link in Z1 next to the handle, opening a Type-C info sheet on tap. (c) Render only on first session, then suppress via localStorage. | After fix: E2E asserts no `[role="note"][aria-label="Cognitive disclaimer"]` overlaps `.playhub-board-hitgrid`, `.contextual-action-slot` button, or `.chesscito-dock` items at any viewport. | Wolfcito + UX | **NO** (P1 — quality regression but not gameplay-blocking) |
| **P1-2** | Floating action zone visually patchy | P1 | `/hub` lower band — DailyTacticSlot, ContextualActionSlot, MiniArenaBridgeSlot rendered as 3 separate floating buttons | Per `play-hub-root.tsx` and existing `ui-zone-map-decision-record-2026-05-01.md` §2 review. Three slots compete: Daily Tactic (left), Contextual Action (center, on-chain submitScore/claimBadge/useShield), Mini Arena (right gated). No grouping container, no shared visual treatment. They sit between the board and dock with ad-hoc absolute positioning. | Looks like 3 disconnected buttons. The user already knows from the zone-map work that this is the intended Phase-2 "Z2 challenges row" + Z4 single primary CTA refactor — tracked in `DESIGN_SYSTEM.md` §10.6 carry-forward. Nothing new here, but the visual debt persists. | This is the deferred "Z2 challenges row" + "Z4 contextual action rail" work. Not a regression — known carry-forward. | **Three options (no implementation in this triage)**: **(A)** Unify Daily Tactic + Mini Arena bridge as a Z2 "Challenges" row sub-strip. Pros: matches the zone-map intent. Cons: requires a Z2 sub-row primitive that doesn't exist yet. **(B)** Move both Daily Tactic + Mini Arena to a "Missions/Challenges" Type-B sheet accessible from the dock. Pros: declutters the play-hub bottom band immediately. Cons: hides the daily streak — engagement loop weaker. **(C)** Keep all three slots, but add labels + a shared chip background so they read as a "today's challenges" cluster. Pros: minimal code. Cons: cosmetic only. | After fix: visual QA pass + dock invariants + tap-target ≥44px assertions. | UX (Wolfcito + Sally) | **NO** |
| **P1-3** | Move animations look ugly | P1 | `/hub` and `/arena` — piece slides between cells | `globals.css:1346-1356` `.arena-piece-float` has `transition: left 320ms ease-in-out, top 320ms ease-in-out, opacity ..., transform 120ms spring`. No literal "trail" CSS found — but the 320ms ease-in-out slide of a 28-32px piece across the board can read as a slow-blur with the piece's own drop-shadow filter trailing in the user's eyes, especially on the candy chessboard background. Also: `.arena-piece-float.is-selected` adds `transform: scale(1.12)` which can lag the move animation. | Visual polish issue. Doesn't block gameplay but feels unprofessional, especially next to the candy art. | The 320ms slide is intentional (per `Move animations` memory entry: "320ms ease-in-out on .arena-piece-float / .playhub-board-piece-float"). The `is-selected` scale doesn't auto-clear when the piece commits to its move — possibly the scale state persists into the slide animation, magnifying the trail-ish effect. The `is-check` `arena-check-pulse` animation (1.4s ease-in-out infinite) on the king's drop-shadow can also visually compete with sliding pieces. | **Audit-first; one of**: (a) Reduce slide duration to 200ms (snappier reads as cleaner). (b) Drop the `ease-in-out` for `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style decel — feels less "drifty"). (c) Clear `.is-selected` synchronously when the move dispatch begins (currently it likely clears with the React state flip — verify). (d) Temporarily disable the slide and snap to position; compare both to the user. | Visual regression spec (see companion regression plan) on canonical move sequence. Manual A/B sign-off. | Wolfcito + UX | **NO** |

---

## 2. Tooling gap — visual suite is capture-only (covered in companion doc)

`apps/web/e2e/visual-snapshot.spec.ts` calls `page.screenshot({ path: ... })` directly — never `expect(page).toHaveScreenshot()`. The suite **always passes** because there is nothing to assert against. Full plan to convert to real regression in: [`docs/reviews/visual-regression-plan-2026-05-02.md`](visual-regression-plan-2026-05-02.md).

This belongs in the stabilization sprint because shipping visual fixes (P1-1, P1-3) without a real regression suite means we cannot prove they don't drift back.

---

## 3. Trivial fix exception (per user's carve-out)

The `puzzles.test.ts` validator gap (P0-3) is a one-line opportunistic test addition that surfaces the bug:

```ts
// Add to puzzles.test.ts
it.each(DAILY_PUZZLES)("$id ($name) — opponent NOT pre-checked at start", (puzzle) => {
  const game = new Chess(puzzle.fen);
  // chess.js's `isCheck()` reports the side-to-move's check status.
  // For a legal puzzle position with "white to move", the opponent
  // (black) must NOT be in check. Swap turn to verify.
  const opponentCheck = game.fen().includes(" w ")
    ? new Chess(puzzle.fen.replace(" w ", " b ")).isCheck()
    : new Chess(puzzle.fen.replace(" b ", " w ")).isCheck();
  expect(opponentCheck, `puzzle ${puzzle.id} starts with opponent already in check — illegal`).toBe(false);
});
```

I am **not committing this in the triage commit** because applying the test would immediately turn the unit suite red on `mt-002 / mt-005 / mt-007` — that's a separate fix-plus-test commit. But the test snippet is here, ready to drop into a P0-3 fix PR.

---

## 4. Stop / Go recommendation

### Must fix before PRO smoke test (HARD blockers)

- **P0-1** — PRO discoverability. Without this, every PRO purchase looks like a black hole. Smoke test would prove the contract works but the user-facing flow is broken regardless. **GO/NO-GO blocker.**
- **P0-3** — Daily Tactic invalid puzzles. Either: (a) fix the 3 FENs and ship the validator test; OR (b) hide the Daily Tactic slot temporarily until fixed. Acceptable to defer the validator test if the slot is hidden.

### Should fix in the same stabilization sprint (NOT smoke blockers)

- **P0-2** — Mini Arena freeze. Not a payment-flow blocker, but the Mini Arena bridge is the pedagogical pivot and a frozen bridge breaks the learning loop. **Hide MiniArenaBridgeSlot until fixed** if the fix needs >1 day.
- **P1-1** — Cognitive disclaimer placement. Cosmetic-but-visible.

### Can defer past the stabilization sprint

- **P1-2** — Floating zone composition. Already tracked in `DESIGN_SYSTEM.md` §10.6 carry-forward. Roll into the next intentional UX pass.
- **P1-3** — Move animation polish. Polish only.

### What to hide temporarily

If the sprint runs short, the lowest-cost mitigation for each broken surface is:

| Surface | Hide via | Restore trigger |
|---|---|---|
| Mini Arena bridge | Conditional render `{false && <MiniArenaBridgeSlot ...>}` (or remove from `play-hub-root.tsx` import block). | After P0-2 fix lands. |
| Daily Tactic | Same pattern on `<DailyTacticSlot>`. | After P0-3 puzzle fixes + validator test land. |
| Cognitive disclaimer | Remove the `<CognitiveDisclaimer variant="short" />` lines in `mission-panel-candy.tsx:412` and `arena/page.tsx:878`. Keep the component for landing / about / legal usage. | After P1-1 placement decision. |
| Move slide animation | Set `transition: none` on `.arena-piece-float` and `.playhub-board-piece-float` temporarily. | After P1-3 polish lands. |

### What MUST NOT be hidden

- **PRO purchase flow** — payment must continue to work even if the post-purchase UX is dim. The smoke test depends on this.
- **Z1 + Z2 primitives** — `<GlobalStatusBar />` and `<ContextualHeader />` are stable and proved (560/560 + 16/16 e2e). Their `pro-tap-debt-due-by: 2026-07-01` clock keeps running.

---

## 5. What this triage explicitly does NOT do

- Implement any of the above fixes (with the one trivial test snippet exception in §3, and even that is NOT committed).
- Touch contracts, payment plumbing, Coach API routes, or Supabase.
- Continue any layout-primitives work — Z1 canary stays; Z3/Z4/Z5 primitives are paused.
- Decide between options A/B/C in P1-2 — that is a UX call, surfaces the trade-offs only.
- Validate the Mini Arena `js-chess-engine` hypothesis interactively — that requires a live repro session.

---

## 6. Recommended execution order

1. **Today** — review this triage; decide which P0/P1 ship in the sprint vs which get hidden.
2. **Sprint commit #1** — convert `visual-snapshot.spec.ts` to real regression (per companion doc). Foundation for shipping P1 fixes safely.
3. **Sprint commit #2** — P0-1 (PRO discoverability fix + ProSheet active-state CTA + Coach surface decision).
4. **Sprint commit #3** — P0-3 (puzzle FEN audit + validator test + fix or remove broken seeds).
5. **Sprint commit #4** — P0-2 (Mini Arena freeze fix OR hide bridge until fixed).
6. **Sprint commit #5** — P1-1 (disclaimer relocation).
7. **PRO smoke test** — only after #2, #3 (or hide), #4 (or hide) land.
8. **Resume Phase 2** — `<ContextualActionRail />` Z4 primitive next.

Estimated total: 2-4 days of focused work depending on how much gets hidden vs fixed.

— Wolfcito + canary author (audit only — no implementation)
