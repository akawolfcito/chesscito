"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import { PIECE_IMAGES } from "@/lib/content/editorial";
import {
  interleaveTrainingRows,
  type TrainingNode,
} from "@/lib/training/path";

type ExerciseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: PieceId;
  exercises: Exercise[];
  stars: PieceProgress["stars"];
  activeIndex: number;
  totalStars: number;
  onNavigate: (index: number) => void;
  /** Live shield count. When provided AND > 0, the trigger pill
   *  renders an inline divider + shield count next to the stars so
   *  the HUD collapses two chips into one. Omit (or pass 0) to
   *  preserve the legacy single-stars trigger. */
  shieldCount?: number;
  /** Live consecutive-success streak. When provided AND >= 2, the
   *  trigger pill renders an inline divider + flame icon + count
   *  so the player always sees what they're protecting. Below 2
   *  it's omitted to avoid mounting "1" right after the first
   *  success of a session (visual noise). */
  streakCount?: number;
  /** Rotation Engine (slice E). When provided (non-null), the drawer
   *  shows ONLY today's visible set and treats those exercises as
   *  playable (tier-unlocked), bypassing the legacy linear-senda lock.
   *  Rows keep their real pool index so stars / onNavigate stay correct.
   *  Null/undefined → legacy full list with linear lock. */
  visibleExerciseIds?: ReadonlySet<string> | null;
  /** Slice 3D — the drawer is the PRIMARY training selector, so the
   *  labyrinth leg of the path renders here as a section after the
   *  exercises (the next challenge comes to the player, it is never
   *  searched for inside Mission). Nodes arrive pre-ordered from
   *  buildTrainingPath. Absent → legacy exercise-only drawer. */
  labyrinthNodes?: TrainingNode[];
  /** Tap on an unlocked labyrinth row. Closes the drawer first. */
  onLabyrinthSelect?: (labyrinthId: string) => void;
};

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <CandyIcon
          key={i}
          name="star"
          className={`h-4 w-4 ${i <= count ? "opacity-100" : "opacity-25"}`}
        />
      ))}
    </span>
  );
}

export function ExerciseDrawer({
  open,
  onOpenChange,
  piece,
  exercises,
  stars,
  activeIndex,
  totalStars,
  onNavigate,
  shieldCount,
  streakCount,
  visibleExerciseIds,
  labyrinthNodes,
  onLabyrinthSelect,
}: ExerciseDrawerProps) {
  const t = useTranslations("EXERCISE_DRAWER_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tPath = useTranslations("TRAINING_PATH_COPY");
  const descriptions = useTranslations("EXERCISE_DESCRIPTIONS");
  const maxStars = exercises.length * 3;
  const lastCompleted = stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
  const maxAllowed = Math.min(lastCompleted + 1, exercises.length - 1);
  const rotationOn = visibleExerciseIds != null;

  /** Lock rule. Rotation: anything in today's visible set is playable
   *  (the selector only surfaces tier-unlocked exercises). Legacy: the
   *  linear senda gate. `index` is always the real pool index. */
  function lockedFor(exercise: Exercise, index: number): boolean {
    if (rotationOn) return !visibleExerciseIds!.has(exercise.id);
    return index > maxAllowed;
  }

  function handleSelect(exercise: Exercise, index: number) {
    if (lockedFor(exercise, index)) return;
    onOpenChange(false);
    onNavigate(index);
  }

  // Rotation shows only today's visible set; legacy shows the full pool.
  // Either way each row carries its REAL pool index so stars[index],
  // activeIndex, and onNavigate(index) stay correct.
  const rows = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => !rotationOn || visibleExerciseIds!.has(exercise.id));

  // D6 (surface redistribution): ONE continuous path — labyrinths
  // interleave between exercises by unlock order instead of pooling in
  // a trailing section. Presentation-only; unlock math untouched.
  const orderedRows = interleaveTrainingRows(rows, labyrinthNodes ?? []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("ariaLabel")}
          className="candy-tray-pill"
        >
          <CandyIcon
            name="star"
            className="candy-tray-pill-icon candy-tray-pill-icon--floating"
          />
          <span
            className="tabular-nums text-sm font-extrabold"
            aria-label={t("starsEarnedAriaFormat", { total: totalStars, max: maxStars })}
          >
            {totalStars}
          </span>
          {typeof shieldCount === "number" && shieldCount > 0 ? (
            <>
              <span
                aria-hidden="true"
                className="candy-tray-pill-divider"
              />
              <picture
                aria-hidden="true"
                className="candy-tray-pill-icon candy-tray-pill-icon--floating"
              >
                <source srcSet="/art/redesign/icons/shield.avif" type="image/avif" />
                <source srcSet="/art/redesign/icons/shield.webp" type="image/webp" />
                <img
                  src="/art/redesign/icons/shield.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </picture>
              <span className="tabular-nums text-sm font-extrabold">
                {shieldCount}
              </span>
            </>
          ) : null}
          {typeof streakCount === "number" && streakCount >= 2 ? (
            <>
              <span
                aria-hidden="true"
                className="candy-tray-pill-divider"
              />
              <picture
                aria-hidden="true"
                className="candy-tray-pill-icon candy-tray-pill-icon--floating candy-tray-pill-icon--streak"
              >
                <source srcSet="/art/redesign/icons/streak.avif" type="image/avif" />
                <source srcSet="/art/redesign/icons/streak.webp" type="image/webp" />
                <img
                  src="/art/redesign/icons/streak.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </picture>
              <span className="tabular-nums text-sm font-extrabold">
                {streakCount}
              </span>
            </>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={tPiece(piece)}
        /* flex flex-col + max-h-[90dvh] + min-h-0 on the list:
         * Sprint 1 commit 7 (Training Economy Alpha 2026-06-05) — King
         * grew from 5 to 9 exercises and overflowed the sheet. Without
         * a height bound the SheetContent grew past viewport top and
         * the close-control header rendered offscreen. Bound the sheet
         * at 90dvh, lay out as flex column with header + progress bar
         * shrink-0 so only the middle list scrolls. `min-h-0` on the
         * list is the canonical flex-overflow trick — children of
         * flexboxes default to min-height: auto which inhibits overflow. */
        className="mission-shell sheet-bg-hub flex max-h-[90dvh] flex-col rounded-t-3xl border-0 pb-[5rem]"
      >
        <div className="-mx-6 -mt-6 shrink-0 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src={PIECE_IMAGES[piece]} />}
            title={t("title")}
            subtitle={tPiece(piece)}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {orderedRows.map((row, position) => {
            if (row.kind === "labyrinth") {
              const node = row.value;
              const labIndex = (labyrinthNodes ?? []).indexOf(node);
              const isLabLocked = node.status === "locked";
              const isLabDone = node.status === "complete";
              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={isLabLocked || !onLabyrinthSelect}
                  onClick={() => {
                    if (isLabLocked || !onLabyrinthSelect) return;
                    onOpenChange(false);
                    onLabyrinthSelect(node.id);
                  }}
                  style={{
                    animationDelay: `${position * 50}ms`,
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                  }}
                  className={[
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-backwards",
                    isLabLocked ? "opacity-45 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: isLabDone
                        ? "rgba(245, 158, 11, 0.25)"
                        : "rgba(110, 65, 15, 0.15)",
                      color: isLabDone
                        ? "rgba(120, 65, 5, 0.95)"
                        : "rgba(110, 65, 15, 0.55)",
                    }}
                  >
                    <CandyIcon
                      name={isLabLocked ? "lock" : "crosshair"}
                      className="h-3 w-3"
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: isLabLocked ? "rgba(110, 65, 15, 0.55)" : "rgba(63, 34, 8, 0.95)",
                        textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                      }}
                    >
                      {tPath("labyrinthLabelFormat", { number: labIndex + 1 })}
                    </p>
                    {isLabLocked ? (
                      <p
                        className="text-xs"
                        style={{ color: "rgba(110, 65, 15, 0.70)" }}
                      >
                        {node.unlock.type === "stars"
                          ? tPath("labyrinthLockedStarsFormat", { stars: node.unlock.min })
                          : tPath("labyrinthLockedChain")}
                      </p>
                    ) : null}
                  </div>
                  {isLabDone ? (
                    <StarDisplay count={node.stars ?? 0} />
                  ) : !isLabLocked ? (
                    <span
                      className="text-xs font-bold uppercase"
                      style={{ color: "rgba(120, 65, 5, 0.85)" }}
                    >
                      {tPath("ready")}
                    </span>
                  ) : null}
                </button>
              );
            }

            const { exercise, index } = row.value;
            const isActive = index === activeIndex;
            const isDone = stars[index] > 0;
            const isLocked = lockedFor(exercise, index);
            // EXERCISE_DESCRIPTIONS keys are not statically known to the
            // translator; fall back to `Exercise N` when the key is missing.
            let description: string;
            try {
              description = descriptions(exercise.id);
            } catch {
              description = t("exerciseFallbackFormat", { n: index + 1 });
            }

            return (
              <button
                key={exercise.id}
                type="button"
                disabled={isLocked}
                onClick={() => handleSelect(exercise, index)}
                style={{
                  animationDelay: `${position * 50}ms`,
                  background: "rgba(255, 255, 255, 0.15)",
                  border: isActive
                    ? "1px solid rgba(245, 158, 11, 0.55)"
                    : "1px solid rgba(255, 255, 255, 0.45)",
                  boxShadow: isActive
                    ? "inset 0 0 12px rgba(245, 158, 11, 0.15), 0 0 0 2px rgba(245, 158, 11, 0.25)"
                    : undefined,
                }}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-backwards",
                  isLocked ? "opacity-45 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                {/* Exercise number */}
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isActive
                      ? "rgba(245, 158, 11, 0.85)"
                      : isDone
                        ? "rgba(245, 158, 11, 0.25)"
                        : "rgba(110, 65, 15, 0.15)",
                    color: isActive
                      ? "rgba(255, 240, 180, 0.98)"
                      : isDone
                        ? "rgba(120, 65, 5, 0.95)"
                        : "rgba(110, 65, 15, 0.55)",
                  }}
                >
                  {isLocked ? <CandyIcon name="lock" className="h-3 w-3" /> : index + 1}
                </span>

                {/* Description + type */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: isLocked ? "rgba(110, 65, 15, 0.55)" : "rgba(63, 34, 8, 0.95)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                    }}
                  >
                    {description}
                  </p>
                  <p
                    className="flex items-center gap-1 text-xs"
                    style={{ color: "rgba(110, 65, 15, 0.70)" }}
                  >
                    {exercise.isCapture ? (
                      <><CandyIcon name="crosshair" className="h-2.5 w-2.5" /> {t("captureLabel")}</>
                    ) : (
                      <><CandyIcon name="move" className="h-2.5 w-2.5" /> {t("movementLabel")}</>
                    )}
                  </p>
                </div>

                {/* Stars */}
                {isDone ? (
                  <StarDisplay count={stars[index]} />
                ) : isLocked ? (
                  <span className="text-xs" style={{ color: "rgba(110, 65, 15, 0.55)" }}>
                    {t("locked")}
                  </span>
                ) : null}
              </button>
            );
          })}

        </div>

        {/* Progress summary — shrink-0 keeps it anchored at the bottom of
         *  the sheet next to the dock, even when the list scrolls. */}
        <div className="mt-4 shrink-0 space-y-1.5">
          <div
            className="relative h-2 overflow-hidden rounded-full"
            style={{ background: "rgba(110, 65, 15, 0.18)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(totalStars / maxStars) * 100}%`,
                background: "linear-gradient(90deg, rgba(245, 158, 11, 0.95), rgba(255, 220, 120, 0.95))",
              }}
            />
            <div
              className="absolute top-0 h-full w-1"
              style={{
                left: `${(BADGE_THRESHOLD / maxStars) * 100}%`,
                background: "rgba(120, 65, 5, 0.55)",
              }}
            />
          </div>
          <p
            className="text-center text-xs"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {t("badgeThresholdHint", { threshold: BADGE_THRESHOLD })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
