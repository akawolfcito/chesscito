"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { PlayTacticsSheet } from "@/components/tactics/play-tactics-sheet";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import {
  getPlayTacticsProgress,
  isPlayTacticsCompletedToday,
  playTacticsTodayUtc,
  type PlayTacticsProgress,
} from "@/lib/tactics/progress";
import { emitPlayTacticsOpened } from "@/lib/tactics/telemetry";

const EMPTY_PROGRESS: PlayTacticsProgress = {
  lastCompletedDate: null,
  totalCompleted: 0,
};

type PlayTacticsTileProps = {
  /** Tile chrome. Defaults to the legacy pill classes so existing callers
   *  are unchanged; the Play Kingdom hub passes `""` to fall back to
   *  `HubActionTile`'s square reward-tile look for the CHESS TOOLS grid. */
  className?: string;
};

const DEFAULT_TILE_CLASSNAME =
  "candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left";

/** Competitive warm-up entry point. Completion locks replay until the next
 * UTC day without touching Learn/Daily Focus state. */
export function PlayTacticsTile({
  className = DEFAULT_TILE_CLASSNAME,
}: PlayTacticsTileProps = {}) {
  const t = useTranslations("PLAY_TACTICS_COPY");
  const today = playTacticsTodayUtc();
  const puzzle = useMemo(() => getDailyTactic(today), [today]);
  const [progress, setProgress] = useState<PlayTacticsProgress>(EMPTY_PROGRESS);
  const [open, setOpen] = useState(false);
  const completedToday = isPlayTacticsCompletedToday(today, progress);

  useEffect(() => {
    setProgress(getPlayTacticsProgress());
  }, []);

  return (
    <>
      <HubActionTile
        className={className}
        iconSlot="hub.daily-icon"
        label={t("tileLabel")}
        ariaLabel={
          completedToday ? t("completedAriaLabel") : t("tileAriaLabel")
        }
        disabled={completedToday}
        onClick={() => {
          emitPlayTacticsOpened({
            puzzleId: puzzle.id,
            piece: puzzle.piece,
            completedToday,
          });
          setOpen(true);
        }}
        badge={
          completedToday ? (
            <span className="play-hub-action-badge">{t("doneBadge")}</span>
          ) : undefined
        }
      />
      <PlayTacticsSheet
        open={open}
        onOpenChange={setOpen}
        onCompleted={setProgress}
      />
    </>
  );
}
