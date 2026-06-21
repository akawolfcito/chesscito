"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import type { Achievement } from "@/lib/achievements/compute";
import { AchievementDetailSheet } from "./achievement-detail-sheet";

type AchievementCopy = { title: string; description: string };

/** Fallback SVG icon for achievements without a badge image asset. */
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

/** Real badge art assets — used when available, falling back to ACHIEVEMENT_ICONS. */
const ACHIEVEMENT_ASSETS: Partial<Record<string, string>> = {
  "first-focus-day": "/art/achievements/1day-focus",
  "three-day-rhythm": "/art/achievements/3day-focus",
  "seven-day-focus": "/art/achievements/7day-focus",
};

type Props = {
  achievements: Achievement[];
};

export function AchievementsGrid({ achievements }: Props) {
  const t = useTranslations("ACHIEVEMENTS_COPY");
  const [selected, setSelected] = useState<Achievement | null>(null);

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
  const assetBase = ACHIEVEMENT_ASSETS[achievement.id];

  return (
    <button
      type="button"
      onClick={() => onSelect(achievement)}
      className={`achievement-tile ${earned ? "achievement-tile--earned" : "achievement-tile--locked"} active:scale-95`}
    >
      {/* Badge visual — image asset when available, SVG icon fallback for Full */}
      <div className="achievement-tile-badge-wrap">
        {assetBase ? (
          <picture>
            <source srcSet={`${assetBase}.avif`} type="image/avif" />
            <source srcSet={`${assetBase}.webp`} type="image/webp" />
            <img
              src={`${assetBase}.png`}
              alt=""
              aria-hidden="true"
              draggable={false}
              className={`achievement-tile-badge-img${!earned ? " achievement-tile-badge-img--locked" : ""}`}
            />
          </picture>
        ) : (
          <div className="achievement-tile-icon-wrap">
            <CandyIcon
              name={icon}
              className={`h-10 w-10 ${earned ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]" : "text-[rgba(63,34,8,0.30)] grayscale opacity-70"}`}
            />
          </div>
        )}

        {/* State badge — top-right corner of the badge area */}
        {earned ? (
          <div className="achievement-tile-state-badge achievement-tile-state-badge--earned" aria-hidden="true">
            <CandyIcon name="check" className="h-3 w-3 text-white" />
          </div>
        ) : (
          <div className="achievement-tile-state-badge achievement-tile-state-badge--locked" aria-hidden="true">
            <CandyIcon name="lock" className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Title only — description lives in the detail sheet */}
      <h4 className="achievement-tile-title">{copy.title}</h4>

      {/* Bottom state: progress bar, earned chip, or locked chip */}
      {!earned && progress ? (
        <div className="mt-2 w-full">
          <div className="mb-1 flex items-center justify-between px-0.5 text-nano font-black text-[rgba(63,34,8,0.50)]">
            <span>{t("progressEyebrow")}</span>
            <span>{progress.current}/{progress.goal}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(63,34,8,0.06)]">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${(progress.current / progress.goal) * 100}%` }}
            />
          </div>
        </div>
      ) : earned ? (
        <div className="mt-2">
          <CandyChip variant="success" tone="subtle">
            {t("earnedLabel")}
          </CandyChip>
        </div>
      ) : (
        <div className="mt-2">
          <CandyChip variant="warm" tone="subtle">
            {t("lockedLabel")}
          </CandyChip>
        </div>
      )}
    </button>
  );
}
