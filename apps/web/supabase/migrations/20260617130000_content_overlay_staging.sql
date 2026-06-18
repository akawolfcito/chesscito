-- content-staging-model slice 2 — versioned overlay rows + transactional promote.
--
-- Widens content_overlay to two-version, per-stage rows: a puzzle id may now hold
-- one row per stage (a live `published` + an in-progress `draft`). PK becomes
-- (kind, id, stage). Existing rows default to `draft` (invisible above dev) so a
-- test left in the shared DB never appears in preview/prod when the new read path
-- turns on. See docs/specs/content-staging-model.md.

-- 1. Maturity column. Existing rows backfill to 'draft'.
alter table content_overlay
  add column if not exists stage text not null default 'draft'
    check (stage in ('draft', 'preview', 'published'));

-- 2. Widen the primary key (kind, id) → (kind, id, stage). Each pre-existing id
--    was unique, so backfilling to 'draft' introduces no PK collision.
alter table content_overlay drop constraint content_overlay_pkey;
alter table content_overlay add primary key (kind, id, stage);

-- 3. Stage ladder rank (immutable helper). draft < preview < published.
create or replace function public.content_stage_rank(s text)
returns int
language sql
immutable
as $$
  select case s
    when 'draft' then 0
    when 'preview' then 1
    when 'published' then 2
    else 99
  end;
$$;

-- 4. Atomic promote/demote (content-staging-model Behavior 4). Moves the `p_from`
--    version of one puzzle to `p_to`, deleting every other version at stage-rank
--    <= rank(p_to) (replace the live published + drop any now-stale lower stage).
--    The whole body runs as ONE transaction (a function call is atomic), so a
--    partial failure can never leave the id with a deleted-published + un-promoted
--    state. Returns 1 when a version was moved, 0 when `p_from` was absent (the
--    caller 404s) — and in the 0 case NOTHING is deleted (guard via the EXISTS).
create or replace function public.promote_content(
  p_kind text,
  p_id   text,
  p_from text,
  p_to   text
)
returns int
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.content_overlay
    where kind = p_kind and id = p_id and stage = p_from
  ) then
    return 0;
  end if;

  delete from public.content_overlay
  where kind = p_kind and id = p_id
    and stage <> p_from
    and public.content_stage_rank(stage) <= public.content_stage_rank(p_to);

  update public.content_overlay
  set stage = p_to, updated_at = now()
  where kind = p_kind and id = p_id and stage = p_from;

  return 1;
end;
$$;

-- Down (manual; the PK narrow needs the table collapsed to one row per (kind,id)
-- first if multiple stages exist):
--   drop function if exists public.promote_content(text, text, text, text);
--   drop function if exists public.content_stage_rank(text);
--   alter table content_overlay drop constraint content_overlay_pkey;
--   alter table content_overlay add primary key (kind, id);
--   alter table content_overlay drop column stage;
