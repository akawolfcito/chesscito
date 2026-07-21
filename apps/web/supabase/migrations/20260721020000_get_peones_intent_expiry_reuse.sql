-- Get Peones: stop reusing dead intents, so a transient failure cannot lock a
-- wallet out of buying forever.
--
-- create_get_peones_intent() selected any CREATED/SUBMITTING/SUBMITTED row for
-- the wallet+sku+chain+config and returned it instead of minting a new one.
-- It never looked at expires_at, so a row from weeks earlier kept coming back
-- and the caller could never obtain a fresh intent. Combined with the route's
-- unresolved-submission guard, that surfaced as a permanent 409 and the
-- generic "Something went wrong" in MiniPay. Five rows deadlocked the founder
-- wallet on 2026-07-21; two other wallets had been locked out since
-- 2026-07-01. See docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md
--
-- The rule, matching blocksNewIntent() in the route so the two cannot drift:
-- a row is only worth reusing while there is something to reconcile — it
-- carries a tx_hash (a transfer may be on-chain, the verifier must resolve it)
-- or its window is still open. Anything else is dead and gets expired.
--
-- SUBMITTED always carries a hash (treasury_payment_intents_submitted_hash_check),
-- so only CREATED/SUBMITTING rows are ever swept here. Both transitions to
-- EXPIRED are permitted by the lifecycle trigger.

create or replace function public.create_get_peones_intent(
  p_id uuid,
  p_wallet text,
  p_sku text,
  p_token_address text,
  p_token_symbol text,
  p_token_decimals integer,
  p_expected_amount numeric,
  p_chain_id bigint,
  p_treasury_address text,
  p_config_version text,
  p_price_version text,
  p_required_confirmations integer,
  p_auth_binding text,
  p_expires_at timestamptz
)
returns table(intent jsonb, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.treasury_payment_intents%rowtype;
  inserted public.treasury_payment_intents%rowtype;
begin
  perform pg_advisory_xact_lock(
    public.get_peones_intent_lock_key(
      p_wallet, p_sku, p_chain_id, p_config_version
    )
  );

  -- Retire dead locks for this wallet/sku before deciding anything. Never
  -- touches a row with a tx_hash: that money question stays open for the
  -- verifier, at any age.
  update public.treasury_payment_intents
     set lifecycle_status = 'EXPIRED'
   where lower(wallet) = lower(p_wallet)
     and sku = p_sku
     and chain_id = p_chain_id
     and config_version = p_config_version
     and lifecycle_status in ('CREATED', 'SUBMITTING')
     and tx_hash is null
     and expires_at <= now();

  -- Only a LIVE row is worth handing back.
  select * into existing
    from public.treasury_payment_intents
   where lower(wallet) = lower(p_wallet)
     and sku = p_sku
     and chain_id = p_chain_id
     and config_version = p_config_version
     and lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
     and (tx_hash is not null or expires_at > now())
   order by created_at desc, id desc
   limit 1;

  if found then
    return query select to_jsonb(existing), false;
    return;
  end if;

  insert into public.treasury_payment_intents (
    id, wallet, sku, token_address, token_symbol, token_decimals,
    expected_amount, chain_id, treasury_address, config_version,
    price_version, required_confirmations, auth_binding, expires_at,
    lifecycle_status, tx_hash, provider_result_kind, last_error_code,
    recoverable, retry_safe
  ) values (
    p_id, lower(p_wallet), p_sku, lower(p_token_address), p_token_symbol,
    p_token_decimals, p_expected_amount, p_chain_id, lower(p_treasury_address),
    p_config_version, p_price_version, p_required_confirmations, p_auth_binding,
    p_expires_at, 'CREATED', null, null, null, true, true
  ) returning * into inserted;

  return query select to_jsonb(inserted), true;
end;
$$;

revoke all on function public.create_get_peones_intent(
  uuid, text, text, text, text, integer, numeric, bigint, text, text, text,
  integer, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_get_peones_intent(
  uuid, text, text, text, text, integer, numeric, bigint, text, text, text,
  integer, text, timestamptz
) to service_role;
