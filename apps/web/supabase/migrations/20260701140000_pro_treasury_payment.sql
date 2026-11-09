-- Migration: pro_subscriptions
-- Created: 2026-07-01
-- Purpose: Chesscito PRO purchased via the no-approve single-tx rail
-- (same mechanism as Season Pass / Peones), not Shop.buyItem. The
-- Shop.buyItem PRO path (itemId 6) stays live in parallel; this is a
-- second way to pay for the identical entitlement, not a new product.
--
-- Design notes mirror lite_season_passes exactly:
--   - wallet always lowercase (normalised server-side before INSERT).
--   - idempotency_key UNIQUE: prevents double-credit on retry.
--   - UNIQUE(chain_id, tx_hash, log_index): DB-level anti-replay, same
--     global payment identity already enforced on treasury_payment_consumptions.
--   - expires_at is computed by the CALLER (the route), via the same
--     shared Redis extend-or-set logic (lib/coach/pro-extend.ts) already
--     used by the Shop.buyItem PRO grant path, and passed in as-is. This
--     table does not independently recompute an extension from its own
--     history, because Redis is the single source of truth PRO status is
--     read from everywhere else in the app (coach analyze, hub chip) — if
--     this table computed its own "next expiry" from rows it can see, a
--     wallet that bought PRO via Shop.buyItem (Redis-only, no row here)
--     and then via this rail could have its longer Redis expiry silently
--     overwritten by a shorter one computed from an empty history here.
--   - RLS: service role only; anon/authenticated have no access.

create table if not exists public.pro_subscriptions (
  id               uuid        primary key default gen_random_uuid(),
  wallet           text        not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  sku              text        not null default 'chesscito_pro_30',
  tx_hash          text        not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index        int         not null,
  chain_id         int         not null default 42220,
  token_address    text        not null,
  amount_paid      text        not null,
  idempotency_key  text        not null unique,
  expires_at       timestamptz not null,
  metadata         jsonb,
  created_at       timestamptz not null default now(),

  unique (chain_id, tx_hash, log_index)
);

create index if not exists idx_pro_subscriptions_wallet
  on public.pro_subscriptions (wallet);

create index if not exists idx_pro_subscriptions_wallet_expires_at
  on public.pro_subscriptions (wallet, expires_at desc);

alter table public.pro_subscriptions enable row level security;

create policy "deny_all_direct_client_access"
  on public.pro_subscriptions for all to anon, authenticated
  using (false) with check (false);

-- Chesscito PRO settlement via the no-approve rail. p_expires_at is
-- computed by the caller (Redis extend-or-set, shared with the
-- Shop.buyItem grant path) and recorded here as-is — this function only
-- owns anti-replay + audit, not the extension arithmetic.
create or replace function public.consume_pro_treasury_payment(
  p_chain_id bigint,
  p_tx_hash text,
  p_log_index integer,
  p_wallet text,
  p_sku text,
  p_token_address text,
  p_treasury_address text,
  p_amount_paid numeric,
  p_idempotency_key text,
  p_expires_at timestamptz,
  p_metadata jsonb
)
returns table(
  outcome text,
  subscription_id uuid,
  expires_at timestamptz,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumption public.treasury_payment_consumptions%rowtype;
  v_consumption_id bigint;
  v_sub public.pro_subscriptions%rowtype;
begin
  insert into public.treasury_payment_consumptions (
    chain_id, tx_hash, log_index, wallet, sku, token_address,
    treasury_address, amount_paid, product, source
  ) values (
    p_chain_id, lower(p_tx_hash), p_log_index, lower(p_wallet), p_sku,
    lower(p_token_address), lower(p_treasury_address), p_amount_paid,
    'chesscito_pro', 'legacy_direct'
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
    if v_consumption.product <> 'chesscito_pro'
       or v_consumption.source <> 'legacy_direct'
       or v_consumption.sku <> p_sku
       or v_consumption.wallet <> lower(p_wallet) then
      raise exception 'payment_replay';
    end if;
    if v_consumption.entitlement_id is null then raise exception 'entitlement_incomplete'; end if;
    select * into v_sub from public.pro_subscriptions
     where id = v_consumption.entitlement_id::uuid;
    if not found then raise exception 'entitlement_incomplete'; end if;
    return query select 'duplicate'::text, v_sub.id, v_sub.expires_at, v_sub.metadata;
    return;
  end if;

  insert into public.pro_subscriptions (
    wallet, sku, tx_hash, log_index, chain_id, token_address,
    amount_paid, idempotency_key, expires_at, metadata
  ) values (
    lower(p_wallet), p_sku, lower(p_tx_hash), p_log_index, p_chain_id,
    lower(p_token_address), p_amount_paid::text, p_idempotency_key,
    p_expires_at, p_metadata
  ) returning * into v_sub;

  update public.treasury_payment_consumptions
     set entitlement_id = v_sub.id::text
   where id = v_consumption_id;

  return query select 'credited'::text, v_sub.id, v_sub.expires_at, v_sub.metadata;
end;
$$;

revoke all on function public.consume_pro_treasury_payment(
  bigint, text, integer, text, text, text, text, numeric,
  text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.consume_pro_treasury_payment(
  bigint, text, integer, text, text, text, text, numeric,
  text, timestamptz, jsonb
) to service_role;
