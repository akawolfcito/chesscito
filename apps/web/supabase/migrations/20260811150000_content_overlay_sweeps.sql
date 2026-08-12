-- Star Sweep in the builder — the overlay learns multi-goal boards.
--
-- Until now `content_overlay` could not REPRESENT a sweep: it had one `target`
-- and one `optimal_moves`, so a row written over a multi-goal exercise degraded
-- it to a single goal. Both the read path (mergeOverlay) and the write route
-- refuse such a row today, which is correct but leaves the founder unable to
-- author a sweep anywhere except content/exercises.json — by hand, through me.
--
-- Two nullable columns, no default, deployed BEFORE the route that writes them:
--   * every existing row keeps meaning exactly what it means today (NULL targets
--     = a one-goal puzzle, which is what those rows are);
--   * a deployment running the previous code ignores columns it does not select.
--
-- `targets` mirrors the JSON contract: algebraic squares, any collection order,
-- and `target` MUST equal targets[0] (enforced in mapFenPuzzle, not here — the
-- rule needs the board, and a CHECK that cannot see the FEN would be a second,
-- weaker source of truth). `optimal_moves` stays server-computed: for a sweep it
-- is the cheapest ORDER over every target, never an authored number.
--
-- `star_floor` is per-board reward policy (1 or 2). 3 is rejected because a
-- floor of 3 makes every completed run perfect and the grader stops measuring.

alter table content_overlay
  add column if not exists targets    text[],
  add column if not exists star_floor smallint;

-- A sweep is two-to-five squares: one is a plain exercise (use `target`), and
-- the solver enumerates orders, so it caps at five. NULL stays legal — that is
-- every row written before today.
alter table content_overlay
  drop constraint if exists content_overlay_targets_len;
alter table content_overlay
  add constraint content_overlay_targets_len
  check (targets is null or (array_length(targets, 1) between 2 and 5));

alter table content_overlay
  drop constraint if exists content_overlay_star_floor_range;
alter table content_overlay
  add constraint content_overlay_star_floor_range
  check (star_floor is null or star_floor in (1, 2));
