"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import type { TxErrorKind } from "@/lib/errors";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";
import { VictoryPopupShell } from "./victory-popup-shell";

export type ClaimEndKind = "error" | "cancelled" | "timeout";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  isCheckmate?: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  /** Optional dismiss-without-navigate handler (Sally retention loop). */
  onClose?: () => void;
  errorMessage?: string | null;
  onRetry?: () => void;
  kind?: ClaimEndKind;
  /** Locale-agnostic kind from useMintVictory(). When set to
   *  "insufficientFunds" AND the runtime is MiniPay, the popup
   *  surfaces an Add Cash recovery deeplink alongside the existing
   *  Try Again / Play Again CTAs. Outside MiniPay AddCashCta returns
   *  null so the existing UX is preserved. */
  errorKind?: TxErrorKind | null;
};

const AVATAR_BASE = "/art/new-assets-chesscito/fun/avatar-asustado";

/**
 * Victory claim error popup — mint failed / cancelled / timed out.
 *
 * Same popup vocabulary as the loss + celebration variants. Trophy
 * lottie hero (dimmed for error, full chroma for cancelled), kind-
 * specific headline + subtitle + hint, avatar-asustado (worried wolf)
 * floating right. PRIMARY: Try Again (if onRetry). SECONDARY:
 * Play Again. Errors use rose tones + assertive aria; cancellation
 * stays amber + polite per the existing design system rule.
 */
export function VictoryClaimError({
  moves,
  elapsedMs,
  difficulty,
  onPlayAgain,
  onBackToHub,
  onClose,
  errorMessage,
  onRetry,
  kind = "error",
  errorKind = null,
}: Props) {
  const tArena = useTranslations("ARENA_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
  const time = formatTime(elapsedMs);
  const kindTitle = tClaim(`errorKindCopy.${kind}.title`);
  const kindSubtitle = tClaim(`errorKindCopy.${kind}.subtitle`);
  const kindHint = tClaim(`errorKindCopy.${kind}.hint`);
  const difficultyKey = difficulty as "easy" | "medium" | "hard";
  const difficultyLabel = ["easy", "medium", "hard"].includes(difficultyKey)
    ? tArena(`difficulty.${difficultyKey}`)
    : difficulty;

  const isCancelled = kind === "cancelled";
  const isTimeout = kind === "timeout";
  const statusHeadline = isCancelled
    ? tClaim("statusHeadlinePaused")
    : isTimeout
      ? tClaim("statusHeadlineTimeout")
      : tClaim("statusHeadlineError");
  const tryAgainLabel = tClaim("tryAgain");
  const playAgainLabel = tArena("playAgain");
  const handleClose = onClose ?? onBackToHub;

  return (
    <VictoryPopupShell
      onClose={handleClose}
      ariaLabel={statusHeadline}
      role={isCancelled ? "dialog" : "alert"}
      ariaLive={isCancelled ? "polite" : "assertive"}
      closeLabel={tArena("backToHubAria")}
    >
      <div className="victory-popup-sparkles" aria-hidden="true">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-15" />
      </div>

      {/* Hero — for kind="error" the descriptive title becomes the H1
          (the bare "Error" status added no information and stacked
          redundantly above the same subtitle). cancelled/timeout keep
          the prior kicker + statusHeadline rhythm so the polite/wait
          variants stay distinguishable. */}
      {kind === "error" ? (
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title">{kindTitle}</h1>
        </div>
      ) : (
        <div className="victory-popup-hero-solo victory-popup-hero-solo--with-kicker">
          <span className="arena-result-kicker">{kindTitle}</span>
          <h1 className="arena-result-title">{statusHeadline}</h1>
        </div>
      )}

      {/* Body. For kind="error" the line is either the specific error
          message (e.g., insufficient balance) OR the generic recovery
          hint, never both. Drops the old triple-stack of subtitle +
          errorMessage + hint that surfaced the same idea three times
          and contradicted itself ("Couldn't save" + "your result is
          saved"). cancelled/timeout keep the additive subtitle + hint
          structure because each line adds distinct context. */}
      {kind === "error" ? (
        <div className="victory-popup-error-detail">
          <p className="victory-popup-error-hint">{errorMessage || kindHint}</p>
        </div>
      ) : (
        <div className="victory-popup-error-detail">
          {kindSubtitle && <p className="victory-popup-error-subtitle">{kindSubtitle}</p>}
          <p className="victory-popup-error-hint">{kindHint}</p>
        </div>
      )}

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

      {/* Primary Try Again (if retry available) + worried wolf right. */}
      <div className="victory-popup-mint-row">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label={tryAgainLabel}
            className="arena-result-primary-cta arena-result-primary-cta--amber arena-result-primary-cta--inset"
          >
            <span className="arena-result-primary-cta-label">{tryAgainLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlayAgain}
            className="arena-result-primary-cta arena-result-primary-cta--amber arena-result-primary-cta--inset"
            aria-label={playAgainLabel}
          >
            <span className="arena-result-primary-cta-label">{playAgainLabel}</span>
          </button>
        )}
        <picture className="arena-result-coach-avatar victory-popup-avatar">
          <source srcSet={`${AVATAR_BASE}.avif`} type="image/avif" />
          <source srcSet={`${AVATAR_BASE}.webp`} type="image/webp" />
          <img src={`${AVATAR_BASE}.png`} alt="" aria-hidden="true" draggable={false} />
        </picture>
      </div>

      {/* Secondary row. Renders if EITHER Play Again is exposed (retry
          is the primary) OR the AddCashCta should appear (insufficient
          funds inside MiniPay). The CTA does not depend on `onRetry`
          so an accidental missing handler does not drop the recovery
          affordance. */}
      {(onRetry || errorKind === "insufficientFunds") && (
        <div className="victory-popup-secondary-row">
          {onRetry && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="arena-result-secondary-action"
            >
              <span>{playAgainLabel}</span>
            </button>
          )}
          {errorKind === "insufficientFunds" && (
            <AddCashCta source="mint-victory" />
          )}
        </div>
      )}
    </VictoryPopupShell>
  );
}
