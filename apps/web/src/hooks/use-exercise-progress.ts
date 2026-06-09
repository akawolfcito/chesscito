"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { BADGE_THRESHOLD, EXERCISES, getExerciseCount } from "@/lib/game/exercises";
import { computeStars, totalStars } from "@/lib/game/scoring";
import { computeVisibleExerciseIds } from "@/lib/exercises/visible-set";
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

/**
 * Returns a zero-filled stars array matching the piece's current pool
 * length. Replaces the legacy module-level `EMPTY_STARS = [0,0,0,0,0]`
 * constant — per-piece dynamic since Sprint 1 of Training Economy
 * Alpha (2026-06-05) when piece pools became variable-length.
 */
function emptyStars(piece: PieceId): number[] {
  return new Array(getExerciseCount(piece)).fill(0);
}

/**
 * Migrate a persisted `stars` array to match the current piece pool
 * length. Pure function — no localStorage, no piece coupling. Exported
 * to enable focused testing of the migration logic.
 *
 * Three cases:
 *  - `stars.length === count` → no-op, no mutation flag.
 *  - `stars.length < count`   → pad RIGHT with zeros, preserving every
 *    legacy value. The new exercises (those added to the pool after
 *    the user's last persist) are simply "not played yet".
 *  - `stars.length > count`   → preserve the FIRST `count` values and
 *    truncate the rest. Signals `truncated: true` so the caller can
 *    log a console warning. This case happens when a piece pool shrunk
 *    (rare in production; mostly a dev/migration accident). We do NOT
 *    silently reset to fresh because that throws away all progress.
 *
 * Returns a NEW array even when no mutation happens, so callers don't
 * accidentally mutate the persisted shape.
 */
export function migrateStarsLength(
  stars: readonly number[],
  count: number,
): { stars: number[]; mutated: boolean; truncated: boolean } {
  if (stars.length === count) {
    return { stars: [...stars], mutated: false, truncated: false };
  }
  if (stars.length < count) {
    const padded = [
      ...stars,
      ...new Array(count - stars.length).fill(0),
    ];
    return { stars: padded, mutated: true, truncated: false };
  }
  return {
    stars: stars.slice(0, count),
    mutated: true,
    truncated: true,
  };
}

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

function loadProgress(piece: PieceId): PieceProgress {
  if (typeof window === "undefined") {
    return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
  }

  const count = getExerciseCount(piece);
  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (!raw) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const parsed = JSON.parse(raw) as PieceProgress;
    if (
      !Array.isArray(parsed.stars) ||
      typeof parsed.exerciseIndex !== "number"
    ) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const validStars = parsed.stars.every(
      (s: unknown) => typeof s === "number" && s >= 0 && s <= 3,
    );
    if (!validStars) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const migration = migrateStarsLength(parsed.stars, count);
    if (migration.truncated) {
      // eslint-disable-next-line no-console
      console.warn(
        `[useExerciseProgress] stars length for piece "${piece}" exceeds current pool (got ${parsed.stars.length}, count ${count}). Preserving first ${count} entries; entries beyond have been discarded.`,
      );
    }
    const clampedIndex = Math.max(0, Math.min(parsed.exerciseIndex, count - 1));
    const result: PieceProgress = {
      piece,
      exerciseIndex: clampedIndex,
      stars: migration.stars,
    };
    if (migration.mutated || clampedIndex !== parsed.exerciseIndex) {
      saveProgress(result);
    }
    return result;
  } catch {
    return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
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
  // Lazy initializer porque emptyStars depende del piece — evita recomputar
  // en cada render y mantiene compatibilidad SSR/CSR.
  const [progress, setProgress] = useState<PieceProgress>(() => ({
    piece,
    exerciseIndex: 0,
    stars: emptyStars(piece),
  }));

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
  const safeIndex = Math.min(Math.max(0, progress.exerciseIndex), count - 1);
  const currentExercise: Exercise = EXERCISES[piece][safeIndex];
  const isLastExercise = progress.exerciseIndex === count - 1;
  const total = totalStars(progress.stars);
  const badgeEarned = total >= BADGE_THRESHOLD;
  const isReplay = progress.stars[progress.exerciseIndex] > 0;

  /** Rotation Engine (slice E) — the set of exerciseIds to surface today,
   *  or `null` when rotation is disabled (legacy: full pool navigable).
   *  Gates `goToExercise` and is surfaced to the drawer. Progress stays
   *  keyed by pool index / exerciseId — never by a daily slot position. */
  const rotationEnabled = rotation?.enabled ?? false;
  const rotationDateUtc = rotation?.dateUtc ?? "";
  const rotationSessionSeed = rotation?.sessionSeed ?? null;
  const visibleExerciseIds = useMemo(
    () =>
      computeVisibleExerciseIds({
        piece,
        enabled: rotationEnabled,
        address: address ?? null,
        sessionSeed: rotationSessionSeed,
        dateUtc: rotationDateUtc,
        starsArray: progress.stars,
      }),
    [rotationEnabled, piece, address, rotationSessionSeed, rotationDateUtc, progress.stars],
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
        const idx = Math.min(Math.max(0, prev.exerciseIndex), pieceCount - 1);
        const exercise = EXERCISES[piece][idx];
        const starsForAttempt = computeStars(movesUsed, exercise.optimalMoves);
        const newStars = [...prev.stars] as PieceProgress["stars"];
        const bestStarsBefore = newStars[idx] ?? 0;
        const bestStarsAfter = Math.max(
          bestStarsBefore,
          starsForAttempt,
        ) as 0 | 1 | 2 | 3;
        newStars[idx] = bestStarsAfter;

        const prevTotal = totalStars(prev.stars);
        const newTotal = totalStars(newStars);
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
          const exercisesCompleted = newStars.filter((s) => s > 0).length;
          track("training_piece_badge_threshold_reached", {
            piece,
            totalStars: newTotal,
            exercisesCompleted,
          });
        }

        // Senda completion: every slot has ≥1★ AND at least one was 0
        // before this update. The second clause is what prevents the
        // event from re-firing on every replay after the senda already
        // closed.
        const sendaCompletedNow =
          newStars.every((s) => s > 0) && prev.stars.some((s) => s === 0);
        if (sendaCompletedNow) {
          track("training_senda_completed", {
            piece,
            totalStars: newTotal,
            exercisesCompleted: newStars.length,
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
      const pieceCount = getExerciseCount(piece);
      if (prev.exerciseIndex >= pieceCount - 1) return prev;
      const next: PieceProgress = {
        ...prev,
        exerciseIndex: prev.exerciseIndex + 1,
      };
      saveProgress(next);
      return next;
    });
  }, [piece]);

  const goToExercise = useCallback((index: number) => {
    setProgress((prev) => {
      const pieceCount = getExerciseCount(piece);
      const clamped = Math.max(0, Math.min(index, pieceCount - 1));
      const visibleIds = visibleIdsRef.current;
      if (visibleIds) {
        // Rotation mode: gate by today's visible (tier-unlocked) set, not
        // the legacy linear senda. The clamped value is always a real pool
        // index, so progress writes still target the correct exerciseId.
        const targetId = EXERCISES[piece][clamped]?.id;
        if (!targetId || !visibleIds.has(targetId)) return prev;
      } else {
        // Legacy: navigate to any completed exercise or one past the last.
        const lastCompleted = prev.stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
        const maxAllowed = Math.min(lastCompleted + 1, pieceCount - 1);
        if (clamped > maxAllowed) return prev;
      }
      const next: PieceProgress = { ...prev, exerciseIndex: clamped };
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
