-- Run this SELECT at T0 and T0 + 15 minutes BEFORE and AFTER deployment.
-- Save each resulting JSON object locally, outside the production database.
-- No query text, wallet identifiers, credentials or event payloads are returned.
-- Uses the installed pg_stat_statements extension on the SQL client's search_path.
-- If needed, qualify both extension views with their installed schema, found by:
-- SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
-- WHERE e.extname = 'pg_stat_statements';
WITH normalized AS (
  SELECT s.*, lower(replace(s.query, '"', '')) AS normalized_query
  FROM pg_stat_statements AS s
  WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
), classified AS (
  SELECT
    dbid::text AS dbid,
    userid::text AS userid,
    queryid::text AS queryid,
    toplevel,
    CASE
      WHEN normalized_query ~ '\minsert[[:space:]]+into[[:space:]]+(public\.)?account_first_seen\M'
        THEN 'account_first_seen'
      WHEN normalized_query ~ '\minsert[[:space:]]+into[[:space:]]+(public\.)?session_first_seen\M'
        THEN 'session_first_seen'
      WHEN normalized_query ~ '\minsert[[:space:]]+into[[:space:]]+(public\.)?analytics_events\M'
        THEN 'analytics_events'
      ELSE substring(normalized_query FROM '\m(stats_[a-z_]+)[[:space:]]*\(')
    END AS kind,
    calls,
    shared_blks_dirtied,
    shared_blks_written,
    shared_blks_read,
    temp_blks_read,
    temp_blks_written,
    total_exec_time,
    mean_exec_time
  FROM normalized
)
SELECT jsonb_build_object(
  'captured_at', clock_timestamp(),
  'stats_reset', info.stats_reset,
  'dealloc', info.dealloc,
  'rows', coalesce(
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.kind, c.queryid, c.userid, c.toplevel)
     FROM classified AS c WHERE c.kind IS NOT NULL),
    '[]'::jsonb
  )
) AS measurement
FROM pg_stat_statements_info AS info;
