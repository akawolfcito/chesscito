-- Get Peones -> ChesscitoTreasury canary foundation.
-- Dormant until the server-authoritative canary gate is explicitly enabled.

create table if not exists public.treasury_payment_intents (
  id                     uuid        primary key,
  wallet                 text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  sku                    text        not null check (sku = 'peones_pack_50'),
  token_address          text        not null check (token_address ~ '^0x[0-9a-f]{40}$'),
  token_symbol           text        not null,
  token_decimals         integer     not null check (token_decimals between 0 and 36),
  expected_amount        numeric(78, 0) not null check (expected_amount > 0),
  chain_id               bigint      not null check (chain_id = 42220),
  treasury_address       text        not null check (treasury_address ~ '^0x[0-9a-f]{40}$'),
  config_version         text        not null,
  price_version          text        not null,
  required_confirmations integer     not null check (required_confirmations between 1 and 100),
  auth_binding           text        not null check (auth_binding = 'client_asserted_wallet'),
  expires_at             timestamptz not null,
  created_at             timestamptz not null default now()
);

create index if not exists treasury_payment_intents_wallet_created_idx
  on public.treasury_payment_intents (wallet, created_at desc);

create or replace function public.reject_treasury_payment_intent_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'treasury_payment_intent_immutable';
end;
$$;

create trigger treasury_payment_intents_immutable
  before update or delete on public.treasury_payment_intents
  for each row execute function public.reject_treasury_payment_intent_mutation();

create table if not exists public.treasury_payment_consumptions (
  id                bigserial   primary key,
  intent_id         uuid        unique references public.treasury_payment_intents(id),
  chain_id          bigint      not null,
  tx_hash           text        not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index         integer     not null check (log_index >= 0),
  wallet            text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  sku               text        not null,
  token_address     text        not null,
  treasury_address  text        not null,
  amount_paid       numeric(78, 0) not null check (amount_paid > 0),
  product            text        not null,
  source              text        not null,
  entitlement_id      text,
  ledger_id         bigint      references public.peones_ledger(id),
  created_at        timestamptz not null default now(),
  unique (chain_id, tx_hash, log_index)
);

comment on table public.treasury_payment_consumptions is
  'Global source-independent ERC-20 payment identity. One chainId+txHash+logIndex can fund at most one entitlement.';

alter table public.treasury_payment_intents enable row level security;
alter table public.treasury_payment_consumptions enable row level security;

create policy "deny_direct_intent_access"
  on public.treasury_payment_intents for all to anon, authenticated
  using (false) with check (false);

create policy "deny_direct_consumption_access"
  on public.treasury_payment_consumptions for all to anon, authenticated
  using (false) with check (false);

create or replace function public.consume_get_peones_treasury_payment(
  p_intent_id uuid,
  p_chain_id bigint,
  p_tx_hash text,
  p_log_index integer,
  p_wallet text,
  p_token_address text,
  p_treasury_address text,
  p_amount_paid numeric,
  p_tx_mined_at timestamptz,
  p_attestation_hash text,
  p_day_utc date,
  p_metadata jsonb
)
returns table(outcome text, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.treasury_payment_intents%rowtype;
  v_consumption public.treasury_payment_consumptions%rowtype;
  v_consumption_id bigint;
  v_ledger_id bigint;
  v_ledger_key text;
begin
  select * into v_intent
    from public.treasury_payment_intents
   where id = p_intent_id
   for update;

  if not found then raise exception 'intent_not_found'; end if;
  if v_intent.sku <> 'peones_pack_50' then raise exception 'wrong_sku'; end if;
  if v_intent.chain_id <> p_chain_id then raise exception 'wrong_chain'; end if;
  if v_intent.wallet <> lower(p_wallet) then raise exception 'wrong_sender'; end if;
  if v_intent.token_address <> lower(p_token_address) then raise exception 'wrong_token'; end if;
  if v_intent.treasury_address <> lower(p_treasury_address) then raise exception 'wrong_recipient'; end if;
  if p_amount_paid < v_intent.expected_amount then raise exception 'insufficient_amount'; end if;
  if p_tx_mined_at > v_intent.expires_at then raise exception 'expired_intent'; end if;

  insert into public.treasury_payment_consumptions (
    intent_id, chain_id, tx_hash, log_index, wallet, sku,
    token_address, treasury_address, amount_paid, product, source
  ) values (
    p_intent_id, p_chain_id, lower(p_tx_hash), p_log_index, lower(p_wallet),
    v_intent.sku, lower(p_token_address), lower(p_treasury_address), p_amount_paid,
    'get_peones', 'treasury_canary'
  )
  on conflict do nothing
  returning id into v_consumption_id;

  if v_consumption_id is null then
    select * into v_consumption
      from public.treasury_payment_consumptions
     where chain_id = p_chain_id
       and tx_hash = lower(p_tx_hash)
       and log_index = p_log_index;

    if not found or v_consumption.intent_id is distinct from p_intent_id then
      raise exception 'payment_replay';
    end if;
    if v_consumption.ledger_id is null then
      raise exception 'entitlement_incomplete';
    end if;
    return query select 'duplicate'::text, v_consumption.ledger_id;
    return;
  end if;

  v_ledger_key := 'treasury:' || p_chain_id::text || ':' || lower(p_tx_hash) || ':' || p_log_index::text;

  insert into public.peones_ledger (
    wallet, event_type, amount, source, source_id, idempotency_key,
    attestation_hash, metadata, day_utc
  ) values (
    lower(p_wallet), 'earn', 50, 'pack_purchase', 'peones_pack_50',
    v_ledger_key, p_attestation_hash, p_metadata, p_day_utc
  ) returning id into v_ledger_id;

  update public.treasury_payment_consumptions
     set ledger_id = v_ledger_id,
         entitlement_id = v_ledger_id::text
   where id = v_consumption_id;

  return query select 'credited'::text, v_ledger_id;
end;
$$;

revoke all on function public.consume_get_peones_treasury_payment(
  uuid, bigint, text, integer, text, text, text, numeric,
  timestamptz, text, date, jsonb
) from public, anon, authenticated;

grant execute on function public.consume_get_peones_treasury_payment(
  uuid, bigint, text, integer, text, text, text, numeric,
  timestamptz, text, date, jsonb
) to service_role;

-- Legacy direct-transfer Get Peones settlement. The global identity is claimed
-- in the same database transaction that writes the Peones entitlement.
create or replace function public.consume_legacy_get_peones_payment(
  p_chain_id bigint,
  p_tx_hash text,
  p_log_index integer,
  p_wallet text,
  p_sku text,
  p_token_address text,
  p_treasury_address text,
  p_amount_paid numeric,
  p_peones integer,
  p_idempotency_key text,
  p_attestation_hash text,
  p_day_utc date,
  p_metadata jsonb
)
returns table(outcome text, ledger_id bigint, peones_credited integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumption public.treasury_payment_consumptions%rowtype;
  v_consumption_id bigint;
  v_ledger_id bigint;
begin
  insert into public.treasury_payment_consumptions (
    chain_id, tx_hash, log_index, wallet, sku, token_address,
    treasury_address, amount_paid, product, source
  ) values (
    p_chain_id, lower(p_tx_hash), p_log_index, lower(p_wallet), p_sku,
    lower(p_token_address), lower(p_treasury_address), p_amount_paid,
    'get_peones', 'legacy_direct'
  )
  on conflict do nothing
  returning id into v_consumption_id;

  if v_consumption_id is null then
    select * into v_consumption
      from public.treasury_payment_consumptions
     where chain_id = p_chain_id
       and tx_hash = lower(p_tx_hash)
       and log_index = p_log_index;

    if not found then raise exception 'payment_replay'; end if;
    if v_consumption.product <> 'get_peones'
       or v_consumption.source <> 'legacy_direct'
       or v_consumption.sku <> p_sku
       or v_consumption.wallet <> lower(p_wallet) then
      raise exception 'payment_replay';
    end if;
    if v_consumption.ledger_id is null then raise exception 'entitlement_incomplete'; end if;
    return query select 'duplicate'::text, v_consumption.ledger_id, p_peones;
    return;
  end if;

  insert into public.peones_ledger (
    wallet, event_type, amount, source, source_id, idempotency_key,
    attestation_hash, metadata, day_utc
  ) values (
    lower(p_wallet), 'earn', p_peones, 'pack_purchase', p_sku,
    p_idempotency_key, p_attestation_hash, p_metadata, p_day_utc
  ) returning id into v_ledger_id;

  update public.treasury_payment_consumptions
     set ledger_id = v_ledger_id,
         entitlement_id = v_ledger_id::text
   where id = v_consumption_id;

  return query select 'credited'::text, v_ledger_id, p_peones;
end;
$$;

revoke all on function public.consume_legacy_get_peones_payment(
  bigint, text, integer, text, text, text, text, numeric,
  integer, text, text, date, jsonb
) from public, anon, authenticated;
grant execute on function public.consume_legacy_get_peones_payment(
  bigint, text, integer, text, text, text, text, numeric,
  integer, text, text, date, jsonb
) to service_role;

-- Season Pass settlement. This changes no recipient or product semantics; it
-- only makes the existing pass row and the shared payment identity atomic.
create or replace function public.consume_lite_season_pass_payment(
  p_chain_id bigint,
  p_tx_hash text,
  p_log_index integer,
  p_wallet text,
  p_sku text,
  p_season_id text,
  p_token_address text,
  p_treasury_address text,
  p_amount_paid numeric,
  p_idempotency_key text,
  p_shields integer,
  p_supporter_status text,
  p_expires_at timestamptz,
  p_metadata jsonb
)
returns table(
  outcome text,
  pass_id uuid,
  expires_at timestamptz,
  shields_credited integer,
  supporter_status text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumption public.treasury_payment_consumptions%rowtype;
  v_consumption_id bigint;
  v_pass public.lite_season_passes%rowtype;
begin
  insert into public.treasury_payment_consumptions (
    chain_id, tx_hash, log_index, wallet, sku, token_address,
    treasury_address, amount_paid, product, source
  ) values (
    p_chain_id, lower(p_tx_hash), p_log_index, lower(p_wallet), p_sku,
    lower(p_token_address), lower(p_treasury_address), p_amount_paid,
    'lite_season_pass', 'legacy_direct'
  )
  on conflict do nothing
  returning id into v_consumption_id;

  if v_consumption_id is null then
    select * into v_consumption
      from public.treasury_payment_consumptions
     where chain_id = p_chain_id
       and tx_hash = lower(p_tx_hash)
       and log_index = p_log_index;

    if not found then raise exception 'payment_replay'; end if;
    if v_consumption.product <> 'lite_season_pass'
       or v_consumption.source <> 'legacy_direct'
       or v_consumption.sku <> p_sku
       or v_consumption.wallet <> lower(p_wallet) then
      raise exception 'payment_replay';
    end if;
    if v_consumption.entitlement_id is null then raise exception 'entitlement_incomplete'; end if;
    select * into v_pass from public.lite_season_passes
     where id = v_consumption.entitlement_id::uuid;
    if not found then raise exception 'entitlement_incomplete'; end if;
    return query select 'duplicate'::text, v_pass.id, v_pass.expires_at,
      v_pass.shields_credited, v_pass.supporter_status, v_pass.metadata;
    return;
  end if;

  insert into public.lite_season_passes (
    wallet, season_id, sku, tx_hash, log_index, chain_id, token_address,
    amount_paid, idempotency_key, shields_credited, supporter_status,
    expires_at, metadata
  ) values (
    lower(p_wallet), p_season_id, p_sku, lower(p_tx_hash), p_log_index,
    p_chain_id, lower(p_token_address), p_amount_paid::text,
    p_idempotency_key, p_shields, p_supporter_status, p_expires_at, p_metadata
  ) returning * into v_pass;

  update public.treasury_payment_consumptions
     set entitlement_id = v_pass.id::text
   where id = v_consumption_id;

  return query select 'credited'::text, v_pass.id, v_pass.expires_at,
    v_pass.shields_credited, v_pass.supporter_status, v_pass.metadata;
end;
$$;

revoke all on function public.consume_lite_season_pass_payment(
  bigint, text, integer, text, text, text, text, text, numeric,
  text, integer, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.consume_lite_season_pass_payment(
  bigint, text, integer, text, text, text, text, text, numeric,
  text, integer, text, timestamptz, jsonb
) to service_role;
