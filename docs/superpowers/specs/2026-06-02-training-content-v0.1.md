# Training Content v0.1 — Audit + Plan

**Date:** 2026-06-02
**Owner:** Product / Game Content
**Status:** Phase A audit + Phase B King exercises landed (no commit yet)
**Scope:** Stabilize the core training loop (exercises → stars → labyrinth unlock → badge claim per piece) before any monetization, PRO, or Peones work resumes.

---

## 0. Guiding constraints

- Do **not** touch contracts, Shop, PRO, Peones, monetization, leaderboard infra, layouts, or the existing labyrinth catalog.
- Do **not** change the `3★ per exercise` rule.
- Do **not** change the `10★ per piece` threshold that unlocks Labyrinths + Badge claim.
- Do **not** introduce medical claims or imply Chesscito is "officially live on MiniPay".
- EN/ES stay in sync (`editorial.ts` + `messages/es.ts`).
- Mobile-first (390px viewport); desktop is non-priority.

---

## 1. Current state (auditoría)

### 1.1 Pieces supported

| Piece  | `PieceId` type | i18n EN | i18n ES | Selector | Sprite | Badge levelId | Status |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|--------|
| Rook   | ✅ | Rook   | Torre  | ✅ | `/art/redesign/pieces/w-rook`   | 1 | Complete |
| Bishop | ✅ | Bishop | Alfil  | ✅ | `…/w-bishop` | 2 | Complete |
| Knight | ✅ | Knight | Caballo| ✅ | `…/w-knight` | 3 | Complete |
| Pawn   | ✅ | Pawn   | Peón   | ✅ | `…/w-pawn`   | 4 | Complete |
| Queen  | ✅ | Queen  | Reina  | ✅ | `…/w-queen`  | 5 | Complete |
| King   | ✅ | King   | Rey    | ✅ | `…/w-king`   | 6 | **Was empty (PR-9). Phase B adds 5 exercises + king move rule.** |

Source files:
- `apps/web/src/lib/game/types.ts:1` — `PieceId` enum
- `apps/web/src/lib/content/editorial.ts:59-66` — `PIECE_LABELS`
- `apps/web/src/lib/content/messages/es.ts:768-774` — ES overrides
- `apps/web/src/components/exercises/badge-sheet.tsx:23` — UI pieces array (already includes `"king"`)
- `apps/web/src/lib/contracts/scoreboard.ts:31-42` — levelId mapping

### 1.2 Exercises per piece (state BEFORE this commit)

| Piece  | Exercises | IDs | Max stars |
|--------|:--:|---|:--:|
| Rook   | 5 | `rook-1..5` | 15 |
| Bishop | 5 | `bishop-1..5` | 15 |
| Knight | 5 | `knight-1..5` | 15 |
| Pawn   | 5 | `pawn-1..5` | 15 |
| Queen  | 5 | `queen-1..5` | 15 |
| King   | **0** | — | **0** |

Catalog: `apps/web/src/lib/game/exercises.ts:79-86`. `PLAYABLE_PIECES` (`:77`) previously excluded `"king"`.

### 1.3 Star scoring (no change in this pass)

`apps/web/src/lib/game/scoring.ts:9-16`:

```
movesUsed <= optimalMoves       → 3★
movesUsed === optimalMoves + 1  → 2★
movesUsed >= optimalMoves + 2   → 1★
```

`apps/web/src/lib/game/exercises.ts:296-301` (labyrinth tier):

```
moves <= optimal       → 3★
moves <= optimal + 2   → 2★
moves <= optimal + 4   → 1★
else                   → 0★ (completable, no fail)
```

`computeStars()` returns `0 | 1 | 2 | 3`; `totalStars()` reduces array. Per-piece max = `5 × 3 = 15★`.

### 1.4 Labyrinth unlock (no change in this pass)

`apps/web/src/lib/game/exercises.ts:88` — `BADGE_THRESHOLD = 10`.
`apps/web/src/components/exercises/exercises-screen.tsx:1926`:

```
labyrinthAvailable = labyrinthList.length > 0 && (badgeEarned || totalStars >= BADGE_THRESHOLD)
```

**Per piece**, NOT global. The same `10★` gate doubles as the badge-claimable threshold (`badge-sheet.tsx:197-210`).

Labyrinth catalog today:

| Piece  | Labyrinths | IDs |
|--------|:--:|---|
| Rook   | 3 | `rook-lab-1..3` |
| Bishop | 2 | `bishop-lab-3..4` |
| Knight | 5 | `knight-lab-1..5` |
| Pawn   | 3 | `pawn-lab-3..5` |
| Queen  | 3 | `queen-lab-1..3` |
| King   | **0** | — (deferred — see §7) |

### 1.5 Persistence

- **Stars (exercises)** → `localStorage["chesscito:progress:{piece}"]` → `{ stars[5], exerciseIndex }` (`use-exercise-progress.ts:10-12`).
- **Best moves (labyrinths)** → `localStorage["chesscito:labyrinth-best:{piece}"]` (`labyrinth-progress.ts:12-16`).
- **No on-chain save** for exercises or labyrinths.

### 1.6 On-chain save — Arena ONLY

`ScoreboardUpgradeable.sol` stores `{ player, levelId, score, timeMs, nonce }` and is **exclusively for Arena chess victories vs AI**, not for training exercises.

- Submission path: `POST /api/sign-score` → EIP-712 signature → `submitScoreSigned(...)` (`apps/web/src/app/api/sign-score/route.ts`).
- Triggered from `/arena` after a win, never from `/exercises`.
- `apps/web/src/lib/contracts/scoreboard.ts:31-42` — `levelId` 1..6 maps to pieces but is **only relevant if/when training scores get an on-chain home in v0.2+.**

### 1.7 Badge / claim — per piece (already correct)

- Contract: `BadgesUpgradeable.sol` — ERC-1155 **soulbound** (`_update` reverts on transfer at `:140-152`).
- Claim path: `POST /api/sign-badge` (`apps/web/src/app/api/sign-badge/route.ts:1-63`) → EIP-712 → `claimBadgeSigned(levelId, nonce, deadline, signature)`. Gasless from the user's perspective in MiniPay (gas paid in cUSD via abstraction).
- UI: `BadgeSheet` (`apps/web/src/components/exercises/badge-sheet.tsx`) iterates all 6 pieces via `PIECES` array (`:23`).
- State machine per piece: `claimed` (on-chain `hasClaimedBadge==true`) → `claimable` (`totalStars ≥ 10`) → `locked`.
- Each piece is **independent**: completing only Rook ➜ user can claim Rook badge immediately, regardless of Bishop/Knight/etc. progress.

**There is no "Mint" path for badges.** "Mint" applies only to `VictoryNFTUpgradeable` (Arena wins) — a separate ERC-721, paid, with 80/20 treasury/prize-pool split. Do not conflate the two systems in copy or UX.

### 1.8 Tests touching this surface

- `apps/web/src/lib/game/__tests__/scoring.test.ts` — `computeStars`, `endgameStars`.
- `apps/web/src/lib/game/__tests__/labyrinth-progress.test.ts` — best-score per labyrinth.
- `apps/web/src/components/exercises/__tests__/badge-sheet.test.tsx` — already expects all 6 pieces.
- `apps/web/src/lib/badges/__tests__/use-badge-sheet-state.test.tsx` — claim orchestration.
- `apps/web/src/app/api/sign-badge/__tests__/route.test.ts` — EIP-712 signer.
- `apps/web/src/app/api/sign-score/__tests__/route.test.ts` — Arena scoring signer.
- VR baselines: `apps/web/e2e/visual-regression.spec.ts-snapshots/` — `hub-clean.png` is the only one likely to shift if King's badge tile re-paints; refresh deferred until Phase B lands and we eyeball the diff.

### 1.9 Gaps identified

1. **King exercises were missing** → Phase B (this commit).
2. **King move generator was missing** (`board.ts:45-58` had no `case "king"`, so exercise board returned `[]` valid targets → unplayable). → Phase B adds `getKingMoves`.
3. **King labyrinths missing** → deferred to v0.2 (see §7).
4. **No on-chain save for training stars** → out of scope for v0.1; logged as future spec item.
5. **Leaderboard cannot tie-break** if everyone reaches 15★/piece × 6 pieces = 90★ — see §9.

---

## 2. Target MVP model

For each piece:

- 5 basic exercises.
- Up to 3★ per exercise.
- Up to 15★ base per piece.
- Labyrinths unlock at **≥ 10★** for that piece.
- 1 claimable/mintable badge at **≥ 10★** for that piece (BadgesUpgradeable, ERC-1155 soulbound).
- At least 1 labyrinth per piece as base (already true for Rook/Bishop/Knight/Pawn/Queen; deferred for King).
- Future option: 3 labyrinths per piece (Easy / Medium / Hard).
- Future option: badges/achievements per labyrinth.

---

## 3. Star progression rule (canonical)

- Each exercise awards `0 | 1 | 2 | 3`★ via `computeStars(movesUsed, optimalMoves)`.
- 5 exercises × 3★ = **15★ base per piece**.
- Threshold for badge AND labyrinth = **10★ per piece**.
- Stars are **best-of-attempts** (`Math.max(prev, new)` in `use-exercise-progress.ts:81-84`); replay never erodes progress.
- Stars persist in `localStorage` only. **No on-chain save in v0.1.**

**Do not change in v0.1.**

---

## 4. Score / on-chain save / leaderboard (current state, no changes)

### What is saved on-chain today

- **Only Arena (full chess vs AI) results.**
- Fields: `player, levelId (piece played), score, timeMs, nonce, deadline, signature`.
- Triggered after Arena win → `/api/sign-score` → `submitScoreSigned`.

### What is NOT saved on-chain

- Exercise completions.
- Labyrinth completions.
- Star counts.
- Streaks / time / attempts on training surfaces.

### Leaderboard wiring

- `apps/web/src/components/exercises/leaderboard-sheet.tsx` reads from `/api/leaderboard` (Supabase RPC `get_leaderboard` + fallback view).
- Row shape: `{ rank, player, total_score, is_verified }`.
- Source data is Arena `Scoreboard` events (indexed) + Supabase mirror.
- No badge/training data flows into the leaderboard.

**Conclusion:** the leaderboard today reflects Arena performance, not training mastery. Anyone who never opens Arena has score 0 on the public board.

---

## 5. Future leaderboard v0.2 ideas (do NOT implement now)

Document only — to be re-scoped after monetization M2 ships.

1. **Tie-breakers** so people who max 90★ aren't all tied:
   - Time per exercise (faster = better) — needs new persisted field.
   - Total attempts (fewer = better) — needs new persisted field.
   - Current streak (consecutive days with at least 1 exercise).
2. **Perfect-runs bonus** (exercises completed at 3★ on first try) → separate scalar.
3. **Difficulty weighting** — labyrinths > exercises; future Hard labyrinths > Easy.
4. **Separate leaderboards** for Exercises vs Arena vs Labyrinths (don't mix systems).
5. **Sealed score commit**: hash-then-reveal to prevent client tampering before any on-chain save.
6. **Optional on-chain mirror** of (piece, totalStars, completedAt) via a `TrainingScoreboard` contract — design only after observing real engagement curves.

Cost of leaving this open: under current model, the moment a power-user hits 90★, the leaderboard cannot distinguish them. Mitigation today: training does not feed the leaderboard at all, so there is no false signal. Action: revisit once training surfaces are stable.

---

## 6. Badges / mint intermediate (no changes in v0.1)

- Claim is **already per-piece and intermediate** (works as desired).
- One badge per piece at `levelId 1..6`, soulbound ERC-1155.
- Each claim is gasless from the user (signed by backend, user pays cUSD gas in MiniPay).
- Claim works **the moment** `totalStars[piece] ≥ 10`. No "wait until you finish all pieces" gate.
- King badge `(levelId = 6)` is **already wired in the contract + UI**; it just becomes claimable for the first time once King exercises exist (Phase B unlocks the path).

No copy or data changes needed in `editorial.ts` for badges — `BADGE_TITLES.king = "King Ascendant"` already exists (`editorial.ts:130`).

---

## 7. Proposed exercise matrix (5 per piece)

For existing pieces, the catalog is already in `exercises.ts`. King exercises landed in this commit:

### King (NEW — added in Phase B)

| # | id | Theme | startPos → targetPos | optimal | isCapture |
|---|----|-------|----------------------|:--:|:--:|
| 1 | `king-1` | One-square move | e1 → e2 | 1 | — |
| 2 | `king-2` | Safe square (diagonal step) | e1 → f2 | 1 | — |
| 3 | `king-3` | Avoid danger (walk away) | d4 → b6 | 2 | — |
| 4 | `king-4` | King capture | e1 → d2 | 1 | ✅ |
| 5 | `king-5` | Reach the shelter | e5 → h8 | 3 | — |

Pedagogy notes:
- v0.1 does NOT model board-level threats (no enemy attack rays evaluated). "Safe square" and "Avoid danger" are framed conceptually via copy (`TUTORIAL_COPY.king`); mechanics remain "reach target in N optimal moves." Adding actual threat modeling would require an `attackedSquares` field on `Exercise` and is deferred to v0.2.
- King is **never sliding**: each move is one step in one of 8 directions. The new `getKingMoves` rule mirrors `getKnightMoves` shape (no rays, 8 deltas, blocker-aware).

### Other pieces (unchanged — already 5)

See `apps/web/src/lib/game/exercises.ts:8-74`. No rename or content change in v0.1.

---

## 8. Labyrinths per piece

**v0.1 (now):** keep the existing Rook/Bishop/Knight/Pawn/Queen labyrinth catalog untouched. King labyrinth(s) deferred (see §10).

**v0.2 target:** each piece exposes up to 3 labyrinths (Easy / Medium / Hard). Structure already supports this (`LABYRINTHS: Record<PieceId, Exercise[]>`); just append entries.

**Examples for future King labyrinths (do NOT implement now):**

| Tier | Concept |
|------|---------|
| Easy | Walk along a clear file from e1 to e8, no obstacles. |
| Medium | Reach a corner avoiding obstacle "guard" pieces blocking diagonals. |
| Hard | Reach the shelter while detouring around a wall of obstacles — requires picking the shorter L-shaped path. |

Hard requires the `attackedSquares` modeling work flagged in §7. Easy + Medium are achievable today with current `obstacles[]` machinery but were left out to keep this PR small.

---

## 9. Unlock rules

### Now (v0.1)

- All 5 basic exercises per piece are **Free**.
- Each exercise awards up to 3★.
- Labyrinths unlock at **≥ 10★ per piece**.
- Badge per piece claimable at **≥ 10★ per piece** (same threshold).
- Existing labyrinths (1–5 per piece) are part of core content, not premium.

### Future-compatible (no implementation)

- **PRO** could unlock additional labyrinths (a hypothetical L2 / L3 tier per piece).
- **Peones** (in-app consumable) could fund hints / retries / Coach feedback on hard puzzles.
- Any premium gating must be **additive** — never gate the 5 basic exercises or the first labyrinth.

---

## 10. Phased rollout

| Phase | Goal | Status |
|-------|------|--------|
| **A** | Audit + spec | ✅ this doc |
| **B** | King 5 exercises + `getKingMoves` rule + `PLAYABLE_PIECES` includes king | ✅ landed in this commit (pending user review) |
| **C** | Normalize 5 ex/piece | ✅ already true for Rook/Bishop/Knight/Pawn/Queen; King added in Phase B |
| **D** | Per-piece badge/claim verification | ✅ already correct in code; no diff |
| **E** | King labyrinths (≥ 1) | ⏸️ **deferred** — riesgo alto sin attackedSquares modeling |
| **F** | PRO/Peones future hooks | 📄 documented (§9) — no code |
| **G** | Leaderboard v0.2 | 📄 documented (§5) — no code |

**Per user directive (2026-06-02):** "Laberintos por pieza pueden quedar en spec si el riesgo es alto." → Phase E held in spec.

---

## 11. Acceptance criteria

- [x] All 6 pieces exist in types/i18n/selector/badge contract.
- [x] Each piece has 5 basic exercises.
- [x] Each exercise can award up to 3★.
- [x] Each piece can reach 15★ base.
- [x] Labyrinths unlock at ≥ 10★ per piece.
- [x] Per-piece badge claim works as intermediate reward (no full-route gate).
- [x] Rook flow preserved (no diff to `ROOK_EXERCISES` or `ROOK_LABYRINTHS`).
- [x] King appears and is playable (`getKingMoves` added, `PLAYABLE_PIECES` extended).
- [x] No change to on-chain save (still Arena-only).
- [x] No leaderboard redesign.
- [x] No layout / navigation changes.
- [x] No monetization changes.
- [x] No "available on MiniPay" claims introduced.
- [x] EN/ES already in sync for King (`PIECE_LABELS`, `BADGE_TITLES`, `TUTORIAL_COPY` already populated).
- [ ] Tests reported (see commit message after `pnpm test` run).
- [ ] Files modified reported (see commit message).
- [ ] Pending risks: see §12.

---

## 12. Pending risks / open questions

1. **King exercise board interaction** — `getKingMoves` is new; if the exercise board renderer (`exercises-screen.tsx`) hard-codes piece-specific affordances (e.g., long-jump highlights), King may need visual polish. To validate manually before merging.
2. **VR baseline `hub-clean.png`** — adding King to `PLAYABLE_PIECES` may cause the piece-picker thumbnail row to render King where previously hidden. If the baseline goes red, refresh in the same PR with eyeballed diff per `vr-baseline-discipline`.
3. **Attack squares modeling** — without it, "Safe square" and "Avoid danger" are framed copy-only. Document loudly; consider promoting to v0.2 scope if pedagogy concerns surface in user testing.
4. **King labyrinths** — entirely deferred. If user finishes 5 King exercises and reaches 10★, `labyrinthAvailable` evaluates `false` because `labyrinthList.length === 0`. UX must not promise King labyrinths until they ship.

---

## 13. Files touched in this commit (Phase B)

- `apps/web/src/lib/game/rules/king.ts` — **NEW** — `getKingMoves(origin, blockers)`, 8 one-square deltas with blocker filtering.
- `apps/web/src/lib/game/board.ts` — add `case "king": moves = getKingMoves(position, blockers); break;` to the switch + import.
- `apps/web/src/lib/game/exercises.ts` — add `KING_EXERCISES` (5 entries), wire into `EXERCISES.king`, extend `PLAYABLE_PIECES` to include `"king"`.
- `apps/web/src/components/exercises/exercises-screen.tsx` — flip `enabled: false` → `enabled: true` for the King entry in the `pieces` array passed to `PiecePickerSheet` (`:2087`). Without this, the picker grid still renders King with the "Soon" lock badge despite the underlying exercises being defined.
- `apps/web/src/app/[locale]/exercises/__tests__/page.test.tsx` — `accepts pieces with defined exercises` loop extended to include king; removed obsolete `rejects pieces with empty EXERCISES arrays (king)` test.
- `apps/web/src/app/[locale]/hub/__tests__/page.test.tsx` — `preserves rook/bishop/knight/pawn/queen on the redirect` loop extended to include king; removed obsolete `drops king (empty EXERCISES) from the redirect` test.
- `docs/superpowers/specs/2026-06-02-training-content-v0.1.md` — **NEW** — this document.

No other files touched in v0.1.

---

## 14. Validation findings (post-Phase B, pre-commit)

### 14.1 Selector

- **King tile in `PiecePickerSheet` grid:** `pieces` array in `exercises-screen.tsx:2081-2088` previously had `{ key: "king", …, enabled: false }`. Fixed to `enabled: true` so the tile is clickable. The grid itself is gated by `hasClaimedAnyBadge` — first-time users won't see the picker until they claim their first badge; that gating is intentional pedagogy (see `piece-picker-sheet.tsx:54-59`), not affected by Phase B.
- **Direct route `/exercises?piece=king`:** previously rejected by `page.tsx` server guard (the test we patched); now passes through `initialPiece="king"`.
- **King badge tile in `BadgeSheet`:** already iterated by the existing `PIECES` array at `badge-sheet.tsx:23` — no diff needed.

### 14.2 Exercise playability

- `EXERCISES.king` is populated with 5 entries (`king-1..5`).
- `getKingMoves` wired into `board.ts` so `getValidTargets("king", origin)` returns the 8 one-square deltas, blocker-filtered.
- `use-exercise-progress.ts:68` resolves `currentExercise: Exercise = EXERCISES["king"][safeIndex]` — no longer `undefined`, the crash mode that the obsolete tests guarded against.
- `tutorialHints` (`exercises-screen.tsx:1990-1994`) calls `getValidTargets(selectedPiece, currentExercise.startPos)` — King now returns valid hint squares (the 8 neighbours of `king-1.startPos = e1`).

### 14.3 Star award + badge claim

- `completeExercise(movesUsed)` → `computeStars(movesUsed, exercise.optimalMoves)` is piece-agnostic; awards 0–3★ exactly like every other piece.
- `totalStars >= BADGE_THRESHOLD (10)` triggers `badgeEarned = true`.
- `BadgeSheet` renders the King tile as `claimable` once `totalStars >= 10`.
- Claim path: `/api/sign-badge` (`sign-badge/route.ts`) signs EIP-712 for `levelId = 6` unchanged — no contract or signer change needed. End-to-end claim works the moment the user crosses 10★.

### 14.4 Labyrinth toggle UX at 10★ King (empty-state finding)

- After completing King to 10★ + claiming badge, the user sees the `Labyrinths` toggle button in the bottom rail (`mission-panel-candy.tsx:540-545`).
- For King: `labyrinthList.length === 0` → `labyrinthAvailable = false` → button renders `disabled` with `opacity-30 cursor-not-allowed`. No "Coming Soon" copy or explanatory tooltip.
- **UX risk:** a King-completer earns the right to see the toggle but the toggle is silently dimmed, which can read as a bug rather than as "content coming later." Other pieces always show a working toggle because each has at least one labyrinth, so this is a King-unique empty state.
- **Recommended follow-up (do NOT implement in v0.1):**
  - Option A — show a small "SOON" pill on the disabled toggle when `labyrinthList.length === 0` (same `comingSoon` token used in `PiecePickerSheet`).
  - Option B — hide the toggle entirely when `labyrinthList.length === 0` regardless of stars, since "10★ unlocked but no content" is a different state than "10★ not yet reached."
- Logged here as a known UX paper-cut tied to the deferred labyrinth Phase E.

### 14.5 VR snapshot risk

- Existing baselines (`apps/web/e2e/visual-regression.spec.ts-snapshots/`): `hub-clean.png`, `hub-daily-tactic-open.png`, `hub-shop-sheet-open.png`. None of these snapshot the open `PiecePickerSheet` grid.
- No e2e spec was found that opens the picker grid with King visible, so the picker-tile flip from locked → clickable is **not currently captured** by any baseline.
- `hub-clean.png` may shift if the hub HUD renders any King-conditional element on first paint (unlikely — the badge sheet is closed by default, and the picker chip shows only the active piece sprite).
- **Recommendation:** run `pnpm test:e2e:visual` once on Phase B branch before refresh; if `hub-clean.png` is red, eyeball the diff per `vr-baseline-discipline` rule. Do NOT pre-refresh.

### 14.6 Selector pieces array — additional housekeeping

- The hardcoded `pieces=[...]` literal in `exercises-screen.tsx:2081-2088` parallels `PLAYABLE_PIECES` in `exercises.ts:77` but is maintained in two places. Future drift risk: someone adds a 7th piece to `PLAYABLE_PIECES` and forgets the picker literal, or vice versa.
- **Recommended follow-up (do NOT implement in v0.1):** derive the picker `pieces` array from `PLAYABLE_PIECES` so there is a single source of truth. Out of scope for v0.1 because it touches the picker shape and could shift VR.
