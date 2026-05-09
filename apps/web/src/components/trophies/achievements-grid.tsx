"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { TreasureTile } from "@/components/scene-rooted/treasure-tile";
import { ACHIEVEMENTS_COPY } from "@/lib/content/editorial";
import type { Achievement } from "@/lib/achievements/compute";
import { AchievementDetailSheet } from "./achievement-detail-sheet";

type Props = {
  achievements: Achievement[];
};

export function AchievementsGrid({ achievements }: Props) {
  const [selected, setSelected] = useState<Achievement | null>(null);

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <>
      <div className="flex flex-col gap-6">
        {earned.length > 0 ? (
          <Section
            label={ACHIEVEMENTS_COPY.sectionEarned}
            count={earned.length}
            achievements={earned}
            onSelect={setSelected}
          />
        ) : null}
        {locked.length > 0 ? (
          <Section
            label={ACHIEVEMENTS_COPY.sectionLocked}
            count={locked.length}
            achievements={locked}
            onSelect={setSelected}
          />
        ) : null}
      </div>
      <AchievementDetailSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        achievement={selected}
      />
    </>
  );
}

type SectionProps = {
  label: string;
  count: number;
  achievements: Achievement[];
  onSelect: (a: Achievement) => void;
};

function Section({ label, count, achievements, onSelect }: SectionProps) {
  return (
    <section>
      <h3
        className="mb-3 text-xs font-bold uppercase tracking-wider"
        style={{ color: "rgba(110, 65, 15, 0.85)" }}
      >
        {label} ({count})
      </h3>
      <ul
        className="grid grid-cols-2 gap-x-3 gap-y-5"
        role="list"
        aria-label={label}
      >
        {achievements.map((a) => (
          <AchievementCard key={a.id} achievement={a} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

function AchievementCard({
  achievement,
  onSelect,
}: {
  achievement: Achievement;
  onSelect: (a: Achievement) => void;
}) {
  const copy =
    ACHIEVEMENTS_COPY.items[achievement.id as keyof typeof ACHIEVEMENTS_COPY.items];
  if (!copy) return null;

  const { earned, progress } = achievement;
  const stateLabel = earned
    ? ACHIEVEMENTS_COPY.earnedLabel
    : ACHIEVEMENTS_COPY.lockedLabel;

  return (
    <li className="flex flex-col items-center gap-2">
      <TreasureTile
        size="small"
        ribbon={earned ? "EARNED" : undefined}
        iconStack={
          <CandyIcon
            name={earned ? "trophy" : "lock"}
            className={[
              "h-9 w-9",
              earned
                ? "drop-shadow-[0_0_6px_rgba(245,158,11,0.55)]"
                : "opacity-55",
            ].join(" ")}
          />
        }
        onClick={() => onSelect(achievement)}
        aria-label={`${copy.title} — ${stateLabel}`}
      />
      <div className="w-full px-1 text-center">
        <p
          className="text-xs font-extrabold uppercase tracking-wider"
          style={{
            color: earned ? "rgba(120, 65, 5, 0.95)" : "rgba(110, 65, 15, 0.65)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
          }}
        >
          {copy.title}
        </p>
        <p
          className="mt-1 text-[11px] leading-tight"
          style={{
            color: earned ? "rgba(110, 65, 15, 0.85)" : "rgba(110, 65, 15, 0.55)",
          }}
        >
          {copy.description}
        </p>
        {!earned && progress ? (
          <p
            className="mt-1.5 text-[10px] font-bold"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {ACHIEVEMENTS_COPY.progressLabel(progress.current, progress.goal)}
          </p>
        ) : null}
      </div>
    </li>
  );
}
