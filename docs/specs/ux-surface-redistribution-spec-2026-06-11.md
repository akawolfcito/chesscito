---
status: APPROVED — D1-D6 frozen by founder 2026-06-11; ready for implementation planning
author: Sally (bmad-agent-ux-designer) + Wolfcito
date: 2026-06-11
baseline: main 508596b3 · suite 3601/3601
founderInputs: docs/handoffs/2026-06-11-training-path-3d-4-close-handoff.md §NEXT-1
relatedSpecs:
  - docs/specs/integrated-training-path.md
  - _bmad-output/planning-artifacts/ux-design-specification.md (Kingdom Vivo baseline)
patternLibrary: docs/design-patterns/game-economy-patterns.md
---

# UX Spec — Training Surface Redistribution

## 0. Founder inputs (verbatim, 2026-06-11)

1. Mission = help/guide for "what do I do now"; TODAY it mixes guide +
   showcase + data and is not understandable.
2. The path listing "all say 3, 3, 3" — illegible; maybe a summary +
   save score off/onchain button.
3. Milestones/Mastery "look like badges" — founder proposal: B/W icons
   that fill with color on completion (also in Journey).
4. Achievement showcase → Profile or TROPHIES, not Mission.
5. The piece selector (TORRE chip) could BE the YOUR BADGES sheet.

## 1. Current-state audit (what lives where TODAY)

### 1.1 Quest tray (top of game screen) — 3 chips
| Chip | Opens | File |
|---|---|---|
| TORRE ▾ (piece) | PiecePickerSheet — info-first; switch grid gated until 1 badge claimed | `piece-picker-trigger.tsx` / `piece-picker-sheet.tsx` |
| Mission peek (crosshair + target) | MissionDetailSheet | `mission-panel-candy.tsx:499` → `mission-detail-sheet.tsx` |
| Stars + shield + streak | ExerciseDrawer (primary selector) | `exercise-drawer.tsx` |

### 1.2 MissionDetailSheet — the overloaded surface
Stacked top-to-bottom in one 340px panel (`mission-detail-sheet.tsx`):
1. **GUIDE** ✓ — avatar + objective + piece hint (its real job)
2. **DATA** — score + time pills (or pre-first-move hint)
3. **TRAINING PATH** — `TrainingPathRail`: exercise star-chips (the
   "3★ 3★ 3★" wall), labyrinth rows, MILESTONES group (badge + mastery
   rows with lock/trophy/crown icons → "look like badges")
4. **JOURNEY** — `JourneyRail`: 3 tiers (current badge / next piece /
   all mastered) — a roadmap/showcase, duplicating §3's milestones

Verdict: confirms founder read. 4 jobs in 1 surface; only job 1 is
Mission's. §3 duplicates the ExerciseDrawer (which already lists
exercises + labyrinths interactively). §3-milestones and §4 overlap
each other AND BadgeSheet.

### 1.3 ExerciseDrawer (Slice 3D primary selector)
Exercise rows (number, description, stars, lock) + LABYRINTHS section
(tappable rows) + bottom progress bar with badge-threshold marker +
hint copy. This is already the canonical "where do I train" surface.

### 1.4 BadgeSheet (YOUR BADGES, dock)
Vitrine hero band (wolf + 6 piece minis claimed-in-color/locked-as-
silhouette + counters + progress bar) + 6 badge cards with per-piece
progress bar + CLAIM CTA. Note: hero already implements the
"color-on-completion" idea the founder wants for milestones.

### 1.5 Redundancy map (the core problem)
| Fact | Surfaces showing it today |
|---|---|
| Per-exercise stars | Drawer rows · TrainingPathRail chips · drawer trigger total |
| Badge progress (N/10★) | JourneyRail tier 1 · TrainingPathRail milestone · BadgeSheet card · drawer bottom bar |
| Labyrinth status | Drawer LABYRINTHS section · TrainingPathRail rows |
| Piece roster + claim state | PiecePickerSheet grid · BadgeSheet hero + cards · hub MasteryDashboard |
| Mastery (crown) | TrainingPathRail milestone · hub mastery tiles |

Same data painted 2–4 times with different visual vocabularies =
"vitrina + data" noise drowning the guide.

## 2. Proven patterns (cited per ux-pattern-references rule)

- **P1 · Duolingo path node**: ONE highlighted "current" node; the rest
  of the path is compressed (checkmarks behind, locked ahead). The list
  never shows uniform per-item scores; detail lives one tap deeper.
  → resolves "3, 3, 3": show *summary + current*, not a wall of equals.
- **P2 · Clash Royale mastery / trophy road**: upcoming rewards
  previewed in grayscale/silhouette, filling with color when earned —
  exactly the founder's B/W→color icon proposal. Already half-built in
  BadgeSheet hero (`is-claimed` color vs silhouette).
- **P3 · Candy Crush saga map**: the map is a *destination* for browsing
  progress; the *guide* is a single giant "next level" button. Guide and
  showcase never share a panel.
- **P4 · Forcing Function** (`game-economy-patterns.md#forcing-function-
  for-catalog-awareness`): milestones moments deep-link to the showcase
  surface (BadgeSheet) instead of embedding the showcase in the guide.

## 3. Approved model — one job per surface

| Surface | Job after redistribution |
|---|---|
| MissionDetailSheet | GUIDE only: objective + hint + live "Now: X" line (`getNextChallenge()`, tappable) + save-score button |
| ExerciseDrawer | SELECTOR (canonical path list, interleaved presentation per D6) |
| Unified Piece Sheet (TORRE chip + dock badge button → SAME sheet) | SHOWCASE + SWITCH: hero band, active-piece progress (badge / labyrinths summary / mastery crown, B/W→color), claim CTAs, switch grid |
| Hub MasteryDashboard | Cross-piece glance (already correct, untouched) |

Pattern anchors: P1 (current-node focus), P2 (grayscale→color rewards),
P3 (guide and showcase never share a panel).

## 4. Decision log — FROZEN by founder 2026-06-11

- [x] **D1** — Mission keeps ONLY: objective + avatar hint + one live
      "Now: X" line from `getNextChallenge()` (tappable) + save-score
      button. Score/time pills as standalone block, TrainingPathRail
      and JourneyRail all leave Mission.
- [x] **D2** — TrainingPathRail is DELETED (pure duplicate of the
      drawer, the canonical interactive selector since Slice 3D).
      JourneyRail MIGRATES to the unified Piece Sheet with B/W→color
      milestone icons. No information lost, only duplication.
- [x] **D3** — FULL MERGE: PiecePickerSheet + BadgeSheet become one
      "Piece Sheet". Both entries (TORRE chip in quest tray, badge
      button in dock) open the same sheet: hero band on top,
      active-piece progress middle, switch grid bottom.
      **Guardrail (non-negotiable):** the pedagogy gate survives —
      switch grid stays hidden until the first badge is claimed
      (founder decision 2026-05-31); new players see hero + progress
      only.
- [x] **D4** — Achievements render as grayscale/silhouette and fill
      with color when earned, via CSS filter over EXISTING sprites
      (same technique as BadgeSheet hero `is-claimed`). No new art
      authored (respects no-lotties / authoring-bottleneck phase rule).
- [x] **D5** — Save-score button lives INSIDE Mission, below the
      objective block.
- [x] **D6** — Interleaved path (Ex5→Lab1→Ex6) is PRESENTATION-ONLY:
      the drawer renders nodes interleaved by unlock order;
      `buildTrainingPath()` model is untouched. Closes handoff open
      question (2026-06-11 §Open questions).

## 4b. QA amendments — founder review round (2026-06-11, same day)

Founder QA on device produced 5 findings; these AMEND the frozen log:

- **F2 (amends labyrinth exit)** — the full-width BACK TO EXERCISES
  band visually resurrected the retired tab strip. Exit is now a muted
  `exitLabyrinth` ActionPin in the contextual action row.
- **F3 (new)** — LabyrinthCompleteOverlay is continue-first: primary
  "Continue" exits the lab and lands on the next pending exercise
  (rotation-aware); "Try again" demoted to secondary; the shell X
  shares the Continue intent. King finale keeps Enter Arena.
- **F4 (amends D2 + D3)** — JourneyRail is DELETED, not migrated (its
  info duplicated the hero band + badge cards). The SWITCH PIECE grid
  is gone: the badge cards themselves are the switch (tap → that
  piece's exercises; nested Claim never switches). Pedagogy gate
  unchanged. The B/W→color vocabulary (D4) lives on in the hero
  silhouettes; the rail instance died with the rail.
- **F5 (extends D5)** — Mission save block gains a promise-first line
  ("Keep this score for life") above the explicit "Save score · N"
  action. The "save via TX" second action is DEFERRED: the on-chain
  lane was retired by SaveScore Slice 5 (audit 2026-06-09 §2,
  Leaderboard Proof lane) and ships with the economy narrative spec —
  no dead button before then (fail-closed).
- **F1 (minor)** — PieceComplete "SAVE" → "Save score" (sentence case,
  matches sibling pills). Hierarchy (Try Labyrinth > Start next >
  save) confirmed as-is.

## 4c. QA round 2 + on-chain SAVE revival (2026-06-11, same day)

- **G1** — success auto-advance flows THROUGH the labyrinths:
  `nextPendingLabyrinthAfterExercise()` enters the adjacent available
  lab instead of the next exercise (fresh path ref at timer fire).
- **G2** — Piece Sheet cards respect the linear unlock frontier
  (first piece, claimed pieces, and the one right after a claimed).
- **G3** — off-chain save promise is "Climb the leaderboard"; "for
  life" moved to the on-chain action.
- **G4** — root cause: top-10 LIMIT + 2-min optimistic TTL. Fixed via
  `get_player_rank()` + the LEADERS "Your rank" row.
- **On-chain SAVE revived (founder override of the F5 deferral)** —
  the original gas-only submitScoreSigned flow returns as Mission's
  second action ("Save on-chain" / "Yours for life"); LEADERS marks
  on-chain players (fingerprint seal) via `leaderboard_full_v.has_onchain`.
  Migration `20260611120000` (commit-only; founder applies via
  `supabase db push` from `apps/web`).

## 5. Next steps (not started)

1. Implementation plan: slice the redistribution into atomic commits
   (Mission slim-down → rail deletion → Piece Sheet merge → B/W→color
   → interleaved drawer presentation).
2. VR baselines: mission-detail, piece-picker, badge-sheet baselines
   will all shift — refresh in the same PR per vr-baseline-discipline.
3. Copy pass: new "Now: X" line strings (EN+ES) through
   `editorial.ts` / i18n catalogs; anti-AI-prose rule applies.
4. Telemetry: keep `hub_v2_mastery_*`; consider `training.path_*`
   events landing with Slice 5 (separate cluster).
