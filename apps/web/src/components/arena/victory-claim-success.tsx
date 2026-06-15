"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CoachCostRibbon } from "@/components/coach/coach-cost-ribbon";
import { track } from "@/lib/telemetry";
import { SHARE_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { ShareModal } from "@/components/share/share-modal";
import { formatTime } from "@/lib/game/arena-utils";
import type { ClaimData, ShareStatus } from "./arena-end-state";
import sparklesData from "@/../public/animations/sparkles.json";
import { VictoryPopupShell } from "./victory-popup-shell";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  fen?: string;
  playerColor?: string;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  /** Optional dismiss-without-navigate handler (Sally retention loop). */
  onClose?: () => void;
  claimData: ClaimData;
  shareStatus: ShareStatus;
  onAskCoach?: () => void;
  /** Re-invoke the mint from the post-mint popup (unlimited re-save). */
  onSaveAgain?: () => void;
  /** Coach CTA gating — mirrors VictoryCelebration so post-mint shares
   *  the same coach-section vocabulary (#115). */
  coachCtaDisabled?: boolean;
  coachCtaBusy?: boolean;
  coachTooShort?: boolean;
  /** PRO status forwarded from arena-end-state — same flag as
   *  VictoryCelebration. Drives the coach pill label
   *  ("Open coach insight" vs "See key moments"). */
  proActive?: boolean;
};

const AVATAR_BASE = "/art/new-assets-chesscito/fun/avatar-feliz";

/**
 * Victory claim success popup — post-mint celebration.
 *
 * Same popup vocabulary as the loss + celebration variants. Trophy
 * lottie hero + "Claimed!" headline. Avatar-feroz (triumphant wolf)
 * floats right of the secondary actions row — the mint is done, the
 * coach is hyped. Coach + Share live as secondary candy chips; PLAY
 * AGAIN is the primary action to keep the loop going.
 */
export function VictoryClaimSuccess({
  moves,
  elapsedMs,
  difficulty,
  fen,
  playerColor,
  onPlayAgain,
  onBackToHub,
  onClose,
  claimData,
  shareStatus,
  onAskCoach,
  onSaveAgain,
  coachCtaDisabled = false,
  coachCtaBusy = false,
  coachTooShort = false,
  proActive = false,
}: Props) {
  const tArena = useTranslations("ARENA_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
  const tCoachEntry = useTranslations("COACH_ENTRY_COPY");
  const time = formatTime(elapsedMs);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    track("modal_open", {
      id: "victory-claim-success",
      difficulty,
      moves,
    });
    // M1 funnel (Commit 4) — fire save_victory_success exactly once per
    // mount of the post-mint surface so the funnel sees the conversion
    // even when the user navigates away before tapping a follow-up CTA.
    track("monetization.save_victory_success", { context: "endgame_win" });
  }, [difficulty, moves]);

  // Share card: use the on-chain victory OG when available, else fall
  // back to a match card built from game params (mirrors victory-celebration.tsx
  // lines ~100-108) so Share is always present regardless of mint status.
  const fallbackCardParams = new URLSearchParams({
    moves: String(moves),
    time: String(elapsedMs),
    diff: difficulty,
    result: "win",
  });
  if (fen) fallbackCardParams.set("fen", fen);
  if (playerColor) fallbackCardParams.set("color", playerColor);
  const fallbackCardUrl = `/api/og/match?${fallbackCardParams.toString()}`;
  const effectiveCardUrl = claimData.shareCardUrl ?? fallbackCardUrl;
  const shareUrl = claimData.shareLinkUrl ?? SHARE_COPY.url;
  const challengeText = tClaim("challengeText", { moves, url: shareUrl });
  const playAgainLabel = tArena("playAgain");
  const difficultyKey = difficulty as "easy" | "medium" | "hard";
  // (isShareReady removed — Share is now always present regardless of shareStatus)
  const difficultyLabel = ["easy", "medium", "hard"].includes(difficultyKey)
    ? tArena(`difficulty.${difficultyKey}`)
    : difficulty;
  const headline = tClaim("claimedBadge");
  const handleClose = onClose ?? onBackToHub;
  // M1 funnel (Commit 4) — post-mint Coach CTA inherits the same
  // curiosity frame as the pre-mint celebration so both surfaces
  // share one voice. Drops the PRO / free label split.
  const coachLabel = tCelebration("winCoachReviewCta");
  const coachKicker = tCoachEntry("reviewKicker");
  const coachHeadline = coachTooShort
    ? tCoachEntry("reviewHeadlineTooShort")
    : tCoachEntry("reviewHeadlineReady");
  const coachBody = coachTooShort
    ? tCoachEntry("reviewBodyTooShort")
    : tCoachEntry("reviewBodyReady");
  const coachTooltip = coachTooShort ? tCoachEntry("matchTooShort") : undefined;

  const handleCoachClick = () => {
    if (coachCtaDisabled || !onAskCoach) return;
    track("coach_victory_analyze_tap", {
      position: "secondary-on-claimed",
      too_short: coachTooShort,
    });
    // M1 funnel (Commit 4) — source="save_success" distinguishes
    // post-mint taps from pre-mint celebration taps without proliferating
    // event names. Same context (endgame_win) so dashboards roll up.
    track("monetization.coach_review_tap", {
      context: "endgame_win",
      source: "save_success",
    });
    onAskCoach();
  };

  return (
    <>
      <VictoryPopupShell
        onClose={handleClose}
        ariaLabel={headline}
        role="alert"
        ariaLive="assertive"
        closeLabel={tArena("closeResultAria")}
      >
        <div className="victory-popup-sparkles" aria-hidden="true">
          <LottieAnimation animationData={sparklesData} speed={1.35} className="h-full w-full opacity-30" />
        </div>

        {/* Hero — centered headline alone (no trophy). Matches the win-
            celebration hero so all win-* variants share the same opener. */}
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title victory-text-slam">{headline}</h1>
        </div>

        {/* Stats. */}
        <div className="arena-result-stats-row arena-result-stats-row--missionpills">
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <CandyIcon name="star" className="h-4 w-4" />
            </span>
            {difficultyLabel}
          </span>
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <picture>
                <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
                <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
                <img
                  src="/art/redesign/pieces/w-pawn.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="block h-full w-full object-contain"
                />
              </picture>
            </span>
            {String(moves)}
          </span>
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <CandyIcon name="time" className="h-4 w-4" />
            </span>
            {time}
          </span>
        </div>

        {/* COACH — kicker + body (amber Ask Coach pill LEFT, wolf RIGHT).
            Mirrors VictoryCelebration vocabulary so pre-mint and post-mint
            share the same coach-section silhouette (#115). */}
        {onAskCoach && (
          <div
            className="arena-result-coach-section"
            aria-labelledby="victory-claim-coach-headline"
          >
            <div className="arena-result-coach-kicker-row">
              <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
              <span
                className="arena-result-kicker"
                id="victory-claim-coach-headline"
              >
                {coachKicker}
              </span>
              <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
            </div>
            <div className="arena-result-coach-body">
              <div className="arena-result-coach-text">
                <h2
                  id="victory-claim-coach-headline-h2"
                  className="arena-result-coach-headline"
                >
                  {coachHeadline}
                </h2>
                <p className="arena-result-coach-body-text">{coachBody}</p>
                <button
                  type="button"
                  onClick={handleCoachClick}
                  disabled={coachCtaDisabled}
                  aria-busy={coachCtaBusy || undefined}
                  aria-disabled={coachCtaDisabled || undefined}
                  title={coachTooltip}
                  className="arena-result-primary-cta arena-result-primary-cta--amber disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CandyIcon name="coach" className="h-5 w-5 shrink-0" />
                  <span className="arena-result-primary-cta-label">{coachLabel}</span>
                  {!coachCtaDisabled && (
                    <CoachCostRibbon proActive={proActive} variant="cta" />
                  )}
                </button>
              </div>
              <picture className="arena-result-coach-avatar">
                <source srcSet={`${AVATAR_BASE}.avif`} type="image/avif" />
                <source srcSet={`${AVATAR_BASE}.webp`} type="image/webp" />
                <img src={`${AVATAR_BASE}.png`} alt="" aria-hidden="true" draggable={false} />
              </picture>
            </div>
          </div>
        )}

        {/* TERTIARY — Play again + Share + Save cream mini-pills. Share is
            always present: uses the on-chain victory card when ready, else
            falls back to a match card from game params so the user can
            always share regardless of mint status. Save Again re-invokes
            the mint for unlimited re-save (founder spec 2026-06-13). */}
        <div
          className={`victory-popup-secondary-row${onSaveAgain ? " victory-popup-secondary-row--triple" : ""}`}
        >
          <button
            type="button"
            onClick={onPlayAgain}
            className="arena-result-secondary-action"
            aria-label={playAgainLabel}
          >
            <span>{tCelebration("playAgainShort")}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="arena-result-secondary-action"
          >
            <span>{SHARE_COPY.button}</span>
          </button>
          {onSaveAgain && (
            <button
              type="button"
              onClick={onSaveAgain}
              className="arena-result-secondary-action"
              aria-label={tCelebration("primaryLabel")}
            >
              <span>{tCelebration("primaryLabel")}</span>
            </button>
          )}
        </div>
      </VictoryPopupShell>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        cardUrl={effectiveCardUrl}
        text={challengeText}
        url={shareUrl}
      />
    </>
  );
}
