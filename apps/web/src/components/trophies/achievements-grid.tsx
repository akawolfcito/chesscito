"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import type { Achievement } from "@/lib/achievements/compute";
import { AchievementDetailSheet } from "./achievement-detail-sheet";

type AchievementCopy = { title: string; description: string };

/** Thematic icon per achievement so locked tiles read as a dimmed PREVIEW of
 *  the reward (with a small lock badge), not a wall of identical padlocks
 *  (founder 2026-06-16). Falls back to trophy for any unmapped id. */
const ACHIEVEMENT_ICONS: Record<string, CandyIconName> = {
  "first-victory": "trophy",
  "solid-player": "shield",
  "arena-champion": "crown",
  speedrunner: "time",
  "rapid-finish": "crosshair",
  "five-crowns": "star",
  dedication: "refresh",
  "first-focus-day": "star",
  "three-day-rhythm": "refresh",
  "seven-day-focus": "crown",
};

type Props = {
  achievements: Achievement[];
};

export function AchievementsGrid({ achievements }: Props) {
  const t = useTranslations("ACHIEVEMENTS_COPY");
  const [selected, setSelected] = useState<Achievement | null>(null);

  // Group by earned status but display in a single grid or logical sections
  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <>
      <div className="flex flex-col gap-8">
        {earned.length > 0 && (
          <Section
            label={t("sectionEarned")}
            achievements={earned}
            onSelect={setSelected}
          />
        )}

        {locked.length > 0 && (
          <Section
            label={t("sectionLocked")}
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
  const t = useTranslations("ACHIEVEMENTS_COPY");
  return (
    <section>
      <div className="mb-4 flex items-center justify-between px-1">
        <h3 className="text-nano font-black uppercase tracking-[0.2em] text-[rgba(63,34,8,0.40)]">
          {label}
        </h3>
        <span className="text-nano font-black text-[rgba(63,34,8,0.30)]">
          {achievements.length} {t("itemsLabel")}
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
  const t = useTranslations("ACHIEVEMENTS_COPY");
  const items = t.raw("items") as Record<string, AchievementCopy | undefined>;
  const copy = items[achievement.id];
  if (!copy) return null;

  const { earned, progress } = achievement;
  const icon = ACHIEVEMENT_ICONS[achievement.id] ?? "trophy";

  return (
    <button
      type="button"
      onClick={() => onSelect(achievement)}
      className={`achievement-tile ${!earned ? "achievement-tile--locked" : ""} active:scale-95`}
    >
      <div className="achievement-tile-icon-wrap">
        {/* Thematic icon: full color + glow when earned, dimmed preview when
            locked (with a small lock badge), never a generic padlock. */}
        <CandyIcon
          name={icon}
          className={`h-8 w-8 ${earned ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]" : "text-[rgba(63,34,8,0.30)] grayscale opacity-70"}`}
        />
        {earned ? (
          <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white/20">
            <CandyIcon name="check" className="h-3 w-3 text-white" />
          </div>
        ) : (
          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/30 bg-[rgba(63,34,8,0.55)]">
            <CandyIcon name="lock" className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      <h4 className="achievement-tile-title">{copy.title}</h4>
      <p className="achievement-tile-objective">{copy.description}</p>
      
      {!earned && progress ? (
        <div className="mt-3 w-full">
          <div className="flex items-center justify-between px-1 mb-1 text-nano font-black text-[rgba(63,34,8,0.50)]">
            <span>{t("progressEyebrow")}</span>
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
            {t("earnedLabel")}
          </CandyChip>
        </div>
      ) : (
        <div className="mt-3">
          <CandyChip variant="warm" tone="subtle">
            {t("lockedLabel")}
          </CandyChip>
        </div>
      )}
    </button>
  );
}
