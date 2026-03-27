-- Chesscito — Initial Supabase schema
-- Derived data layer: practice telemetry, coach summaries, progress snapshots, Hall index
-- On-chain (Celo) remains source of truth for scores, badges, and victories.

-- ── Practice runs ──
-- One row per exercise attempt. Written by /api/practice/log (PR-7).
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

-- ── Practice move logs ──
-- Per-move positions within a run. Enables coach pattern analysis.
create table practice_move_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references practice_runs(id) on delete cascade,
  move_index int not null,
  from_square text not null,
  to_square text not null,
  created_at timestamptz not null default now()
);

create index idx_move_logs_run on practice_move_logs(run_id);

-- ── Coach summaries ──
-- Persisted LLM analysis results. Supports both arena and practice modes.
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

-- ── Player progress snapshots ──
-- Materialized progress per wallet+piece. One row per wallet+piece (upserted).
-- exercise_breakdown: JSONB array of star counts per exercise, e.g. [3, 2, 0, 1, 3]
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

-- ── Hall of Fame victory index ──
-- Materialized from on-chain VictoryMinted events via incremental scan (PR-8).
-- Source of truth remains on-chain; this table enables fast reads.
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
