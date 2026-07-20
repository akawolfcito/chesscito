-- Persist the operational lifecycle of Get Peones intents without making
-- client reports authoritative for payment confirmation or entitlement.

alter table public.treasury_payment_intents
  add column if not exists lifecycle_status text,
  add column if not exists tx_hash text,
  add column if not exists provider_result_kind text,
  add column if not exists last_error_code text,
  add column if not exists recoverable boolean,
  add column if not exists retry_safe boolean,
  add column if not exists lifecycle_updated_at timestamptz;

-- The foundation trigger rejects every UPDATE. Remove it before the compatible
-- backfill, then recreate it below with operational-column awareness.
drop trigger if exists treasury_payment_intents_immutable
  on public.treasury_payment_intents;

update public.treasury_payment_intents
   set lifecycle_status = coalesce(lifecycle_status, 'CREATED'),
       recoverable = coalesce(recoverable, true),
       retry_safe = coalesce(retry_safe, true),
       lifecycle_updated_at = coalesce(lifecycle_updated_at, created_at);

-- Intents consumed before lifecycle persistence are already authoritatively
-- confirmed. Recover their canonical transaction hash instead of presenting
-- them as newly created/retryable.
update public.treasury_payment_intents as intent
   set lifecycle_status = 'CONFIRMED',
       tx_hash = lower(consumption.tx_hash),
       provider_result_kind = 'TRANSACTION_HASH',
       last_error_code = null,
       recoverable = false,
       retry_safe = false,
       lifecycle_updated_at = greatest(intent.lifecycle_updated_at, consumption.created_at)
  from public.treasury_payment_consumptions as consumption
 where consumption.intent_id = intent.id;

-- Pre-migration rows have no durable submission evidence. An unconsumed row
-- may be abandoned or may represent a broadcast whose provider lost the hash;
-- choosing retry-safe would risk a second charge. Preserve it as ambiguous for
-- operator/on-chain reconciliation instead of guessing a terminal outcome.
update public.treasury_payment_intents as intent
   set lifecycle_status = 'SUBMITTING',
       provider_result_kind = 'AMBIGUOUS_ERROR',
       last_error_code = 'PRE_MIGRATION_STATE_UNKNOWN',
       recoverable = true,
       retry_safe = false,
       lifecycle_updated_at = greatest(intent.lifecycle_updated_at, now())
 where not exists (
   select 1
     from public.treasury_payment_consumptions as consumption
    where consumption.intent_id = intent.id
 );

alter table public.treasury_payment_intents
  alter column lifecycle_status set default 'CREATED',
  alter column lifecycle_status set not null,
  alter column recoverable set default true,
  alter column recoverable set not null,
  alter column retry_safe set default true,
  alter column retry_safe set not null,
  alter column lifecycle_updated_at set default now(),
  alter column lifecycle_updated_at set not null;

do $$
begin
  alter table public.treasury_payment_intents
    add constraint treasury_payment_intents_lifecycle_status_check
    check (lifecycle_status in (
      'CREATED', 'SUBMITTING', 'SUBMITTED', 'CONFIRMED',
      'CANCELLED', 'FAILED', 'EXPIRED', 'REVERTED'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.treasury_payment_intents
    add constraint treasury_payment_intents_tx_hash_check
    check (
      tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.treasury_payment_intents
    add constraint treasury_payment_intents_submitted_hash_check
    check (
      lifecycle_status not in ('SUBMITTED', 'CONFIRMED', 'REVERTED')
      or tx_hash is not null
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.treasury_payment_intents
    add constraint treasury_payment_intents_provider_kind_check
    check (
      provider_result_kind is null or provider_result_kind in (
        'WALLET_REQUESTED', 'TRANSACTION_HASH', 'USER_CANCELLED',
        'PRE_BROADCAST_FAILURE', 'AMBIGUOUS_ERROR', 'UNEXPECTED_RESULT'
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.treasury_payment_intents
    add constraint treasury_payment_intents_error_code_check
    check (
      last_error_code is null
      or (length(last_error_code) between 1 and 64
          and last_error_code ~ '^[A-Za-z0-9_.:-]+$')
    );
exception when duplicate_object then null;
end $$;

create or replace function public.reject_treasury_payment_intent_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'treasury_payment_intent_immutable';
  end if;

  if new.id is distinct from old.id
     or new.wallet is distinct from old.wallet
     or new.sku is distinct from old.sku
     or new.token_address is distinct from old.token_address
     or new.token_symbol is distinct from old.token_symbol
     or new.token_decimals is distinct from old.token_decimals
     or new.expected_amount is distinct from old.expected_amount
     or new.chain_id is distinct from old.chain_id
     or new.treasury_address is distinct from old.treasury_address
     or new.config_version is distinct from old.config_version
     or new.price_version is distinct from old.price_version
     or new.required_confirmations is distinct from old.required_confirmations
     or new.auth_binding is distinct from old.auth_binding
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'treasury_payment_intent_immutable';
  end if;

  if old.tx_hash is not null
     and new.tx_hash is distinct from old.tx_hash
     and not (
       old.lifecycle_status in ('CREATED', 'SUBMITTING', 'SUBMITTED', 'CANCELLED', 'FAILED')
       and new.lifecycle_status in ('SUBMITTED', 'REVERTED')
     ) then
    raise exception 'treasury_payment_intent_tx_hash_immutable';
  end if;

  if not (
    (old.lifecycle_status = 'CREATED' and new.lifecycle_status in
      ('CREATED', 'SUBMITTING', 'SUBMITTED', 'CANCELLED', 'FAILED', 'EXPIRED'))
    or (old.lifecycle_status = 'SUBMITTING' and new.lifecycle_status in
      ('SUBMITTING', 'SUBMITTED', 'CANCELLED', 'FAILED', 'EXPIRED'))
    or (old.lifecycle_status = 'SUBMITTED' and new.lifecycle_status in
      ('SUBMITTED', 'CONFIRMED', 'REVERTED', 'EXPIRED'))
    or (old.lifecycle_status in ('CANCELLED', 'FAILED') and new.lifecycle_status in
      (old.lifecycle_status, 'SUBMITTED', 'REVERTED'))
    or (old.lifecycle_status in ('CONFIRMED', 'EXPIRED', 'REVERTED')
      and new.lifecycle_status = old.lifecycle_status)
  ) then
    raise exception 'invalid_treasury_payment_intent_transition';
  end if;

  return new;
end;
$$;

create trigger treasury_payment_intents_immutable
  before update or delete on public.treasury_payment_intents
  for each row execute function public.reject_treasury_payment_intent_mutation();
