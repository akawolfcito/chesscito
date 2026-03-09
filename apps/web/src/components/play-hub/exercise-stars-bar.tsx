type ExerciseStarsBarProps = {
  stars: [number, number, number, number, number];
  activeIndex: number;
  onSelect?: (index: number) => void;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <span
      className={filled ? "text-amber-400" : "text-cyan-900/60"}
      aria-hidden="true"
    >
      ★
    </span>
  );
}

export function ExerciseStarsBar({
  stars,
  activeIndex,
  onSelect,
}: ExerciseStarsBarProps) {
  return (
    <div className="flex items-center justify-between gap-1 px-1">
      {stars.map((exerciseStars, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect?.(index)}
            className={[
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition",
              isActive
                ? "bg-cyan-900/40 ring-1 ring-cyan-500/50"
                : "opacity-60 hover:opacity-90",
            ].join(" ")}
            aria-label={`Trial ${index + 1}: ${exerciseStars} star${exerciseStars !== 1 ? "s" : ""}`}
          >
            <span className="text-[0.6rem] font-semibold tracking-widest text-cyan-400/70">
              {index + 1}
            </span>
            <div className="flex text-[0.65rem] leading-none">
              {[0, 1, 2].map((i) => (
                <StarIcon key={i} filled={i < exerciseStars} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
