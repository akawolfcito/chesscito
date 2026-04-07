"use client";

import Link from "next/link";
import { useState } from "react";
import { BADGE_EARNED_COPY, PIECE_COMPLETE_COPY, PIECE_LABELS, RESULT_OVERLAY_COPY, SHARE_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { EXERCISES_PER_PIECE } from "@/lib/game/exercises";

type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
type SuccessVariant = "badge" | "score" | "shop";
type Variant = SuccessVariant | "error";

type ResultOverlayProps = {
  variant: Variant;
  pieceType?: PieceKey;
  itemLabel?: string;
  txHash?: string;
  celoscanHref?: string;
  errorMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  totalStars?: number;
};

const VARIANT_IMG: Record<SuccessVariant, string> = {
  badge: "/art/pieces/w-rook.png", // overridden by pieceType
  score: "/art/score-chesscito.png",
  shop: "/art/badge-chesscito.png",
};

function getBadgeImg(pieceType?: PieceKey): string {
  const map: Record<PieceKey, string> = {
    rook: "/art/pieces/w-rook.png",
    bishop: "/art/pieces/w-bishop.png",
    knight: "/art/pieces/w-knight.png",
    pawn: "/art/pieces/w-pawn.png",
    queen: "/art/pieces/w-queen.png",
    king: "/art/pieces/w-king.png",
  };
  return map[pieceType ?? "rook"];
}

function getTitle(variant: Variant): string {
  if (variant === "error") return RESULT_OVERLAY_COPY.error.title;
  return RESULT_OVERLAY_COPY[variant].title;
}

function getSubtitle(variant: Variant, pieceType?: PieceKey, itemLabel?: string, errorMessage?: string): string {
  switch (variant) {
    case "badge":
      return RESULT_OVERLAY_COPY.badge.subtitle(
        PIECE_LABELS[pieceType ?? "rook"]
      );
    case "score":
      return RESULT_OVERLAY_COPY.score.subtitle;
    case "shop":
      return RESULT_OVERLAY_COPY.shop.subtitle(itemLabel ?? "Item");
    case "error":
      return errorMessage ?? RESULT_OVERLAY_COPY.error.unknown;
  }
}

function SuccessImage({ variant, pieceType, glowClass }: { variant: SuccessVariant; pieceType?: PieceKey; glowClass?: string }) {
  const src = variant === "badge" ? getBadgeImg(pieceType) : VARIANT_IMG[variant];
  return (
    <div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
      <picture
        className="reward-icon-showcase reward-ceremony-icon relative z-10"
        style={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }}
      >
        <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
        <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
        <img src={src} alt="" className="h-32 w-32 object-contain drop-shadow-lg" />
      </picture>
    </div>
  );
}

const MAX_STARS = EXERCISES_PER_PIECE * 3;

function StarsRow({ totalStars, staggered = false }: { totalStars: number; staggered?: boolean }) {
  const filled = Math.min(EXERCISES_PER_PIECE, Math.ceil(totalStars / 3));
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: EXERCISES_PER_PIECE }, (_, i) => {
        const isEarned = i < filled;
        const starDelay = 400 + i * 150;
        return (
          <span
            key={i}
            className={
              isEarned
                ? "reward-ceremony-star text-amber-400 inline-block"
                : "text-amber-400/30"
            }
            style={
              isEarned && staggered
                ? {
                    opacity: 0,
                    animation: `reward-star-bounce 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${starDelay}ms forwards`,
                  }
                : undefined
            }
            aria-hidden="true"
          >
            {isEarned ? "★" : "☆"}
          </span>
        );
      })}
      <span
        className="reward-ceremony-buttons ml-1 text-xs text-cyan-100/70"
        style={staggered ? { opacity: 0, animation: "reward-buttons-enter 250ms ease-out 1200ms forwards" } : undefined}
      >
        {totalStars}/{MAX_STARS}
      </span>
    </div>
  );
}

function getShareText(variant: SuccessVariant, pieceType?: PieceKey, itemLabel?: string, totalStars?: number): string {
  switch (variant) {
    case "badge":
      return SHARE_COPY.badge(PIECE_LABELS[pieceType ?? "rook"], totalStars ?? 0);
    case "score":
      return SHARE_COPY.score(totalStars ?? 0);
    case "shop":
      return SHARE_COPY.shop(itemLabel ?? "an item");
  }
}

function ShareButton({ variant, pieceType, itemLabel, totalStars }: {
  variant: SuccessVariant;
  pieceType?: PieceKey;
  itemLabel?: string;
  totalStars?: number;
}) {
  const [copied, setCopied] = useState(false);
  const text = getShareText(variant, pieceType, itemLabel, totalStars);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url: SHARE_COPY.url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n${SHARE_COPY.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard also failed — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="w-full rounded-xl border border-cyan-400/30 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10 active:scale-[0.98]"
    >
      {copied ? SHARE_COPY.fallbackCopied : SHARE_COPY.button}
    </button>
  );
}

export function ResultOverlay({
  variant,
  pieceType,
  itemLabel,
  txHash,
  celoscanHref,
  errorMessage,
  onDismiss,
  onRetry,
  totalStars,
}: ResultOverlayProps) {
  const [exiting, setExiting] = useState(false);
  const isError = variant === "error";
  const title = getTitle(variant);
  const subtitle = getSubtitle(variant, pieceType, itemLabel, errorMessage);

  function handleDismiss() {
    setExiting(true);
    setTimeout(onDismiss, 250);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`${isError ? "panel-elevated" : "panel-showcase"} reward-ceremony-panel flex w-full max-w-xs flex-col items-center gap-6 px-6 py-10 text-center`}
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        {/* Image or error icon */}
        {isError ? (
          <div className="h-20 w-20">
            <LottieAnimation src="/animations/error-alert.lottie" loop className="h-full w-full" />
          </div>
        ) : (
          <SuccessImage variant={variant} pieceType={pieceType} glowClass={variant === "badge" ? "reward-glow-achievement reward-glow-pulse" : "reward-glow-progress"} />
        )}

        {/* Title */}
        <h2 className={`fantasy-title text-2xl ${isError ? "text-rose-100" : "text-cyan-50 drop-shadow-[0_0_8px_rgba(34,211,238,0.2)]"}`}>
          {title}
        </h2>

        {/* Subtitle */}
        <p className={`text-sm leading-relaxed ${isError ? "text-rose-200/80" : "text-cyan-100/80"}`}>
          {subtitle}
        </p>

        {/* Stars (badge/score only) */}
        {!isError && variant !== "shop" && totalStars != null ? (
          <StarsRow totalStars={totalStars} staggered />
        ) : null}

        {/* CeloScan link (success only) */}
        {!isError && txHash && celoscanHref ? (
          <Link
            href={celoscanHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-cyan-400 underline underline-offset-2"
          >
            {RESULT_OVERLAY_COPY.cta.viewOnCeloscan}
          </Link>
        ) : null}

        {/* CTA buttons */}
        <div
          className="reward-ceremony-buttons mt-2 flex w-full flex-col gap-2"
          style={{ opacity: 0, animation: "reward-buttons-enter 300ms ease-out 1300ms forwards" }}
        >
          {!isError ? (
            <ShareButton variant={variant} pieceType={pieceType} itemLabel={itemLabel} totalStars={totalStars} />
          ) : null}

          {isError && onRetry ? (
            <Button
              type="button"
              variant="game-solid"
              size="game"
              onClick={onRetry}
            >
              {RESULT_OVERLAY_COPY.cta.tryAgain}
            </Button>
          ) : null}

          {isError && onRetry ? (
            <Button
              type="button"
              variant="game-text"
              size="game-sm"
              onClick={handleDismiss}
            >
              {RESULT_OVERLAY_COPY.cta.dismiss}
            </Button>
          ) : (
            <Button
              type="button"
              variant="game-primary"
              size="game"
              onClick={handleDismiss}
            >
              {RESULT_OVERLAY_COPY.cta.continue}
            </Button>
          )}
        </div>

        {/* Branding footer (success only) */}
        {!isError ? (
          <div className="mt-4 flex flex-col items-center gap-0.5">
            <span className="fantasy-title text-sm text-cyan-100/50">chesscito</span>
            <span className="text-[0.65rem] text-cyan-100/30">on Celo</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type BadgeEarnedPromptProps = {
  pieceType: PieceKey;
  totalStars: number;
  onSubmitScore: () => void;
  onLater: () => void;
};

const BADGE_AUTO_DISMISS_MS = 15_000;

export function BadgeEarnedPrompt({
  pieceType,
  totalStars,
  onSubmitScore,
  onLater,
}: BadgeEarnedPromptProps) {
  const [exiting, setExiting] = useState(false);
  const title = BADGE_EARNED_COPY.title(PIECE_LABELS[pieceType]);

  function handleLater() {
    setExiting(true);
    setTimeout(onLater, 250);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-earned-title"
    >
      <div
        className="panel-showcase reward-ceremony-panel flex w-full max-w-xs flex-col items-center gap-6 px-6 py-10 text-center relative overflow-hidden"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        {/* Auto-dismiss countdown bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-cyan-400/20">
          <div
            className="h-full bg-cyan-400/60 rounded-r-full"
            style={{
              animation: `badge-countdown ${BADGE_AUTO_DISMISS_MS}ms linear forwards`,
            }}
          />
        </div>
        <SuccessImage variant="badge" pieceType={pieceType} glowClass="reward-glow-achievement reward-glow-pulse" />

        <StarsRow totalStars={totalStars} staggered />

        <h2 id="badge-earned-title" className="fantasy-title text-2xl text-cyan-50">{title}</h2>

        <div
          className="reward-ceremony-buttons mt-2 flex w-full flex-col gap-2"
          style={{ opacity: 0, animation: "reward-buttons-enter 300ms ease-out 1300ms forwards" }}
        >
          <Button
            type="button"
            variant="game-solid"
            size="game"
            onClick={onSubmitScore}
          >
            {BADGE_EARNED_COPY.submitScore}
          </Button>
          <ShareButton variant="badge" pieceType={pieceType} totalStars={totalStars} />
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={handleLater}
          >
            {BADGE_EARNED_COPY.later}
          </Button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-0.5">
          <span className="fantasy-title text-sm text-cyan-100/50">chesscito</span>
          <span className="text-[0.65rem] text-cyan-100/30">on Celo</span>
        </div>
      </div>
    </div>
  );
}

type PieceCompletePromptProps = {
  pieceType: PieceKey;
  nextPiece: PieceKey | null;
  hasClaimedBadge: boolean;
  totalStars: number;
  onNextPiece: () => void;
  onArena: () => void;
  onPracticeAgain: () => void;
};

export function PieceCompletePrompt({
  pieceType,
  nextPiece,
  hasClaimedBadge,
  totalStars,
  onNextPiece,
  onArena,
  onPracticeAgain,
}: PieceCompletePromptProps) {
  const [exiting, setExiting] = useState(false);

  const subtitle = nextPiece && hasClaimedBadge
    ? PIECE_COMPLETE_COPY.subtitleWithNext(PIECE_LABELS[nextPiece])
    : !hasClaimedBadge
      ? PIECE_COMPLETE_COPY.subtitleKeepPracticing
      : PIECE_COMPLETE_COPY.subtitleFinal;

  function handleAction(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 250);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={PIECE_COMPLETE_COPY.title}
    >
      <div
        className="panel-showcase reward-ceremony-panel flex w-full max-w-xs flex-col items-center gap-6 px-6 py-10 text-center"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        <SuccessImage variant="badge" pieceType={pieceType} glowClass="reward-glow-progress" />

        <StarsRow totalStars={totalStars} staggered />

        <h2 className="fantasy-title text-2xl text-cyan-50">
          {PIECE_COMPLETE_COPY.title}
        </h2>

        <p className="text-sm leading-relaxed text-cyan-100/80">
          {subtitle}
        </p>

        <div
          className="reward-ceremony-buttons mt-2 flex w-full flex-col gap-2"
          style={{ opacity: 0, animation: "reward-buttons-enter 300ms ease-out 1300ms forwards" }}
        >
          {nextPiece && hasClaimedBadge ? (
            <Button
              type="button"
              variant="game-solid"
              size="game"
              onClick={() => handleAction(onNextPiece)}
            >
              {PIECE_COMPLETE_COPY.nextPiece(PIECE_LABELS[nextPiece])}
            </Button>
          ) : (
            <Button
              type="button"
              variant="game-solid"
              size="game"
              onClick={() => handleAction(onArena)}
            >
              {PIECE_COMPLETE_COPY.tryArena}
            </Button>
          )}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={() => handleAction(onPracticeAgain)}
          >
            {PIECE_COMPLETE_COPY.practiceAgain}
          </Button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-0.5">
          <span className="fantasy-title text-sm text-cyan-100/50">chesscito</span>
          <span className="text-[0.65rem] text-cyan-100/30">on Celo</span>
        </div>
      </div>
    </div>
  );
}
