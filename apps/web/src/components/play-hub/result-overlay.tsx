"use client";

import Link from "next/link";
import { useState } from "react";
import { BADGE_EARNED_COPY, PIECE_LABELS, RESULT_OVERLAY_COPY, SHARE_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";

type PieceKey = "rook" | "bishop" | "knight";
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

function SuccessImage({ variant, pieceType }: { variant: SuccessVariant; pieceType?: PieceKey }) {
  const src = variant === "badge" ? getBadgeImg(pieceType) : VARIANT_IMG[variant];
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow behind image */}
      <div className="absolute h-48 w-48 rounded-full bg-[image:var(--playhub-reward-glow)] bg-contain bg-center bg-no-repeat opacity-70 blur-sm" />
      <picture className="reward-burst relative z-10">
        <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
        <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
        <img src={src} alt="" className="h-32 w-32 object-contain drop-shadow-lg" />
      </picture>
    </div>
  );
}

const EXERCISES_PER_PIECE = 5;
const MAX_STARS = EXERCISES_PER_PIECE * 3;

function StarsRow({ totalStars }: { totalStars: number }) {
  const filled = Math.min(EXERCISES_PER_PIECE, Math.ceil(totalStars / 3));
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: EXERCISES_PER_PIECE }, (_, i) => (
        <span
          key={i}
          className={i < filled ? "text-amber-400" : "text-amber-400/30"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-cyan-100/70">
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
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-300 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-6 rounded-3xl border border-white/[0.06] bg-[var(--surface-frosted)] px-6 py-10 text-center backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-400">
        {/* Image or error icon */}
        {isError ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-900/40 ring-1 ring-rose-500/40">
            <span className="text-4xl text-rose-400" aria-hidden="true">!</span>
          </div>
        ) : (
          <SuccessImage variant={variant} pieceType={pieceType} />
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
          <StarsRow totalStars={totalStars} />
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
        <div className="mt-2 flex w-full flex-col gap-2">
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
              autoFocus={false}
              onClick={handleDismiss}
            >
              {RESULT_OVERLAY_COPY.cta.dismiss}
            </Button>
          ) : (
            <Button
              type="button"
              variant="game-primary"
              size="game"
              autoFocus={!(isError && onRetry)}
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
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-300 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-earned-title"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-6 px-6 py-10 text-center animate-in zoom-in-95 fade-in duration-400">
        <SuccessImage variant="badge" pieceType={pieceType} />

        <StarsRow totalStars={totalStars} />

        <h2 id="badge-earned-title" className="fantasy-title text-2xl text-cyan-50">{title}</h2>

        <div className="mt-2 flex w-full flex-col gap-2">
          <Button
            type="button"
            variant="game-solid"
            size="game"
            autoFocus
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
