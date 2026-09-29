# Arena entry telemetry emitter review

**Date:** 2026-09-28\
**Scope:** final consumer review and removal of the two Arena entry emitters. Telemetry remains disabled; cron, retention, database state and deployment configuration were not changed.

## Decision

Both events are **REMOVE EMITTER**. The repository contains no current runtime consumer, RPC/stat, test, or saved query that reads these event names or payloads. Historical diagnostics explain why they were introduced, but no current diagnostic flow consumes the raw rows. No versioned external dashboard/query was found; unversioned external dashboards cannot be ruled out by repository search.

| Event | Previous state | Decision | Runtime emitter after change |
| --- | --- | --- | --- |
| `arena_mount` | Active once-per-mount diagnostic in `apps/web/src/app/[locale]/arena/page.tsx` | REMOVE EMITTER | No |
| `arena_fresh_reset_fired` | Active diagnostic on `?fresh=1` in the same file | REMOVE EMITTER | No |
| `dock_tap` | Already retired | Keep retired; guard against reintroduction | No |
| `dock_center_close` | Already retired | Keep retired; guard against reintroduction | No |
| `arena_select_view` | Already retired; historical mention remains in a source comment | Keep retired; guard against reintroduction | No |

## Consumer and functional review

The event payloads were not inputs to recovery, persistence, routing, Match Reviewer, Coach or reset logic. `arena_mount` recorded mount-time state and local-save presence for a past investigation. `arena_fresh_reset_fired` recorded pre-reset state, but the value was only emitted; no current code read it back. The actual `?fresh=1` effect still checks the query parameter and game status, and still calls `game.reset()` when the status is not `selecting`.

The page continues to emit other distinct Arena events such as `game_persist_outcome`, `arena_game_start`, `arena_game_end`, `arena_x_close_fired`, `arena_pending_nav_consumed`, and Coach navigation/view events. These remain untouched.

## Regression guard

Added an AST-based source guard at `apps/web/src/app/[locale]/arena/__tests__/retired-telemetry-emitter-guard.test.ts`. It scans TypeScript/TSX runtime source under each app's `src`, excludes test/mock directories, resolves direct, aliased and namespace imports of `track` from each app's telemetry module, and ignores comments/docs because it inspects parsed calls. It also tests that comments and historical string declarations are allowed. This avoids line-number or raw-text matching.

The final runtime-source search found only the historical `arena_select_view` comment; no retired event is emitted. The other Arena `track()` calls remain.

## Validation

- Arena test directory, including fresh-entry reset behavior and new regression guard: **7 files, 31 tests passed**.
- TypeScript: `pnpm -C apps/web exec tsc --noEmit` — passed.
- Focused Next lint on changed TSX and test files — passed with no warnings/errors.
- No commit or push.
