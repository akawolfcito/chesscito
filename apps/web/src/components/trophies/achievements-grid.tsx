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
          ? "border-amber-400/50 bg-amber-500/[0.10] shadow-[0_0_14px_rgba(251,191,36,0.18)]"
          : "border-amber-300/[0.12] bg-amber-400/[0.04]",
      ].join(" ")}
      aria-label={`${copy.title} — ${earned ? ACHIEVEMENTS_COPY.earnedLabel : ACHIEVEMENTS_COPY.lockedLabel}`}
    >
      <div className="flex items-center gap-2">
        <CandyIcon
          name={earned ? "trophy" : "lock"}
          className={[
            "h-4 w-4",
            earned ? "drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" : "opacity-40",
          ].join(" ")}
        />
        <p
          className={[
            "text-xs font-bold uppercase tracking-wider",
            earned ? "text-amber-300" : "text-amber-100/55",
          ].join(" ")}
        >
          {copy.title}
        </p>
      </div>
      <p
        className={[
          "mt-1 text-[11px] leading-tight",
          earned ? "text-amber-100/75" : "text-amber-100/45",
        ].join(" ")}
      >
        {copy.description}
      </p>
      {progress && !earned && (
        <p className="mt-auto pt-1 text-[10px] font-semibold text-white/50">
          {ACHIEVEMENTS_COPY.progressLabel(progress.current, progress.goal)}
        </p>
      )}
    </li>
  );
}
