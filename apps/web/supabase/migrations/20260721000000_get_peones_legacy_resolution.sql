-- Prepare an auditable, manual-only closure path for legacy ambiguous intents.
-- This migration creates schema and an admin RPC only; it performs no data
-- transition. Production execution requires explicit human approval per row.

create table if not exists public.treasury_payment_intent_resolutions (
  id                bigserial primary key,
  intent_id         uuid not null references public.treasury_payment_intents(id),
  previous_status   text not null,
  new_status        text not null check (new_status in ('EXPIRED', 'CANCELLED', 'FAILED')),
  resolution_code   text not null check (resolution_code ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  evidence_ref      text not null check (length(evidence_ref) between 1 and 256),
  actor             text not null check (actor ~ '^[A-Za-z0-9_.:@/-]{1,128}$'),
  resolved_at       timestamptz not null default now()
);

comment on table public.treasury_payment_intent_resolutions is
  'Append-only operational record for explicitly reviewed legacy Get Peones intent closure.';

alter table public.treasury_payment_intent_resolutions enable row level security;
do $$
begin
  create policy deny_direct_intent_resolution_access
    on public.treasury_payment_intent_resolutions
    for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null;
end $$;

create or replace function public.resolve_get_peones_legacy_intent(
  p_intent_id uuid,
  p_new_status text,
  p_resolution_code text,
  p_evidence_ref text,
  p_actor text
)
returns table(
  resolution_id bigint,
  intent_id uuid,
  previous_status text,
  new_status text,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.treasury_payment_intents%rowtype;
  resolution public.treasury_payment_intent_resolutions%rowtype;
begin
  if p_new_status is null or p_new_status not in ('EXPIRED', 'CANCELLED', 'FAILED')
     or p_resolution_code is null
     or p_resolution_code !~ '^[A-Za-z0-9_.:-]{1,64}$'
     or p_evidence_ref is null or length(p_evidence_ref) not between 1 and 256
     or p_actor is null or p_actor !~ '^[A-Za-z0-9_.:@/-]{1,128}$' then
    raise exception 'invalid_legacy_resolution_request' using errcode = '22023';
  end if;

  select * into target
    from public.treasury_payment_intents
   where id = p_intent_id
   for update;

  if not found then
    raise exception 'intent_not_found' using errcode = 'P0002';
  end if;

  if target.lifecycle_status not in ('CREATED', 'SUBMITTING') then
    raise exception 'legacy_resolution_requires_non_terminal_intent' using errcode = '55000';
  end if;
  if target.tx_hash is not null then
    raise exception 'legacy_resolution_requires_hashless_intent' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.treasury_payment_consumptions c where c.intent_id = target.id
  ) then
    raise exception 'legacy_resolution_has_consumption' using errcode = '55000';
  end if;

  insert into public.treasury_payment_intent_resolutions (
    intent_id, previous_status, new_status, resolution_code, evidence_ref, actor
  ) values (
    target.id, target.lifecycle_status, p_new_status, p_resolution_code, p_evidence_ref, p_actor
  ) returning * into resolution;

  update public.treasury_payment_intents
     set lifecycle_status = p_new_status,
         recoverable = false,
         retry_safe = true,
         last_error_code = p_resolution_code,
         lifecycle_updated_at = resolution.resolved_at
   where id = target.id;

  return query select resolution.id, resolution.intent_id, resolution.previous_status,
                      resolution.new_status, resolution.resolved_at;
end;
$$;

revoke all on function public.resolve_get_peones_legacy_intent(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_get_peones_legacy_intent(uuid, text, text, text, text)
  to service_role;
