import { Crosshair, Lock, Swords, MoveRight, Star } from "lucide-react";
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
        <Star
          key={i}
          size={12}
          className={i <= count ? "fill-amber-400 text-amber-400" : "text-slate-600"}
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
          className="flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[10px] font-bold text-[rgba(220,200,140,0.85)] transition hover:brightness-110"
          style={{ background: "linear-gradient(180deg, rgba(20,16,10,0.70) 0%, rgba(12,10,8,0.60) 100%)", border: "1px solid rgba(180,160,100,0.20)", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.05), inset 0 -1px 2px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.2)" }}
        >
          <Star size={10} className="fill-[rgba(220,190,100,0.9)] text-[rgba(220,190,100,0.9)]" />
          <span className="tabular-nums">{totalStars}/{maxStars}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-white/[0.10]" style={{ background: "var(--surface-b)", backdropFilter: "blur(20px)" }}>
        <div className="border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title flex items-center gap-2 text-slate-100"><Crosshair size={20} className="text-cyan-400/60" />{EXERCISE_DRAWER_COPY.title}</SheetTitle>
            <SheetDescription className="text-cyan-100/75">
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
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  isActive
                    ? "bg-cyan-500/18 ring-1 ring-cyan-400/45 shadow-[inset_0_0_12px_rgba(34,211,238,0.06)]"
                    : isDone
                      ? "bg-white/[0.05] border border-white/[0.06] hover:bg-white/[0.08]"
                      : "bg-white/[0.03] border border-white/[0.04]",
                  isLocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                {/* Exercise number */}
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isActive
                      ? "bg-cyan-500/30 text-cyan-200"
                      : isDone
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-700/50 text-slate-500",
                  ].join(" ")}
                >
                  {isLocked ? <Lock size={12} /> : index + 1}
                </span>

                {/* Description + type */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isLocked ? "text-slate-500" : "text-slate-100"}`}>
                    {description}
                  </p>
                  <p className="flex items-center gap-1 text-[0.65rem] text-slate-400">
                    {exercise.isCapture ? (
                      <><Swords size={10} /> Capture</>
                    ) : (
                      <><MoveRight size={10} /> Movement</>
                    )}
                  </p>
                </div>

                {/* Stars */}
                {isDone ? (
                  <StarDisplay count={stars[index]} />
                ) : isLocked ? (
                  <span className="text-[0.6rem] text-slate-600">{EXERCISE_DRAWER_COPY.locked}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Progress summary */}
        <div className="mt-4 space-y-1.5">
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-800/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
              style={{ width: `${(totalStars / maxStars) * 100}%` }}
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-cyan-400/50"
              style={{ left: `${(BADGE_THRESHOLD / maxStars) * 100}%` }}
            />
          </div>
          <p className="text-center text-[0.6rem] text-cyan-100/40">
            {EXERCISE_DRAWER_COPY.badgeThresholdHint(BADGE_THRESHOLD)}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
