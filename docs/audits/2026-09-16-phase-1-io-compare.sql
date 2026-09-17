-- Parameterized, read-only SELECT. JSON parameters from io-capture.sql:
-- $1 = BEFORE T0; $2 = BEFORE T0 + 15 min;
-- $3 = AFTER T0;  $4 = AFTER T0 + 15 min.
-- Execute using an existing SQL client supporting bound parameters, or replace
-- $1..$4 with dollar-quoted JSON literals in the SQL editor.
-- This compares interval deltas, NEVER lifetime means or a subtraction of means.
-- It rejects windows containing a reset, statement eviction, disappearing entry
-- or negative counter delta. Capture timestamps also reveal mismatched durations.
WITH samples(period, edge, doc) AS (
  VALUES
    ('before', 'start', $1::jsonb), ('before', 'end', $2::jsonb),
    ('after', 'start', $3::jsonb), ('after', 'end', $4::jsonb)
), windows AS (
  SELECT period,
    max((doc->>'captured_at')::timestamptz) FILTER (WHERE edge = 'start') AS started_at,
    max((doc->>'captured_at')::timestamptz) FILTER (WHERE edge = 'end') AS ended_at,
    max(doc->>'stats_reset') FILTER (WHERE edge = 'start') AS reset_start,
    max(doc->>'stats_reset') FILTER (WHERE edge = 'end') AS reset_end,
    max((doc->>'dealloc')::bigint) FILTER (WHERE edge = 'start') AS dealloc_start,
    max((doc->>'dealloc')::bigint) FILTER (WHERE edge = 'end') AS dealloc_end
  FROM samples GROUP BY period
), expanded AS (
  SELECT s.period, s.edge, r.*
  FROM samples AS s CROSS JOIN LATERAL jsonb_to_recordset(s.doc->'rows') AS r(
    dbid text, userid text, queryid text, toplevel boolean, kind text,
    calls bigint, shared_blks_dirtied bigint, shared_blks_written bigint,
    shared_blks_read bigint, temp_blks_read bigint, temp_blks_written bigint,
    total_exec_time numeric, mean_exec_time numeric
  )
), starts AS (
  SELECT * FROM expanded WHERE edge = 'start'
), ends AS (
  SELECT * FROM expanded WHERE edge = 'end'
), deltas AS (
  SELECT coalesce(e.period, b.period) AS period,
    coalesce(e.kind, b.kind) AS kind,
    e.queryid IS NOT NULL AS end_present,
    coalesce(e.calls, 0) - coalesce(b.calls, 0) AS calls,
    coalesce(e.shared_blks_dirtied, 0) - coalesce(b.shared_blks_dirtied, 0) AS shared_blks_dirtied,
    coalesce(e.shared_blks_written, 0) - coalesce(b.shared_blks_written, 0) AS shared_blks_written,
    coalesce(e.shared_blks_read, 0) - coalesce(b.shared_blks_read, 0) AS shared_blks_read,
    coalesce(e.temp_blks_read, 0) - coalesce(b.temp_blks_read, 0) AS temp_blks_read,
    coalesce(e.temp_blks_written, 0) - coalesce(b.temp_blks_written, 0) AS temp_blks_written,
    coalesce(e.total_exec_time, 0) - coalesce(b.total_exec_time, 0) AS total_exec_time
  FROM starts AS b FULL JOIN ends AS e
    USING (period, dbid, userid, queryid, toplevel)
), validity AS (
  SELECT w.*,
    coalesce(w.reset_start = w.reset_end AND w.dealloc_start = w.dealloc_end AND
      w.ended_at > w.started_at AND NOT EXISTS (
        SELECT 1 FROM deltas AS d WHERE d.period = w.period AND (
          NOT d.end_present OR d.calls < 0 OR d.shared_blks_dirtied < 0 OR
          d.shared_blks_written < 0 OR d.shared_blks_read < 0 OR d.temp_blks_read < 0 OR
          d.temp_blks_written < 0 OR d.total_exec_time < 0
        )
      ), false) AS valid
  FROM windows AS w
), metrics AS (
  SELECT d.period, d.kind, sum(d.calls) AS calls,
    sum(d.shared_blks_dirtied) AS shared_blks_dirtied,
    sum(d.shared_blks_written) AS shared_blks_written,
    sum(d.shared_blks_read) AS shared_blks_read,
    sum(d.temp_blks_read) AS temp_blks_read,
    sum(d.temp_blks_written) AS temp_blks_written,
    sum(d.total_exec_time) AS total_exec_time,
    sum(d.total_exec_time) / nullif(sum(d.calls), 0) AS mean_exec_time
  FROM deltas AS d JOIN validity AS v USING (period)
  WHERE v.valid GROUP BY d.period, d.kind
), ratios AS (
  SELECT period,
    coalesce(sum(calls) FILTER (WHERE kind = 'account_first_seen'), 0) /
      nullif(sum(calls) FILTER (WHERE kind = 'analytics_events'), 0) AS account_first_seen_per_analytics_call
  FROM metrics GROUP BY period
)
SELECT v.period,
  CASE WHEN NOT v.valid THEN 'INVALID: recapture without reset/eviction'
    WHEN abs(extract(epoch FROM (v.ended_at - v.started_at)) - 900) > 5
      THEN 'VALID counters; duration differs from 15 minutes'
    ELSE 'VALID' END AS measurement_status,
  v.started_at, v.ended_at,
  extract(epoch FROM (v.ended_at - v.started_at)) AS elapsed_seconds,
  m.kind, m.calls, m.shared_blks_dirtied, m.shared_blks_written, m.shared_blks_read,
  m.temp_blks_read, m.temp_blks_written, m.total_exec_time, m.mean_exec_time,
  r.account_first_seen_per_analytics_call,
  100 * r.account_first_seen_per_analytics_call AS account_first_seen_percent
FROM validity AS v LEFT JOIN metrics AS m USING (period)
LEFT JOIN ratios AS r USING (period)
ORDER BY v.period, m.kind;
