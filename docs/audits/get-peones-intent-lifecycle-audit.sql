-- Safe read-only audit for treasury_payment_intents.
-- Never select wallet itself in operational output; md5 is only a grouping key.

-- 1. Total, date distribution, consumed/unconsumed, and hash coverage.
select count(*) as total_intents,
       count(*) filter (where c.intent_id is not null) as consumed,
       count(*) filter (where c.intent_id is null) as unconsumed,
       count(*) filter (where i.tx_hash is not null) as with_hash,
       count(*) filter (where i.tx_hash is null) as without_hash
  from public.treasury_payment_intents i
  left join public.treasury_payment_consumptions c on c.intent_id = i.id;

select date_trunc('day', created_at) as created_day,
       count(*) as intents,
       count(*) filter (where c.intent_id is not null) as consumed,
       count(*) filter (where c.intent_id is null) as unconsumed
  from public.treasury_payment_intents i
  left join public.treasury_payment_consumptions c on c.intent_id = i.id
 group by 1 order by 1;

-- 2. Legacy unknown-submission evidence.
-- The foundation did not persist the legacy event body. Therefore an exact
-- historical event count is unavailable from SQL alone. This reports the
-- durable approximation created by the lifecycle migration.
select provider_result_kind, last_error_code, lifecycle_status, count(*)
  from public.treasury_payment_intents
 where provider_result_kind = 'AMBIGUOUS_ERROR'
    or last_error_code in ('LEGACY_UNKNOWN_SUBMISSION_STATE', 'PRE_MIGRATION_STATE_UNKNOWN')
 group by 1, 2, 3 order by 1, 2, 3;

-- 3. Rows backfilled into SUBMITTING and rows that currently block creation.
select md5(lower(i.wallet)) as wallet_hash,
       i.id as intent_id,
       i.sku, i.chain_id, i.config_version,
       i.created_at, i.lifecycle_status, i.tx_hash,
       i.provider_result_kind, i.last_error_code,
       i.recoverable, i.retry_safe,
       (c.intent_id is not null) as consumed
  from public.treasury_payment_intents i
  left join public.treasury_payment_consumptions c on c.intent_id = i.id
 where i.lifecycle_status = 'SUBMITTING'
 order by i.created_at;

select md5(lower(i.wallet)) as wallet_hash,
       i.sku, i.chain_id, i.config_version,
       count(*) as blocking_intents,
       min(i.created_at) as oldest_created_at,
       max(i.created_at) as newest_created_at,
       bool_or(i.tx_hash is not null) as any_hash
  from public.treasury_payment_intents i
 where i.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
 group by 1, 2, 3, 4
 order by oldest_created_at;

-- 4. Wallets affected, grouped only by irreversible hash.
select md5(lower(i.wallet)) as wallet_hash,
       count(*) as legacy_or_blocking_intents,
       min(i.created_at) as first_seen,
       max(i.created_at) as last_seen
  from public.treasury_payment_intents i
 where (i.lifecycle_status = 'SUBMITTING' and i.last_error_code = 'PRE_MIGRATION_STATE_UNKNOWN')
    or i.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
 group by 1 order by first_seen;

-- 5. Age of unresolved rows, including min/max and percentiles.
select count(*) as unresolved_count,
       min(now() - created_at) as youngest_age,
       max(now() - created_at) as oldest_age,
       percentile_cont(0.50) within group (order by extract(epoch from now() - created_at)) * interval '1 second' as p50_age,
       percentile_cont(0.90) within group (order by extract(epoch from now() - created_at)) * interval '1 second' as p90_age,
       percentile_cont(0.99) within group (order by extract(epoch from now() - created_at)) * interval '1 second' as p99_age
  from public.treasury_payment_intents
 where lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED');

-- 6. Configuration guard: legacy rows outside the current canary identity
-- require manual review and must not be used to infer a new payment.
select md5(lower(wallet)) as wallet_hash, id, sku, chain_id, config_version,
       lifecycle_status, tx_hash, created_at
  from public.treasury_payment_intents
 where lifecycle_status = 'SUBMITTING'
   and (sku <> 'peones_pack_50' or chain_id <> 42220 or config_version <> 'canary-v1')
 order by created_at;
