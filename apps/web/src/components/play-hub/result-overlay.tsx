"use client";

import Link from "next/link";
import { useState } from "react";
import { BADGE_EARNED_COPY, PIECE_COMPLETE_COPY, PIECE_LABELS, RESULT_OVERLAY_COPY, SHARE_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { EXERCISES_PER_PIECE } from "@/lib/game/exercises";
import { THEME_CONFIG } from "@/lib/theme";

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
  badge: `${THEME_CONFIG.piecesBase}/w-rook.png`, // overridden by pieceType
  score: "/art/score-chesscito.png",
  shop: "/art/badge-chesscito.png",
};

function getBadgeImg(pieceType?: PieceKey): string {
  const base = THEME_CONFIG.piecesBase;
  const map: Record<PieceKey, string> = {
    rook: `${base}/w-rook.png`,
    bishop: `${base}/w-bishop.png`,
    knight: `${base}/w-knight.png`,
    pawn: `${base}/w-pawn.png`,
    queen: `${base}/w-queen.png`,
    king: `${base}/w-king.png`,
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

function SuccessImage({
  variant,
  pieceType,
  glowClass,
  size = "lg",
}: {
  variant: SuccessVariant;
  pieceType?: PieceKey;
  glowClass?: string;
  size?: "sm" | "lg";
}) {
  const src = variant === "badge" ? getBadgeImg(pieceType) : VARIANT_IMG[variant];
  const hasOptimized = variant === "badge" ? THEME_CONFIG.hasOptimizedFormats : true;
  const sizeClass = size === "sm" ? "h-20 w-20" : "h-32 w-32";
  return (
    <div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
      <picture
        className="reward-icon-showcase reward-ceremony-icon relative z-10"
        style={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }}
      >
        {hasOptimized && (
          <>
            <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
            <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
          </>
        )}
        <img src={src} alt="" className={`${sizeClass} object-contain drop-shadow-lg`} />
      </picture>
    </div>
  );
}

const MAX_STARS = EXERCISES_PER_PIECE * 3;

function StarsRow({
  totalStars,
  staggered = false,
}: {
  totalStars: number;
  staggered?: boolean;
}) {
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
                ? "reward-ceremony-star text-amber-500 inline-block"
                : "text-amber-700/25"
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
        className="reward-ceremony-buttons ml-1 text-xs"
        style={{
          color: "rgba(110, 65, 15, 0.75)",
          ...(staggered
            ? { opacity: 0, animation: "reward-buttons-enter 250ms ease-out 1200ms forwards" }
            : {}),
        }}
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
      className="w-full rounded-xl border py-3 text-sm font-bold transition active:scale-[0.98]"
      style={{
        background: "rgba(255, 255, 255, 0.18)",
        borderColor: "rgba(255, 255, 255, 0.50)",
        color: "rgba(110, 65, 15, 0.90)",
        textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
      }}
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
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleDismiss}
    >
      <div
        className="relative w-full max-w-xs"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={title}
          onClose={handleDismiss}
          closeLabel={RESULT_OVERLAY_COPY.cta.dismiss}
          cta={
            isError && onRetry ? (
              <div className="flex flex-col gap-1.5">
                <Button type="button" variant="game-solid" size="game" onClick={onRetry} className="w-full">
                  {RESULT_OVERLAY_COPY.cta.tryAgain}
                </Button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-1 text-xs font-semibold underline underline-offset-2"
                  style={{ color: "rgba(110, 65, 15, 0.70)" }}
                >
                  {RESULT_OVERLAY_COPY.cta.dismiss}
                </button>
              </div>
            ) : (
              <Button type="button" variant="game-primary" size="game" onClick={handleDismiss} className="w-full">
                {RESULT_OVERLAY_COPY.cta.continue}
              </Button>
            )
          }
          meta={
            !isError ? (
              <>
                <span className="fantasy-title">chesscito</span>
                <span className="opacity-70"> · on Celo</span>
              </>
            ) : null
          }
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {isError ? (
              <div className="h-16 w-16">
                <LottieAnimation src="/animations/error-alert.lottie" loop className="h-full w-full" />
              </div>
            ) : (
              <SuccessImage
                variant={variant}
                pieceType={pieceType}
                glowClass={variant === "badge" ? "reward-glow-achievement reward-glow-pulse" : "reward-glow-progress"}
                size="sm"
              />
            )}

            {!isError && variant !== "shop" && totalStars != null ? (
              <StarsRow totalStars={totalStars} staggered />
            ) : null}

            <p
              className="text-sm leading-snug"
              style={{
                color: isError
                  ? "rgba(159, 18, 57, 0.95)"
                  : "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {subtitle}
            </p>

            {!isError && txHash && celoscanHref ? (
              <Link
                href={celoscanHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(120, 65, 5, 0.95)" }}
              >
                {RESULT_OVERLAY_COPY.cta.viewOnCeloscan}
              </Link>
            ) : null}

            {!isError ? (
              <ShareButton variant={variant} pieceType={pieceType} itemLabel={itemLabel} totalStars={totalStars} />
            ) : null}
          </div>
        </CandyGlassShell>
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
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-earned-title"
      onClick={handleLater}
    >
      <div
        className="relative w-full max-w-xs"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Auto-dismiss countdown bar — sits above the glass card so it reads
            as a "timer on the modal" rather than a card element. */}
        <div className="absolute left-1/2 top-[-0.6rem] z-10 h-1 w-[60%] -translate-x-1/2 overflow-hidden rounded-full bg-amber-900/15">
          <div
            className="h-full rounded-full bg-amber-500/70"
            style={{ animation: `badge-countdown ${BADGE_AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>

        <CandyGlassShell
          title="Badge Earned"
          onClose={handleLater}
          closeLabel={BADGE_EARNED_COPY.later}
          cta={
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="game-solid"
                size="game"
                onClick={onSubmitScore}
                className="w-full"
              >
                {BADGE_EARNED_COPY.submitScore}
              </Button>
              <button
                type="button"
                onClick={handleLater}
                className="w-full py-1 text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {BADGE_EARNED_COPY.later}
              </button>
            </div>
          }
          meta={
            <>
              <span className="fantasy-title">chesscito</span>
              <span className="opacity-70"> · on Celo</span>
            </>
          }
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <SuccessImage
              variant="badge"
              pieceType={pieceType}
              glowClass="reward-glow-achievement reward-glow-pulse"
              size="sm"
            />

            <StarsRow totalStars={totalStars} staggered />

            <h2
              id="badge-earned-title"
              className="fantasy-title text-base font-bold leading-tight"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {title}
            </h2>

            <ShareButton variant="badge" pieceType={pieceType} totalStars={totalStars} />
          </div>
        </CandyGlassShell>
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
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={PIECE_COMPLETE_COPY.title}
      onClick={() => handleAction(onPracticeAgain)}
    >
      <div
        className="relative w-full max-w-xs"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={PIECE_COMPLETE_COPY.title}
          onClose={() => handleAction(onPracticeAgain)}
          closeLabel={PIECE_COMPLETE_COPY.practiceAgain}
          cta={
            <div className="flex flex-col gap-1.5">
              {nextPiece && hasClaimedBadge ? (
                <Button
                  type="button"
                  variant="game-solid"
                  size="game"
                  onClick={() => handleAction(onNextPiece)}
                  className="w-full"
                >
                  {PIECE_COMPLETE_COPY.nextPiece(PIECE_LABELS[nextPiece])}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="game-solid"
                  size="game"
                  onClick={() => handleAction(onArena)}
                  className="w-full"
                >
                  {PIECE_COMPLETE_COPY.tryArena}
                </Button>
              )}
              <button
                type="button"
                onClick={() => handleAction(onPracticeAgain)}
                className="w-full py-1 text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {PIECE_COMPLETE_COPY.practiceAgain}
              </button>
            </div>
          }
          meta={
            <>
              <span className="fantasy-title">chesscito</span>
              <span className="opacity-70"> · on Celo</span>
            </>
          }
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <SuccessImage variant="badge" pieceType={pieceType} glowClass="reward-glow-progress" size="sm" />
            <StarsRow totalStars={totalStars} staggered />
            <p
              className="text-sm leading-snug"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {subtitle}
            </p>
          </div>
        </CandyGlassShell>
      </div>
    </div>
  );
}
