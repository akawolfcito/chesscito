# PR-2 — Supabase Bootstrap: Implementation Spec

**Status**: Ready for execution
**Date**: 2026-03-27
**Phase**: Systems & Content Expansion

---

## 1. PR-2 SUMMARY

1. Install `@supabase/supabase-js` in `apps/web`
2. Add Supabase env vars to `.env.template` (URL + service role key)
3. Create server-only Supabase client (`lib/supabase/server.ts`)
4. Create initial migration SQL with 5 tables
5. Create typed helpers for server-side writes/reads
6. All writes/reads server-side only — no client-side Supabase access
7. Supabase failure must not break core gameplay — all calls are fire-and-forget or gracefully degraded
8. Zero UI changes — this is pure infrastructure

---

## 2. WHAT SUPABASE OWNS NOW

### Yes — stored in Supabase after this PR:
- Practice run records (future: PR-7 will write to these)
- Practice move logs (future: PR-7)
- Coach analysis summaries (future: PR-10)
- Player progress snapshots (future: PR-11)
- Hall of Fame victory index (future: PR-8)

### No — stays where it is:
- Scores → on-chain (Scoreboard contract)
- Badges → on-chain (Badges contract)
- Victories → on-chain (VictoryNFT contract)
- Game state → React state + localStorage
- Coach credits → Redis (Upstash)
- Rate limits → Redis (Upstash)
- Session claims → Redis (Upstash)

---

## 3. SCHEMA

### practice_runs
```sql
create table practice_runs (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  piece text not null,
  exercise_id text not null,
  actual_moves int not null,
  optimal_moves int not null,
  stars_earned int not null check (stars_earned between 1 and 3),
  time_ms int not null,
  was_replay boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_practice_runs_wallet on practice_runs(wallet);
create index idx_practice_runs_wallet_piece on practice_runs(wallet, piece);
```

### practice_move_logs
```sql
create table practice_move_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references practice_runs(id) on delete cascade,
  move_index int not null,
  from_square text not null,
  to_square text not null,
  created_at timestamptz not null default now()
);

create index idx_move_logs_run on practice_move_logs(run_id);
```

### coach_summaries
```sql
create table coach_summaries (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  mode text not null check (mode in ('arena', 'practice')),
  piece text,
  game_id text,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_coach_wallet_mode on coach_summaries(wallet, mode);
```

### player_progress_snapshots
```sql
create table player_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  piece text not null,
  total_stars int not null default 0,
  best_local_score int not null default 0,
  badge_claimed boolean not null default false,
  exercise_breakdown jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),

  unique(wallet, piece)
);

create index idx_progress_wallet on player_progress_snapshots(wallet);
```

### hall_victory_index
```sql
create table hall_victory_index (
  id uuid primary key default gen_random_uuid(),
  token_id bigint not null unique,
  wallet text not null,
  difficulty text not null,
  total_moves int not null,
  time_ms int not null,
  block_number bigint not null,
  tx_hash text not null,
  minted_at timestamptz not null default now()
);

create index idx_hall_wallet on hall_victory_index(wallet);
create index idx_hall_block on hall_victory_index(block_number);
create index idx_hall_minted on hall_victory_index(minted_at desc);
```

---

## 4. FILES TO CREATE/MODIFY

### New files:
- `apps/web/src/lib/supabase/server.ts` — server-only client
- `apps/web/src/lib/supabase/types.ts` — table types
- `apps/web/supabase/migrations/001_initial_schema.sql` — migration

### Modified files:
- `apps/web/.env.template` — add Supabase vars
- `apps/web/package.json` — add `@supabase/supabase-js`

---

## 5. ACCEPTANCE CRITERIA

1. `@supabase/supabase-js` installed and importable
2. Server client connects with service role key
3. Migration SQL creates all 5 tables with correct columns, indexes, and constraints
4. Types match the schema exactly
5. `.env.template` has `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
6. No client-side Supabase access (no `NEXT_PUBLIC_SUPABASE_*` vars)
7. Build passes
8. No UI changes
9. No existing functionality broken
