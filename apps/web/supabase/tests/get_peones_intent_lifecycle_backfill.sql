-- Disposable-database fixture for migration review. Execute inside a test
-- database only; the transaction rolls back and performs no chain calls.
begin;

create temp table intent_fixture (
  id uuid primary key,
  created_at timestamptz not null,
  sku text not null,
  chain_id bigint not null,
  config_version text not null,
  token_address text not null,
  expected_amount numeric not null,
  treasury_address text not null,
  tx_hash text,
  consumed boolean not null,
  lifecycle_status text,
  provider_result_kind text,
  last_error_code text,
  retry_safe boolean
);

insert into intent_fixture values
  ('00000000-0000-4000-8000-000000000001', now() - interval '1 hour', 'peones_pack_50', 42220, 'canary-v1', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 500000, '0x1234567890abcdef1234567890abcdef12345678', null, false, null, null, null),
  ('00000000-0000-4000-8000-000000000002', now() - interval '2 days', 'peones_pack_50', 42220, 'canary-v1', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 500000, '0x1234567890abcdef1234567890abcdef12345678', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', false, null, null, null),
  ('00000000-0000-4000-8000-000000000003', now() - interval '3 days', 'peones_pack_50', 42220, 'canary-v1', '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', 500000, '0x1234567890abcdef1234567890abcdef12345678', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', true, null, null, null);

update intent_fixture
   set lifecycle_status = case when consumed then 'CONFIRMED' else 'SUBMITTING' end,
       provider_result_kind = case when consumed then 'TRANSACTION_HASH'
         when tx_hash is null then 'AMBIGUOUS_ERROR' else 'TRANSACTION_HASH' end,
       last_error_code = case when consumed then null
         when tx_hash is null then 'PRE_MIGRATION_STATE_UNKNOWN'
         else 'PRE_MIGRATION_HASH_UNVERIFIED' end,
       retry_safe = false;

do $$
begin
  if (select count(*) from intent_fixture where lifecycle_status = 'CONFIRMED') <> 1 then
    raise exception 'consumed fixture was not confirmed';
  end if;
  if (select count(*) from intent_fixture where lifecycle_status = 'SUBMITTING' and tx_hash is null and retry_safe = false) <> 1 then
    raise exception 'hashless ambiguous fixture was not fail-closed';
  end if;
  if (select count(*) from intent_fixture where lifecycle_status = 'SUBMITTING' and tx_hash is not null and provider_result_kind = 'TRANSACTION_HASH') <> 1 then
    raise exception 'hash-bearing fixture lost submission evidence';
  end if;
  if exists (
    select 1 from intent_fixture
     where sku <> 'peones_pack_50' or chain_id <> 42220 or config_version <> 'canary-v1'
        or token_address <> '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e'
        or expected_amount <> 500000
        or treasury_address <> '0x1234567890abcdef1234567890abcdef12345678'
  ) then
    raise exception 'commercial terms changed during backfill';
  end if;
  if exists (select 1 from intent_fixture where consumed and lifecycle_status <> 'CONFIRMED') then
    raise exception 'fixture implies credit without confirmed evidence';
  end if;
end $$;

rollback;
