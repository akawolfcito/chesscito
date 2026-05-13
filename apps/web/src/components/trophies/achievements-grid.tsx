"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { ACHIEVEMENTS_COPY } from "@/lib/content/editorial";
import type { Achievement } from "@/lib/achievements/compute";
import { AchievementDetailSheet } from "./achievement-detail-sheet";

type Props = {
  achievements: Achievement[];
};

export function AchievementsGrid({ achievements }: Props) {
  const [selected, setSelected] = useState<Achievement | null>(null);

  // Group by earned status but display in a single grid or logical sections
  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <>
      <div className="flex flex-col gap-8">
        {earned.length > 0 && (
          <Section
            label={ACHIEVEMENTS_COPY.sectionEarned}
            achievements={earned}
            onSelect={setSelected}
          />
        )}
        
        {locked.length > 0 && (
          <Section
            label={ACHIEVEMENTS_COPY.sectionLocked}
            achievements={locked}
            onSelect={setSelected}
          />
        )}
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

function Section({
  label,
  achievements,
  onSelect,
}: {
  label: string;
  achievements: Achievement[];
  onSelect: (a: Achievement) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between px-1">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(63,34,8,0.40)]">
          {label}
        </h3>
        <span className="text-[10px] font-black text-[rgba(63,34,8,0.30)]">
          {achievements.length} ITEMS
        </span>
      </div>
      
      <div className="achievement-tile-grid">
        {achievements.map((a) => (
          <AchievementTile key={a.id} achievement={a} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function AchievementTile({
  achievement,
  onSelect,
}: {
  achievement: Achievement;
  onSelect: (a: Achievement) => void;
}) {
  const copy = ACHIEVEMENTS_COPY.items[achievement.id as keyof typeof ACHIEVEMENTS_COPY.items];
  if (!copy) return null;

  const { earned, progress } = achievement;

  return (
    <button
      type="button"
      onClick={() => onSelect(achievement)}
      className={`achievement-tile ${!earned ? "achievement-tile--locked" : ""} active:scale-95`}
    >
      <div className="achievement-tile-icon-wrap">
        <CandyIcon
          name={earned ? "trophy" : "lock"}
          className={`h-8 w-8 ${earned ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.40)]" : "text-[rgba(63,34,8,0.35)] grayscale"}`}
        />
        {earned && (
          <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white/20">
            <CandyIcon name="check" className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      <h4 className="achievement-tile-title">{copy.title}</h4>
      <p className="achievement-tile-objective">{copy.description}</p>
      
      {!earned && progress ? (
        <div className="mt-3 w-full">
          <div className="flex items-center justify-between px-1 mb-1 text-[9px] font-black text-[rgba(63,34,8,0.50)]">
            <span>PROGRESS</span>
            <span>{progress.current}/{progress.goal}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[rgba(63,34,8,0.06)] overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.current / progress.goal) * 100}%` }}
            />
          </div>
        </div>
      ) : earned ? (
        <div className="mt-3">
          <CandyChip variant="success" tone="subtle">
            {ACHIEVEMENTS_COPY.earnedLabel}
          </CandyChip>
        </div>
      ) : (
        <div className="mt-3">
          <CandyChip variant="warm" tone="subtle">
            {ACHIEVEMENTS_COPY.lockedLabel}
          </CandyChip>
        </div>
      )}
    </button>
  );
}
