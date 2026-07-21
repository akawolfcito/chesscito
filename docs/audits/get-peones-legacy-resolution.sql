-- MANUAL-ONLY operational runbook. Read-only preview first.
-- Never execute the marked SELECT in production without human approval.

-- PREVIEW: candidates are hashless, unconsumed, non-terminal, and canary-only.
select md5(lower(i.wallet)) as wallet_hash,
       i.id as intent_id,
       i.lifecycle_status,
       i.created_at,
       i.expires_at,
       i.sku,
       i.chain_id,
       i.config_version,
       i.provider_result_kind,
       i.last_error_code,
       i.recoverable,
       i.retry_safe,
       false as has_tx_hash,
       false as has_consumption
  from public.treasury_payment_intents as i
 where i.lifecycle_status in ('CREATED', 'SUBMITTING')
   and i.tx_hash is null
   and i.sku = 'peones_pack_50'
   and i.chain_id = 42220
   and i.config_version = 'canary-v1'
   and not exists (
     select 1 from public.treasury_payment_consumptions as c
      where c.intent_id = i.id
   )
 order by i.created_at;

-- PRECONDITION: run immediately before each approved operation and require
-- exactly one qualifying row. Do not use wallet/amount/time as a substitute.
select count(*) as qualifying_rows
  from public.treasury_payment_intents as i
 where i.id = :'INTENT_ID'
   and i.lifecycle_status in ('CREATED', 'SUBMITTING')
   and i.tx_hash is null
   and i.sku = 'peones_pack_50'
   and i.chain_id = 42220
   and i.config_version = 'canary-v1'
   and not exists (
     select 1 from public.treasury_payment_consumptions as c
      where c.intent_id = i.id
   );

-- APPROVED OPERATION (service_role only; intentionally commented):
-- select * from public.resolve_get_peones_legacy_intent(
--   :'INTENT_ID',
--   'EXPIRED',                 -- or CANCELLED / FAILED after review
--   'LEGACY_NO_BROADCAST',     -- bounded operational code
--   'ops-ticket-123',          -- bounded evidence reference, no secrets
--   'operator-id'              -- bounded administrative actor
-- );

-- POST-CHECK: verify the append-only resolution record and unchanged terms.
select r.id as resolution_id,
       r.intent_id,
       r.previous_status,
       r.new_status,
       r.resolution_code,
       r.evidence_ref,
       r.actor,
       r.resolved_at,
       md5(lower(i.wallet)) as wallet_hash,
       i.sku,
       i.chain_id,
       i.config_version,
       (i.tx_hash is not null) as has_tx_hash,
       exists (select 1 from public.treasury_payment_consumptions c where c.intent_id = i.id) as has_consumption
  from public.treasury_payment_intent_resolutions as r
  join public.treasury_payment_intents as i on i.id = r.intent_id
 where r.intent_id = :'INTENT_ID'
 order by r.resolved_at desc;

-- NO AUTOMATIC ROLLBACK: closure is deliberately irreversible through this
-- RPC. A mistaken closure requires a new approved operational decision; it
-- must never silently reopen an intent or manufacture a payment hash.
