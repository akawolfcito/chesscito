-- db-backed-content Phase 1 — content overlay table.
--
-- Holds only DELTAS over the compiled baseline catalog: new puzzles, edits to a
-- baseline puzzle, and soft-deletes. The player read path stays the compiled
-- generated module; this table is merged on top (Phase 2). Written only by the
-- ADMIN_TOKEN-gated /api/admin/content route via the service-role key.
--
-- Service-role only: RLS is enabled with NO anon/authenticated grants, so the
-- table is unreachable from the client. See docs/specs/db-backed-content.md.

create table if not exists content_overlay (
  id            text not null,
  kind          text not null check (kind in ('exercise','labyrinth')),
  piece         text not null,
  fen           text not null,
  target        text not null,
  mover         text,
  tier          text not null check (tier in ('easy','medium','hard')),
  tags          text[],
  explanation   text,
  "order"       int not null default 0,
  disabled      boolean not null default false,
  optimal_moves int not null,
  updated_at    timestamptz not null default now(),
  primary key (kind, id)
);

alter table content_overlay enable row level security;
