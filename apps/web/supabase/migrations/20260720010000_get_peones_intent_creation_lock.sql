-- Serialize Get Peones intent creation across tabs, devices, and serverless
-- processes. The lock key is the commercial identity, not a wallet alone.

create or replace function public.get_peones_intent_lock_key(
  p_wallet text,
  p_sku text,
  p_chain_id bigint,
  p_config_version text
)
returns bigint
language sql
immutable
strict
as $$
  select hashtextextended(
    lower(p_wallet) || '|' || p_sku || '|' || p_chain_id::text || '|' || p_config_version,
    0
  )
$$;

create or replace function public.guard_get_peones_intent_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    public.get_peones_intent_lock_key(
      new.wallet, new.sku, new.chain_id, new.config_version
    )
  );

  if exists (
    select 1
      from public.treasury_payment_intents existing
     where lower(existing.wallet) = lower(new.wallet)
       and existing.sku = new.sku
       and existing.chain_id = new.chain_id
       and existing.config_version = new.config_version
       and existing.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
  ) then
    raise exception 'active_get_peones_intent_exists' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists treasury_payment_intents_creation_lock
  on public.treasury_payment_intents;
create trigger treasury_payment_intents_creation_lock
  before insert on public.treasury_payment_intents
  for each row execute function public.guard_get_peones_intent_insert();

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

  select * into existing
    from public.treasury_payment_intents
   where lower(wallet) = lower(p_wallet)
     and sku = p_sku
     and chain_id = p_chain_id
     and config_version = p_config_version
     and lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED')
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

revoke all on function public.get_peones_intent_lock_key(text, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.guard_get_peones_intent_insert()
  from public, anon, authenticated;
revoke all on function public.create_get_peones_intent(
  uuid, text, text, text, text, integer, numeric, bigint, text, text, text,
  integer, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_get_peones_intent(
  uuid, text, text, text, text, integer, numeric, bigint, text, text, text,
  integer, text, timestamptz
) to service_role;
