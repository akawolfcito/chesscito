# Telemetry low-signal prune — first pass

**Scope:** remove only low-signal persistent dock interaction events. No schema,
retention, stats RPC, batching, sampling, or feature behavior changes.

## Removed emitters

- `dock_tap` — side and center dock navigation taps in
  `apps/web/src/components/exercises/persistent-dock.tsx`.
- `dock_center_close` — center dock action that closes an open sheet in the
  same component.

The navigation and sheet-close actions are unchanged. The old telemetry audit
reported identical-timestamp bursts for `dock_tap` and recommended reviewing it
as an early reduction candidate (`docs/handoffs/2026-08-04-launch-stabilization-handoff.md`).
No current code consumer or active experiment for these two event names was
found.

## Reviewed and retained

- `coach_viewer_move_jump`, `coach_viewer_replay_scrub`: retained because the
  2026-08-28 core-loop diagnostic uses them as the only signal for Coach viewer
  move/replay navigation. Their future removal needs a product decision about
  losing that signal.
- Arena lifecycle and configuration events: retained because recent disk-IO
  and play-behavior audits use lifecycle events for recovery diagnosis and
  taps for product behavior analysis.
- `sweep_replay_cta_shown`, `sweep_replay_started`: retained as the Star Sweep
  replay conversion denominator/numerator.
- `consequence_shown`: retained as the completion consequence feature's
  explicit measurement signal.
- `training_retry_completed`: retained because retry rate is documented as a
  possible input to per-exercise difficulty tuning.

## Production stats migration check

Read-only `supabase migration list --linked --workdir apps/web` reported
`20260805000000`, `20260805010000`, and
`20260805020000_split_daily_focus_from_training_funnel.sql` applied remotely.
The SQL file's `NOT APPLIED` header is stale. A direct `pg_get_functiondef`
catalog read was attempted through the available Supabase Management API and
returned 401; the repository's read-only query runner could not start because
local `tsx` dependencies are absent. The deployed function bodies were therefore
not independently read in this pass. The post-apply handoff
`docs/handoffs/2026-08-05-stats-rpc-phase-a-post-apply.md` records the eight
RPCs verified live after application. No stats code or aliases were changed.

## Follow-up measurement (read-only)

Compare equivalent traffic windows before/after the next deployment:

1. `/api/telemetry` request counts from Vercel logs, with status/error counts.
2. `analytics_events` insert call deltas and dirtied/written blocks from
   `pg_stat_statements`; use deltas, do not reset counters.
3. Table and index size from catalog size functions; compare growth over the
   same elapsed window and traffic volume.
4. Mean/max duration and block/temp-block deltas for the five required stats
   RPCs from `pg_stat_statements`.
5. Stats refresh success/failure counts and duration from existing refresh
   logs; do not trigger a manual refresh as a measurement probe.

No percentage reduction is claimed. The removed events are only a subset of
client emits, and batching means request-count changes need not match row-count
changes.
