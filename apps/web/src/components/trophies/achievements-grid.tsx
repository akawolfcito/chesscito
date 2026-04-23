"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { ACHIEVEMENTS_COPY } from "@/lib/content/editorial";
import type { Achievement } from "@/lib/achievements/compute";

type Props = {
  achievements: Achievement[];
};

export function AchievementsGrid({ achievements }: Props) {
  return (
    <ul
      className="grid grid-cols-2 gap-2"
      role="list"
      aria-label={ACHIEVEMENTS_COPY.sectionTitle}
    >
      {achievements.map((a) => (
        <AchievementCard key={a.id} achievement={a} />
      ))}
    </ul>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const copy = ACHIEVEMENTS_COPY.items[achievement.id as keyof typeof ACHIEVEMENTS_COPY.items];
  if (!copy) return null;

  const { earned, progress } = achievement;

  return (
    <li
      className={[
        "flex min-h-[88px] flex-col rounded-2xl border px-3 py-2.5 transition-all",
        earned
          ? "border-amber-400/70 bg-amber-400/25 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
          : "border-[rgba(110,65,15,0.20)] bg-white/15",
      ].join(" ")}
      aria-label={`${copy.title} — ${earned ? ACHIEVEMENTS_COPY.earnedLabel : ACHIEVEMENTS_COPY.lockedLabel}`}
    >
      <div className="flex items-center gap-2">
        <CandyIcon
          name={earned ? "trophy" : "lock"}
          className={[
            "h-4 w-4",
            earned ? "drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" : "opacity-55",
          ].join(" ")}
        />
        <p
          className="text-xs font-extrabold uppercase tracking-wider"
          style={{
            color: earned ? "rgba(120, 65, 5, 0.95)" : "rgba(110, 65, 15, 0.65)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
          }}
        >
          {copy.title}
        </p>
      </div>
      <p
        className="mt-1 text-[11px] leading-tight"
        style={{ color: earned ? "rgba(110, 65, 15, 0.85)" : "rgba(110, 65, 15, 0.55)" }}
      >
        {copy.description}
      </p>
      {progress && !earned && (
        <p
          className="mt-auto pt-1 text-[10px] font-bold"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          {ACHIEVEMENTS_COPY.progressLabel(progress.current, progress.goal)}
        </p>
      )}
    </li>
  );
}
