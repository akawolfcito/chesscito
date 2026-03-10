type ExerciseStarsBarProps = {
  stars: [number, number, number, number, number];
  activeIndex: number;
  onSelect?: (index: number) => void;
};

export function ExerciseStarsBar({
  stars,
  activeIndex,
  onSelect,
}: ExerciseStarsBarProps) {
  const totalEarned = stars.reduce((sum, s) => sum + s, 0);
  const maxStars = stars.length * 3;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {/* Progress bar */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
          style={{ width: `${(totalEarned / maxStars) * 100}%` }}
        />
        {/* Threshold marker at 10/15 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-cyan-400/50"
          style={{ left: `${(10 / maxStars) * 100}%` }}
        />
      </div>

      {/* Exercise dots */}
      <div className="flex items-center justify-between">
        {stars.map((exerciseStars, index) => {
          const isActive = index === activeIndex;
          const isDone = exerciseStars > 0;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect?.(index)}
              className={[
                "flex items-center gap-0.5 rounded-md px-2 py-1 transition",
                isActive
                  ? "bg-cyan-900/40 ring-1 ring-cyan-500/50"
                  : "opacity-60 hover:opacity-100",
              ].join(" ")}
              aria-label={`Trial ${index + 1}: ${exerciseStars} star${exerciseStars !== 1 ? "s" : ""}`}
            >
              <span className={`text-xs font-bold ${isDone ? "text-amber-400" : "text-cyan-400/70"}`}>
                {index + 1}
              </span>
              {isDone ? (
                <span className="text-xs text-amber-400" aria-hidden="true">
                  {"★".repeat(exerciseStars)}
                </span>
              ) : null}
            </button>
          );
        })}
        <span className="text-xs font-semibold text-cyan-100/50">
          {totalEarned}/{maxStars}
        </span>
      </div>
    </div>
  );
}
