-- pgbench fixture for the legacy direct-insert path in a disposable database.
-- Seven callers should receive the controlled 23505 trigger exception; one
-- caller inserts successfully. No payment or entitlement is involved.

insert into public.treasury_payment_intents (
  id, wallet, sku, token_address, token_symbol, token_decimals,
  expected_amount, chain_id, treasury_address, config_version,
  price_version, required_confirmations, auth_binding, expires_at
) values (
  md5('legacy-' || :client_id)::uuid,
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'peones_pack_50',
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  'USDT', 6, 500000, 42220,
  '0x1234567890abcdef1234567890abcdef12345678',
  'canary-v1', 'peones-50-v1', 2, 'client_asserted_wallet',
  now() + interval '10 minutes'
);
