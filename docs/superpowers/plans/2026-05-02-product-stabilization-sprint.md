# Chesscito Product Stabilization before PRO Smoke — Sprint Plan (2026-05-02)

> **Status**: Plan-only. **No code in this document.** Awaiting Wolfcito sign-off before commit #1 starts.
> **Source**: `docs/reviews/product-ux-gameplay-triage-2026-05-02.md` + `docs/reviews/visual-regression-plan-2026-05-02.md`.
> **Goal**: Make PRO purchase meaningful, daily challenges valid, gameplay UI uncovered, and Playwright actually protect real experience — before the PRO smoke test.
> **Phase 2 layout-primitives status**: HALTED. No `<ProChip>` deletion, no Z4/`<ContextualActionRail />`, no migration of Z1 to other screens. The `pro-tap-debt-due-by: 2026-07-01` clock keeps ticking but no action.

---

## Sprint scope (closed before PRO smoke)

1. **P0-1** — PRO discoverable post-purchase.
2. **P0-3** — Daily Tactic FEN legality validator + fix data.
3. **P1-1** — Cognitive disclaimer placement.

Same sprint, attempt:

4. **P0-2** — Mini Arena freeze (fix OR hide).

Deferred (next sprint):

- **P1-2** — Floating zone composition (already in `DESIGN_SYSTEM.md` §10.6 carry-forward).
- **P1-3** — Move animation polish, **unless** a quick CSS-only fix appears in commit #4 audit.

After everything above lands, **then** commit #5 lays the visual regression foundation. Reasoning: protecting screenshots of a UI we know is broken just locks the rot.

---

## Commit 1 — `feat(pro): post-purchase CTA in ProSheet active state`

### Goal

PRO active state in `<ProSheet>` ends in a clear next action, not a dead screen.

### Decision (audit-driven)

Coach is reachable **only inside `/arena` post-game flow** today (`apps/web/src/app/arena/page.tsx:1027` mounts `onAskCoach` when `ENABLE_COACH && coachPhase === "idle"`; no other surface links to it). ProSheet has zero router calls.

The honest, minimal CTA: route the user to `/arena` with copy that sets the right expectation — **"Play Arena, then use Coach after your match"** — backed by `router.push("/arena")`.

If `ENABLE_COACH` is `"false"` (unlikely default but possible per `.env.template`), the CTA degrades to a non-routing message: **"Coach access is being enabled — check back soon."**

### Files (probable)

| Path | Change |
|---|---|
| `apps/web/src/components/pro/pro-sheet.tsx` | Add an "Active state" CTA section above the existing CTA button. Conditional copy + optional `router.push("/arena")`. |
| `apps/web/src/lib/content/editorial.ts` | Extend `PRO_COPY` with `activeStateCta`, `activeStateCopy`, `activeStateCopyDisabled`. No new top-level constant. |
| `apps/web/src/components/pro/__tests__/pro-sheet.test.tsx` | Add 3 tests: (a) active state shows CTA + correct copy, (b) CTA fires `router.push("/arena")` when `ENABLE_COACH !== "false"`, (c) CTA does not fire router when disabled. |

### Tests

- Unit: 3 new in `pro-sheet.test.tsx` (described above).
- Unit: existing 6 ProSheet tests must continue to pass.
- E2E: out of scope for this commit — covered by the visual regression foundation (commit #5).

### Risk

- **Low**. ProSheet is a presentational component; no payment plumbing touched.
- The router import (`next/navigation`'s `useRouter`) is the only new dependency surface. Verify it doesn't accidentally fire on SSR.
- If `ENABLE_COACH` flag misreads at build time (process.env evaluation), the disabled-copy fallback is the correct degradation.

### Fix vs hide

**Fix.** Hiding ProSheet active state is not an option — the user already has PRO and needs to see their state.

### Blocks PRO smoke?

**YES**. Without this, the smoke test proves the contract works but the user-facing flow is dead.

---

## Commit 2 — `fix(daily): puzzle FEN legality validator + repair seed`

### Goal

No Daily Tactic visible to users may start with an illegal position (opponent king in check on player's turn).

### Decision

**Fix the data.** All 7 puzzles are mate-in-1; rotating the kings/queen positions to legal placements is mechanical. The slot stays live, no temporary hide.

### Files (probable)

| Path | Change |
|---|---|
| `apps/web/src/lib/daily/__tests__/puzzles.test.ts` | Add the validator test from triage doc §3 ("opponent NOT pre-checked at start"). The test file ALREADY parses each FEN; one additional assertion per puzzle. |
| `apps/web/src/lib/daily/puzzles.ts` | Repair `mt-002`, `mt-005`, `mt-007` FENs. Likely fixes: shift the king to a square NOT under attack at start (e.g., mt-002 move opponent king away from h-file or relocate the queen). Each repair must keep the puzzle a true mate-in-1. |

### Tests

- Unit: new validator test fires red on current data, green after repair.
- Unit: existing solution + checkmate tests must continue to pass for the repaired FENs.
- Manual: load each repaired puzzle in the dev sheet, eyeball the start position.

### Risk

- **Medium-low**. Repairing a FEN sometimes alters the unique mating move. If the chosen repair has 2+ mating moves, `puzzles.test.ts:22` (`solution must produce checkmate`) still passes, but the player might find a different mate and the `isPuzzleSolution` strict check would reject it.
- Mitigation: for each repair, run `chess.js` locally, enumerate all white moves, confirm exactly one yields `isCheckmate()`. If multiple do, prefer the one matching the original `solution.from/to` shape so the hint stays valid.
- A worse case: a repair makes the position trivial (move-and-mate is too easy). Check that the puzzle still reads as "find the mate," not "the only legal move IS mate."

### Fix vs hide

**Fix.** Data-only; cheap.

### Blocks PRO smoke?

**YES** if the broken puzzles surface during the smoke window. The hash-mod selector means ~3 of every 7 days hits a broken puzzle. **Acceptable alternative**: ship just the validator test (no repair), then drop the broken puzzles from the seed array — leaving 4 valid puzzles. Hides the bug at the cost of rotation diversity.

---

## Commit 3 — `refactor(legal): remove cognitive disclaimer from gameplay surfaces`

### Goal

Disclaimer no longer steals vertical space from gameplay (`/hub`, Mini Arena, Daily Tactic, Arena active).

### Decision

**Preferred option (from triage P1-1)**: Remove `<CognitiveDisclaimer variant="short" />` from `mission-panel-candy.tsx:412` and `arena/page.tsx:878`. Keep the component live for `/about`, landing, and legal pages where it already renders `variant="full"`. **No new icon link in Z1** — that would re-open the "Z1 is read-only" rule debate; out of scope.

### Files (probable)

| Path | Change |
|---|---|
| `apps/web/src/components/play-hub/mission-panel-candy.tsx` | Remove `<CognitiveDisclaimer variant="short" />` at line 412. Keep `{persistentDock}` in its wrapper. Drop the import on line 6 if no other usage. |
| `apps/web/src/app/arena/page.tsx` | Remove `<CognitiveDisclaimer variant="short" />` at line 878. Drop import on line 18. |
| `apps/web/src/components/legal/cognitive-disclaimer.tsx` | **Untouched.** Component stays alive for landing / about / legal. |
| (optional) `apps/web/e2e/contextual-header.spec.ts` or new spec | Add a regression assertion: `[role="note"][aria-label="Cognitive disclaimer"]` does NOT appear on `/hub` or `/arena`. Pure regression guard. |

### Tests

- Unit: existing tests in `mission-panel-candy.test.tsx` and arena tests should continue to pass (the disclaimer was not load-bearing).
- E2E: optional regression spec asserting disclaimer absence in gameplay surfaces.
- Manual: visual check at 390px confirms no disclaimer over board / contadores / contextual action.

### Risk

- **Low** technically.
- **Legal/marketing risk**: removing the cognitive disclaimer from the gameplay surface might be a brand or compliance concern. Surface this to Wolfcito before commit. If legal demands the disclaimer stays in-app, the fallback is to convert it to a small footer-link ("About Chesscito") that opens an info sheet on tap — but that requires Z4 work and is out of scope here.
- Mitigation: keep landing + `/about` + `/privacy` + `/terms` rendering the full disclaimer. The user encounters it at first install and at any legal-page visit.

### Fix vs hide

**Fix** (relocation, not removal).

### Blocks PRO smoke?

**Recommended yes** — visual quality matters during the smoke window. Soft-blocker.

---

## Commit 4 — `fix(mini-arena): turn loop never freezes after AI failure`

### Goal

The K+R vs K bridge either continues or terminates correctly; never freezes with the player unable to move.

### Decision

**Audit first, then fix or hide.** Two paths:

**Path A — fix the silent catch** (preferred if root cause is identifiable in <2h):

- Replace `try { ... } catch { setStatus("playing"); }` (mini-arena-sheet.tsx:139-141) with a logged `console.error` + recovery branch:
  - If `aiMove` returned empty → game is over → call `endIfTerminal()` and let it set `won/drawn`.
  - If `aiMove` returned malformed entries → log + concede AI's turn (advance `chess.js` turn manually via a null-move workaround) so the player can keep playing. **Verify chess.js supports this** before relying on it.
  - If `game.move()` throws on the AI's reported move → log the offending move + position, then concede.
- Optionally raise `aiLevel` from `0` to `1` for `kr-vs-k` if level-0 random-move is the actual culprit; level-1 plays slightly better but stays beatable.

**Path B — hide the slot** (if root cause needs >2h investigation):

- In `apps/web/src/components/play-hub/play-hub-root.tsx`: gate `<MiniArenaBridgeSlot ...>` rendering behind a temporary feature flag or simple `false &&` with a comment + reference to this plan.
- Add a TODO file or comment block referencing the plan + an issue tracker entry.

### Files (probable)

**Path A**:

| Path | Change |
|---|---|
| `apps/web/src/components/mini-arena/mini-arena-sheet.tsx` | Rewrite `triggerAi()` catch with recovery + logging. Possibly bump `aiLevel`. |
| `apps/web/src/lib/game/mini-arena.ts` | If level-bump chosen, `aiLevel: 1` for `kr-vs-k`. |
| `apps/web/src/components/mini-arena/__tests__/mini-arena-sheet.test.tsx` | New test: simulate first legal player move, assert AI responds within 1s OR turn restored OR status terminal — never frozen. (Test file may not exist yet; create it.) |

**Path B**:

| Path | Change |
|---|---|
| `apps/web/src/components/play-hub/play-hub-root.tsx` | Wrap `<MiniArenaBridgeSlot ...>` render with conditional disable + comment referencing this plan. |

### Tests

- Path A unit: new freeze-detection test (described above).
- Path A unit: existing mini-arena tests (if any) must continue to pass.
- Path B: no new tests — hide is a one-liner.

### Risk

- **Path A risk**: chess.js does not natively support "skip turn" / null-move. If the only recovery is "force-game-over", players who hit the bug see the game ended without context. Acceptable with clear copy ("AI couldn't respond — try again"), bad without.
- **Path B risk**: hiding the bridge removes the K+R vs K pedagogical step. Players who unlocked it lose the path. Mitigation: ship with a one-line "Coming soon" placeholder where the slot used to render, or omit silently and document.

### Fix vs hide

**Fix preferred.** Time-box at 2 hours of investigation. If fix is unclear by then → **Path B (hide)**. Decide live during commit work.

### Blocks PRO smoke?

**No** for the smoke test itself. **Yes** for "everything visible from `/hub` works" — soft blocker. If hidden, sprint can ship.

---

## Commit 5 — `test(visual): foundation regression suite (Step 1)`

### Goal

Convert visual capture-only suite into a real regression gate covering the surfaces stabilized in commits 1-4.

### Decision

Per `docs/reviews/visual-regression-plan-2026-05-02.md` §8 Step 1, **minimum viable** regression:

1. Rename `apps/web/e2e/visual-snapshot.spec.ts` → `apps/web/e2e/visual-capture.spec.ts`. Add disclaimer comment.
2. Create `apps/web/e2e/visual-regression.spec.ts` with **3 assertions only**:
   - `hub-anonymous-clean` — `/hub` after first-visit bypass, no sheet open.
   - `hub-anonymous-pro-sheet-open` — same + ProSheet mounted (anonymous Connect-Wallet CTA).
   - `hub-anonymous-daily-tactic-sheet-open` — same + DailyTacticSheet mounted on a fixed test puzzle (probably `mt-001` after the seed is sane post-commit-2).
3. Generate baselines (`pnpm test:e2e:visual --update-snapshots`).
4. Update `apps/web/package.json` scripts:
   - `test:e2e:visual` → `playwright test e2e/visual-regression.spec.ts` (real regression gate).
   - `test:e2e:visual-capture` → `playwright test e2e/visual-capture.spec.ts` (artifact only).

### Files (probable)

| Path | Change |
|---|---|
| `apps/web/e2e/visual-snapshot.spec.ts` → `apps/web/e2e/visual-capture.spec.ts` | Rename + disclaimer comment. |
| `apps/web/e2e/visual-regression.spec.ts` | New — 3 `expect(page).toHaveScreenshot()` assertions. |
| `apps/web/e2e/visual-regression.spec.ts-snapshots/` | New baseline PNG directory committed. |
| `apps/web/package.json` | Update `test:e2e:visual` + add `test:e2e:visual-capture`. |
| `DESIGN_SYSTEM.md` | New §10.x note: baseline updates require explicit `--update-snapshots` + visual-intent description in PR body. |

### Tests

This **is** the test infrastructure. Self-validating.

### Risk

- **Low**. Foundation only; expansion to remaining 7 canonical states from the regression plan deferred to next sprint.
- Baselines are generated against the **stabilized** UI (post commits 1-4). Locking in broken visuals would defeat the purpose — that's why this commit lands **last**.

### Fix vs hide

**Fix** (this is build-out, not fix).

### Blocks PRO smoke?

**No** for the smoke test directly. **Yes** for "we can defend against future drift" — soft blocker on confidence.

---

## Sprint dependency graph

```
Commit 1 (PRO CTA) ──┐
Commit 2 (Daily FEN) ──┼─► [PRO smoke gate] ──► Commit 5 (Visual regression)
Commit 3 (Disclaimer)  ┘
Commit 4 (Mini Arena fix or hide) ── (parallel; not gating smoke)
```

Commits 1, 2, 3 are independent and can land in any order. Commit 4 may run in parallel with the others. Commit 5 must be **last** so its baselines lock the stabilized state.

---

## What blocks the PRO smoke test

| Item | Required to pass smoke |
|---|---|
| Commit 1 | YES — payment without next-step UX is a half-shipped feature |
| Commit 2 | YES (or remove the 3 broken seeds without fix — see commit 2 fallback) |
| Commit 3 | Soft yes — visual quality during smoke window |
| Commit 4 | Soft no — bridge can be hidden without blocking smoke |
| Commit 5 | No — build-out, not fix |

**Hard floor**: commits 1 + 2 must land. Everything else is desirable for confidence.

---

## What this sprint does NOT do

- No `<ProChip>` deletion (Phase 2 commit #3 stays paused).
- No new layout primitives (`<ContextualActionRail />`, etc.).
- No reorganization of the floating action zone (P1-2 carry-forward).
- No move-animation polish (P1-3) unless a 1-line CSS fix surfaces during commit 4 audit.
- No Coach surface migration (Coach stays in `/arena` post-game).
- No Supporter Gallery, prize pool, or new features.
- No contracts, payments, or signer touch.
- No Supabase or backend work.
- No e2e baseline cleanup (the 26 pre-existing failures stay flagged in `docs/reviews/e2e-baseline-red-2026-05-02.md`).

---

## Risks at sprint level

1. **Commit 2 puzzle repairs introduce non-unique mates.** Mitigation: per-repair enumeration of all white moves with chess.js; reject any repair where >1 move yields `isCheckmate()`. If no clean repair exists, drop the broken puzzle from the seed.
2. **Commit 3 disclaimer removal is a legal/marketing call.** Mitigation: surface to Wolfcito before commit; landing + `/about` + legal still render the full disclaimer.
3. **Commit 4 fix path is opaque** — `js-chess-engine` source not under our control; if root cause is in the engine, fix path narrows to either "raise level" (might not help) or "hide the bridge" (Path B). Time-box at 2h.
4. **Commit 5 baselines lock visuals that may still need P1 polish.** Acceptable for v1 — re-baselining is explicit per the plan rule. Not silent rot.
5. **Sprint scope creep.** The user already explicitly said: PRO smoke first, architecture later. Any "while we're in there..." pull from P1-2 / P1-3 / Phase 2 primitives gets rejected at PR review.

---

## Estimated effort (focused, single-author)

| Commit | Estimate |
|---|---|
| 1 — PRO CTA | 1.5h |
| 2 — Daily Tactic FEN + validator | 2h (incl. per-puzzle uniqueness check) |
| 3 — Disclaimer relocation | 0.5h |
| 4 — Mini Arena fix or hide | 2-4h (audit + fix), 15min (hide) |
| 5 — Visual regression Step 1 | 2h |
| **Total** | **8-10h** |

Single workday for a focused operator. Two workdays if commit 4 lands the full Path A fix.

---

## Acceptance to declare sprint done

- [ ] Commit 1 merged: ProSheet active state has CTA + tests.
- [ ] Commit 2 merged: validator test green; 0 puzzles with pre-checked opponents.
- [ ] Commit 3 merged: disclaimer not rendering on `/hub` or `/arena` interactive surfaces; landing + about untouched.
- [ ] Commit 4 merged OR Mini Arena bridge hidden with comment + plan reference.
- [ ] Commit 5 merged: `test:e2e:visual` script gates 3 baselines; `--update-snapshots` documented.
- [ ] PRO smoke test executed end-to-end (separate work).
- [ ] Handoff doc summarizing the sprint, similar pattern to ContextualHeader handoff.

---

## Awaiting decision

Wolfcito sign-off on:

1. Sprint scope as written (5 commits, 8-10h).
2. **Commit 1 CTA wording** — accept "Play Arena, then use Coach after your match" as the active-state copy? Or prefer different phrasing?
3. **Commit 2 strategy** — repair the 3 broken FENs in-place, OR ship validator + drop them from the seed (4 puzzles remain)?
4. **Commit 3 — disclaimer removal** — confirm legal/marketing OK with disclaimer being landing/about-only.
5. **Commit 4 time-box** — accept the 2h investigation cap before falling back to hide?
6. **Commit 5 baseline coverage** — start with 3 assertions or expand to the full 10 from the regression plan now?

Plan ends here. Implementation starts after sign-off.

— canary author + triage doc author
