-- Disposable-database test for the manual legacy resolution RPC.
-- This transaction rolls back and never creates consumption or ledger rows.

begin;

insert into public.treasury_payment_intents (
  id, wallet, sku, token_address, token_symbol, token_decimals,
  expected_amount, chain_id, treasury_address, config_version,
  price_version, required_confirmations, auth_binding, expires_at,
  lifecycle_status, tx_hash, provider_result_kind, last_error_code, recoverable, retry_safe
) values
  ('00000000-0000-4000-8000-000000000301', '0x1212121212121212121212121212121212121212', 'peones_pack_50', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 'USDT', 6, 500000, 42220, '0x1234567890abcdef1234567890abcdef12345678', 'canary-v1', 'peones-50-v1', 2, 'client_asserted_wallet', now() + interval '10 minutes', 'SUBMITTING', null, 'AMBIGUOUS_ERROR', 'PRE_MIGRATION_STATE_UNKNOWN', true, false),
  ('00000000-0000-4000-8000-000000000302', '0x3434343434343434343434343434343434343434', 'peones_pack_50', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 'USDT', 6, 500000, 42220, '0x1234567890abcdef1234567890abcdef12345678', 'canary-v1', 'peones-50-v1', 2, 'client_asserted_wallet', now() + interval '10 minutes', 'CONFIRMED', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'TRANSACTION_HASH', null, false, false),
  ('00000000-0000-4000-8000-000000000303', '0x5656565656565656565656565656565656565656', 'peones_pack_50', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 'USDT', 6, 500000, 42220, '0x1234567890abcdef1234567890abcdef12345678', 'canary-v1', 'peones-50-v1', 2, 'client_asserted_wallet', now() + interval '10 minutes', 'SUBMITTING', null, 'AMBIGUOUS_ERROR', 'PRE_MIGRATION_STATE_UNKNOWN', true, false);

insert into public.treasury_payment_consumptions (
  intent_id, chain_id, tx_hash, log_index, wallet, sku, token_address,
  treasury_address, amount_paid, product, source
) values (
  '00000000-0000-4000-8000-000000000303', 42220,
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 0,
  '0x5656565656565656565656565656565656565656', 'peones_pack_50',
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  '0x1234567890abcdef1234567890abcdef12345678', 500000,
  'get_peones', 'treasury'
);

select * from public.resolve_get_peones_legacy_intent(
  '00000000-0000-4000-8000-000000000301', 'EXPIRED',
  'LEGACY_NO_BROADCAST', 'ops:test-fixture', 'service_role:test'
);

do $$
begin
  if not exists (
    select 1 from public.treasury_payment_intents
     where id = '00000000-0000-4000-8000-000000000301'
       and lifecycle_status = 'EXPIRED'
       and retry_safe = true
       and tx_hash is null
  ) then raise exception 'ambiguous intent was not safely expired'; end if;
  if exists (select 1 from public.treasury_payment_consumptions where intent_id = '00000000-0000-4000-8000-000000000301') then
    raise exception 'resolution created a consumption';
  end if;
  begin
    perform * from public.resolve_get_peones_legacy_intent(
      '00000000-0000-4000-8000-000000000302', 'CANCELLED',
      'BAD_CONFIRMED', 'ops:test-fixture', 'service_role:test'
    );
    raise exception 'confirmed intent was resolved';
  exception when others then
    if sqlerrm = 'confirmed intent was resolved' then raise; end if;
  end;
  begin
    perform * from public.resolve_get_peones_legacy_intent(
      '00000000-0000-4000-8000-000000000303', 'FAILED',
      'HAS_CONSUMPTION', 'ops:test-fixture', 'service_role:test'
    );
    raise exception 'intent with consumption was resolved';
  exception when others then
    if sqlerrm = 'intent with consumption was resolved' then raise; end if;
  end;
end $$;

rollback;
