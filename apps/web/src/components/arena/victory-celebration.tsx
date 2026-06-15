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
import type { PlayerColor } from "@/lib/game/use-chess-game";
import sparklesData from "@/../public/animations/sparkles.json";
import { VictoryPopupShell } from "./victory-popup-shell";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  isCheckmate?: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  /** Optional popup close handler. When provided, the X button + scrim
   *  tap dismiss without navigating (Sally retention-loop guidance).
   *  Falls back to onBackToHub when omitted (legacy /coach/history). */
  onClose?: () => void;
  onClaimVictory?: () => void;
  claimPrice?: string;
  fen?: string;
  playerColor?: PlayerColor;
  onAskCoach?: () => void;
  /** Coach CTA gating from arena-end-state — matches CoachAnalysisCta. */
  coachCtaDisabled?: boolean;
  coachCtaBusy?: boolean;
  coachTooShort?: boolean;
  /** PRO status forwarded from the wagmi-aware parent so this client
   *  component can render in dev fixtures (no WagmiProvider in
   *  /dev/arena-end-state layout). */
  proActive?: boolean;
};

const AVATAR_BASE = "/art/new-assets-chesscito/fun/avatar-feliz";

/**
 * Victory celebration popup — initial win state before Mint Victory.
 *
 * Sally redesign 2026-05-27 (pass 2): mirrors the resign popup vocabulary
 * for visual cohesion across end-states.
 *  hero (trophy lottie LEFT + headline RIGHT, 2-col, no avatar in hero)
 *  → stats (3 candy pills)
 *  → primary "Save Victory" pill with right-aligned amber price chip
 *  → COACH section: kicker + rules + purple Ask Coach pill LEFT + full
 *    avatar-feliz wolf RIGHT (reuses .arena-result-coach-section from
 *    loss popup)
 *  → tertiary outline mini-pills (Play again + Share, sentence case)
 */
export function VictoryCelebration({
  moves,
  elapsedMs,
  difficulty,
  isCheckmate = true,
  onPlayAgain,
  onBackToHub,
  onClose,
  onClaimVictory,
  claimPrice,
  fen,
  playerColor,
  onAskCoach,
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

  // Boolean-signature deps prevent modal_open from re-firing on every
  // parent render that hands us new callback identities — the prior
  // [onClaimVictory, onAskCoach] deps tripled the event on a single
  // celebration (observed in telemetry 2026-05-28). The semantic
  // signal we want is "did availability of these CTAs change?", which
  // these booleans answer exactly.
  const canClaim = Boolean(onClaimVictory);
  const coachCtaVisible = Boolean(onAskCoach);
  useEffect(() => {
    track("modal_open", {
      id: "victory-celebration",
      difficulty,
      moves,
      can_claim: canClaim,
      coach_cta_visible: coachCtaVisible,
    });
  }, [difficulty, moves, canClaim, coachCtaVisible]);

  const cardParams = new URLSearchParams({
    moves: String(moves),
    time: String(elapsedMs),
    diff: difficulty,
    result: "win",
  });
  if (fen) cardParams.set("fen", fen);
  if (playerColor) cardParams.set("color", playerColor);
  const cardUrl = `/api/og/match?${cardParams.toString()}`;
  const challengeText = tClaim("challengeText", { moves, url: SHARE_COPY.url });
  const primaryLabel = tCelebration("primaryLabel");
  const claimAriaLabel = `${primaryLabel}${claimPrice ? ` · ${claimPrice}` : ""}`;
  const difficultyKey = difficulty as "easy" | "medium" | "hard";
  const difficultyLabel = ["easy", "medium", "hard"].includes(difficultyKey)
    ? tArena(`difficulty.${difficultyKey}`)
    : difficulty;
  const headline = isCheckmate
    ? tCelebration("headlineCheckmate")
    : tCelebration("headlineWin");
  // M1 funnel (Commit 4) — Coach CTA now frames the invitation as
  // curiosity about success ("Why did you win?") regardless of PRO
  // status. Replaces the legacy coachPillFree / coachPillPro split.
  const coachLabel = tCelebration("winCoachReviewCta");
  const coachKicker = tCoachEntry("reviewKicker");
  const coachHeadline = coachTooShort
    ? tCoachEntry("reviewHeadlineTooShort")
    : tCoachEntry("reviewHeadlineReady");
  const coachBody = coachTooShort
    ? tCoachEntry("reviewBodyTooShort")
    : tCoachEntry("reviewBodyReady");
  const saveHeadline = tCelebration("saveSectionHeadline");
  const saveBody = tCelebration("saveSectionBody");
  const coachTooltip = coachTooShort ? tCoachEntry("matchTooShort") : undefined;
  const handleClose = onClose ?? onBackToHub;

  const handleCoachClick = () => {
    if (coachCtaDisabled || !onAskCoach) return;
    track("coach_victory_analyze_tap", {
      position: "secondary-on-win",
      too_short: coachTooShort,
    });
    // M1 funnel (Commit 4) — monetization-namespaced event so the win
    // funnel rolls up alongside loss/resign/draw events without
    // disturbing the legacy coach_victory_analyze_tap dashboards.
    track("monetization.coach_review_tap", {
      context: "endgame_win",
      source: "endgame",
    });
    onAskCoach();
  };

  const handleClaimClick = () => {
    if (!onClaimVictory) return;
    track("monetization.save_victory_tap", { context: "endgame_win" });
    onClaimVictory();
  };

  return (
    <>
      <VictoryPopupShell
        onClose={handleClose}
        disableBackdropClose={Boolean(onClaimVictory)}
        ariaLabel={headline}
        role="alert"
        ariaLive="assertive"
        closeLabel={tArena("closeResultAria")}
      >
        {/* Sparkles lottie behind the panel content. */}
        <div className="victory-popup-sparkles" aria-hidden="true">
          <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-30" />
        </div>

        {/* Hero — headline solo, centrado. Sin trofeo/avatar peleando
            por espacio (Wolfcito 2026-05-27): "Checkmate!" lee en una
            sola línea con peso pleno. La celebración la cargan el
            sparkles backdrop + el wolfcito en coach section + el amber
            Save Victory CTA debajo. */}
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title victory-text-slam">{headline}</h1>
        </div>

        {/* Stats row — 3 candy pills. */}
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

        {/* SAVE — headline + body + treasure pill. Sally pass 14
            (2026-05-27): kicker "SAVE THIS WIN" dropped — el headline
            "Yours forever." ya carga la promesa sin necesidad de un
            kicker arriba que repite el WIN context del Checkmate. */}
        {onClaimVictory && (
          <div className="arena-result-save-section" aria-labelledby="victory-save-headline">
            <h2 id="victory-save-headline" className="arena-result-coach-headline">
              {saveHeadline}
            </h2>
            <p className="arena-result-coach-body-text">{saveBody}</p>
            <button
              type="button"
              onClick={handleClaimClick}
              aria-label={claimAriaLabel}
              className="arena-result-primary-cta arena-result-primary-cta--treasure"
            >
              <picture className="arena-result-primary-cta-treasure-icon">
                <source srcSet="/art/new-icons-chesscito/save.avif" type="image/avif" />
                <source srcSet="/art/new-icons-chesscito/save.webp" type="image/webp" />
                <img src="/art/new-icons-chesscito/save.png" alt="" draggable={false} />
              </picture>
              <span className="arena-result-primary-cta-label">{primaryLabel}</span>
              {claimPrice && (
                <span
                  className="arena-result-treasure-price-ribbon"
                  aria-hidden="true"
                >
                  {claimPrice}
                </span>
              )}
            </button>
          </div>
        )}

        {/* COACH — kicker + body (purple Ask Coach pill LEFT, wolf RIGHT).
            Reuses the resign popup's coach-section vocabulary verbatim
            for visual cohesion across end-states. */}
        {onAskCoach && (
          <div
            className="arena-result-coach-section"
            aria-labelledby="victory-coach-review-headline"
          >
            <div className="arena-result-coach-kicker-row">
              <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
              <span className="arena-result-kicker" id="victory-coach-review-headline">
                {coachKicker}
              </span>
              <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
            </div>
            <div className="arena-result-coach-body">
              <div className="arena-result-coach-text">
                <h2
                  id="victory-coach-review-headline-h2"
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

        {/* TERTIARY — Play again + Share cream pills (filled, claramente
            tapeables pero más chicos que el primary). Reuses the same
            .arena-result-secondary-action class as the loss popup so
            both end-states share secondary vocabulary. */}
        <div className="victory-popup-secondary-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className="arena-result-secondary-action"
          >
            <span>{tCelebration("playAgainShort")}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="arena-result-secondary-action"
          >
            <span>{tCelebration("shareShort")}</span>
          </button>
        </div>
      </VictoryPopupShell>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        cardUrl={cardUrl}
        text={challengeText}
      />
    </>
  );
}
