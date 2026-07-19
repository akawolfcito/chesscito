"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { track } from "@/lib/telemetry";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

type Props = {
  /** Number of moves the player took to reach the target. */
  moves: number;
  /** Optimal move count for this labyrinth. */
  optimalMoves: number;
  /** Stars earned (0–3) — caller computes via labyrinthStars(). */
  stars: number;
  /** False for ludic variants that preserve a result but never award stars. */
  awardsStars?: boolean;
  /** Personal record before this attempt — null on first completion. */
  previousBest?: number | null;
  /** True when this attempt set a new personal record. */
  isNewBest?: boolean;
  /** QA F3 (2026-06-11): primary action — exit the labyrinth and
   *  advance to the next pending step of the path. The shell X shares
   *  this intent so closing never strands the player in the lab. */
  onContinue: () => void;
  /** Replay the completed challenge — demoted to the secondary slot. */
  onRetry: () => void;
  /** When defined, replaces the "Continue" primary CTA with "Enter
   *  Arena" and routes the user into the full match flow. Wired by
   *  exercises-screen only when the player has just solved every King
   *  labyrinth in the catalog. Before that the player is still
   *  finishing the King training cascade and the natural next step is
   *  another lap, not the Arena. */
  onEnterArena?: () => void;
};


/**
 * LabyrinthCompleteOverlay — L2 completion ceremony.
 *
 * 2026-06-05: migrated from CandyGlassShell + emoji trophy to the
 * arena-end-state vocabulary (VictoryPopupShell + panel-bg1 + stat
 * pills + arena-result-primary-cta) so it reads as a member of the
 * same celebration family as VictoryCelebration / arena-end-state-draw.
 */
export function LabyrinthCompleteOverlay({
  moves,
  optimalMoves,
  stars,
  awardsStars = true,
  previousBest = null,
  isNewBest = false,
  onContinue,
  onRetry,
  onEnterArena,
}: Props) {
  const t = useTranslations("LABYRINTH_COPY");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    track("modal_open", {
      id: "labyrinth-complete",
      moves,
      optimal: optimalMoves,
      stars,
    });
    track("labyrinth_complete", {
      isLite: CHESSCITO_LITE_MODE,
      moves,
      optimalMoves,
      stars,
      isNewBest: isNewBest ?? false,
    });
  }, [moves, optimalMoves, stars, isNewBest]);

  function handleAction(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 250);
  }

  const isOptimal = moves <= optimalMoves;
  const starsLabel = `${stars}/3`;
  const movesLabel = String(moves);
  const bestLabel = previousBest != null ? String(previousBest) : String(optimalMoves);

  return (
    <div className={exiting ? "modal-exiting" : undefined}>
      <VictoryPopupShell
        onClose={() => handleAction(onContinue)}
        ariaLabel={t("completeTitle")}
        role="alert"
        ariaLive="assertive"
        closeLabel={t("continue")}
      >
        {/* Hero — title centered (arena win-celebration vocabulary). */}
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title">{t("completeTitle")}</h1>
        </div>

        {/* Stats — optional stars plus moves / best candy pills. */}
        <div className="arena-result-stats-row arena-result-stats-row--missionpills">
          {awardsStars ? (
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="star" className="h-4 w-4" />
              </span>
              {starsLabel}
            </span>
          ) : null}
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
<ThemeAssetPicture slot="board.piece.white.pawn" alt="" aria-hidden="true" draggable={false} className="block h-full w-full object-contain" />
            </span>
            {movesLabel}
          </span>
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <CandyIcon name="trophy" className="h-4 w-4" />
            </span>
            {bestLabel}
          </span>
        </div>

        {/* Move narrative — Optimal! N moves OR N moves · optimal M. */}
        <p
          className="px-2 text-center text-sm font-semibold"
          style={{
            color: "rgba(63, 34, 8, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
          }}
        >
          {isOptimal
            ? t("completeMovesOptimalFormat", { moves })
            : t("completeMovesFormat", { moves, optimal: optimalMoves })}
        </p>

        {/* New best celebration pill OR perfect-path kicker. Personal
            record beats the static perfect-path label when both fire. */}
        {isNewBest ? (
          <p
            className="mx-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.10em]"
            style={{
              background: "rgba(245, 158, 11, 0.85)",
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              boxShadow:
                "0 0 12px rgba(245, 158, 11, 0.55), inset 0 1px 0 rgba(255, 245, 215, 0.45)",
            }}
          >
            {previousBest != null
              ? t("newBestFormat", { previous: previousBest, current: moves })
              : t("firstCompletionFormat", { moves })}
          </p>
        ) : isOptimal ? (
          <p
            className="text-center text-xs"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {t("perfectPath")}
          </p>
        ) : null}

        {/* BUTTONS — canonical PrincipalButton medium (popup-scope) + cream
            secondary. Continue-first (QA F3): the path advances by
            default; replay is the opt-in. When onEnterArena is provided
            the primary shifts to "Enter Arena" (King finale). */}
        <div className="flex flex-col items-center gap-2">
          <PrincipalButton
            size="medium"
            onClick={() =>
              handleAction(onEnterArena ?? onContinue)
            }
          >
            {onEnterArena ? t("enterArena") : t("continue")}
          </PrincipalButton>

          <button
            type="button"
            onClick={() => handleAction(onRetry)}
            className="arena-result-secondary-action"
          >
            {t("retry")}
          </button>
        </div>

        {/* AVATAR — Sally placement: bottom-right peek inside the panel's
            foliage zone, no longer competing with the CTA stack. */}
        <ThemeAssetPicture slot="shared.feedback-happy" pictureClassName="pointer-events-none absolute -right-2 bottom-12 h-24 w-24" alt="" aria-hidden="true" draggable={false} className="h-full w-full object-contain" />
      </VictoryPopupShell>
    </div>
  );
}
