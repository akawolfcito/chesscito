-- Read-only Get Peones lifecycle audit.
-- Safe output: wallet values are represented only by md5(lower(wallet));
-- transaction hashes are represented only by md5(lower(tx_hash)).
-- Sections are labelled pre-deploy, post-migration, or operational review.

-- POST-MIGRATION: lifecycle population and hash coverage.
select count(*) as total_intents,
       count(*) filter (where c.intent_id is not null) as consumed_intents,
       count(*) filter (where c.intent_id is null) as unconsumed_intents,
       count(*) filter (where i.tx_hash is not null) as intents_with_hash,
       count(*) filter (where i.tx_hash is null) as intents_without_hash
  from public.treasury_payment_intents as i
  left join public.treasury_payment_consumptions as c on c.intent_id = i.id;

-- POST-MIGRATION: date distribution. The i. alias is required after the join.
select date_trunc('day', i.created_at) as created_day,
       count(*) as intents,
       count(*) filter (where c.intent_id is not null) as consumed,
       count(*) filter (where c.intent_id is null) as unconsumed
  from public.treasury_payment_intents as i
  left join public.treasury_payment_consumptions as c on c.intent_id = i.id
 group by date_trunc('day', i.created_at)
 order by created_day;

-- POST-MIGRATION: legacy rows and durable evidence approximation.
-- The old warning event was not stored in the table; exact event counts need
-- the log archive. These values are the migration's durable classification.
select i.provider_result_kind,
       i.last_error_code,
       i.lifecycle_status,
       count(*) as intents
  from public.treasury_payment_intents as i
 where i.provider_result_kind = 'AMBIGUOUS_ERROR'
    or i.last_error_code in ('LEGACY_UNKNOWN_SUBMISSION_STATE', 'PRE_MIGRATION_STATE_UNKNOWN')
 group by i.provider_result_kind, i.last_error_code, i.lifecycle_status
 order by i.provider_result_kind, i.last_error_code, i.lifecycle_status;

-- POST-MIGRATION: all lifecycle rows, without exposing full hashes.
select md5(lower(i.wallet)) as wallet_hash,
       i.id as intent_id,
       i.sku,
       i.chain_id,
       i.config_version,
       i.created_at,
       i.lifecycle_status,
       (i.tx_hash is not null) as has_tx_hash,
       i.provider_result_kind,
       i.last_error_code,
       i.recoverable,
       i.retry_safe,
       (c.intent_id is not null) as has_consumption
  from public.treasury_payment_intents as i
  left join public.treasury_payment_consumptions as c on c.intent_id = i.id
 order by i.created_at;

-- POST-MIGRATION: rows that block the canary identity. CREATED is included
-- because the creation RPC/trigger treats every active lifecycle as locked.
select md5(lower(i.wallet)) as wallet_hash,
       i.sku,
       i.chain_id,
       i.config_version,
       count(*) as blocking_intents,
       min(i.created_at) as oldest_created_at,
       max(i.created_at) as newest_created_at,
       bool_or(i.tx_hash is not null) as any_hash,
       bool_or(c.intent_id is not null) as any_consumption
  from public.treasury_payment_intents as i
  left join public.treasury_payment_consumptions as c on c.intent_id = i.id
 where i.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
 group by md5(lower(i.wallet)), i.sku, i.chain_id, i.config_version
 order by oldest_created_at;

-- POST-MIGRATION: configurations outside the active canary are reported
-- separately and must not be treated as canary blockers.
select md5(lower(i.wallet)) as wallet_hash,
       i.id as intent_id,
       i.sku,
       i.chain_id,
       i.config_version,
       i.lifecycle_status,
       (i.tx_hash is not null) as has_tx_hash,
       i.created_at
  from public.treasury_payment_intents as i
 where i.config_version <> 'canary-v1'
    or i.sku <> 'peones_pack_50'
    or i.chain_id <> 42220
 order by i.created_at;

-- POST-MIGRATION: age distribution of active locks.
select count(*) as active_count,
       min(now() - i.created_at) as youngest_age,
       max(now() - i.created_at) as oldest_age,
       percentile_cont(0.50) within group (order by extract(epoch from now() - i.created_at)) * interval '1 second' as p50_age,
       percentile_cont(0.90) within group (order by extract(epoch from now() - i.created_at)) * interval '1 second' as p90_age,
       percentile_cont(0.99) within group (order by extract(epoch from now() - i.created_at)) * interval '1 second' as p99_age
  from public.treasury_payment_intents as i
 where i.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED');

-- POST-MIGRATION: consumption coverage, including legacy orphan rows.
select count(*) as total_consumptions,
       count(*) filter (where c.intent_id is null) as without_intent,
       count(*) filter (where c.intent_id is not null) as with_intent,
       count(*) filter (where c.ledger_id is null) as without_ledger,
       count(*) filter (where c.ledger_id is not null) as with_ledger
  from public.treasury_payment_consumptions as c;

-- OPERATIONAL REVIEW: source/product/metadata shape without metadata values.
-- Consumption rows have no metadata column; linked ledger metadata is shown
-- only through its keys, and orphan consumptions are reported separately.
select c.source,
       c.product,
       count(*) as consumptions,
       count(*) filter (where c.intent_id is null) as orphan_consumptions,
       count(*) filter (where c.ledger_id is null) as unlinked_ledger,
       count(*) filter (where l.metadata is null) as without_ledger_metadata,
       array_agg(distinct key order by key) filter (where key is not null) as ledger_metadata_keys
  from public.treasury_payment_consumptions as c
  left join public.peones_ledger as l on l.id = c.ledger_id
  left join lateral jsonb_object_keys(coalesce(l.metadata, '{}'::jsonb)) as keys(key) on true
 group by c.source, c.product
 order by c.source, c.product;

-- OPERATIONAL REVIEW: orphan consumption identity, grouped safely.
select md5(lower(c.wallet)) as wallet_hash,
       md5(lower(c.tx_hash)) as tx_hash_hash,
       c.chain_id,
       c.sku,
       c.token_address,
       c.treasury_address,
       c.amount_paid,
       c.product,
       c.source,
       c.created_at
  from public.treasury_payment_consumptions as c
 where c.intent_id is null
 order by c.created_at;

-- OPERATIONAL REVIEW: referential consistency between consumption and ledger.
select count(*) filter (where c.intent_id is not null and i.id is null) as missing_intent,
       count(*) filter (where c.ledger_id is not null and l.id is null) as missing_ledger,
       count(*) filter (where c.ledger_id is not null and l.id is not null) as valid_ledger_links
  from public.treasury_payment_consumptions as c
  left join public.treasury_payment_intents as i on i.id = c.intent_id
  left join public.peones_ledger as l on l.id = c.ledger_id;

-- OPERATIONAL REVIEW: temporal matches are investigative only. They do not
-- authorize linking an orphan consumption to an intent.
select md5(lower(i.wallet)) as wallet_hash,
       i.id as intent_id,
       md5(lower(c.tx_hash)) as tx_hash_hash,
       c.created_at as consumption_created_at,
       i.created_at as intent_created_at,
       abs(extract(epoch from (c.created_at - i.created_at))) as seconds_apart
  from public.treasury_payment_intents as i
  join public.treasury_payment_consumptions as c
    on lower(i.wallet) = lower(c.wallet)
   and i.sku = c.sku
   and i.chain_id = c.chain_id
   and lower(i.token_address) = lower(c.token_address)
   and lower(i.treasury_address) = lower(c.treasury_address)
 where c.intent_id is null
 order by seconds_apart;

-- POST-MIGRATION: unambiguous privilege check. Expected anon/authenticated
-- false and service_role true for all payment/admin routines.
select role_name,
       routine_name,
       has_function_privilege(role_name, routine_signature, 'EXECUTE') as effective_execute
  from (values
    ('anon'::name), ('authenticated'::name), ('service_role'::name)
  ) as roles(role_name)
  cross join (values
    ('create_get_peones_intent'::text, 'public.create_get_peones_intent(uuid,text,text,text,text,integer,numeric,bigint,text,text,text,integer,text,timestamptz)'::text),
    ('consume_get_peones_treasury_payment'::text, 'public.consume_get_peones_treasury_payment(uuid,bigint,text,integer,text,text,text,numeric,timestamptz,text,date,jsonb)'::text),
    ('resolve_get_peones_legacy_intent'::text, 'public.resolve_get_peones_legacy_intent(uuid,text,text,text,text)'::text)
  ) as routines(routine_name, routine_signature)
 order by routine_name, role_name;

-- POST-MIGRATION: function security, owner, and fixed search_path.
select n.nspname as schema_name,
       p.proname,
       pg_get_userbyid(p.proowner) as owner_name,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ', '), '') as function_config
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('create_get_peones_intent', 'consume_get_peones_treasury_payment', 'resolve_get_peones_legacy_intent');

-- POST-MIGRATION: installed triggers and exact events/functions.
select t.tgname,
       pg_get_triggerdef(t.oid) as trigger_definition,
       p.proname as trigger_function
  from pg_trigger as t
  join pg_class as c on c.oid = t.tgrelid
  join pg_namespace as n on n.oid = c.relnamespace
  join pg_proc as p on p.oid = t.tgfoid
 where n.nspname = 'public'
   and c.relname = 'treasury_payment_intents'
   and not t.tgisinternal
 order by t.tgname;

-- PRE-DEPLOY / OPERATIONAL REVIEW: the administrative resolution migration
-- is intentionally not invoked by this read-only audit.
