"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { AddCashCta } from "@/components/minipay/add-cash-cta";
import type { TxErrorKind } from "@/lib/errors";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { ShareModal } from "@/components/share/share-modal";
import { clampMaxStars, shareUrlForBadge, shareUrlForScore } from "@/lib/og/share-urls";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { TopScreenConfetti } from "@/components/redesign/confetti-burst";
import { pieceThemeSlot } from "@/lib/themes/piece-theme-assets";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";


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
  /** Asset basename for the shop variant hero icon — points at the
   *  `/art/shop/<sku>` triplet basename the catalog already exposes
   *  via `selectedItem.icon`. Optional fallback to a generic shop
   *  badge so legacy callers don't break. */
  itemAsset?: string;
  itemAssetSlot?: ThemeAssetKey;
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
  /** The piece's real star ceiling — `getMaxPossibleStars(piece, catalog)`.
   *  Drives the stat pill and the share card. Omitted (dev fixtures, shop
   *  variant) it falls back to the baseline 10-exercise pool, never to the
   *  deprecated 5-exercise one. */
  maxPossibleStars?: number;
  /** Recovery CTA for an error variant (e.g. insufficient Peones → "Get
   *  Peones"). When set, it becomes the primary button + a "Not now"
   *  secondary, replacing the Try-again/Dismiss pair. */
  recoveryCta?: { label: string; onPress: () => void };
};

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
  const slot = variant === "badge"
    ? pieceThemeSlot("w", pieceType ?? "rook")
    : variant === "score"
      ? "exercises.score"
      : "exercises.badge";
  const sizeClass = size === "sm" ? "h-20 w-20" : "h-32 w-32";
  return (
    <div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
      <ThemeAssetPicture slot={slot} pictureClassName="reward-icon-showcase reward-ceremony-icon relative z-10" pictureStyle={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }} alt="" className={`${sizeClass} object-contain drop-shadow-lg`} />
    </div>
  );
}

/** The meter is a fixed 5-segment bar, not one glyph per exercise: pools run
 *  from 5 to 100 exercises and a row of 100 stars is not a UI. Segments fill
 *  proportionally, so at maxStars=15 this reduces to the historical
 *  `ceil(totalStars / 3)` and a 5-exercise piece looks exactly as it did. */
const METER_SEGMENTS = 5;

function StarsRow({
  totalStars,
  maxStars,
  staggered = false,
}: {
  totalStars: number;
  maxStars: number;
  staggered?: boolean;
}) {
  const filled = Math.min(
    METER_SEGMENTS,
    Math.ceil((totalStars * METER_SEGMENTS) / Math.max(1, maxStars)),
  );
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: METER_SEGMENTS }, (_, i) => {
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
        {totalStars}/{maxStars}
      </span>
    </div>
  );
}

function useShareText(
  variant: SuccessVariant,
  pieceType?: PieceKey,
  itemLabel?: string,
  totalStars?: number,
  /* The piece's real ceiling. Runs through the SAME `clampMaxStars` the panel's
   * own "{n}/{max}" label uses, so the shared sentence and the number on screen
   * behind it can never disagree — which is exactly what a hardcoded 15 did. */
  maxPossibleStars?: number,
): string {
  const tShare = useTranslations("SHARE_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  switch (variant) {
    case "badge":
      return tShare("badge", {
        piece: tPiece(pieceType ?? "rook"),
        stars: totalStars ?? 0,
        maxStars: clampMaxStars(maxPossibleStars),
      });
    case "score":
      return tShare("score", { stars: totalStars ?? 0 });
    case "shop":
      return tShare("shop", { item: itemLabel ?? "an item" });
  }
}

/** Exported for the share-wiring guard: the score card must point at
 *  `type=score-saved`, never at `piece-complete` ("{Piece} Mastered" art). */
export function getCardUrl(
  variant: SuccessVariant,
  pieceType?: PieceKey,
  totalStars?: number,
  maxPossibleStars?: number,
): string {
  if (variant === "badge" || variant === "score") {
    const piece = pieceType ?? "rook";
    const max = clampMaxStars(maxPossibleStars);
    const stars = Math.min(totalStars ?? 0, max);
    // Slice A: score share gets its own leaderboard-first OG card. Was
    // type=piece-complete, which wrongly rendered "{Piece} Mastered".
    const type = variant === "badge" ? "badge-earned" : "score-saved";
    return `/api/og/exercise?piece=${piece}&stars=${stars}&max=${max}&type=${type}`;
  }
  return "/api/og/invite";
}

/** Canonical page URL the share targets — its OG tags point at the
 *  /api/og/* PNG so WhatsApp/X/Telegram render the rich preview. */
function getShareUrl(
  variant: SuccessVariant,
  pieceType?: PieceKey,
  totalStars?: number,
  maxPossibleStars?: number,
): string | undefined {
  if (variant === "badge") {
    return shareUrlForBadge({ piece: pieceType ?? "rook", stars: totalStars ?? 0, maxStars: maxPossibleStars });
  }
  if (variant === "score") {
    return shareUrlForScore({ piece: pieceType ?? "rook", stars: totalStars ?? 0, maxStars: maxPossibleStars });
  }
  return undefined;
}

function ShareRow({ variant, pieceType, itemLabel, totalStars, maxPossibleStars }: {
  variant: SuccessVariant;
  pieceType?: PieceKey;
  itemLabel?: string;
  totalStars?: number;
  maxPossibleStars?: number;
}) {
  const tShare = useTranslations("SHARE_COPY");
  const [open, setOpen] = useState(false);
  const text = useShareText(variant, pieceType, itemLabel, totalStars, maxPossibleStars);
  const cardUrl = getCardUrl(variant, pieceType, totalStars, maxPossibleStars);
  const shareUrl = getShareUrl(variant, pieceType, totalStars, maxPossibleStars);
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
  itemAsset,
  itemAssetSlot,
  txHash,
  celoscanHref,
  errorMessage,
  errorKind,
  txErrorKind,
  onDismiss,
  onRetry,
  totalStars,
  maxPossibleStars,
  recoveryCta,
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
    maxPossibleStars,
  );
  const shareCardUrl = !isError ? getCardUrl(variant, pieceType, totalStars, maxPossibleStars) : null;
  const shareCanonicalUrl = !isError ? getShareUrl(variant, pieceType, totalStars, maxPossibleStars) : undefined;

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
    const starsLabel = totalStars != null ? `${totalStars}/${clampMaxStars(maxPossibleStars)}` : null;
    return (
      <>
        {/* On-chain save confirmed — rain confetti from the top of the screen.
            Gated on a real receipt (txHash): the score overlay is reused for
            the free OFF-chain save, which is not a transaction to celebrate. */}
        {txHash && <TopScreenConfetti />}
        <div className={exiting ? "modal-exiting" : undefined}>
          <VictoryPopupShell
            onClose={handleDismiss}
            ariaLabel={title}
            closeLabel={tResult("cta.dismiss")}
          >
            <div className="arena-result-hero-row">
              <ThemeAssetPicture slot={pieceThemeSlot("w", pieceType ?? "rook")} pictureClassName="arena-result-hero-icon" alt="" aria-hidden="true" draggable={false} />
              <div className="arena-result-hero-text">
                <h1 className="arena-result-title">{title}</h1>
              </div>
            </div>

            {/* B2 (Lote 2): off-chain save is free, so no Peones-spent or
                free-saves-left pills — only the stars earned. */}
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

            <div className="flex flex-col items-center gap-2">
              <PrincipalButton
                size="medium"
                onClick={() => setShareOpen(true)}
              >
                {tShare("button")}
              </PrincipalButton>

              <button
                type="button"
                onClick={handleDismiss}
                className="arena-result-secondary-action"
              >
                {tResult("cta.continue")}
              </button>
            </div>

            <div className="mt-1 flex flex-col items-center gap-1.5 px-2 text-center text-[11px]"
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

  // badge / shop / error variants — migrated 2026-06-05 from
  // CandyGlassShell to the arena-end-state vocabulary (VictoryPopupShell
  // + panel-bg1 + arena-result-* tokens). Mirrors the score migration
  // in `c2fba9d4`. Per-variant hero:
  //   badge → piece sprite via getBadgeImg (placeholder until a real
  //           badge artwork lands per SKU)
  //   shop  → itemAsset triplet so the popup carries the exact icon
  //           the shop tile showed
  //   error → static warning SVG (no Lotties) + avatar-asombrado peek
  return (
    <>
      {/* Badge claim / shop buy confirmed on-chain — celebrate from the top.
          Gated on a real receipt (txHash): error variants carry none, and
          only a confirmed transaction earns the celebration. */}
      {txHash && <TopScreenConfetti />}
      <div className={exiting ? "modal-exiting" : undefined}>
        <VictoryPopupShell
          onClose={handleDismiss}
          ariaLabel={title}
          closeLabel={tResult("cta.dismiss")}
        >
          {/* TITLE — centered hero. victory-popup-hero-solo clamps the
              arena-result-title font down so longer headlines like
              "Purchase Complete!" or "Couldn't buy" fit the panel. */}
          <div className="victory-popup-hero-solo">
            <h1 className="arena-result-title">{title}</h1>
          </div>

          {/* IMAGE — variant-specific hero centered below the title.
              Error variant has NO hero (founder 2026-06-11: the warning
              triangle read as system-alert, off the candy vocabulary);
              the avatar carries the emotion inline next to the text. */}
          {isError ? null : variant === "shop" && itemAssetSlot ? (
            <ThemeAssetPicture slot={itemAssetSlot} pictureClassName="reward-icon-showcase relative z-10" alt="" aria-hidden="true" className="h-32 w-32 object-contain drop-shadow-lg" />
          ) : variant === "shop" && itemAsset ? (
            <picture className="mx-auto block h-24 w-24">
              <source srcSet={`${itemAsset}.avif`} type="image/avif" />
              <source srcSet={`${itemAsset}.webp`} type="image/webp" />
              <img
                src={`${itemAsset}.png`}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-full w-full object-contain drop-shadow-md"
              />
            </picture>
          ) : (
            <div className="mx-auto block h-24 w-24">
              <SuccessImage
                variant={variant}
                pieceType={pieceType}
                glowClass={variant === "badge" ? "reward-glow-achievement reward-glow-pulse" : "reward-glow-progress"}
                size="sm"
              />
            </div>
          )}

          {!isError && variant === "badge" && totalStars != null ? (
            <div className="arena-result-stats-row arena-result-stats-row--missionpills">
              <span className="candy-stat-pill">
                <span className="candy-stat-pill-icon">
                  <CandyIcon name="star" className="h-4 w-4" />
                </span>
                {totalStars}/{clampMaxStars(maxPossibleStars)}
              </span>
            </div>
          ) : null}

          {isError ? (
            /* Error composition (founder 2026-06-11): text + avatar
               share one in-flow row, instead of an absolutely
               positioned avatar overlapping the message. */
            <div className="flex items-center justify-center gap-2 px-2">
              <p
                className="text-center text-sm leading-snug"
                style={{
                  color: "rgba(159, 18, 57, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {subtitle}
              </p>
              <ThemeAssetPicture slot="shared.feedback-surprised" pictureClassName="w-20 shrink-0" alt="" aria-hidden="true" draggable={false} />
            </div>
          ) : (
            <p
              className="px-2 text-center text-sm leading-snug"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {subtitle}
            </p>
          )}

          {hint ? (
            <p
              className="px-2 text-center text-xs leading-snug"
              style={{ color: "rgba(110, 65, 15, 0.65)" }}
            >
              {hint}
            </p>
          ) : null}

          {isError && txErrorKind === "insufficientFunds" && (
            <AddCashCta source="shop-buy" className="mt-1" />
          )}

          <div className="flex flex-col items-center gap-2">
            {isError && recoveryCta ? (
              <>
                <PrincipalButton size="medium" onClick={recoveryCta.onPress}>
                  {recoveryCta.label}
                </PrincipalButton>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="arena-result-secondary-action"
                >
                  {tResult("cta.notNow")}
                </button>
              </>
            ) : isError && onRetry ? (
              <>
                <PrincipalButton size="medium" onClick={onRetry}>
                  {tResult("cta.tryAgain")}
                </PrincipalButton>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="arena-result-secondary-action"
                >
                  {tResult("cta.dismiss")}
                </button>
              </>
            ) : isError ? (
              <PrincipalButton size="medium" onClick={handleDismiss}>
                {tResult("cta.dismiss")}
              </PrincipalButton>
            ) : (
              <>
                <PrincipalButton size="medium" onClick={() => setShareOpen(true)}>
                  {tShare("button")}
                </PrincipalButton>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="arena-result-secondary-action"
                >
                  {tResult("cta.continue")}
                </button>
              </>
            )}
          </div>

          {!isError ? (
            <div
              className="mt-1 flex flex-col items-center gap-1.5 px-2 text-center text-[11px]"
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
          ) : null}

        </VictoryPopupShell>
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
    </>
  );
}

type BadgeEarnedPromptProps = {
  pieceType: PieceKey;
  totalStars: number;
  /** The piece's real star ceiling — `getMaxPossibleStars(piece, catalog)`. */
  maxPossibleStars: number;
  /** MiniPay Lote 2 F1: the off-chain score auto-saves, so the badge prompt
   *  is purely celebratory. Its single primary CTA continues the flow (X /
   *  scrim / auto-dismiss all resolve to the same continuation). */
  onContinue: () => void;
};

const BADGE_AUTO_DISMISS_MS = 15_000;

export function BadgeEarnedPrompt({
  pieceType,
  totalStars,
  maxPossibleStars,
  onContinue,
}: BadgeEarnedPromptProps) {
  const tBadge = useTranslations("BADGE_EARNED_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const [exiting, setExiting] = useState(false);
  const title = tBadge("title", { piece: tPiece(pieceType) });

  useEffect(() => {
    track("modal_open", { id: "badge-earned", piece: pieceType, stars: totalStars });
  }, [pieceType, totalStars]);

  function handleContinue() {
    setExiting(true);
    setTimeout(onContinue, 250);
  }

  // Founder vocabulary pass 2026-06-11: migrated from CandyGlassShell
  // (plain green glass) to VictoryPopupShell so the prompt carries the
  // panel-bg1 forest frame like every other app modal.
  // MiniPay Lote 2 F1: the off-chain save auto-runs, so the former green
  // SAVE CTA is gone — a single neutral "Continue" resolves the celebration.
  return (
    <div className={exiting ? "modal-exiting" : undefined}>
      <VictoryPopupShell
        onClose={handleContinue}
        ariaLabel={tBadge("headerLabel")}
        closeLabel={tBadge("continue")}
      >
        {/* Auto-dismiss countdown bar — first element inside the panel
            so it reads as a "timer on the modal". */}
        <div className="mx-auto h-1 w-[60%] overflow-hidden rounded-full bg-amber-900/15">
          <div
            className="h-full rounded-full bg-amber-500/70"
            style={{ animation: `badge-countdown ${BADGE_AUTO_DISMISS_MS}ms linear forwards` }}
          />
        </div>

        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title" id="badge-earned-title">
            {title}
          </h1>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <SuccessImage
            variant="badge"
            pieceType={pieceType}
            glowClass="reward-glow-achievement reward-glow-pulse"
            size="sm"
          />

          <StarsRow totalStars={totalStars} maxStars={maxPossibleStars} staggered />

          <ShareRow
            variant="badge"
            pieceType={pieceType}
            totalStars={totalStars}
            maxPossibleStars={maxPossibleStars}
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <PrincipalButton size="medium" onClick={handleContinue}>
            {tBadge("continue")}
          </PrincipalButton>
        </div>

        <div
          className="mt-1 flex flex-col items-center gap-1.5 px-2 text-center text-[11px]"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          <span>
            <span className="fantasy-title">chesscito</span>
            <span className="opacity-70"> · on Celo</span>
          </span>
        </div>
      </VictoryPopupShell>
    </div>
  );
}

type PieceCompletePromptProps = {
  pieceType: PieceKey;
  nextPiece: PieceKey | null;
  hasClaimedBadge: boolean;
  /** Whether the completion GATE is met (`isBadgeEarned`), which is a different
   *  question from whether the badge was claimed — claiming is an on-chain
   *  step the player can defer forever. Without this the prompt cannot tell
   *  "earned, waiting for you" from "not there yet", and it told both the same
   *  thing. Defaults false so an un-updated call site keeps the old copy
   *  rather than silently claiming a badge exists. */
  hasEarnedBadge?: boolean;
  totalStars: number;
  /** The piece's real star ceiling — `getMaxPossibleStars(piece, catalog)`. */
  maxPossibleStars: number;
  onNextPiece: () => void;
  onArena: () => void;
  onPracticeAgain: () => void;
  /** When provided, surfaces "Try Labyrinth" as the primary CTA in the
   *  no-nextPiece branch. Presence == "the current piece has at least
   *  one labyrinth available", so the parent's gating is the single
   *  source of truth (we never need labyrinthList.length passed
   *  separately). */
  onTryLabyrinth?: () => void;
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
  hasEarnedBadge = false,
  totalStars,
  maxPossibleStars,
  onNextPiece,
  onArena,
  onPracticeAgain,
  onTryLabyrinth,
  onChoosePiece,
}: PieceCompletePromptProps) {
  const tComplete = useTranslations("PIECE_COMPLETE_COPY");
  const tLab = useTranslations("LABYRINTH_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    track("modal_open", { id: "piece-complete", piece: pieceType, stars: totalStars, next_piece: nextPiece ?? null });
  }, [pieceType, totalStars, nextPiece]);

  /* ⛔ The middle branch used to be `!hasClaimedBadge → keep practicing`, which
   * lumped "earned but not claimed" together with "not there yet". A player who
   * had just cleared the gate got told to keep pushing SECONDS after the
   * milestone modal told them the badge was ready (playtest 2026-08-08). Earned
   * and claimed are different questions; the prompt now asks both. */
  const subtitle = nextPiece && hasClaimedBadge
    ? tComplete("subtitleWithNext", { next: tPiece(nextPiece) })
    : hasEarnedBadge && !hasClaimedBadge
      ? tComplete("subtitleBadgeWaiting")
      : !hasClaimedBadge
        ? tComplete("subtitleKeepPracticing")
        : tComplete("subtitleFinal");

  function handleAction(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 250);
  }

  /* Dismissing the popup (X close OR scrim tap) NEVER navigates: it closes the
   * menu and leaves the player on the piece they were on. Jumping pieces here
   * was exactly how players never met the labyrinths (Slice 3E), and the branch
   * that survived that fix — "no pending lab AND a next piece → advance" —
   * turned out to do something worse: closing the bishop's panel deposited you
   * on the knight, abandoning a badge the same panel had just called ready to
   * claim (playtest 2026-08-08).
   *
   * ⛔ The "avoids the stuck on the last level" rationale that branch carried no
   * longer holds. Behind this panel the persistent dock, the exercise drawer and
   * the contextual `claimBadge` pin (`exercises-screen.tsx`, `contextAction`)
   * are all on screen, so closing strands nobody — it leaves the player on the
   * one surface that carries the Claim. Sending them to the hub would be worse
   * still: the hub's piece tile only routes, it does not claim.
   *
   * And the X already announces itself as "Practice Again" — `closeLabel` below
   * is its accessible name — so the jump contradicted what it told the player
   * it would do. Staying is not a new contract; it is the one already written. */
  const handleDismiss = onPracticeAgain;

  /* Primary CTA priority (drives both label and handler) — Slice 3E
   * sequence fix: a pending labyrinth is the natural continuation of
   * the CURRENT piece, so it outranks the next piece (the old
   * nextPiece-first order meant players finished the exercises and
   * never saw a labyrinth):
   *   1. onTryLabyrinth defined → "Try Labyrinth"  (unlocked, pending)
   *   2. nextPiece exists       → "Start {nextPiece}"
   *   3. onChoosePiece defined  → "Choose another piece"
   *   4. fallback (no other path) → "ARENA"
   *
   * When the labyrinth takes the primary slot, nextPiece survives as a
   * secondary text-link (never disappears). Arena keeps the defensive
   * 4th slot so a misconfigured callsite never lands the user on an
   * inert button; when Arena is NOT primary AND there is no next
   * piece, it surfaces as the `tryArenaSecondary` text-link. */
  type CTA = { label: string; handler: () => void };
  const primaryCTA: CTA = onTryLabyrinth
    ? { label: tLab("tryLabyrinth"), handler: onTryLabyrinth }
    : nextPiece
      ? {
          label: tComplete("nextPiece", { piece: tPiece(nextPiece) }),
          handler: onNextPiece,
        }
      : onChoosePiece
        ? { label: tComplete("choosePiece"), handler: onChoosePiece }
        : { label: tComplete("tryArena"), handler: onArena };

  const arenaIsPrimary = primaryCTA.handler === onArena;
  const showArenaSecondary = !nextPiece && !arenaIsPrimary;
  const showNextPieceSecondary = Boolean(onTryLabyrinth && nextPiece);
  const showCoachHint = nextPiece != null;

  const starsLabel = `${totalStars}/${maxPossibleStars}`;

  return (
    <div className={exiting ? "modal-exiting" : undefined}>
      <VictoryPopupShell
        onClose={() => handleAction(handleDismiss)}
        ariaLabel={tComplete("title")}
        closeLabel={tComplete("practiceAgain")}
      >
        {/* TITLE — centered hero (victory-popup-hero-solo clamps the
            arena-result-title font down from 38-56px base to 26-36px so
            it fits inside the panel safely). */}
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title">{tComplete("title")}</h1>
        </div>

        {/* IMAGE — piece icon centered below the title. */}
        <ThemeAssetPicture slot={pieceThemeSlot("w", pieceType ?? "rook")} pictureClassName="mx-auto block h-24 w-24" alt="" aria-hidden="true" draggable={false} className="h-full w-full object-contain drop-shadow-md" />

        {/* STARS — single ★ pill. */}
        <div className="arena-result-stats-row arena-result-stats-row--missionpills">
          <span className="candy-stat-pill">
            <span className="candy-stat-pill-icon">
              <CandyIcon name="star" className="h-4 w-4" />
            </span>
            {starsLabel}
          </span>
        </div>

        {/* MESSAGE — mastery narrative. */}
        <p
          className="px-2 text-center text-sm leading-snug"
          style={{
            color: "rgba(63, 34, 8, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          {subtitle}
        </p>

        {/* BUTTONS — Primary green PrincipalButton + optional SAVE secondary +
            Arena escape hatch. Coach hint removed: at piece-complete the
            user is still learning, the "why did you win?" framing of
            Coach review does not apply. */}
        <div className="flex flex-col items-center gap-2">
          <PrincipalButton
            size="medium"
            onClick={() => handleAction(primaryCTA.handler)}
          >
            {primaryCTA.label}
          </PrincipalButton>

          {showNextPieceSecondary && nextPiece && (
            <button
              type="button"
              onClick={() => handleAction(onNextPiece)}
              className="arena-result-secondary-action"
            >
              {tComplete("nextPiece", { piece: tPiece(nextPiece) })}
            </button>
          )}

          {showArenaSecondary && (
            <button
              type="button"
              onClick={() => handleAction(onArena)}
              className="arena-result-back-link"
            >
              {tComplete("tryArenaSecondary")}
            </button>
          )}
        </div>

        {/* AVATAR — Sally placement: bottom-right "peek" inside the panel so
            the celebration character is present without competing with the
            primary CTA or the title. Transparent half-body crop. */}
        <ThemeAssetPicture slot="shared.feedback-happy" pictureClassName="pointer-events-none absolute -right-2 bottom-12 h-24 w-24" alt="" aria-hidden="true" draggable={false} className="h-full w-full object-contain" />
      </VictoryPopupShell>
    </div>
  );
}
