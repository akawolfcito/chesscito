"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { TreasureTile } from "@/components/scene-rooted/treasure-tile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ACHIEVEMENTS_COPY } from "@/lib/content/editorial";
import type { Achievement } from "@/lib/achievements/compute";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement: Achievement | null;
};

export function AchievementDetailSheet({ open, onOpenChange, achievement }: Props) {
  if (!achievement) return null;
  const copy =
    ACHIEVEMENTS_COPY.items[achievement.id as keyof typeof ACHIEVEMENTS_COPY.items];
  if (!copy) return null;

  const { earned, progress } = achievement;
  const subtitle = earned
    ? ACHIEVEMENTS_COPY.detailEarnedSubtitle
    : ACHIEVEMENTS_COPY.detailLockedSubtitle;

  const progressPct = progress
    ? Math.min(100, Math.round((progress.current / progress.goal) * 100))
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub flex max-h-[85dvh] flex-col rounded-t-3xl border-0 pb-[5rem]"
      >
        <SheetHeader className="text-left">
          <p
            className="text-nano font-bold uppercase tracking-wider"
            style={{ color: "rgba(110, 65, 15, 0.55)" }}
          >
            {subtitle}
          </p>
          <SheetTitle
            className="fantasy-title"
            style={{
              color: "rgba(110, 65, 15, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            }}
          >
            {copy.title}
          </SheetTitle>
          <SheetDescription className="sr-only">{copy.description}</SheetDescription>
        </SheetHeader>

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
              aria-label={`${copy.title} — ${earned ? ACHIEVEMENTS_COPY.earnedLabel : ACHIEVEMENTS_COPY.lockedLabel}`}
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
                  {ACHIEVEMENTS_COPY.goalLabel}
                </p>
                <p
                  className="text-sm font-extrabold"
                  style={{ color: "rgba(110, 65, 15, 0.95)" }}
                >
                  {ACHIEVEMENTS_COPY.progressLabel(progress.current, progress.goal)}
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
