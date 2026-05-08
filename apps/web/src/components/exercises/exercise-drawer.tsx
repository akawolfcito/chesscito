import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";
import { BADGE_THRESHOLD, EXERCISES_PER_PIECE } from "@/lib/game/exercises";
import {
  EXERCISE_DRAWER_COPY,
  EXERCISE_DESCRIPTIONS,
  PIECE_LABELS,
} from "@/lib/content/editorial";

type ExerciseDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: PieceId;
  exercises: Exercise[];
  stars: PieceProgress["stars"];
  activeIndex: number;
  totalStars: number;
  onNavigate: (index: number) => void;
};

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <CandyIcon
          key={i}
          name="star"
          className={`h-3 w-3 ${i <= count ? "opacity-100" : "opacity-25"}`}
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
}: ExerciseDrawerProps) {
  const maxStars = exercises.length * 3;
  const lastCompleted = stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
  const maxAllowed = Math.min(lastCompleted + 1, EXERCISES_PER_PIECE - 1);

  function handleSelect(index: number) {
    if (index > maxAllowed) return;
    onOpenChange(false);
    onNavigate(index);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Exercises"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2.5 text-xs font-bold transition active:scale-[0.97]"
          style={{
            background: "rgba(255, 255, 255, 0.18)",
            border: "1px solid rgba(255, 255, 255, 0.45)",
            color: "rgba(110, 65, 15, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <CandyIcon name="star" className="h-2.5 w-2.5" />
          <span className="tabular-nums">{totalStars}/{maxStars}</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub rounded-t-3xl border-0 pb-[5rem]"
      >
        <div className="border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="crosshair" className="h-5 w-5" />
              {EXERCISE_DRAWER_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.75)" }}>
              {PIECE_LABELS[piece]}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="mt-4 space-y-2">
          {exercises.map((exercise, index) => {
            const isActive = index === activeIndex;
            const isDone = stars[index] > 0;
            const isLocked = index > maxAllowed;
            const description = EXERCISE_DESCRIPTIONS[exercise.id] ?? `Exercise ${index + 1}`;

            return (
              <button
                key={exercise.id}
                type="button"
                disabled={isLocked}
                onClick={() => handleSelect(index)}
                style={{
                  animationDelay: `${index * 50}ms`,
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
                      <><CandyIcon name="crosshair" className="h-2.5 w-2.5" /> Capture</>
                    ) : (
                      <><CandyIcon name="move" className="h-2.5 w-2.5" /> Movement</>
                    )}
                  </p>
                </div>

                {/* Stars */}
                {isDone ? (
                  <StarDisplay count={stars[index]} />
                ) : isLocked ? (
                  <span className="text-xs" style={{ color: "rgba(110, 65, 15, 0.55)" }}>
                    {EXERCISE_DRAWER_COPY.locked}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Progress summary */}
        <div className="mt-4 space-y-1.5">
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
            {EXERCISE_DRAWER_COPY.badgeThresholdHint(BADGE_THRESHOLD)}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
