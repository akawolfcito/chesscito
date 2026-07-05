# PR5 — Dock/Modals Mode-Aware — Session Handoff (2026-07-05)

## Where the work lives

- **Worktree:** `.claude/worktrees/feat-pr5-dock-modes` (absolute:
  `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/.claude/worktrees/feat-pr5-dock-modes`)
- **Branch:** `worktree-feat-pr5-dock-modes`, based on `main@ba6e9cfe` (PR1–PR3B, i.e. mode
  foundation + routing contract + Play hub cleanup + Play Tactics isolation — all already
  merged to `main`).
- **Plan:** `docs/superpowers/plans/2026-07-05-pr5-dock-modals-mode-aware.md` (in this
  worktree — copied there at session start; not on `main`).
- **SDD progress ledger (source of truth for task status):**
  `.superpowers/sdd/progress.md` in this worktree. **Read that file first** — it has a
  line per task with exact commit SHAs and review verdicts, written incrementally as work
  landed. This handoff doc summarizes it; the ledger is authoritative if they ever disagree.
- **`main`'s actual checkout** (the *original*, non-worktree directory) has **unrelated,
  pre-existing uncommitted changes** — PR4 (Learn "Lite"→"Learn" branding rename,
  `app-branding.ts`, manifest/layout copy). Those are NOT part of PR5 and were carefully
  left untouched (see "Incidents" below) — do not touch/discard them.

## Status: 9 of 11 plan tasks done and reviewed. 2 remaining.

| # | Task | Status |
|---|------|--------|
| 1 | Fix leaderboard module-level prefetch, gate on `open` | ✅ done + reviewed (Approved) |
| 2 | Add `PLAY_BADGES_COPY`/`PLAY_LEADERS_COPY` (EN+ES) | ✅ done + reviewed (Approved) |
| 3 | Create `PlayBadgesSheet` | ✅ done + reviewed (Approved — one reviewer finding was a verified false positive, see below) |
| 4 | Create `PlayLeadersSheet` | ✅ done + reviewed (Approved, one Important finding fixed: tokenId-match instead of player-match for optimistic merge) |
| 5 | Create `LearnShopSheet` | ✅ done + reviewed (Approved clean) |
| 6 | Mode-aware `persistent-dock.tsx` | ✅ implemented, committed, **review dispatched but result not yet received when this doc was written** — check for a task-notification from agent, or re-check ledger |
| 7 | Extend `persistent-dock.test.tsx` | ✅ implemented, committed, **same pending combined review as Task 6** (dispatched together, base `ac6c627a`→head `49a75c7a`) |
| 8 | Wire Learn's Shop in `exercises-screen.tsx` | ✅ done + reviewed (Approved clean) |
| 9 | Wire Play effects in `arena/page.tsx` | ✅ done + reviewed (Approved, one Important finding fixed: added legacy-variant test coverage) |
| 10 | Wire Play JSX in `arena/page.tsx` | ✅ done + reviewed (same combined review as Task 9) |
| 11 | Full-branch verification pass | ❌ **NOT STARTED** — full `pnpm --filter web test`, typecheck, build, `git diff --check`, acceptance-criteria trace |

**Immediate next action for whoever picks this up:**
1. Check whether the Task 6+7 combined reviewer (dispatched, agent doing `Review Task 6+7`, diff `ac6c627a..49a75c7a`) has returned a verdict. If not received yet, it may still be running or may need re-dispatching — check for a stray notification first, don't blindly re-dispatch.
2. Once Task 6+7's review is in (fix anything Important/Critical it finds, same pattern as every other task below), move to **Task 11**: run `pnpm --filter web test` (full suite), `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web build` (verify `.next/BUILD_ID` is written — do NOT pipe through `tail`), `git diff --check main` from this worktree, then trace every acceptance criterion in the plan's Task 11 section against the actual diff.
3. After Task 11 is clean, this branch is ready for the user to decide push/PR — do not push or open a PR without asking (per this session's operating rules).

## Full commit history on this branch (in order)

```
0d8c888c feat(config): add Chesscito mode foundation                    } already on
5edb50b8 feat(routing): add Learn and Play domain contract              } main before
21defd5c feat(hub): add Play hub cleanup                                } this session
ba6e9cfe feat(tactics): isolate Play arena warm-up                      } (branch base)
--- PR5 work, this session ---
3aa63549 perf(leaderboard): remove module-level prefetch, gate fetch on sheet open   [Task 1]
04e86c48 feat(content): add PLAY_BADGES_COPY and PLAY_LEADERS_COPY (EN+ES)           [Task 2]
285a11aa feat(play): add PlayBadgesSheet (competitive achievements from Victory NFTs) [Task 3]
b2fec017 feat(play): add PlayLeadersSheet (Arena Hall of Fame, no ELO)               [Task 4]
ac6c627a feat(learn): add LearnShopSheet wrapper around Season Pass                 [Task 5]
13f7323f feat(dock): mode-aware center pin + side items for Play, Shop added to Learn [Task 6]
49a75c7a test(dock): cover Learn Shop addition + Play Arena-pin behavior             [Task 7]
2e76e729 fix(play): match optimistic Hall of Fame entry by tokenId, not player       [Task 4 review-fix]
f1f88e44 feat(learn): wire dock Shop to LearnShopSheet, consolidate Season Pass state [Task 8]
b1ca1c82 feat(play): mount PlayBadgesSheet/PlayLeadersSheet on /arena in Play mode   [Task 9+10]
e85d3249 test(play): cover the legacy-variant arena dock block too                  [Task 9+10 review-fix]
```

All commits verified: `tsc --noEmit` clean at each step, targeted tests passing (test
counts in each commit message), no entitlement/payment/routing/Play-Tactics files touched.

## What changed, functionally (for a reviewer with no other context)

- **`persistent-dock.tsx`**: Play mode's dock center is now permanently pinned to "Arena"
  (never swaps to "Pieces", even on `/arena` itself — tapping it while already on `/arena`
  is a no-op, not a fresh-restart). Play's "leaderboard" fallback route no longer points at
  `/exercises` (unreachable in Play deployments per PR2's routing contract) — it points at
  `/arena` instead. Learn's dock gained a visible "Shop" icon it didn't have before (was
  hidden entirely; now shows, pointing at Season Pass).
- **New `PlayBadgesSheet`** (`components/play/play-badges-sheet.tsx`): Play's "badge" dock
  destination. Reuses the *already-existing* `computeAchievements()` helper — the same one
  `TrophiesBody` already uses for non-Learn achievements — so it shows competitive,
  Victory-NFT-derived achievements, never Learn's piece badges.
- **New `PlayLeadersSheet`** (`components/play/play-leaders-sheet.tsx`): Play's
  "leaderboard" dock destination. Fetches the *already-existing* `/api/hall-of-fame` route
  (global cross-player victories) — no ELO, no durable ranking, victory count only.
- **New `LearnShopSheet`** (`components/learn/learn-shop-sheet.tsx`): thin wrapper around
  the already Learn-gated `SeasonPassSheet`, so Learn's dock never imports the Full/Play
  `ShopSheet` (PRO/Founder Badge/Streak Shields).
- **`exercises-screen.tsx`**: Learn's dock "shop" tap now opens `LearnShopSheet`. The old
  separate `seasonPassSheetOpen` state (used only by the insufficient-Peones recovery CTA)
  was removed and consolidated onto the same `activeDockTab`/`storeOpen` mechanism the dock
  already used — so there's exactly one Season-Pass-driven sheet, never two stacked.
- **`arena/page.tsx`**: in Play mode, the dock's "badge"/"leaderboard" slots mount
  `PlayBadgesSheet`/`PlayLeadersSheet` instead of `BadgeSheet`/`LeaderboardSheet`. Full
  mode's behavior is byte-identical to before (verified by diff inspection in every
  review). `ShopSheet`/`TrophiesSheet` are unchanged for Play too (reused as-is, per spec:
  "Play Shop: Shop/PRO actual", "Play Trophies: actual").
- **`leaderboard-sheet.tsx`** (pre-existing bug, unrelated to mode-awareness but called out
  in the plan's performance section): removed a module-level `/api/leaderboard` prefetch
  that fired on every page import regardless of whether the sheet was ever opened, and
  merged two effects into one properly gated on `open`.
- **`TrophiesSheet` was deliberately left untouched** — it already branches on
  `CHESSCITO_LITE_MODE` internally (Focus/Training achievements for Learn, Victory-NFT
  Hall-of-Fame-plus-achievements for everyone else), which already matches both the Learn
  and Play spec requirements with zero changes needed.

## Incidents this session (all resolved, nothing lost) — read before dispatching more subagents

**Do not dispatch further "implementer" subagents for this plan without reading this
section.** Three consecutive implementer-subagent dispatches (Tasks 1, 2, 3) wrote files
and/or committed to the **wrong repository** — the original `main` checkout at
`/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito`, not this
worktree — despite explicit `cd`-first instructions and correct self-reported
`pwd`/`git branch` confirmations. Root cause: a subagent's Bash tool's `cd` only affects
its own shell's cwd; its Write/Edit tools resolve relative paths against a
harness-registered project root that `cd` does not move. Read-only reviewer subagents can
have the same issue when they do their own exploratory greps outside the given diff file
(happened once, Task 3's review — see below).

All three incidents were caught and cleanly recovered with **zero data loss**: `main`
was restored to its exact prior state (including its own pre-existing uncommitted PR4
branding changes, verified byte-for-byte via diff each time) and the legitimate new work
was manually re-applied at the correct worktree path.

**Per-user decision (mid-session):** given this 3/3 failure rate, the user explicitly
chose to switch strategy for all subsequent tasks (Task 4 onward): **the controller
implements directly** (Read/Edit/Write with absolute worktree paths, controller runs
tests/typecheck/commit itself), while **the read-only task-reviewer subagent dispatch
continues** (that step worked flawlessly every time — 8/8 clean reviews). If you are a
fresh AI picking this up: **follow this same protocol** — do not dispatch implementer
subagents for the remaining task (11 is verification-only, no implementation needed
anyway); if for any reason you need to touch code beyond Task 11's verification, do it
directly rather than via a fresh implementer subagent, or if you do dispatch one, mandate
absolute paths for literally every file operation and verify the actual file location
immediately after, before trusting any self-report.

One reviewer subagent (Task 3's) also hit the same root-cause issue on its own initiative
(grepped the codebase for `PLAY_BADGES_COPY` without an absolute path, found it "missing"
because it checked the wrong repo) — this was caught, verified as a false positive by the
controller directly, and all subsequent reviewer dispatches were given an explicit
"use this absolute path prefix for anything outside the diff" instruction, which fully
resolved it for the remaining 5 reviewer dispatches.

## Two review findings that were real bugs (both fixed, both verified)

1. **Task 4 (`PlayLeadersSheet`)**: optimistic-victory merge matched by player address
   instead of tokenId — a repeat winner's fresh win could get silently dropped if the
   fetched Hall of Fame already contained an OLDER win from the same player. Fixed to
   match by tokenId (mirrors the reference pattern in `trophies-data-provider.tsx`).
   Verified genuine RED (reverted the fix, confirmed the new regression test failed)
   before restoring GREEN. Commit `2e76e729`.
2. **Task 9+10 (`arena/page.tsx`)**: the new test only exercised the "scaffold variant" of
   the page's duplicated dock+sheets JSX block, leaving the "legacy variant"
   (`?arena=legacy`) unverified by any test even though it received the identical manual
   edit. Fixed by making the test's `searchParams` mock controllable per-test and adding a
   second case. Commit `e85d3249`.

## Constraints that held throughout (do not relitigate)

- No changes to PRO/Season-Pass entitlement rules, `/api/verify-pro`, any payment route,
  Treasury/Get-Peones-Canary, `mode-routing.ts`, `app-mode.ts`, `middleware.ts`, any
  landing URL, or Play Tactics storage/localStorage keys.
- `CHESSCITO_LITE_MODE` = canonical Learn flag; `isPlayMode()` = canonical Play flag (both
  from `@/lib/feature-flags`, build-time constants).
- Every sheet's data fetch is gated on `open` — verified per-component, not assumed.
- Every dock slot resolves to exactly one Radix `<Sheet>` open at a time via the existing
  single-state (`activeDockTab`) pattern — no parallel booleans introduced anywhere.
- Full mode's legacy behavior is untouched everywhere (verified byte-identical in every
  review that touched a shared file).

## If context is lost entirely

Read, in this order: (1) this file, (2) `.superpowers/sdd/progress.md` in this worktree
for the authoritative task-by-task ledger, (3) `git log --oneline` in this worktree for
the commit list, (4) the plan file
`docs/superpowers/plans/2026-07-05-pr5-dock-modals-mode-aware.md` for the full original
spec if you need to re-derive *why* something was built a certain way.
