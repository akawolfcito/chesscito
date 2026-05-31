# 2026-05-31 — Defer #14 + Satori investigation + Save Later handoff

**Branch:** `main` · **Range:** `2d50672c..6c016f38` (4 commits, all pushed to `origin/main`)
**Production:** still at `f54f6fc`. **60 commits behind prod promote.**
**Working tree:** clean.

Follow-up to the cleanup marathon handoff (`2026-05-31-cleanup-marathon-handoff.md`). Picked up the open punch list, closed defer #14, ran a deep Satori OG perf investigation (closed without action — recorded as dead-end matrix), and shipped the full Save Later cluster (3 atomic commits closing the 2026-05-27 defer).

## What landed

### Product / refactor

- **Defer #14 closed** (`2d50672c`). `pendingGameIdRef` key-collision bug. `useChessGame` now exposes `gameStartedAt: number` (set on `startGame()`, on resume-from-save back-dated by `savedElapsedMs`, reset to 0 in `reset()`). Arena dedupe key in `apps/web/src/app/[locale]/arena/page.tsx` becomes `${gameStartedAt}:${status}:${moveCount}` — stable within a game, unique across back-to-back matches even with identical terminal stats (e.g., two 4-move Fool's Mates). +4 unit cases on the hook + 2 arena mocks updated. Closes Edge case hunter #1.

- **Save Later cluster shipped** — 3 commits, closes the 2026-05-27 defer ("yours forever IF you tapped at the right moment").
  - **C1 (`38b0cd79`)** — `COACH_COPY.saveAvailable` chip on Training Journal rows when `result === "win" && !mintedTokenId` (LatestReviewCard + OlderReviewRow). `handleSelect` in `coach/history/page.tsx` appends `?focus=save` to the visor URL on those rows. `coach-game-client` reads `focus=save`, scrollIntoViews the `[data-kind="save-victory"]` tile, applies a 3s `data-focused="true"` pulse animation via CSS keyframes in globals. **No auto-fire of the mint signature** — informational highlight only, tap stays the user's conscious action.
  - **C2 (`53f9ddd9`)** — `TROPHY_VITRINE_COPY.saveLaterFromHistoryLink` ("Or save a past victory →") rendered beneath the Arena CTA in the empty trophies state, **gated on `useCoachHistoryCount > 0`** so brand-new users with 0 matches don't dead-end. Dotted-underline secondary style intentionally doesn't compete with the primary Arena push.
  - **C3 (`6c016f38`)** — Sign-victory contract guard test "Save Later: accepts arbitrary past games (no time-window guard in body schema)". Asserts the signed EIP-712 payload stays at exactly 6 fields — if a `gameAge`/`maxAge` field is ever added, the assertion fails and forces a deliberate cluster revisit. `vr8-coach-history-mixed` baseline refreshed (minipay + desktop) — old May 24 capture was stale on two axes (pre-Cluster C "ANALYZE ▶" copy + pre-C1 missing SAVE AVAILABLE chip).

### Investigation (closed without action)

- **Satori OG perf** — full diagnostic. User reported the OG cards loading slower post-`adb19ae4` (16 PNGs re-encoded to RGBA for `@vercel/og` compatibility, P0 fix in late May). Measured `/api/og/match` on prod via curl: cold 4.5s, warm 2.5s (consistent across 5 runs + 2 other endpoints). Bytes per render breakdown showed `panel-mision-icon.png` (337KB) + 20 pieces (~21KB each) hot path; `bg-ch.png` (820KB) is in repo but NEVER fetched (all 4 OG routes pass `bgUrl={null}`).
  - **Dead ends verified:** lossless re-deflate (-1%, useless), JPG (kills alpha, breaks visual), WebP (renders EMPTY in `@vercel/og` runtime per `board-render.tsx:127-129`), downscale source dimensions (panel blocked by `mission-briefing.tsx` browser usage at `max-w-[340px]` × DPR 2-3× → 270 source visibly upscales; pieces-only saves ~60KB → not measurable in TTFB).
  - **Only remaining viable lever:** re-test WebP on current `@vercel/og` runtime via `/api/og/_webp-probe` deploy experiment. The "WebP renders empty" comment is from sometime before 2026-05-28; runtime may have shipped a fix. If green → migrate panel + pieces to WebP for -645KB per `/match` render (≈ -1s TTFB). If red → close the topic, accept 2.5s warm as cost of correctness. Deploy-gated experiment with rollback, not a quick win.
  - Memorialized in `project_satori_og_perf_constraints` memory so the next attempt doesn't repeat the same dead ends.

### Memory + ledger updates

| File | Change |
|---|---|
| `project_satori_og_perf_constraints` (new) | Full dead-end matrix + WebP re-test as the one remaining lever. Includes reproducible curl probe. |
| `project_next_session_content_monetization` (new) | User-set directive: next session starts with content + monetization track. Surface reminder at session start, delete once concrete track is picked. |
| `MEMORY.md` | Two new pointer lines (Satori constraints + NEXT SESSION INTENT). |
| `_bmad-output/.../deferred-work.md` | Defer #14 marked closed (entry rewritten with `2d50672c` verdict). Save Later defer marked closed with full 3-commit verdict. Bulk PNG re-encode defer noted as REJECTED today (would degrade perf without real wins — see Satori memory). |

## State at EOD

- **Tests:** 1899 passing across components + lib + api suites (full sweep after C2). Save Later adds +9 net cases across coach-history, history-page, trophies-body, sign-victory. Defer #14 adds +4 cases on `useChessGame`.
- **VR baselines:** `vr8-coach-history-mixed` refreshed (minipay + desktop). Other coach + vr10 visor baselines re-validated green (8 specs, all bit-identical). No drift introduced by C1/C2/C3.
- **Disk / swap:** session stayed within steady-state. Reboot recommended only if disk pressure climbs above the 8GB mark (didn't trigger).
- **Production gap:** 60 commits between `origin/main@6c016f38` and prod@`f54f6fc`. User promotes manually.

## Ready to grab next session

**User directive at EOD:** pivot to **content + monetization** track. Memory `project_next_session_content_monetization` surfaces this at session start — the next conversation should open with "We had set content + monetization for this session — which angle do you want to start with?" and let the user lead. Don't propose menus.

Once the angle is concretely picked AND scoped, **delete that memory file** so it doesn't become permanent ambient noise.

### Carryover from the cleanup marathon handoff

Still applicable, in priority order:

1. **MiniPay smoke pass** (manual, on-device) — last condition blocking prod promote. Validate Save Later end-to-end on a real device: tap a past unminted win in `/coach/history` → visor opens with Save tile pulsing → tap Save → mint completes in MiniPay → row updates to claimed + token appears in `/trophies`.
2. **`/coach/[gameId]` polish** — Cluster C tail. Needs paint-point screenshots + 3-5 concrete issues from the user before scoping. ~2h.
3. **Save Later from match history + trophy vitrine** — **CLOSED today** (3 commits).

### Open product decisions (require user input)

- **Founder perks UI** — what does Founder unlock beyond the visual chip? Without that answer, surfacing it commits to a UX promise.
- **Persona legal** — `"Operated by Wolfcito"` → `"Operated by Luis Fernando Ushiña"`? Current framing is intentional separation; user decision.

These may end up being the content/monetization angle the user picks. Don't pre-empt — wait for the scope.

### Production promote conditions

Carried forward from the cleanup marathon handoff:

- (a) MiniPay smoke pass against the new surfaces (now including Save Later). ⏳
- ✅ (b) Hint-variant baselines exist.
- ✅ (c) `hub-shop-sheet-open` settle fix re-validated.
- ✅ (d) `vr8-coach-history-mixed` refreshed with SAVE AVAILABLE chip locked.

(b), (c), (d) done; (a) is still the only remaining condition.

## Cluster Closure Protocol checklist

1. **GitHub housekeeping** — no issues opened for any of today's threads; nothing to close.
2. **README sync** — N/A. No contracts deployed; "What's live" surface unchanged. Save Later is UX polish on existing minting plumbing.
3. **MEMORY.md sync** — done: 2 new entries added with one-line pointers.
4. **Branch hygiene** — only `main` touched. No feature branches.
5. **Handoff doc** — this file.

## Pointers

- **First commit of session:** `2d50672c`.
- **Last commit of session:** `6c016f38`.
- **Source handoff:** `docs/handoffs/2026-05-31-cleanup-marathon-handoff.md`.
- **Local-only ledger** (gitignored, in working tree): `_bmad-output/implementation-artifacts/deferred-work.md`.
- **New memory entries:**
  - `project_satori_og_perf_constraints.md` (technical, persistent)
  - `project_next_session_content_monetization.md` (intent, self-deletes after next session scopes)

---

Wolfcito 🐾 @akawolfcito
