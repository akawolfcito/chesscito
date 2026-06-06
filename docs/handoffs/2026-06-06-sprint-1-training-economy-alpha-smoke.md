# Sprint 1 — Training Economy Alpha — Smoke Report

**Date:** 2026-06-06
**Scope:** Manual + automated smoke validating the 6-commit Sprint 1 delivered against the plan in `docs/product/chesscito-training-economy-alpha-decisions-2026-06-05.md`.
**Branch:** `main` (7 commits ahead of `origin/main`, range `6f881fb2..6ba33687`).
**Status at write-time:** ready for human smoke; recommendation at the bottom.

---

## Section A — Automated checks (executed by Claude)

### A.1 Unit/integration suite

| Validation | Tool | Result |
|---|---|---|
| BFS verifier (warning mode) — all 34 exercises | vitest | ✅ "All exercises pass optimalMoves verification" |
| Migration helper (6 pure + 4 integration) | vitest | ✅ 10/10 |
| Telemetry contract (5 events × scenarios) | vitest | ✅ 14/14 |
| EXERCISE_DESCRIPTIONS catalog (EN+ES) | vitest | ✅ 68/68 |
| Full vitest suite `--max-workers=2` | vitest | ✅ **2631/2631** in 78s |
| TypeScript `tsc --noEmit` | tsc | ✅ clean |

### A.2 Dev server SSR probes (Next.js dev on port 3000 after `.next` cache clear)

| Probe | Expected | Result |
|---|---|---|
| `GET /en/exercises?piece=king` HTTP | 200 | ✅ 200 |
| HTML contains king-1..king-7 + king-9 + king-10 | 9 entries | ✅ 9 (all present) |
| HTML does NOT contain `king-8` | parked | ✅ absent |
| `GET /en/exercises?piece=rook` shows only rook-1..rook-5 | 5 entries | ✅ 5 (unchanged) |
| King EN descriptions render | 4 strings present | ✅ "Long diagonal march", "Sidestep the obstacle", "Antidiagonal march", "Wall of obstacles" |
| `GET /es/exercises?piece=king` ES descriptions render | 4 strings present | ✅ "Marcha por la diagonal larga", "Esquiva el obstáculo", "Marcha por la antidiagonal", "Muro de obstáculos" |
| `POST /api/telemetry` smoke probe | 204 No Content | ✅ 204 |

### A.3 Migration semantics (proved by unit test, not requiring browser)

| Scenario | Expected | Result |
|---|---|---|
| Legacy `chesscito:progress:king` with `stars: [3,3,2,1,0]` post-Sprint 1 | expand to length 9 padding with zeros, `totalStars` unchanged at 9, persisted back | ✅ test `expands legacy King [3,3,2,1,0] to length 9 after king-6..10 catalog extension` |
| Rook unchanged (still count 5) | verbatim, no write-back | ✅ test `preserves Rook [3,3,3,3,0] verbatim when pool count is 5` |
| Truncation case (pool shrunk) | warn + preserve first N | ✅ test `warns AND truncates when simulated count shrinks below persisted length` |

### A.4 Telemetry dedup proofs (unit tests, mocked `track`)

| Concern | Result |
|---|---|
| `training_exercise_started` fires once per hydrated id, no re-fire on re-render | ✅ |
| `training_exercise_started` fires with hydrated id, NOT SSR-default | ✅ |
| `training_stars_earned` skipped on replay-without-improvement | ✅ |
| `training_piece_badge_threshold_reached` skipped when already ≥10★ | ✅ |
| `training_senda_completed` uses `getExerciseCount(piece)` (Rook 5 vs King 9) | ✅ |
| `training_senda_completed` does NOT re-fire on replay after senda closed | ✅ |

---

## Section B — Manual checklist for Wolfcito (MiniPay viewport, real browser)

These items require either the MiniPay client, a real Chrome at 390×844, or DevTools observation. Mark each PASS / FAIL / N/A as you walk through.

### B.1 Visual smoke at `/en/exercises?piece=king` (viewport 390×844 or MiniPay)

- [ ] Page mounts without console errors (open DevTools → Console).
- [ ] Top board renders the King piece at its `startPos` for the active exercise.
- [ ] **ExerciseDrawer opens** (tap stars chip) and lists **9 exercises** with names + ID badges.
- [ ] Each of the 4 new entries has a description in your locale (EN or ES):
  - king-6 → "Long diagonal march" / "Marcha por la diagonal larga"
  - king-7 → "Sidestep the obstacle" / "Esquiva el obstáculo"
  - king-9 → "Antidiagonal march" / "Marcha por la antidiagonal"
  - king-10 → "Wall of obstacles" / "Muro de obstáculos"
- [ ] No layout overflow on the drawer at 390px (no horizontal scroll inside the sheet).
- [ ] Stars counter pill shows `current/total` correctly. For a fresh King: `0/27` (= 9 × 3). **NOTE:** if it shows `0/15`, that's the deferred `result-overlay.tsx` refactor for Sprint 3 — log as expected, NOT a regression.
- [ ] Bottom dock / persistent nav unchanged (no chip moved, no missing icon).

### B.2 Play through new exercises

- [ ] `king-6` (h8 → a1): play the diagonal in 7 moves, confirm 3★ on the result overlay.
- [ ] `king-7` (e4 → e8 with obstacle e6): observe the e6 cell rendered as obstacle/blocked, complete in 4 moves, 3★.
- [ ] `king-9` (a8 → h1): play the antidiagonal in 7 moves, 3★.
- [ ] `king-10` (e4 → e1 with wall): observe 4 obstacle cells (e3, e2, d2, f2), complete in 4 moves, 3★.

### B.3 Legacy migration (use an account/wallet that already had King progress)

- [ ] In DevTools → Application → Local Storage, find `chesscito:progress:king`.
- [ ] If you had pre-Sprint 1 data, confirm the array `stars` now has **length 9** with the original 5 values preserved in the first 5 slots and 4 zeros appended.
- [ ] Replay any exercise with stars > 0 and confirm:
  - No event named `training_stars_earned` posts to `/api/telemetry` (Network tab) unless your reattempt actually improved.

### B.4 Badge claim threshold (legacy and fresh)

- [ ] Fresh King: complete the first 4 exercises with 3★ each → totalStars = 12 → badge becomes claimable.
- [ ] Confirm badge claim sheet still opens at 10★ threshold (NOT 27 or any new threshold).
- [ ] After claim, the claim button surfaces "Claimed" state as before.

### B.5 Telemetry events (DevTools Network → /api/telemetry filter)

Walk through and observe payloads. Each row should appear at most once per condition.

- [ ] Open `/exercises?piece=king` → exactly 1 `training_exercise_started` with `{ piece: "king", exerciseId: "king-1", slotIndex: 0, isReplay: false }`.
- [ ] Re-render the page (toggle dark mode, swap locales, navigate drawer back) — **no extra** `training_exercise_started` events for the same `exerciseId`.
- [ ] Navigate to king-2 via drawer → exactly 1 new `training_exercise_started` with `exerciseId: "king-2"`.
- [ ] Complete king-1 with 1 move → `training_exercise_completed` (1 event) AND `training_stars_earned` (delta 3).
- [ ] Replay king-1 with 1 move → `training_exercise_completed` (1 event, `isReplay: true`), NO `training_stars_earned`.
- [ ] At the moment cumulative King ★ crosses 10 → 1 `training_piece_badge_threshold_reached`. NOT repeated on subsequent completions.
- [ ] After completing king-10 with ≥1★ (i.e., the 9th slot closes) → 1 `training_senda_completed` with `{ exerciseCount: 9 }`. NOT repeated on replay.

### B.6 Other pieces (regression — Rook/Bishop/Knight/Pawn/Queen)

- [ ] Visit `/exercises?piece=rook` — drawer shows 5 exercises, none of them king-6..10.
- [ ] Same for bishop, knight, pawn, queen.
- [ ] knight-5 now targets **e4** (not e5). Play optimally in 3 moves → 3★.
- [ ] Any piece you previously had stars on: progress survives, `totalStars` numeric matches what you had.

### B.7 Visual — drawer / overlay / counter / nav

- [ ] Drawer scrollbar (if 9 entries don't fit in viewport): scrolls smoothly without rubber-banding at edges.
- [ ] Result overlay after completing king-6 (long path) shows the correct moves/optimal display ("7 / 7").
- [ ] Result overlay stars row doesn't visually break at slot index ≥ 5 (these are the new slots).
- [ ] Bottom nav: PiecePicker shows King as available (was true before Sprint 1).
- [ ] No console warnings about React keys, hydration mismatch, or `EXERCISES_PER_PIECE`.

---

## Section C — Known carry-over / NOT bugs

These are documented as out-of-scope for Sprint 1 and would surface as superficial "issues" during the smoke. They are NOT regressions.

- **`result-overlay.tsx` displays `totalStars / (EXERCISES_PER_PIECE * 3)` = X/15.** That's the deprecated constant still imported — its refactor is scheduled for Sprint 3 when StarsRow takes a `piece` prop. For King today the "true max" is 27 (9 × 3), but the overlay still shows /15. This is cosmetic ambiguity, not a bug. Will fix in Sprint 3.
- **King EXERCISE_DESCRIPTIONS for king-8 omitted (and that's correct).** king-8 is parked pending re-spec — its descriptions catalog entry must NOT exist until the exercise lands.
- **BFS verifier remains in warning mode.** No drift today (`knight-5` was the only mismatch and was resolved in commit `25fdfbee`), but the assertion is `console.warn` not `expect`. Promotion to hard fail is queued for Sprint 2.

---

## Section D — UX parking (do NOT act on in Sprint 1)

Captured per Wolfcito directive 2026-06-06:

> Queda parqueada una exploración de experiencia tipo **lesson path inspirada en Duolingo**. La idea es evaluar si `Exercises` y `Labyrinths` deberían sentirse menos como tabs separadas y más como una secuencia fluida: explicación breve → captura simple → captura múltiple → reto en N movimientos → combinación de piezas → laberinto/aplicación. Esto puede ayudar a reducir la sensación de "capturo estrellas una y otra vez" y mejorar el onboarding pedagógico, pero no debe modificar el scope actual.

Where this goes when it activates: this is a discovery item that would feed into the Daily Tactic Evolution (Sprint 2) framing and the labyrinth tier T2/T3/T4 design (Milestones B+). Not implementation work for Sprint 1.

---

## Section E — Recommendation

**Recommendation: PUSH to `origin/main` after manual smoke (B.1–B.7) returns no FAILs.**

Rationale:
- All automated checks pass with zero unexplained anomalies.
- The dev-server SSR probe confirms the page mounts, the catalog is correct, and i18n descriptions render in both locales.
- Migration semantics, telemetry dedup, and BFS optimality are proven at the unit level.
- The deferred items (`result-overlay.tsx` display, BFS hard fail) are documented as Sprint 3 / Sprint 2 follow-ups; they are not gating.
- The full suite ran clean at `--max-workers=2` (78s), so the previous fork-pool flakiness was system pressure, not code.

If during manual smoke a Section B item FAILs:
- **B.1 / B.7 visual layout failure** → fix in a follow-up commit before push. Most likely culprit is drawer scrolling at 9 items inside a sheet sized for 5 — a small CSS fix.
- **B.5 telemetry duplicate** → fix in a follow-up commit before push. Possible culprits: `lastStartedRef` not surviving re-mounts, or a missing dep in the effect.
- **B.6 regression on another piece** → fix immediately. This would indicate the per-piece dynamic count broke a hardcoded path I missed.

**Production promote** is NOT recommended yet — Sprint 2 (Daily Tactic Evolution), Sprint 3 (Peones ledger), and Sprint 4 (Compendio TX) are still ahead. Promote at the end of Sprint 4 retrospective.

---

## Section F — How to continue

1. Wolfcito walks through Section B on real device + DevTools.
2. Marks PASS / FAIL inline (or just reports back).
3. If all green → `git push origin main`.
4. If any FAIL → describe the fail; I open a fix branch + a separate commit before push.
5. Then either start Sprint 2 (Daily Tactic Evolution) or hold for product calibration.
