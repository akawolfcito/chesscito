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
    <div className="flex items-center gap-2 py-1">
      {/* Exercise dot markers */}
      <div className="flex items-center gap-1">
        {stars.map((exerciseStars, index) => {
          const isActive = index === activeIndex;
          const isDone = exerciseStars > 0;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect?.(index)}
              className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold transition",
                isActive
                  ? "bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/60"
                  : isDone
                    ? "text-amber-400/80"
                    : "text-cyan-400/40",
              ].join(" ")}
              aria-label={`Trial ${index + 1}: ${exerciseStars} star${exerciseStars !== 1 ? "s" : ""}`}
            >
              {isDone ? "★" : index + 1}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
          style={{ width: `${(totalEarned / maxStars) * 100}%` }}
        />
        {/* Threshold marker at 10/15 */}
        <div
          className="absolute top-0 h-full w-px bg-cyan-400/40"
          style={{ left: `${(10 / maxStars) * 100}%` }}
        />
      </div>

      {/* Score count */}
      <span className="text-[0.6rem] font-semibold text-cyan-100/40 tabular-nums">
        {totalEarned}/{maxStars}
      </span>
    </div>
  );
}
