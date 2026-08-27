/**
 * The monitor's SQL, isolated so the guard tests can import it without dragging
 * in `child_process`.
 *
 * ── Ingest rate: windows, never an extrapolation ──────────────────────────
 *
 * Rates are reported per window (15 min / 1 h / 6 h / 24 h) plus the observed
 * peak. What is deliberately NOT produced here is a single "rows per day"
 * headline derived from a short window: two point samples twelve minutes apart
 * suggested ~56 K/day during this build, while the 24 h window says something
 * else again. A short window measures the current minute, not the regime, and
 * labelling it "daily" invents a number nobody measured. The renderer is
 * expected to show the windows side by side and let the shape speak.
 *
 * ── Version handling, and why `to_regclass` is not enough ────────────────
 *
 * Postgres resolves relation names at PARSE time, so a missing view breaks the
 * whole statement even inside `case when to_regclass(...) is null`. The
 * `to_regclass` guards below therefore protect against a *dropped* object, not
 * against an *older server*. For the genuinely version-dependent views the
 * optional blocks are omitted from the SQL entirely and the collector retries.
 *
 * Target is PostgreSQL 17.6 (measured). Relevant split: in PG17 the checkpoint
 * counters moved out of `pg_stat_bgwriter` into `pg_stat_checkpointer`, leaving
 * bgwriter with buffers only. Both are queried with `row_to_json` so column
 * changes across versions never break the statement.
 */

export type SnapshotSqlOptions = {
  /**
   * Blocks whose relations may simply not exist on a given server:
   * `pg_stat_checkpointer` (PG17+), `cron.*` (pg_cron) and
   * `pg_stat_statements` (an extension). Dropped on retry.
   */
  includeOptional: boolean;
};

/**
 * Cumulative counters are meaningless without knowing whether the counter was
 * zeroed between two snapshots — a Nano→Micro resize did exactly that on this
 * project, which is what made `n_live_tup` read as 126 on a 98 K-row table.
 * Every cumulative block therefore carries its own `stats_reset`, and the
 * renderer may only subtract when the two snapshots agree on it.
 */
export function buildSnapshotSql(options: SnapshotSqlOptions): string {
  const optional = options.includeOptional
    ? `
  'checkpointer', (select row_to_json(t) from pg_catalog.pg_stat_checkpointer t),
  -- Unqualified on purpose: the extension lives in the \`extensions\` schema on
  -- Supabase and in \`public\` elsewhere, and both are on the search_path. A
  -- hardcoded schema would break on one of them. Query text arrives already
  -- normalized by pg_stat_statements (literals replaced with $1) and is
  -- truncated regardless, so no user data travels here.
  'statements', json_build_object(
    'by_total_exec_time', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select left(query, 120) as query, calls,
               round(total_exec_time::numeric, 1) as total_exec_time_ms,
               round(mean_exec_time::numeric, 2) as mean_exec_time_ms
        from pg_stat_statements order by total_exec_time desc limit 10
      ) t
    ),
    'by_shared_blks_read', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select left(query, 120) as query, calls, shared_blks_read, shared_blks_hit
        from pg_stat_statements order by shared_blks_read desc limit 10
      ) t
    ),
    'by_temp_blks_read', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select left(query, 120) as query, calls, temp_blks_read
        from pg_stat_statements where temp_blks_read > 0
        order by temp_blks_read desc limit 10
      ) t
    ),
    'by_temp_blks_written', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select left(query, 120) as query, calls, temp_blks_written
        from pg_stat_statements where temp_blks_written > 0
        order by temp_blks_written desc limit 10
      ) t
    )
  ),
  'cron_jobs', (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
    from (select jobid, jobname, schedule, active from cron.job) t
  ),
  'cron_runs', (
    select coalesce(json_agg(row_to_json(t) order by t.start_time desc), '[]'::json)
    from (
      select jobid, status, start_time, end_time,
             left(coalesce(return_message, ''), 120) as return_message
      from cron.job_run_details order by start_time desc limit 12
    ) t
  ),`
    : `
  'checkpointer', null,
  'statements', null,
  'cron_jobs', null,
  'cron_runs', null,`;

  return `
select json_build_object(
  'now', now(),
  'server_version', current_setting('server_version'),
  'db_size_bytes', pg_database_size(current_database()),
  'analytics', json_build_object(
    'heap_bytes',  pg_relation_size('public.analytics_events'),
    'index_bytes', pg_indexes_size('public.analytics_events'),
    'total_bytes', pg_total_relation_size('public.analytics_events'),
    'row_count',   (select count(*) from public.analytics_events),
    'oldest',      (select min(created_at) from public.analytics_events),
    'newest',      (select max(created_at) from public.analytics_events)
  ),
  -- Instantaneous rates. Each window is what it says and nothing more; see the
  -- module header on why none of these is promoted to a daily figure here.
  'ingest_windows', json_build_object(
    'last_15m', json_build_object(
      'minutes', 15,
      'events', (select count(*) from public.analytics_events
                 where created_at > now() - interval '15 minutes'),
      'sessions', (select count(distinct session_id) from public.analytics_events
                   where created_at > now() - interval '15 minutes')
    ),
    'last_1h', json_build_object(
      'minutes', 60,
      'events', (select count(*) from public.analytics_events
                 where created_at > now() - interval '1 hour'),
      'sessions', (select count(distinct session_id) from public.analytics_events
                   where created_at > now() - interval '1 hour')
    ),
    'last_6h', json_build_object(
      'minutes', 360,
      'events', (select count(*) from public.analytics_events
                 where created_at > now() - interval '6 hours'),
      'sessions', (select count(distinct session_id) from public.analytics_events
                   where created_at > now() - interval '6 hours')
    ),
    'last_24h', json_build_object(
      'minutes', 1440,
      'events', (select count(*) from public.analytics_events
                 where created_at > now() - interval '24 hours'),
      'sessions', (select count(distinct session_id) from public.analytics_events
                   where created_at > now() - interval '24 hours')
    )
  ),
  -- Observed peaks over everything still retained. This is the honest ceiling
  -- to size capacity against, rather than whatever the last few minutes did.
  'peaks', json_build_object(
    'busiest_day', (
      select row_to_json(t) from (
        select created_at::date as day, count(*) as events,
               count(distinct session_id) as sessions
        from public.analytics_events group by 1 order by 2 desc limit 1
      ) t
    ),
    'busiest_hour', (
      select row_to_json(t) from (
        select date_trunc('hour', created_at) as hour, count(*) as events
        from public.analytics_events group by 1 order by 2 desc limit 1
      ) t
    )
  ),
  'events_per_hour', (
    select coalesce(json_agg(row_to_json(t) order by t.hour desc), '[]'::json)
    from (
      select date_trunc('hour', created_at) as hour, count(*) as events
      from public.analytics_events
      where created_at > now() - interval '24 hours'
      group by 1
    ) t
  ),
  'daily', (
    select coalesce(json_agg(row_to_json(t) order by t.day desc), '[]'::json)
    from (
      select created_at::date as day,
             count(*) as events,
             count(distinct session_id) as sessions,
             round(count(*)::numeric / nullif(count(distinct session_id), 0), 2)
               as events_per_session
      from public.analytics_events
      where created_at > now() - interval '8 days'
      group by 1
    ) t
  ),
  'top_events_1h', (
    select coalesce(json_agg(row_to_json(t) order by t.events desc), '[]'::json)
    from (
      select event, count(*) as events from public.analytics_events
      where created_at > now() - interval '1 hour'
      group by 1 order by 2 desc limit 20
    ) t
  ),
  'top_events_24h', (
    select coalesce(json_agg(row_to_json(t) order by t.events desc), '[]'::json)
    from (
      select event, count(*) as events from public.analytics_events
      where created_at > now() - interval '24 hours'
      group by 1 order by 2 desc limit 20
    ) t
  ),
  -- Score-save outcomes, named explicitly rather than left to top_events.
  --
  -- ⛔ WHY top_events_24h DOES NOT COVER THIS: that block is a top-20, so an
  -- event drops out of view exactly when it gets rarer — which is the direction
  -- we are trying to observe. score_save_failed was the third noisiest event in
  -- the product (2.332 events, 72,9 per install); the 2026-08-25 fix split it,
  -- sending session_required to score_save_deferred. If the remainder falls out
  -- of the top 20 and the new name never climbs into it, the whole migration is
  -- invisible and reads as lost telemetry.
  --
  -- ⚠️ READ THE PAIR, NEVER ONE ALONE. A collapse in failed is ambiguous on its
  -- own: either the fix worked, or saves stopped being attempted. deferred
  -- picking up the volume is what tells those apart. Same 24h window for both,
  -- so the sum is comparable to what failed used to be by itself.
  'score_saves_24h', (
    select coalesce(json_object_agg(t.event, t.events), '{}'::json)
    from (
      select event, count(*) as events
      from public.analytics_events
      where created_at > now() - interval '24 hours'
        and event in ('score_save_failed', 'score_save_deferred')
      group by 1
    ) t
  ),
  -- DIAGNOSTIC ONLY. This is a top-N sample: it is ordered by the very
  -- quantity one would want to percentile, so no percentile taken over it is
  -- the population's. Deriving the p95 from here reported "the second noisiest
  -- session of the last hour" under a p95 label, and fired a RED over a healthy
  -- system (audit 2026-08-04). The classifier reads session_stats_24h instead.
  'top_sessions_1h', (
    select coalesce(json_agg(row_to_json(t) order by t.events desc), '[]'::json)
    from (
      select left(md5(session_id), 12) as session_digest, count(*) as events
      from public.analytics_events
      where created_at > now() - interval '1 hour'
      group by 1 order by 2 desc limit 20
    ) t
  ),
  -- The percentile the classifier actually uses: computed in PostgreSQL over
  -- EVERY session of the window, never a sample. session_count travels with
  -- it so the report can say how large the population behind the number was.
  'session_stats_24h', (
    select row_to_json(t) from (
      select count(*) as session_count,
             percentile_disc(0.95) within group (order by s.event_count)
               as p95_events,
             percentile_disc(0.50) within group (order by s.event_count)
               as p50_events,
             max(s.event_count) as max_events
      from (
        select session_id, count(*) as event_count
        from public.analytics_events
        where created_at > now() - interval '24 hours'
          and session_id is not null
          and session_id <> ''
        group by 1
      ) s
    ) t
  ),
  'table_stats', (
    select row_to_json(t) from (
      select n_live_tup, n_dead_tup, n_tup_ins, n_tup_del,
             last_autovacuum, last_autoanalyze, last_vacuum, last_analyze
      from pg_stat_user_tables where relname = 'analytics_events'
    ) t
  ),
  'index_stats', (
    select coalesce(json_agg(row_to_json(t) order by t.idx_scan desc), '[]'::json)
    from (
      select indexrelname as index_name, idx_scan,
             pg_relation_size(indexrelid) as size_bytes
      from pg_stat_user_indexes where relname = 'analytics_events'
    ) t
  ),
  -- Cumulative blocks. Each carries stats_reset so a delta can be refused when
  -- the counters were zeroed between snapshots.
  'database', (
    select row_to_json(t) from (
      select stats_reset, xact_commit, xact_rollback, blks_read, blks_hit,
             tup_returned, tup_fetched, tup_inserted, tup_deleted,
             temp_files, temp_bytes, deadlocks, conflicts,
             session_time, active_time, blk_read_time, blk_write_time
      from pg_stat_database where datname = current_database()
    ) t
  ),
  'wal', (select row_to_json(t) from pg_catalog.pg_stat_wal t),
  'bgwriter', (select row_to_json(t) from pg_catalog.pg_stat_bgwriter t),${optional}
  'connections', (
    select row_to_json(t) from (
      select count(*) filter (where state = 'active') as active,
             count(*) filter (where state = 'idle')   as idle,
             count(*) as total
      from pg_stat_activity
    ) t
  )
) as snapshot
`;
}

/** The statement actually shipped in the normal (PostgreSQL 17) case. */
export const SUPABASE_SNAPSHOT_SQL = buildSnapshotSql({ includeOptional: true });
