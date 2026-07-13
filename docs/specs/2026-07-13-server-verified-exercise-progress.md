# Spec — server-verified-exercise-progress

**Date**: 2026-07-13
**Status**: draft
**Supersedes**: the "server-verified progress" line item in `docs/backlog/2026-07-10-backlog-index.md` §4

## Problem

`/api/sign-badge` signs a `BadgeClaim` for **any** `levelId` in `1..10000` for any
address that asks (`route.ts:23`). It never checks whether the player earned the
badge. The 10★ gate (`BADGE_THRESHOLD`) is enforced **only in the client**. The
`Badges` contract prevents claiming the *same* badge twice — it does not prevent
claiming a badge you never earned.

`/api/sign-score` has the identical hole, and `score.ts` already documents it in
its own header:

> *"Nothing ties the `score` in the request body to real progress: progress lives
> in the player's localStorage and the server never sees it. Anyone can POST a
> maximal score for a piece they never played and it will be signed."*

That one is worse, because the score feeds the leaderboard and the prize pool —
it is the path with money attached.

The root cause is the same for both: **there is no server-side record of what a
player did.** The `scores` table is not progress; it is a cache of on-chain
`ScoreSubmitted` events (`tx_hash UNIQUE`, filled by a cron). Progress is
localStorage, and localStorage is the attacker's own machine.

## Goal

The server derives stars from **solutions it re-executed itself**, and refuses to
sign a badge or a score the player has not demonstrably earned.

## Non-goals

- **Labyrinths** (`/api/sign-labyrinth`). Same class of hole, deliberately deferred:
  it is a separate catalog and a separate mint policy. Track it as a follow-up.
- **Retro-fixing already-minted badges.** What is on-chain stays on-chain.
- **Rewriting the client's local progress model.** localStorage stays as the
  optimistic UI cache. It simply stops being *evidence*.
- **Anti-collusion / sybil resistance.** One wallet honestly grinding many
  exercises is a legitimate player. Out of scope.

## Decisions taken (founder, 2026-07-13)

1. **Scope = badge + score together.** One progress substrate serves both. Fixing
   only the badge leaves the leaderboard forgeable.
2. **Grandfathering = on-chain only.** A badge already minted is credited (the
   chain is auditable truth). Un-minted localStorage progress is **not** imported:
   it is unverifiable, and importing it would be signing the blank cheque one last
   time. Honest players re-play; they keep their local stars for UI continuity.
3. **Submission = per exercise, at completion.** The client POSTs the move
   sequence when the exercise is solved. Claim time only reads a bit.

## Contracts (SDD)

```ts
// lib/progress/types.ts

/** A single solved exercise, as the client submits it. NO star count: the
 *  server computes stars. Sending stars would re-open the hole. */
export type ExerciseSolution = {
  piece: PieceId;
  exerciseId: string;
  /** Ordered squares the piece landed on, EXCLUDING startPos and INCLUDING
   *  the final square. `moves.length` is therefore the move count. */
  moves: BoardPosition[];
  /** Wall-clock ms the player took. Advisory only — never an input to stars.
   *  Persisted for the score payload and for anomaly analysis. */
  elapsedMs: number;
};

/** Server's verdict for one submission. */
export type VerificationResult =
  | { ok: true; stars: 0 | 1 | 2 | 3; movesUsed: number; optimalMoves: number }
  | { ok: false; reason: VerificationFailure };

export type VerificationFailure =
  | "unknown-exercise"      // id not in the merged catalog
  | "illegal-move"          // a hop that piece cannot make
  | "blocked-square"        // moved through/onto an obstacle
  | "wrong-start"           // first hop does not originate at startPos
  | "wrong-target"          // final square is not targetPos
  | "missed-capture"        // isCapture exercise that never took the target
  | "too-many-moves";       // beyond the 0-star ceiling; still a legal play

/** Sparse, id-keyed, monotonic-by-max. Mirrors the client's
 *  `ExerciseStarsById` — same shape on both sides, on purpose.
 *  NEVER store an aggregate `totalStars`: the pool grows (the content overlay
 *  appends live) and a stored aggregate goes stale silently. */
export type ExerciseStarsById = Record<string, 0 | 1 | 2 | 3>;

/** The gate `sign-badge` and `sign-score` read. */
export type QualificationBit = {
  player: Address;      // lowercase
  piece: PieceId;
  qualifiedAt: string;  // ISO; set once, never cleared
  starsAtQualification: number;
  source: "verified" | "onchain-grandfathered";
};
```

```sql
-- supabase/migrations/<ts>_exercise_progress.sql

-- One row per (player, exercise). Best-of semantics: stars only ever go UP.
CREATE TABLE IF NOT EXISTS exercise_progress (
  player       text NOT NULL CHECK (player = lower(player)),
  piece        text NOT NULL,
  exercise_id  text NOT NULL,
  stars        smallint NOT NULL CHECK (stars BETWEEN 0 AND 3),
  moves_used   smallint NOT NULL,
  elapsed_ms   int NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_exercise_progress_player_piece
  ON exercise_progress (player, piece);

-- The monotonic gate. Written ONCE, on first crossing. Never deleted, never
-- recomputed from the live catalog.
CREATE TABLE IF NOT EXISTS piece_qualification (
  player                 text NOT NULL CHECK (player = lower(player)),
  piece                  text NOT NULL,
  qualified_at           timestamptz NOT NULL DEFAULT now(),
  stars_at_qualification smallint NOT NULL,
  source                 text NOT NULL CHECK (source IN ('verified','onchain-grandfathered')),
  PRIMARY KEY (player, piece)
);
```

Both tables are **service-role only**. No RLS-exposed client writes — a client
that can write `exercise_progress` is the same hole with extra steps.

## Behavior

### Verification (`POST /api/exercises/verify`)

1. Given a valid `ExerciseSolution`, when the exercise id resolves in the merged
   catalog, then the server replays `moves` from `startPos` using the **same pure
   functions the client uses** (`lib/game/board.ts` legality, `lib/game/scoring.ts`
   `computeStars`) and returns the stars it computed.
2. Given a replay that ends on `targetPos` in `n` moves, then stars follow the
   existing ladder — `n == optimalMoves` → 3★, `n <= optimal+2` → 2★,
   `n <= optimal+4` → 1★, else 0★. **The ladder is not re-implemented**; the route
   imports `computeStars`.
3. Given `ok: true` and `stars` greater than the stored row, then
   `exercise_progress` is upserted (best-of). Given equal or lower stars, the row
   is left alone and the response still reports the *stored* best.
4. Given the upsert makes the player's summed stars for that piece cross
   `BADGE_THRESHOLD`, then `piece_qualification` is inserted with
   `source='verified'` — **once**. A second crossing is a no-op (`ON CONFLICT DO
   NOTHING`), so the bit can never flap.
5. Given any `ok: false`, then nothing is written and the response carries the
   `VerificationFailure`. A rejected solution is not an error the player caused —
   see Edge cases.

### Signing (`/api/sign-badge`, `/api/sign-score`)

6. Given a `sign-badge` request, when `piece_qualification` has **no row** for
   `(player, pieceOf(levelId))`, then respond **403 `not-qualified`** and sign
   nothing.
7. Given a `sign-badge` request with the bit present, then sign exactly as today.
   The bit is the whole gate — the route does **not** re-derive the threshold from
   the live catalog. (A proportional threshold evaluated live would retroactively
   disqualify players as the pool grows; that is why the bit exists.)
8. Given a `sign-score` request, then the server **ignores any `score` in the
   body** and derives it from `exercise_progress`:
   `score = sum(stars for that piece) * POINTS_PER_STAR`. The client's number is
   no longer an input to anything. `MAX_SUBMITTABLE_SCORE` stays as a sanity bound
   on the derived value, not as the control.
9. Given a `sign-score` for a piece with no rows, then respond **403
   `not-qualified`** (a zero score has nothing to submit).

### Grandfathering

10. Given a wallet that already owns badge `levelId` on-chain, when it first hits
    a gated route, then the server reads the `Badges` contract, and on a confirmed
    balance inserts `piece_qualification` with `source='onchain-grandfathered'`.
    Read-through, cached; no bulk backfill job.
11. Given un-minted local progress, then it is **not** imported. The player
    re-plays to re-earn the bit. Their localStorage stars still render, so the UI
    does not appear to wipe their history.

## Edge cases

- **The catalog can disagree with itself.** `getMergedCatalog` has a 60s TTL and a
  2s overlay timeout that **falls back to baseline**. If the client played an
  overlay-authored exercise and the server's overlay fetch times out, the id
  resolves to nothing and an honest solution is rejected as `unknown-exercise`.
  → The verify route MUST NOT fall back to baseline. On overlay failure it returns
  **503 `catalog-unavailable`** and the client retries. Rejecting an honest player
  is worse than delaying them.
- **Offline / failed POST.** The exercise is already solved and celebrated locally.
  The submission queues in localStorage and retries. Progress UI never blocks on the
  network — only *claiming* does.
- **Replay of the same solution.** Idempotent by construction: best-of upsert on
  `(player, exercise_id)`. Re-POSTing a 3★ solution ten times writes 3★ once.
- **A pool shrinks / an exercise is retired.** The `exercise_progress` row survives
  (it is id-keyed, not positional) and simply stops summing, because the sum walks
  the *current* pool. The qualification bit already granted stays granted — that is
  the entire point of it being monotonic.
- **Two devices, same wallet.** Both submit; best-of merges. No conflict.
- **Clock/`elapsedMs` lies.** Accepted: it is advisory and never feeds stars.
- **`isCapture` exercises.** The target square holds a piece; the replay must end
  by capturing it. A path that reaches `targetPos` without the capture flag set is
  `missed-capture`.

## UI states (claim flow)

The spec is not complete without these — per CLAUDE.md, a UI feature enumerates
every state or the bugs surface in QA.

| State | Trigger | UI |
| --- | --- | --- |
| `idle` | default | Claim CTA enabled iff local stars ≥ 10 |
| `syncing` | queued submissions pending | CTA disabled + "Saving your progress…" |
| `not-qualified` | 403 from sign route | CTA disabled + "Finish 10★ on this piece to claim" — **not** an error toast; it is a rule, not a failure |
| `catalog-unavailable` | 503 from verify | Silent retry, backoff. No user-facing error unless claim is attempted |
| `claiming` | signature obtained, tx in flight | existing `ClaimPhase` machinery, unchanged |
| `qualified-but-unclaimed` | bit present, no NFT | Claim CTA enabled — the normal happy path |

**Hard rule:** `not-qualified` must never render as a generic transaction error.
The player who sees it is either a cheater or someone whose sync has not landed —
and the second one deserves an honest, non-alarming message.

## Acceptance criteria

- [ ] A `sign-badge` POST for a wallet with no `piece_qualification` row returns 403
      and signs nothing. **This is the test that would have caught the original bug.**
- [ ] A `sign-score` POST with an inflated `score` in the body returns a signature
      for the **derived** score, not the submitted one.
- [ ] `verify` rejects an illegal move sequence (`illegal-move`) and writes nothing.
- [ ] `verify` rejects a sequence that ends off-target (`wrong-target`).
- [ ] `verify` awards 3★ only for `moves == optimalMoves`, using `computeStars`
      (not a re-implementation).
- [ ] Best-of: a 1★ submission after a 3★ submission leaves the row at 3★.
- [ ] Crossing 10★ writes exactly one `piece_qualification` row; crossing again is
      a no-op.
- [ ] A wallet holding the badge on-chain gets a `onchain-grandfathered` bit and can
      still sign (regression guard for existing players).
- [ ] Overlay timeout → 503, **never** a baseline fallback that rejects a valid id.
- [ ] The verify route is service-role only; no anon client can write progress.

## Out of scope / future

- `/api/sign-labyrinth` — same hole, deferred deliberately.
- `/api/sign-victory` — arena games are a different verification problem (a full
  game replay, not a 4-move path). Needs its own spec.
- Server-authoritative *rotation* (which exercises a player is served).

## Open questions

1. **Does `sign-score` still need a client-supplied `timeMs`?** It is currently
   signed into the payload. If it stays client-supplied it remains forgeable — but
   it only affects tie-breaks. Accept, or derive from `sum(elapsed_ms)`?
2. **Rate limiting the verify route.** It is now the hottest authenticated path
   (one POST per solved exercise). Reuse `enforceRateLimit`, or does per-exercise
   traffic need its own budget?
3. **Grandfathering read cost.** Reading the `Badges` contract on the first gated
   request per wallet adds an RPC hop to a user-blocking path. Cache in
   `piece_qualification` on first read (as specced) — is a cold-start delay on the
   claim acceptable, or should a cron pre-warm known holders?
