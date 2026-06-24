"use client";

import { useEffect, useRef, useState } from "react";
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
import { BADGE_THRESHOLD, resolveExerciseDescription } from "@/lib/game/exercises";
import { useExerciseDescriptions } from "@/lib/content/catalog-context";
import { PIECE_IMAGES } from "@/lib/content/editorial";
import {
  interleaveTrainingRows,
  type TrainingNode,
} from "@/lib/training/path";
import { buildContentId } from "@/lib/daily/session-quota";

type QuotaState = {
  isAtLimit: boolean;
  consumedContentIds: string[];
  piece: string;
};

type ExerciseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: PieceId;
  exercises: Exercise[];
  stars: PieceProgress["stars"];
  activeIndex: number;
  totalStars: number;
  onNavigate: (index: number) => void;
  shieldCount?: number;
  streakCount?: number;
  visibleExerciseIds?: ReadonlySet<string> | null;
  labyrinthNodes?: TrainingNode[];
  onLabyrinthSelect?: (labyrinthId: string) => void;
  quotaState?: QuotaState | null;
  badgeClaimable?: boolean;
  onClaimBadge?: () => void;
};

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <CandyIcon
          key={i}
          name="star"
          className={`h-6 w-6 ${i <= count ? "opacity-100" : "opacity-25"}`}
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
  quotaState,
  badgeClaimable,
  onClaimBadge,
}: ExerciseDrawerProps) {
  const t = useTranslations("EXERCISE_DRAWER_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tPath = useTranslations("TRAINING_PATH_COPY");
  const descriptions = useTranslations("EXERCISE_DESCRIPTIONS");
  const overlayDescriptions = useExerciseDescriptions();
  const maxStars = exercises.length * 3;

  const lastCompleted = exercises.reduce(
    (acc, exercise, i) => ((stars[exercise.id] ?? 0) > 0 ? i : acc),
    -1,
  );
  const maxAllowed = Math.min(lastCompleted + 1, exercises.length - 1);
  const rotationOn = visibleExerciseIds != null;

  // Auto-scroll to active node when drawer opens
  const activeNodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [open]);

  // Tooltip for locked nodes
  const [lockedTooltip, setLockedTooltip] = useState<string | null>(null);
  const tooltipTimer = useRef<number | undefined>(undefined);

  function showLockedTooltip(text: string) {
    window.clearTimeout(tooltipTimer.current);
    setLockedTooltip(text);
    tooltipTimer.current = window.setTimeout(() => setLockedTooltip(null), 2000);
  }

  function isExerciseReplayable(exercise: Exercise): boolean {
    if (!quotaState?.isAtLimit) return true;
    return (
      (stars[exercise.id] ?? 0) > 0 ||
      quotaState.consumedContentIds.includes(
        buildContentId("exercise", quotaState.piece, exercise.id),
      )
    );
  }

  function isLabReplayable(node: TrainingNode): boolean {
    if (!quotaState?.isAtLimit) return true;
    return (
      node.status === "complete" ||
      quotaState.consumedContentIds.includes(
        buildContentId("labyrinth", quotaState.piece, node.id),
      )
    );
  }

  function lockedFor(exercise: Exercise, index: number): boolean {
    if (rotationOn && !visibleExerciseIds!.has(exercise.id)) return true;
    return index > maxAllowed;
  }

  function handleSelect(exercise: Exercise, index: number) {
    if (lockedFor(exercise, index)) return;
    onOpenChange(false);
    onNavigate(index);
  }

  const rows = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => !rotationOn || visibleExerciseIds!.has(exercise.id));

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
              <span aria-hidden="true" className="candy-tray-pill-divider" />
              <picture className="candy-tray-pill-icon candy-tray-pill-icon--floating">
                <source srcSet="/art/redesign/icons/shield.avif" type="image/avif" />
                <source srcSet="/art/redesign/icons/shield.webp" type="image/webp" />
                <img src="/art/redesign/icons/shield.png" alt="" aria-hidden={true} draggable={false} />
              </picture>
              <span className="tabular-nums text-sm font-extrabold">{shieldCount}</span>
            </>
          ) : null}
          {typeof streakCount === "number" && streakCount >= 2 ? (
            <>
              <span aria-hidden="true" className="candy-tray-pill-divider" />
              <picture className="candy-tray-pill-icon candy-tray-pill-icon--floating candy-tray-pill-icon--streak">
                <source srcSet="/art/redesign/icons/combo.avif" type="image/avif" />
                <source srcSet="/art/redesign/icons/combo.webp" type="image/webp" />
                <img src="/art/redesign/icons/combo.png" alt="" aria-hidden={true} draggable={false} />
              </picture>
              <span className="tabular-nums text-sm font-extrabold">{streakCount}</span>
            </>
          ) : null}
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={tPiece(piece)}
        className="sheet-bg-exercises flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        {/* Locked tooltip — fixed so it floats above the scroll container */}
        {lockedTooltip ? (
          <div
            role="alert"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-[18%] z-[200] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-xl"
            style={{ background: "rgba(30,20,10,0.92)", whiteSpace: "nowrap" }}
          >
            {lockedTooltip}
          </div>
        ) : null}

        <div className="-mx-6 -mt-6 shrink-0 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)]"
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}
        >
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src={PIECE_IMAGES[piece]} />}
            title={t("title")}
            subtitle={tPiece(piece)}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        {/* Path map — flex-col-reverse so orderedRows[0] (exercise 1) sits at visual bottom */}
        <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col-reverse gap-8 px-4 py-6">
            {orderedRows.map((row, originalIndex) => {
              // originalIndex 0 = exercise 1 (visual bottom). Even → left, odd → right.
              const isRight = originalIndex % 2 !== 0;

              if (row.kind === "labyrinth") {
                const node = row.value;
                const labIndex = (labyrinthNodes ?? []).indexOf(node);
                const isLocked = node.status === "locked";
                const isQuotaLocked = !isLocked && !isLabReplayable(node);
                const isDone = node.status === "complete";
                const effectiveLocked = isLocked || isQuotaLocked || !onLabyrinthSelect;
                const tooltipText = isLocked
                  ? node.unlock.type === "stars"
                    ? tPath("labyrinthLockedStarsFormat", { stars: node.unlock.min })
                    : tPath("labyrinthLockedChain")
                  : tPath("labyrinthLabelFormat", { number: labIndex + 1 });

                return (
                  <div
                    key={node.id}
                    className={`flex items-center ${isRight ? "justify-end" : "justify-start"}`}
                  >
                    <div className="relative flex flex-col items-center gap-0">
                      {/* Badge: green check if done, number otherwise */}
                      {isDone ? (
                        <span
                          className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full shadow"
                          style={{ background: "rgba(60,140,60,0.95)" }}
                        >
                          <svg viewBox="0 0 12 10" className="h-3 w-3" fill="none">
                            <polyline points="1,5 4.5,8.5 11,1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                          style={{ background: isLocked ? "rgba(63,34,8,0.80)" : "rgba(245,158,11,0.95)" }}
                        >
                          {labIndex + 1}
                        </span>
                      )}

                      {/* Labyrint icon node */}
                      <button
                        type="button"
                        aria-label={tPath("labyrinthLabelFormat", { number: labIndex + 1 })}
                        data-locked={effectiveLocked ? "true" : undefined}
                        data-quota-locked={isQuotaLocked ? "true" : undefined}
                        onClick={() => {
                          if (effectiveLocked) {
                            showLockedTooltip(tooltipText);
                            return;
                          }
                          onOpenChange(false);
                          onLabyrinthSelect!(node.id);
                        }}
                        className="relative"
                        style={{
                          filter: effectiveLocked
                            ? "grayscale(1) brightness(0.85)"
                            : !isDone
                              ? "drop-shadow(0 0 6px rgba(255,213,74,0.85)) drop-shadow(0 0 14px rgba(255,200,40,0.55))"
                              : undefined,
                        }}
                      >
                        <picture className="block h-20 w-20 drop-shadow-md">
                          <source srcSet="/art/redesign/bg/labyrint-icon.avif" type="image/avif" />
                          <source srcSet="/art/redesign/bg/labyrint-icon.webp" type="image/webp" />
                          <img
                            src="/art/redesign/bg/labyrint-icon.png"
                            alt=""
                            aria-hidden={true}
                            draggable={false}
                            className="h-full w-full object-contain"
                          />
                        </picture>
                        {effectiveLocked && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <CandyIcon name="lock" className="h-7 w-7 drop-shadow" />
                          </span>
                        )}
                        {/* Accessible text for screen readers and tests */}
                        <span className="sr-only">
                          {tPath("labyrinthLabelFormat", { number: labIndex + 1 })}
                        </span>
                        {isLocked ? (
                          <span className="sr-only">
                            {node.unlock.type === "stars"
                              ? tPath("labyrinthLockedStarsFormat", { stars: node.unlock.min })
                              : tPath("labyrinthLockedChain")}
                          </span>
                        ) : null}
                      </button>

                      {/* Stars */}
                      {isDone ? <StarDisplay count={node.stars ?? 0} /> : null}
                    </div>
                  </div>
                );
              }

              // Exercise node
              const { exercise, index } = row.value;
              const isActive = index === activeIndex;
              const starCount = stars[exercise.id] ?? 0;
              const isDone = starCount > 0;
              const isLocked = lockedFor(exercise, index);
              const isQuotaLocked = !isLocked && !isExerciseReplayable(exercise);
              const effectiveLocked = isLocked || isQuotaLocked;
              const description = resolveExerciseDescription(
                exercise.id,
                index,
                (eid) => (descriptions.has(eid) ? descriptions(eid) : null),
                (n) => t("exerciseFallbackFormat", { n }),
                overlayDescriptions,
              );

              return (
                <div
                  key={exercise.id}
                  ref={isActive ? activeNodeRef : undefined}
                  className={`flex items-center ${isRight ? "justify-end" : "justify-start"}`}
                >
                  <div className="relative flex flex-col items-center gap-0">
                    {/* Badge: green check if done, number otherwise */}
                    {isDone ? (
                      <span
                        className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full shadow"
                        style={{ background: "rgba(60,140,60,0.95)" }}
                      >
                        <svg viewBox="0 0 12 10" className="h-3 w-3" fill="none">
                          <polyline points="1,5 4.5,8.5 11,1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                        style={{ background: effectiveLocked ? "rgba(63,34,8,0.80)" : "rgba(245,158,11,0.95)" }}
                      >
                        {index + 1}
                      </span>
                    )}

                    {/* btn-nodo + piece on top */}
                    <button
                      type="button"
                      aria-label={description}
                      data-locked={effectiveLocked ? "true" : undefined}
                      data-quota-locked={isQuotaLocked ? "true" : undefined}
                      onClick={() => {
                        if (effectiveLocked) {
                          showLockedTooltip(description);
                          return;
                        }
                        handleSelect(exercise, index);
                      }}
                      className="relative"
                      style={{
                        filter: effectiveLocked
                          ? "grayscale(1) brightness(0.85)"
                          : (isActive && !isDone)
                            ? "drop-shadow(0 0 6px rgba(255,213,74,0.85)) drop-shadow(0 0 14px rgba(255,200,40,0.55))"
                            : undefined,
                      }}
                    >
                      {/* Node button image */}
                      <picture className="block h-20 w-20 drop-shadow-md">
                        <source srcSet="/art/redesign/bg/btn-nodo.avif" type="image/avif" />
                        <source srcSet="/art/redesign/bg/btn-nodo.webp" type="image/webp" />
                        <img
                          src="/art/redesign/bg/btn-nodo.png"
                          alt=""
                          aria-hidden={true}
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                      </picture>

                      {/* Chess piece centered on the button */}
                      <span className="absolute inset-0 flex items-center justify-center pb-8">
                        <TileIconSlot src={PIECE_IMAGES[piece]} className="h-11 w-11" />
                      </span>

                      {/* Lock overlay */}
                      {effectiveLocked ? (
                        <span className="absolute inset-0 flex items-end justify-center pb-1">
                          <CandyIcon name="lock" className="h-5 w-5 opacity-90 drop-shadow" />
                        </span>
                      ) : null}
                      {/* Accessible text for screen readers and tests */}
                      <span className="sr-only">{description}</span>
                    </button>

                    {/* Stars */}
                    {isDone ? <StarDisplay count={starCount} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress summary */}
        <div
          className="mt-4 shrink-0 space-y-1.5 rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(6px)" }}
        >
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
          {badgeClaimable && onClaimBadge ? (
            <button
              type="button"
              onClick={() => { onOpenChange(false); onClaimBadge(); }}
              className="mt-1 w-full rounded-xl py-2 text-sm font-bold text-white transition-opacity active:opacity-80"
              style={{
                background: "linear-gradient(145deg, #fbe04b 0%, #fcc00a 40%, #d38804 100%)",
                boxShadow: "0 0 0 2px rgba(255,216,74,0.7), 0 0 8px 2px rgba(255,200,40,0.6), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -4px 0 rgba(142,78,0,0.3)",
                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            >
              {t("claimBadgeCta")}
            </button>
          ) : (
            <p
              className="text-center text-xs"
              style={{ color: "rgba(110, 65, 15, 0.65)" }}
            >
              {t("badgeThresholdHint", { threshold: BADGE_THRESHOLD })}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
