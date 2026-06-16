"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { BADGE_THRESHOLD, EXERCISES, getExerciseCount } from "@/lib/game/exercises";
import { computeStars } from "@/lib/game/scoring";
import {
  calculateTotalStarsFromIdMap,
  starsIdMapToArray,
} from "@/lib/game/progress-adapter";
import { computeVisibleExerciseIds } from "@/lib/exercises/visible-set";
import {
  getOrCreateGuestSessionId,
  isGuestGraduated,
} from "@/lib/exercises/guest-session";
import { submitTrainingExerciseEarn } from "@/lib/peones/training-earn";
import { emitPeonesEarned } from "@/lib/peones/telemetry";
import { track } from "@/lib/telemetry";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";

/** Optional rotation context (slice E). When omitted or `enabled: false`,
 *  the hook behaves bit-identically to the legacy linear senda. */
export type ExerciseRotationOptions = {
  enabled: boolean;
  /** UTC date string "YYYY-MM-DD" (provided by the caller for
   *  determinism / testability — the hook never reads the clock). */
  dateUtc: string;
  /** Guest session seed when there is no wallet; falls back to the
   *  canonical 5 when both wallet and session seed are absent. */
  sessionSeed?: string | null;
};

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

/** Fresh, empty id-keyed progress for a piece (SSR default + corrupt-data
 *  fallback). Sparse `stars` map: absent id means "not played yet". */
function emptyProgress(piece: PieceId): PieceProgress {
  return { piece, currentId: null, stars: {} };
}

/** Coerce any value into a valid star count: non-numbers/NaN → 0,
 *  clamp to [0, 3], round fractional values. Mirrors the adapter's
 *  internal clamp so the persisted map can never hold an out-of-range
 *  value even if localStorage was hand-edited. */
function clampStars(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return Math.round(value);
}

/** Build a sparse id-map from an arbitrary parsed `stars` object: keeps
 *  only ids present in the current pool, drops zero/absent values (sparse
 *  shape — readers use `?? 0`), and clamps the rest to [0,3]. Unknown ids
 *  are discarded. */
function sanitizeStarsById(
  piece: PieceId,
  raw: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ex of EXERCISES[piece]) {
    const stars = clampStars(raw[ex.id]);
    if (stars > 0) out[ex.id] = stars;
  }
  return out;
}

/**
 * Load + migrate persisted progress to the id-keyed shape.
 *
 * Three input shapes are tolerated:
 *  - Legacy positional `{ exerciseIndex: number, stars: number[] }` —
 *    migrated by CURRENT catalog order: `stars[i]` → `stars[pool[i].id]`,
 *    `currentId = pool[exerciseIndex]?.id`. The migrated id-map shape is
 *    written back so subsequent loads are idempotent (no array left).
 *  - Already id-keyed `{ currentId, stars: Record<id, number> }` —
 *    sanitized (unknown ids dropped, values clamped, sparse). `currentId`
 *    is kept only if it still names a pool exercise, else null.
 *  - Anything missing/corrupt → empty progress.
 */
function loadProgress(piece: PieceId): PieceProgress {
  if (typeof window === "undefined") {
    return emptyProgress(piece);
  }

  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (!raw) {
      return emptyProgress(piece);
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Legacy positional shape: stars is an array. Migrate by catalog order.
    if (Array.isArray(parsed.stars)) {
      const legacyStars = parsed.stars as unknown[];
      const stars: Record<string, number> = {};
      const pool = EXERCISES[piece];
      for (let i = 0; i < pool.length; i += 1) {
        const value = clampStars(legacyStars[i]);
        if (value > 0) stars[pool[i].id] = value;
      }
      const legacyIndex =
        typeof parsed.exerciseIndex === "number" ? parsed.exerciseIndex : 0;
      const currentId = pool[legacyIndex]?.id ?? null;
      const result: PieceProgress = { piece, currentId, stars };
      // Persist the migrated id-map shape (drops the legacy array).
      saveProgress(result);
      return result;
    }

    // Already id-keyed: sanitize. A non-object `stars` is treated as empty.
    const starsObj =
      parsed.stars && typeof parsed.stars === "object"
        ? (parsed.stars as Record<string, unknown>)
        : {};
    const stars = sanitizeStarsById(piece, starsObj);
    const rawCurrentId =
      typeof parsed.currentId === "string" ? parsed.currentId : null;
    const currentId =
      rawCurrentId && EXERCISES[piece].some((ex) => ex.id === rawCurrentId)
        ? rawCurrentId
        : null;
    return { piece, currentId, stars };
  } catch {
    return emptyProgress(piece);
  }
}

function saveProgress(progress: PieceProgress) {
  try {
    localStorage.setItem(storageKey(progress.piece), JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function useExerciseProgress(
  piece: PieceId,
  rotation?: ExerciseRotationOptions,
) {
  /** Sprint 3 commit F — connected wallet drives the Peones earn POST
   *  inside `completeExercise`. Guests skip the call entirely; their
   *  local progress + telemetry stay intact. */
  const { isConnected, address } = useAccount();

  // Inicializar siempre con defaults para que server y cliente rendericen igual
  // (evita hydration mismatch). localStorage se lee después del montaje.
  // Lazy initializer para no recomputar el default en cada render y
  // mantener compatibilidad SSR/CSR.
  const [progress, setProgress] = useState<PieceProgress>(() =>
    emptyProgress(piece),
  );

  /** Tracks whether the post-mount loadProgress effect has run yet.
   *  Sprint 1 commit 6 (Training Economy Alpha 2026-06-05) — gates the
   *  `training_exercise_started` emission so we don't fire on the SSR
   *  default state and immediately re-fire when localStorage settles
   *  to a different exerciseIndex. */
  const [hydrated, setHydrated] = useState(false);

  /** Last exerciseId we emitted `training_exercise_started` for. The
   *  useEffect below fires once per unique id transition, so re-renders
   *  without a slot change emit nothing. */
  const lastStartedRef = useRef<string | null>(null);

  /**
   * Sprint 5 commit B (2026-06-08) — Retry surface support.
   *
   * `attemptSeq` is the in-memory per-attempt counter that:
   *   - starts at 1 when the hook mounts;
   *   - is incremented by ONE per successful Retry spend (commit D);
   *   - resets to 1 whenever `currentExercise.id` changes (piece swap
   *     OR slot navigation OR completion-advance).
   *
   * Persistence: NONE. Reset on reload, reset on navigation. By
   * design — attempts are session-scoped, the ledger uses the
   * idempotency-key chain to guarantee server-side correctness across
   * client state loss.
   *
   * Consumers (commits C/D/E):
   *   - PeonesHintButton will replace its hardcoded `1` with this
   *     value (commit E);
   *   - PeonesRetryButton (commit C/D) will read it to build its
   *     idempotency key and call `incrementAttemptSeq()` on success.
   *
   * This commit is the passive plumbing only — no caller wires up
   * yet, so the runtime behaviour stays bit-identical to Sprint 4.
   */
  const [attemptSeq, setAttemptSeq] = useState(1);
  const incrementAttemptSeq = useCallback(
    () => setAttemptSeq((n) => n + 1),
    [],
  );
  const resetAttemptSeq = useCallback(() => setAttemptSeq(1), []);
  /** Mirrors `lastStartedRef` — track the last exerciseId we reset
   *  the counter for so we don't bounce it on unrelated re-renders
   *  (e.g. an unrelated dep changing in the started-emit effect).  */
  const lastResetExerciseIdRef = useRef<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress(piece));
    setHydrated(true);
  }, [piece]);

  const count = getExerciseCount(piece);
  // `currentId` (an exerciseId) drives navigation; derive the pool index
  // from it so the index-based affordances (telemetry slotIndex,
  // currentExercise, isLastExercise, nav guards) keep working. A null or
  // stale id resolves to the first pool exercise (index 0).
  const currentIdIndex = progress.currentId
    ? EXERCISES[piece].findIndex((ex) => ex.id === progress.currentId)
    : -1;
  const safeIndex = currentIdIndex >= 0 ? currentIdIndex : 0;
  const currentExercise: Exercise = EXERCISES[piece][safeIndex];
  const isLastExercise = safeIndex === count - 1;
  // Badge mastery is the across-pool sum of best stars (each exercise
  // counts ≤3★ once; replays never double-count). The id-map mastery
  // helper makes the across-pool semantics explicit; sparse map → unset
  // ids contribute 0.
  const total = calculateTotalStarsFromIdMap(piece, progress.stars);
  const badgeEarned = total >= BADGE_THRESHOLD;
  const isReplay = (progress.stars[currentExercise.id] ?? 0) > 0;

  /** Rotation Engine (slice E) — the set of exerciseIds to surface today,
   *  or `null` when rotation is disabled (legacy: full pool navigable).
   *  Gates `goToExercise` and is surfaced to the drawer. Progress stays
   *  keyed by pool index / exerciseId — never by a daily slot position. */
  const rotationEnabled = rotation?.enabled ?? false;
  const rotationDateUtc = rotation?.dateUtc ?? "";

  /** Guest rotation seed. Derived POST-MOUNT (never during the initial,
   *  SSR-matching render) so reading/creating the localStorage uuid can't
   *  cause a hydration mismatch. Null when rotation is off, a wallet is
   *  connected (wallet always wins), or the guest hasn't yet completed
   *  the canonical 5 — in those cases the selector falls back to canonical
   *  / wallet. Otherwise the persistent per-device guest session id. */
  const [guestSessionSeed, setGuestSessionSeed] = useState<string | null>(null);
  useEffect(() => {
    // `isGuestGraduated` + the rotation selector still consume the
    // positional stars array; bridge the id-map → array (catalog order).
    const starsArray = starsIdMapToArray(piece, progress.stars);
    if (!rotationEnabled || address || !isGuestGraduated(starsArray)) {
      setGuestSessionSeed(null);
      return;
    }
    setGuestSessionSeed(getOrCreateGuestSessionId());
  }, [rotationEnabled, address, piece, progress.stars]);

  // `rotation.sessionSeed` is a test override; real callers rely on the
  // derived guest seed above. A connected wallet still wins inside
  // computeVisibleExerciseIds (`address ?? sessionSeed`).
  const effectiveSessionSeed = rotation?.sessionSeed ?? guestSessionSeed;
  const visibleExerciseIds = useMemo(
    () =>
      computeVisibleExerciseIds({
        piece,
        enabled: rotationEnabled,
        address: address ?? null,
        sessionSeed: effectiveSessionSeed,
        dateUtc: rotationDateUtc,
        // The visible-set selector still takes a positional stars array;
        // bridge the id-map → array in current catalog order.
        starsArray: starsIdMapToArray(piece, progress.stars),
      }),
    [rotationEnabled, piece, address, effectiveSessionSeed, rotationDateUtc, progress.stars],
  );
  /** Mirror into a ref so `goToExercise` can read the current visible set
   *  without taking it as a dependency (keeps the callback identity
   *  stable — see hook-ref-stability discipline). */
  const visibleIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    visibleIdsRef.current = visibleExerciseIds;
  }, [visibleExerciseIds]);

  useEffect(() => {
    if (!hydrated) return;
    const id = currentExercise.id;
    if (lastStartedRef.current === id) return;
    lastStartedRef.current = id;
    track("training_exercise_started", {
      piece,
      exerciseId: id,
      slotIndex: safeIndex,
      isReplay,
    });
  }, [hydrated, currentExercise.id, piece, safeIndex, isReplay]);

  /**
   * Sprint 5 commit B — reset `attemptSeq` on every exerciseId
   * transition. Independent of the started-emit effect above so
   * either can change without affecting the other (counter never
   * leaks across slots; emit never fires twice for the same id).
   *
   * Fires on initial mount too (initial id transitions from `null`
   * to the first slot's id), which is a no-op when attemptSeq is
   * already at its initial value of 1.
   */
  useEffect(() => {
    const id = currentExercise.id;
    if (lastResetExerciseIdRef.current === id) return;
    lastResetExerciseIdRef.current = id;
    setAttemptSeq(1);
  }, [currentExercise.id]);

  const completeExercise = useCallback(
    (movesUsed: number) => {
      setProgress((prev) => {
        const pieceCount = getExerciseCount(piece);
        // Resolve the active exercise from currentId (fallback: first pool
        // exercise). `idx` is kept for telemetry slotIndex parity.
        const idx = prev.currentId
          ? Math.max(
              0,
              EXERCISES[piece].findIndex((ex) => ex.id === prev.currentId),
            )
          : 0;
        const exercise = EXERCISES[piece][idx];
        const starsForAttempt = computeStars(movesUsed, exercise.optimalMoves);
        const bestStarsBefore = prev.stars[exercise.id] ?? 0;
        const bestStarsAfter = Math.max(
          bestStarsBefore,
          starsForAttempt,
        ) as 0 | 1 | 2 | 3;
        // Write best stars by exerciseId. Sparse map: only set when >0.
        const newStars: Record<string, number> = { ...prev.stars };
        if (bestStarsAfter > 0) newStars[exercise.id] = bestStarsAfter;

        const prevTotal = calculateTotalStarsFromIdMap(piece, prev.stars);
        const newTotal = calculateTotalStarsFromIdMap(piece, newStars);
        const delta = newTotal - prevTotal;
        const wasReplay = bestStarsBefore > 0;

        // Telemetry — fire-and-forget per `track` contract; never blocks
        // the state update. The order here is the chronological order a
        // reviewer would expect when reading the event stream.
        track("training_exercise_completed", {
          piece,
          exerciseId: exercise.id,
          slotIndex: idx,
          movesUsed,
          optimalMoves: exercise.optimalMoves,
          starsEarned: starsForAttempt,
          isReplay: wasReplay,
          bestStarsBefore,
          bestStarsAfter,
        });

        if (delta > 0) {
          track("training_stars_earned", {
            piece,
            exerciseId: exercise.id,
            delta,
            newPieceTotal: newTotal,
          });
        }

        if (prevTotal < BADGE_THRESHOLD && newTotal >= BADGE_THRESHOLD) {
          const exercisesCompleted = EXERCISES[piece].filter(
            (ex) => (newStars[ex.id] ?? 0) > 0,
          ).length;
          track("training_piece_badge_threshold_reached", {
            piece,
            totalStars: newTotal,
            exercisesCompleted,
          });
        }

        // Senda completion: every pool exercise has ≥1★ AND at least one
        // was 0 before this update. The second clause is what prevents
        // the event from re-firing on every replay after the senda
        // already closed.
        const allDoneNow = EXERCISES[piece].every(
          (ex) => (newStars[ex.id] ?? 0) > 0,
        );
        const hadZeroBefore = EXERCISES[piece].some(
          (ex) => (prev.stars[ex.id] ?? 0) === 0,
        );
        if (allDoneNow && hadZeroBefore) {
          track("training_senda_completed", {
            piece,
            totalStars: newTotal,
            exercisesCompleted: pieceCount,
            exerciseCount: pieceCount,
          });
        }

        // Sprint 3 commit F — Peones earn for the Senda exercise. Fire
        // and forget. Local progress + persistence + telemetry already
        // happened above; the earn POST is the LAST step and never
        // blocks or reverts anything. Gates:
        //   - connected wallet (guest path skipped)
        //   - delta of best stars strictly positive (replay without
        //     improvement, worse score, or untouched slot all skip)
        // The helper itself short-circuits delta<=0 defensively too.
        const deltaBestStars = bestStarsAfter - bestStarsBefore;
        if (isConnected && address && deltaBestStars > 0) {
          // Sprint 3 commit H — capture the result so we can emit
          // `peones_earned`. Errors stay swallowed (fire-and-forget);
          // exercise_completion is NOT a daily-family source so
          // capReached is always false and peones_cap_reached
          // never fires from this surface.
          submitTrainingExerciseEarn({
            wallet: address,
            piece,
            exerciseId: exercise.id,
            bestStarsBefore,
            bestStarsAfter,
          })
            .then((result) => {
              if (result.kind === "success" && result.credited > 0) {
                emitPeonesEarned({
                  source: "exercise_completion",
                  sourceId: `${piece}:${exercise.id}`,
                  requested: deltaBestStars,
                  credited: result.credited,
                  capReached: false,
                  newBalance: result.newBalance,
                  dailyEarnedCapped: result.dailyEarnedCapped,
                  dailyCap: result.dailyCap,
                  attestationHash: result.attestationHash,
                  duplicate: result.duplicate,
                });
              }
            })
            .catch(() => {
              /* swallow — earn helper already never throws, but
               * defensive in case a future refactor changes that. */
            });
        }

        const next: PieceProgress = { ...prev, stars: newStars };
        saveProgress(next);
        return next;
      });
    },
    [piece, isConnected, address]
  );

  const advanceExercise = useCallback(() => {
    setProgress((prev) => {
      const pool = EXERCISES[piece];
      const curIdx = prev.currentId
        ? pool.findIndex((ex) => ex.id === prev.currentId)
        : 0;
      const idx = curIdx >= 0 ? curIdx : 0;
      if (idx >= pool.length - 1) return prev;
      const next: PieceProgress = { ...prev, currentId: pool[idx + 1].id };
      saveProgress(next);
      return next;
    });
  }, [piece]);

  const goToExercise = useCallback((index: number) => {
    setProgress((prev) => {
      const pool = EXERCISES[piece];
      const clamped = Math.max(0, Math.min(index, pool.length - 1));
      const targetId = pool[clamped]?.id;
      if (!targetId) return prev;
      const visibleIds = visibleIdsRef.current;
      if (visibleIds) {
        // Rotation mode: gate by today's visible (tier-unlocked) set, not
        // the legacy linear senda. The clamped value is always a real pool
        // index, so progress writes still target the correct exerciseId.
        if (!visibleIds.has(targetId)) return prev;
      } else {
        // Legacy: navigate to any completed exercise or one past the last.
        // "Completed" = the highest pool index with ≥1★ in the id-map.
        const lastCompleted = pool.reduce(
          (acc, ex, i) => ((prev.stars[ex.id] ?? 0) > 0 ? i : acc),
          -1,
        );
        const maxAllowed = Math.min(lastCompleted + 1, pool.length - 1);
        if (clamped > maxAllowed) return prev;
      }
      const next: PieceProgress = { ...prev, currentId: targetId };
      saveProgress(next);
      return next;
    });
  }, [piece]);

  return {
    progress,
    currentExercise,
    isLastExercise,
    totalStars: total,
    badgeEarned,
    isReplay,
    /** Rotation Engine (slice E) — exerciseIds to surface today, or null
     *  when rotation is disabled (legacy full-pool navigation). */
    visibleExerciseIds,
    completeExercise,
    advanceExercise,
    goToExercise,
    // Sprint 5 commit B — Retry surface plumbing. Passive in this
    // commit; commit E will swap PeonesHintButton's hardcoded 1 for
    // this value and commit D will call incrementAttemptSeq().
    attemptSeq,
    incrementAttemptSeq,
    resetAttemptSeq,
  };
}
