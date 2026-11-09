-- ═════════════════════════════════════════════════════════════════
-- Close public access to the three privileged views
-- 2026-08-05 — production audit P0
-- ═════════════════════════════════════════════════════════════════
--
-- THE DEFECT, and it is written down in the repo as a false belief.
-- `20260607000000_peones_ledger_init.sql:261` closes the RLS section with:
--
--     -- Note: the view inherits RLS from the underlying table; no extra
--     -- policy needed.
--
-- That is not how Postgres works. A view does NOT inherit RLS from its base
-- table. Without `security_invoker = true` a view executes with the
-- privileges of its OWNER (here: the migration role), so it reads
-- `peones_ledger` straight past `peones_ledger_own_reads` — the very policy
-- that migration wrote to keep one wallet from reading another's ledger.
--
-- The second half of the hole is Supabase's own default privileges:
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,
-- authenticated, service_role`. Every view created in `public` therefore
-- picks up an EXPLICIT grant to anon. Combined: the anon key could select
-- `wallet, balance, last_event_at, event_count` for EVERY wallet.
--
-- `leaderboard_full_v` and `leaderboard_combined_v` are the same shape. Their
-- contents are less sensitive (the leaderboard is a public product surface),
-- but they are reached the same way and expose the full wallet list, so they
-- are closed here too rather than left as the one exception nobody re-audits.
--
-- WHY THIS BREAKS NOTHING. Every consumer in the app is server-side and holds
-- the service role: `lib/supabase/queries.ts` (leaderboard) and
-- `app/api/peones/balance/route.ts` (balances) both go through
-- `getSupabaseServer()`, which is built from `SUPABASE_SERVICE_ROLE_KEY`
-- (`lib/supabase/server.ts:14`). There is no browser Supabase client at all:
-- `NEXT_PUBLIC_SUPABASE_*` appears nowhere in `apps/web/src`. service_role
-- also bypasses RLS, so `security_invoker` does not change what it reads.
--
-- BOTH STATEMENTS PER VIEW ARE REQUIRED, and each alone is insufficient:
--   * the REVOKE is the control — it is what stops the anon key;
--   * `security_invoker` is defence in depth — it makes RLS apply again if a
--     future migration, or a Supabase default, re-grants SELECT by accident.
-- This mirrors `20260801000000_leaderboard_weekly.sql`, the one view that was
-- built correctly; that slice found the equivalent gap against a live
-- database rather than by review, which is why the check below asserts
-- effective privileges instead of trusting the statements.
--
-- Nothing here touches a TABLE, a POLICY, or any row. No data is at risk and
-- no relation is dropped or redefined.

-- ─────────────────────────────────────────────────────────────────
-- 1. Make the views run as their caller
-- ─────────────────────────────────────────────────────────────────
-- `leaderboard_combined_v` reads `leaderboard_full_v`, so with invoker
-- semantics on both the caller needs SELECT on both. service_role is granted
-- both below.

alter view public.peones_balances        set (security_invoker = true);
alter view public.leaderboard_full_v     set (security_invoker = true);
alter view public.leaderboard_combined_v set (security_invoker = true);

-- ─────────────────────────────────────────────────────────────────
-- 2. Privileges
-- ─────────────────────────────────────────────────────────────────
-- `from public, anon, authenticated` for the same reason the weekly slice
-- documented: revoking from PUBLIC does not remove the explicit per-role
-- grants Supabase's default privileges hand out, and revoking from the two
-- roles alone leaves them holding the privilege through PUBLIC.

revoke select on public.peones_balances        from public, anon, authenticated;
revoke select on public.leaderboard_full_v     from public, anon, authenticated;
revoke select on public.leaderboard_combined_v from public, anon, authenticated;

grant select on public.peones_balances        to service_role;
grant select on public.leaderboard_full_v     to service_role;
grant select on public.leaderboard_combined_v to service_role;

-- ─────────────────────────────────────────────────────────────────
-- 3. Record the correction on the relations themselves
-- ─────────────────────────────────────────────────────────────────
-- The old comment on `peones_balances` is silent about access, and the
-- ledger migration's comment is actively wrong. Both are corrected where the
-- next reader will actually look: `\d+` output.

comment on view public.peones_balances is
  'Sprint 4 — derived per-wallet balance. SUM(ledger) excluding pro_bypass spend rows. NEVER cached as a mutable column anywhere in the app. Not a client-facing relation since 2026-08-05 (prod audit P0): revoked from anon/authenticated and security_invoker, so peones_ledger''s RLS applies. The 2026-06-07 note claiming the view inherits RLS from the base table was false — it never did.';

comment on view public.leaderboard_full_v is
  'Unlimited combined ranking (scores + score_saves, best per player+level, summed). total_score is BIGINT since 2026-07-29 (Slice 0 / audit R13): the previous ::int cast made the whole view raise on overflow, taking Leaders down for everyone. has_onchain = player has at least one row in the on-chain scores table. Server-only since 2026-08-05 (prod audit P0): revoked from anon/authenticated and security_invoker. Reached exclusively through getSupabaseServer().';

comment on view public.leaderboard_combined_v is
  'Top-10 cut of leaderboard_full_v. total_score BIGINT since 2026-07-29. Single source of truth for get_leaderboard() + the TS fallback. Server-only since 2026-08-05 (prod audit P0): revoked from anon/authenticated and security_invoker.';

-- ─────────────────────────────────────────────────────────────────
-- 4. Verification — fails the migration rather than reporting a lie
-- ─────────────────────────────────────────────────────────────────
-- A statement-level review cannot see an effective privilege. This asserts
-- the outcome in the database that just ran the migration.

do $$
declare
  v_rel   text;
  v_role  text;
begin
  foreach v_rel in array array[
    'public.peones_balances',
    'public.leaderboard_full_v',
    'public.leaderboard_combined_v'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_table_privilege(v_role, v_rel, 'select') then
        raise exception
          'P0 not closed: % can still SELECT %', v_role, v_rel;
      end if;
    end loop;

    if not has_table_privilege('service_role', v_rel, 'select') then
      raise exception
        'service_role lost SELECT on % — the app reads this', v_rel;
    end if;

    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname || '.' || c.relname = v_rel
        and c.reloptions @> array['security_invoker=true']
    ) then
      raise exception 'security_invoker not set on %', v_rel;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. Rollback
-- ─────────────────────────────────────────────────────────────────
-- Reversible and explicit. Restores the pre-migration state exactly, which
-- is the INSECURE state — only for backing out an incident, never as a fix.
--
--   alter view public.peones_balances        set (security_invoker = false);
--   alter view public.leaderboard_full_v     set (security_invoker = false);
--   alter view public.leaderboard_combined_v set (security_invoker = false);
--
--   grant select on public.peones_balances        to anon, authenticated;
--   grant select on public.leaderboard_full_v     to anon, authenticated;
--   grant select on public.leaderboard_combined_v to anon, authenticated;
