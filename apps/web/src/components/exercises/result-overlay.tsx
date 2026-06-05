"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import type { TxErrorKind } from "@/lib/errors";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { ShareModal } from "@/components/share/share-modal";
import { EXERCISES_PER_PIECE } from "@/lib/game/exercises";
import { shareUrlForBadge, shareUrlForScore } from "@/lib/og/share-urls";
import { THEME_CONFIG } from "@/lib/theme";

const PIECE_COMPLETE_AVATAR_BASE = "/art/new-assets-chesscito/fun/avatar-feliz";

type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
type SuccessVariant = "badge" | "score" | "shop";
type Variant = SuccessVariant | "error";
/** Subtype of error overlay rendered for purchase flows (F4 Buy Item
 *  Shop, F5 Buy Coach Credits). When provided, the overlay reads its
 *  title / subtitle / hint from RESULT_OVERLAY_COPY.error.purchaseKindCopy
 *  so cancellation, timeout and real errors each get distinct,
 *  non-technical wording — matching the pattern Mint Victory already
 *  uses via VICTORY_CLAIM_COPY.errorKindCopy. */
export type ErrorKind = "error" | "cancelled" | "timeout";

type ResultOverlayProps = {
  variant: Variant;
  pieceType?: PieceKey;
  itemLabel?: string;
  txHash?: string;
  celoscanHref?: string;
  errorMessage?: string;
  errorKind?: ErrorKind;
  /** Locale-agnostic tx classification from classifyTxErrorKind.
   *  Distinct from `errorKind` (UI variant for purchase copy). When
   *  set to "insufficientFunds" AND the runtime is MiniPay, the
   *  overlay surfaces the AddCashCta recovery deeplink. Only the
   *  shop-buy caller is expected to pass this in v1; badge claim
   *  and score submit deliberately omit it so the CTA does not
   *  appear in non-paid surfaces. */
  txErrorKind?: TxErrorKind | null;
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
  const src = variant === "badge" || variant === "score" ? getBadgeImg(pieceType) : VARIANT_IMG[variant];
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

function useShareText(variant: SuccessVariant, pieceType?: PieceKey, itemLabel?: string, totalStars?: number): string {
  const tShare = useTranslations("SHARE_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  switch (variant) {
    case "badge":
      return tShare("badge", { piece: tPiece(pieceType ?? "rook"), stars: totalStars ?? 0 });
    case "score":
      return tShare("score", { stars: totalStars ?? 0 });
    case "shop":
      return tShare("shop", { item: itemLabel ?? "an item" });
  }
}

function getCardUrl(variant: SuccessVariant, pieceType?: PieceKey, totalStars?: number): string {
  if (variant === "badge") {
    const piece = pieceType ?? "rook";
    const stars = Math.min(totalStars ?? 0, 15);
    return `/api/og/exercise?piece=${piece}&stars=${stars}&type=badge-earned`;
  }
  if (variant === "score") {
    const piece = pieceType ?? "rook";
    const stars = Math.min(totalStars ?? 0, 15);
    return `/api/og/exercise?piece=${piece}&stars=${stars}&type=piece-complete`;
  }
  return "/api/og/invite";
}

/** Canonical page URL the share targets — its OG tags point at the
 *  /api/og/* PNG so WhatsApp/X/Telegram render the rich preview. */
function getShareUrl(variant: SuccessVariant, pieceType?: PieceKey, totalStars?: number): string | undefined {
  if (variant === "badge") {
    return shareUrlForBadge({ piece: pieceType ?? "rook", stars: totalStars ?? 0 });
  }
  if (variant === "score") {
    return shareUrlForScore({ piece: pieceType ?? "rook", stars: totalStars ?? 0 });
  }
  return undefined;
}

function ShareRow({ variant, pieceType, itemLabel, totalStars }: {
  variant: SuccessVariant;
  pieceType?: PieceKey;
  itemLabel?: string;
  totalStars?: number;
}) {
  const tShare = useTranslations("SHARE_COPY");
  const [open, setOpen] = useState(false);
  const text = useShareText(variant, pieceType, itemLabel, totalStars);
  const cardUrl = getCardUrl(variant, pieceType, totalStars);
  const shareUrl = getShareUrl(variant, pieceType, totalStars);
  return (
    <>
      <Button
        type="button"
        variant="game-ghost"
        size="game"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        {tShare("button")}
      </Button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        cardUrl={cardUrl}
        text={text}
        url={shareUrl}
      />
    </>
  );
}

export function ResultOverlay({
  variant,
  pieceType,
  itemLabel,
  txHash,
  celoscanHref,
  errorMessage,
  errorKind,
  txErrorKind,
  onDismiss,
  onRetry,
  totalStars,
}: ResultOverlayProps) {
  const tResult = useTranslations("RESULT_OVERLAY_COPY");
  const tShare = useTranslations("SHARE_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const [exiting, setExiting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isError = variant === "error";

  const title = (() => {
    if (variant === "error") {
      if (errorKind) return tResult(`error.purchaseKindCopy.${errorKind}.title` as const);
      return tResult("error.title");
    }
    return tResult(`${variant}.title` as const);
  })();

  const subtitle = (() => {
    switch (variant) {
      case "badge":
        return tResult("badge.subtitle", { piece: tPiece(pieceType ?? "rook") });
      case "score":
        return tResult("score.subtitle");
      case "shop":
        return tResult("shop.subtitle", { item: itemLabel ?? "Item" });
      case "error":
        if (errorKind) return tResult(`error.purchaseKindCopy.${errorKind}.subtitle` as const);
        return errorMessage ?? tResult("error.unknown");
    }
  })();

  const hint = isError && errorKind
    ? tResult(`error.purchaseKindCopy.${errorKind}.hint` as const)
    : null;

  const shareText = useShareText(
    isError ? "badge" : variant,
    pieceType,
    itemLabel,
    totalStars,
  );
  const shareCardUrl = !isError ? getCardUrl(variant, pieceType, totalStars) : null;
  const shareCanonicalUrl = !isError ? getShareUrl(variant, pieceType, totalStars) : undefined;

  function handleDismiss() {
    setExiting(true);
    setTimeout(onDismiss, 250);
  }

  // Score variant — on-chain save celebration. Migrated 2026-06-05
  // from CandyGlassShell to the arena-end-state vocabulary
  // (VictoryPopupShell + panel-bg1 + arena-result-stats-row +
  // arena-result-primary-cta). CeloScan receipt chip inlined below
  // the secondary action since VictoryPopupShell has no meta band.
  if (variant === "score") {
    const pieceImg = getBadgeImg(pieceType);
    const pieceHasOptimized = THEME_CONFIG.hasOptimizedFormats;
    const starsLabel = totalStars != null ? `${totalStars}/${MAX_STARS}` : null;
    return (
      <>
        <div className={exiting ? "modal-exiting" : undefined}>
          <VictoryPopupShell
            onClose={handleDismiss}
            ariaLabel={title}
            closeLabel={tResult("cta.dismiss")}
          >
            <div className="arena-result-hero-row">
              <picture className="arena-result-hero-icon">
                {pieceHasOptimized && (
                  <>
                    <source srcSet={pieceImg.replace(".png", ".avif")} type="image/avif" />
                    <source srcSet={pieceImg.replace(".png", ".webp")} type="image/webp" />
                  </>
                )}
                <img src={pieceImg} alt="" aria-hidden="true" draggable={false} />
              </picture>
              <div className="arena-result-hero-text">
                <h1 className="arena-result-title">{title}</h1>
              </div>
            </div>

            {starsLabel && (
              <div className="arena-result-stats-row arena-result-stats-row--missionpills">
                <span className="candy-stat-pill">
                  <span className="candy-stat-pill-icon">
                    <CandyIcon name="star" className="h-4 w-4" />
                  </span>
                  {starsLabel}
                </span>
              </div>
            )}

            <p
              className="px-2 text-center text-sm leading-snug"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {subtitle}
            </p>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="arena-result-primary-cta"
            >
              {tShare("button")}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="arena-result-secondary-action mx-auto"
            >
              {tResult("cta.continue")}
            </button>

            <div className="mt-1 inline-flex flex-wrap items-center justify-center gap-2 px-2 text-center text-[11px]"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              <span>
                <span className="fantasy-title">chesscito</span>
                <span className="opacity-70"> · on Celo</span>
              </span>
              {txHash && celoscanHref ? (
                <Link
                  href={celoscanHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="account-status-pill"
                  data-tone="celo"
                >
                  {tResult("cta.receiptOnCeloscan")}
                </Link>
              ) : null}
            </div>
          </VictoryPopupShell>
        </div>
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          cardUrl={shareCardUrl}
          text={shareText}
          url={shareCanonicalUrl}
        />
      </>
    );
  }

  return (
    <div
      // pointer-events-auto explicitly defeats Radix's modal-mode body
      // lock that lingers ~300ms during sheet exit animations. Without
      // it, clicks on the scrim / X / CTA right after a transaction
      // failure are silently swallowed and the user can't dismiss.
      className={`pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleDismiss}
    >
      <div
        className="pointer-events-auto relative w-full max-w-xs"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={title}
          onClose={handleDismiss}
          closeLabel={tResult("cta.dismiss")}
          cta={
            isError && onRetry ? (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={onRetry}
                  className="arena-scaffold-soft-gate-primary w-full"
                >
                  {tResult("cta.tryAgain")}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="arena-result-back-link w-full"
                >
                  {tResult("cta.dismiss")}
                </button>
              </div>
            ) : isError ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="arena-scaffold-soft-gate-primary w-full"
              >
                {tResult("cta.dismiss")}
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="arena-scaffold-soft-gate-primary w-full"
                >
                  {tShare("button")}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="arena-scaffold-soft-gate-secondary w-full"
                >
                  {tResult("cta.continue")}
                </button>
              </div>
            )
          }
          meta={
            !isError ? (
              <span className="inline-flex flex-wrap items-center justify-center gap-2">
                <span>
                  <span className="fantasy-title">chesscito</span>
                  <span className="opacity-70"> · on Celo</span>
                </span>
                {txHash && celoscanHref ? (
                  <Link
                    href={celoscanHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="account-status-pill"
                    data-tone="celo"
                  >
                    {tResult("cta.receiptOnCeloscan")}
                  </Link>
                ) : null}
              </span>
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

            {!isError && variant === "badge" && totalStars != null ? (
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

            {hint ? (
              <p
                className="text-xs leading-snug"
                style={{ color: "rgba(110, 65, 15, 0.65)" }}
              >
                {hint}
              </p>
            ) : null}

            {isError && txErrorKind === "insufficientFunds" && (
              <AddCashCta source="shop-buy" className="mt-2" />
            )}

          </div>
        </CandyGlassShell>
      </div>

      {!isError && (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          cardUrl={shareCardUrl}
          text={shareText}
          url={shareCanonicalUrl}
        />
      )}
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
  const tBadge = useTranslations("BADGE_EARNED_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const [exiting, setExiting] = useState(false);
  const title = tBadge("title", { piece: tPiece(pieceType) });

  useEffect(() => {
    track("modal_open", { id: "badge-earned", piece: pieceType, stars: totalStars });
  }, [pieceType, totalStars]);

  function handleLater() {
    setExiting(true);
    setTimeout(onLater, 250);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
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
          title={tBadge("headerLabel")}
          onClose={handleLater}
          closeLabel={tBadge("later")}
          cta={
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onSubmitScore}
                className="arena-scaffold-soft-gate-primary w-full"
              >
                {tBadge("submitScore")}
              </button>
              <button
                type="button"
                onClick={handleLater}
                className="arena-result-back-link w-full"
              >
                {tBadge("later")}
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

            <ShareRow variant="badge" pieceType={pieceType} totalStars={totalStars} />
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
  /** When provided, surfaces "Try Labyrinth" as the primary CTA in the
   *  no-nextPiece branch. Presence == "the current piece has at least
   *  one labyrinth available", so the parent's gating is the single
   *  source of truth (we never need labyrinthList.length passed
   *  separately). */
  onTryLabyrinth?: () => void;
  /** Re-surfaces the Submit Score transactional moment that may have
   *  been lost when the user dismissed BadgeEarnedPrompt with "Later".
   *  Only wired when canSendOnChain && score is eligible. */
  onSubmitScore?: () => void;
  /** Opens the PiecePickerSheet from the completion ceremony. Used as
   *  the primary CTA when there is no next piece in the linear order
   *  AND no labyrinth available for the current piece — without this
   *  the player would be dropped on Arena as the primary path, which
   *  feels wrong for a still-incomplete piece like King (no labyrinths
   *  yet). Arena stays available as a secondary text-link in this
   *  branch (`tryArenaSecondary`). */
  onChoosePiece?: () => void;
};

export function PieceCompletePrompt({
  pieceType,
  nextPiece,
  hasClaimedBadge,
  totalStars,
  onNextPiece,
  onArena,
  onPracticeAgain,
  onTryLabyrinth,
  onSubmitScore,
  onChoosePiece,
}: PieceCompletePromptProps) {
  const tComplete = useTranslations("PIECE_COMPLETE_COPY");
  const tLab = useTranslations("LABYRINTH_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    track("modal_open", { id: "piece-complete", piece: pieceType, stars: totalStars, next_piece: nextPiece ?? null });
  }, [pieceType, totalStars, nextPiece]);

  const subtitle = nextPiece && hasClaimedBadge
    ? tComplete("subtitleWithNext", { next: tPiece(nextPiece) })
    : !hasClaimedBadge
      ? tComplete("subtitleKeepPracticing")
      : tComplete("subtitleFinal");

  function handleAction(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 250);
  }

  // Dismissing the popup (X close OR scrim tap) used to fire
  // `onPracticeAgain`, which kept the user on the SAME piece at the
  // same last exercise — players reported this as "stuck on the last
  // level" after completing a piece. New mapping: close advances to
  // the next piece when one exists (the primary CTA's natural
  // destination); on the final piece, close still falls back to
  // practice-again so the player isn't dropped out of the surface
  // they're choosing to dismiss.
  const handleDismiss = nextPiece ? onNextPiece : onPracticeAgain;

  /* Primary CTA priority (drives both label and handler):
   *   1. nextPiece exists       → "Start {nextPiece}"
   *   2. onTryLabyrinth defined → "Try Labyrinth"   (current piece has
   *                                                  ≥1 labyrinth)
   *   3. onChoosePiece defined  → "Choose another piece"
   *   4. fallback (no other path) → "ARENA"
   *
   * Arena keeps the defensive 4th slot so a misconfigured callsite
   * never lands the user on an inert button. When Arena is NOT primary
   * AND there is no next piece, surface it as a secondary text-link
   * (`tryArenaSecondary`) — Arena stays a valid escape hatch but stops
   * dominating the moment for pieces that still have no follow-up
   * content (King v0.1). */
  type CTA = { label: string; handler: () => void };
  const primaryCTA: CTA = nextPiece
    ? {
        label: tComplete("nextPiece", { piece: tPiece(nextPiece) }),
        handler: onNextPiece,
      }
    : onTryLabyrinth
      ? { label: tLab("tryLabyrinth"), handler: onTryLabyrinth }
      : onChoosePiece
        ? { label: tComplete("choosePiece"), handler: onChoosePiece }
        : { label: tComplete("tryArena"), handler: onArena };

  const arenaIsPrimary = primaryCTA.handler === onArena;
  const showArenaSecondary = !nextPiece && !arenaIsPrimary;
  const showCoachHint = nextPiece != null;

  const pieceImg = getBadgeImg(pieceType);
  const pieceHasOptimized = THEME_CONFIG.hasOptimizedFormats;
  const starsLabel = `${totalStars}/${MAX_STARS}`;

  return (
    <div className={exiting ? "modal-exiting" : undefined}>
      <VictoryPopupShell
        onClose={() => handleAction(handleDismiss)}
        ariaLabel={tComplete("title")}
        closeLabel={tComplete("practiceAgain")}
      >
        {/* Hero — piece icon LEFT + title RIGHT (mirrors arena-end-state loss/draw). */}
        <div className="arena-result-hero-row">
          <picture className="arena-result-hero-icon">
            {pieceHasOptimized && (
              <>
                <source srcSet={pieceImg.replace(".png", ".avif")} type="image/avif" />
                <source srcSet={pieceImg.replace(".png", ".webp")} type="image/webp" />
              </>
            )}
            <img src={pieceImg} alt="" aria-hidden="true" draggable={false} />
          </picture>
          <div className="arena-result-hero-text">
            <h1 className="arena-result-title">{tComplete("title")}</h1>
          </div>
        </div>

        {/* Stats — single ★ pill mirroring arena candy-stat-pill vocabulary. */}
        <div className="arena-result-stats-row arena-result-stats-row--missionpills">
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <CandyIcon name="star" className="h-4 w-4" />
            </span>
            {starsLabel}
          </span>
        </div>

        {/* Body — mastery narrative. */}
        <p
          className="px-2 text-center text-sm leading-snug"
          style={{
            color: "rgba(63, 34, 8, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          {subtitle}
        </p>

        {/* Primary CTA — green family, mirrors arena-end-state primary. */}
        <button
          type="button"
          onClick={() => handleAction(primaryCTA.handler)}
          className="arena-result-primary-cta"
        >
          {primaryCTA.label}
        </button>

        {/* Secondary — SAVE cream pill (only when score submission re-surface is wired). */}
        {onSubmitScore && (
          <button
            type="button"
            onClick={() => handleAction(onSubmitScore)}
            className="arena-result-secondary-action mx-auto"
          >
            {tComplete("submitScore")}
          </button>
        )}

        {/* Tertiary — Coach hint with avatar (only when primary == Start next piece). */}
        {showCoachHint && (
          <div className="arena-result-coach-section" aria-labelledby="piece-complete-coach-headline">
            <div className="arena-result-coach-body">
              <div className="arena-result-coach-text">
                <button
                  type="button"
                  onClick={() => {
                    track("coach_hint_click", { source: "piece-complete", piece: pieceType });
                    handleAction(onArena);
                  }}
                  id="piece-complete-coach-headline"
                  className="arena-result-back-link"
                >
                  {tComplete("coachHint")}
                </button>
              </div>
              <picture className="arena-result-coach-avatar">
                <source srcSet={`${PIECE_COMPLETE_AVATAR_BASE}.avif`} type="image/avif" />
                <source srcSet={`${PIECE_COMPLETE_AVATAR_BASE}.webp`} type="image/webp" />
                <img src={`${PIECE_COMPLETE_AVATAR_BASE}.png`} alt="" aria-hidden="true" draggable={false} />
              </picture>
            </div>
          </div>
        )}

        {/* Arena escape hatch as tertiary text link (no nextPiece, no labyrinth, Arena not primary). */}
        {showArenaSecondary && (
          <button
            type="button"
            onClick={() => handleAction(onArena)}
            className="arena-result-back-link mx-auto"
          >
            {tComplete("tryArenaSecondary")}
          </button>
        )}
      </VictoryPopupShell>
    </div>
  );
}
