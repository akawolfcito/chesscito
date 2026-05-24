"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { TreasureTile } from "@/components/scene-rooted/treasure-tile";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import type { Achievement } from "@/lib/achievements/compute";

type AchievementCopy = { title: string; description: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement: Achievement | null;
};

export function AchievementDetailSheet({ open, onOpenChange, achievement }: Props) {
  const t = useTranslations("ACHIEVEMENTS_COPY");
  if (!achievement) return null;
  const items = t.raw("items") as Record<string, AchievementCopy | undefined>;
  const copy = items[achievement.id];
  if (!copy) return null;

  const { earned, progress } = achievement;
  const subtitle = earned
    ? t("detailEarnedSubtitle")
    : t("detailLockedSubtitle");

  const progressPct = progress
    ? Math.min(100, Math.round((progress.current / progress.goal) * 100))
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={copy.title}
        description={copy.description}
        className="mission-shell sheet-bg-hub flex max-h-[85dvh] flex-col rounded-t-3xl border-0 pb-[5rem]"
      >
        {/* Canonical header strip. The earned/locked eyebrow now sits
         *  above the close-control header preserving the original
         *  visual stacking and DOM order. */}
        <div className="shrink-0 -mx-6 -mt-6 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <p
            className="text-nano font-bold uppercase tracking-wider px-4 pt-1"
            style={{ color: "rgba(110, 65, 15, 0.55)" }}
          >
            {subtitle}
          </p>
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/action-row/trofeo-epico" />}
            title={copy.title}
            close={{ onClick: () => onOpenChange(false), label: t("closeAchievementLabel") }}
          />
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          <div className="flex flex-col items-center gap-3">
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
              onClick={() => {}}
              disabled
              aria-label={`${copy.title} — ${earned ? t("earnedLabel") : t("lockedLabel")}`}
            />
          </div>

          <p
            className="text-center text-sm leading-relaxed"
            style={{
              color: "rgba(110, 65, 15, 0.85)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            {copy.description}
          </p>

          {!earned && progress ? (
            <div className="rounded-2xl border border-[rgba(110,65,15,0.22)] bg-white/15 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "rgba(110, 65, 15, 0.85)" }}
                >
                  {t("goalLabel")}
                </p>
                <p
                  className="text-sm font-extrabold"
                  style={{ color: "rgba(110, 65, 15, 0.95)" }}
                >
                  {t("progressLabel", { current: progress.current, goal: progress.goal })}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full"
                style={{ background: "rgba(110, 65, 15, 0.18)" }}
                role="progressbar"
                aria-valuenow={progress.current}
                aria-valuemin={0}
                aria-valuemax={progress.goal}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progressPct}%`,
                    background:
                      "linear-gradient(90deg, rgba(245,158,11,0.85) 0%, rgba(217,180,74,0.95) 100%)",
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
