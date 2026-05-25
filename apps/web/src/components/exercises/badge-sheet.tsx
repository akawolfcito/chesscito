"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { useConnectPrompt } from "@/lib/connect-prompt/use-connect-prompt";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import { THEME_CONFIG } from "@/lib/theme";
import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

const BADGE_ART: Record<PieceId, string> = {
  rook: `${THEME_CONFIG.piecesBase}/w-rook.png`,
  bishop: `${THEME_CONFIG.piecesBase}/w-bishop.png`,
  knight: `${THEME_CONFIG.piecesBase}/w-knight.png`,
  pawn: `${THEME_CONFIG.piecesBase}/w-pawn.png`,
  queen: `${THEME_CONFIG.piecesBase}/w-queen.png`,
  king: `${THEME_CONFIG.piecesBase}/w-king.png`,
};

type BadgeState = "claimed" | "claimable" | "locked";

type BadgeInfo = {
  piece: PieceId;
  state: BadgeState;
  totalStars: number;
  maxStars: number;
};

function readStarsFromStorage(piece: PieceId): number[] {
  if (typeof window === "undefined") return [0, 0, 0, 0, 0];
  try {
    const raw = localStorage.getItem(`chesscito:progress:${piece}`);
    if (!raw) return [0, 0, 0, 0, 0];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.stars) ? parsed.stars : [0, 0, 0, 0, 0];
  } catch {
    return [0, 0, 0, 0, 0];
  }
}

function BadgeCard({
  badge,
  onClaim,
  isClaimBusy,
  claimingPiece,
}: {
  badge: BadgeInfo;
  onClaim: () => void;
  isClaimBusy: boolean;
  claimingPiece: PieceId | null;
}) {
  const t = useTranslations("BADGE_SHEET_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const label = tPiece(badge.piece);
  const title = t("ascendantFormat", { piece: label });
  const isClaimed = badge.state === "claimed";
  const isClaimable = badge.state === "claimable";
  const isLocked = badge.state === "locked";
  const isThisBusy = claimingPiece === badge.piece;

  return (
    <div
      className={[
        "badge-card",
        isLocked ? "badge-card--locked" : "",
        isClaimed ? "badge-card--owned" : "",
      ].join(" ")}
    >
      {/* Horizontal icon wrap */}
      <div className="badge-card-icon-wrap">
        <picture className="h-8 w-8">
          {THEME_CONFIG.hasOptimizedFormats && (
            <>
              <source srcSet={BADGE_ART[badge.piece].replace(".png", ".avif")} type="image/avif" />
              <source srcSet={BADGE_ART[badge.piece].replace(".png", ".webp")} type="image/webp" />
            </>
          )}
          <img
            src={BADGE_ART[badge.piece]}
            alt={title}
            className="badge-card-icon-img"
          />
        </picture>
      </div>

      {/* Identity column */}
      <div className="badge-card-identity">
        <p className="badge-card-name">{title}</p>
        <p className="badge-card-status-text">
          {isClaimed ? t("owned") : isLocked ? t("locked") : t("claimable")}
        </p>

        {/* Progress bar */}
        <div className="badge-card-progress-bar-wrap">
          <div
            className="badge-card-progress-fill"
            style={{ width: `${(badge.totalStars / badge.maxStars) * 100}%` }}
          />
        </div>
      </div>

      {/* Action area */}
      <div className="badge-card-action">
        {isClaimed ? (
          <CandyChip variant="success" tone="subtle">
            <CandyIcon name="check" className="mr-0.5 h-2.5 w-2.5" />
            {t("owned")}
          </CandyChip>
        ) : isClaimable ? (
          <PrincipalButton
            size="medium"
            className="badge-card-claim-btn"
            onClick={onClaim}
            loading={isThisBusy}
            disabled={isClaimBusy && !isThisBusy}
            aria-label={t("claimBadge")}
          >
            {t("claim")}
          </PrincipalButton>
        ) : (
          <CandyChip variant="warm" tone="subtle">
            <CandyIcon name="lock" className="mr-0.5 h-2.5 w-2.5" />
            {t("lockedShort")}
          </CandyChip>
        )}
      </div>
    </div>
  );
}

type BadgeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badgesClaimed: Record<PieceId, boolean | undefined>;
  onClaim: (piece: PieceId) => void;
  isClaimBusy: boolean;
  claimingPiece?: PieceId | null;
  /** When set, renders an inline success banner above the badge grid
   *  for the duration the host keeps it set. Used by the scaffold's
   *  `useBadgeSheetState` hook to provide a celebration moment after a
   *  successful claim — ExercisesScreen legacy uses the global ResultOverlay
   *  for the same purpose, so it keeps this prop unset. */
  lastClaimedPiece?: PieceId | null;
  showNotification: boolean;
  /** Switch to the Trophies sheet. Parent closes this sheet and opens
   *  the trophy drawer in-place — no route navigation. */
  onNavigateToTrophies: () => void;
  /** Render the built-in `<SheetTrigger>` dock button. Default `true`
   *  for legacy callers (`<ExercisesScreen>` mounts this inside the dock).
   *  Pass `false` from the scaffold, which controls open state via
   *  `onOpenChange` and never wants the orphan trigger floating in the
   *  layout tree. Without this gate, Radix renders the button as a real
   *  DOM node sibling of the scaffold — invisible only by accident. */
  showTrigger?: boolean;
};

export function BadgeSheet({
  open,
  onOpenChange,
  badgesClaimed,
  onClaim,
  isClaimBusy,
  claimingPiece = null,
  lastClaimedPiece = null,
  showNotification,
  onNavigateToTrophies,
  showTrigger = true,
}: BadgeSheetProps) {
  const t = useTranslations("BADGE_SHEET_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tAbout = useTranslations("ABOUT_LINK_COPY");
  // Initialize synchronously from localStorage to avoid progress bar flashing from 0%
  const [starsByPiece, setStarsByPiece] = useState<Record<PieceId, number[]>>(() =>
    Object.fromEntries(
      PIECES.map((p) => [p, readStarsFromStorage(p)])
    ) as Record<PieceId, number[]>
  );

  useEffect(() => {
    if (!open) return;
    setStarsByPiece(
      Object.fromEntries(
        PIECES.map((p) => [p, readStarsFromStorage(p)])
      ) as Record<PieceId, number[]>
    );
  }, [open]);

  const badges: BadgeInfo[] = PIECES.map((piece) => {
    const stars = starsByPiece[piece];
    const totalStars = stars.reduce((sum, s) => sum + s, 0);
    const maxStars = stars.length * 3;
    const claimed = Boolean(badgesClaimed[piece]);
    const earned = totalStars >= BADGE_THRESHOLD;

    return {
      piece,
      state: claimed ? "claimed" : earned ? "claimable" : "locked",
      totalStars,
      maxStars,
    };
  });

  const totalCollectedStars = badges.reduce((s, b) => s + b.totalStars, 0);
  const totalAvailableStars = badges.reduce((s, b) => s + b.maxStars, 0);

  // Phase 2 nudge: when a disconnected user opens the sheet AND has at
  // least one claimable badge (= local stars cross threshold but no
  // wallet on record), fire the one-shot prompt. Idempotent — the hook
  // no-ops after the flag is set.
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const badgesConnectPrompt = useConnectPrompt("badges");
  const hasClaimable = badges.some((b) => b.state === "claimable");
  useEffect(() => {
    if (open && !isConnected && hasClaimable) {
      badgesConnectPrompt.show();
    }
  }, [open, isConnected, hasClaimable, badgesConnectPrompt]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          {/* No explicit h/w classes needed: .chesscito-dock-item > button in globals.css enforces 2.75rem x 2.75rem via !important */}
          <button
            type="button"
            aria-label={t("ariaLabel")}
            className="relative flex shrink-0 items-center justify-center"
          >
            <img
              src="/art/badge-menu.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
            {showNotification ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
              </span>
            ) : null}
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={t("subtitle")}
        className="mission-shell sheet-bg-badges flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        {/* Sheet header — canonical Z2 envelope. The star-count chip +
         *  progress bar that used to live inside the header now sit
         *  below it as a "stats banner" so the header stays 56–64 px. */}
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/badge-menu" />}
            title={t("title")}
            subtitle={t("subtitle")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        {badgesConnectPrompt.isVisible && (
          <div className="shrink-0 mt-3">
            <ConnectPromptToast
              milestone="badges"
              onConnect={() => {
                badgesConnectPrompt.dismiss();
                openConnectModal?.();
              }}
              onDismiss={badgesConnectPrompt.dismiss}
            />
          </div>
        )}

        {/* Stats banner — star count + progress bar */}
        <div className="shrink-0 mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-end">
            <CandyChip variant="warm" tone="subtle">
              {t("starsProgressFormat", { collected: totalCollectedStars, total: totalAvailableStars })}
            </CandyChip>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(110, 65, 15, 0.12)" }}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${(totalCollectedStars / totalAvailableStars) * 100}%` }}
            />
          </div>
        </div>

        {lastClaimedPiece ? (
          <div
            data-testid="badge-claim-success"
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition"
            style={{
              background: "rgba(16, 185, 129, 0.22)",
              color: "rgba(6, 78, 59, 0.95)",
              boxShadow: "inset 0 0 0 1px rgba(16, 185, 129, 0.55)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            <CandyIcon name="check" className="h-5 w-5" />
            {t("claimSuccess", { piece: tPiece(lastClaimedPiece) })}
          </div>
        ) : null}

        {/* Badge Grid */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pb-6">
          {badges.map((badge) => (
            <BadgeCard
              key={badge.piece}
              badge={badge}
              onClaim={() => onClaim(badge.piece)}
              isClaimBusy={isClaimBusy}
              claimingPiece={claimingPiece}
            />
          ))}
        </div>

        {/* Footer: Demoted Trophies CTA + Link */}
        <div className="shrink-0 pt-2">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={onNavigateToTrophies}
              className="text-xs font-bold underline underline-offset-4 transition-colors hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
              aria-label={t("viewTrophies")}
            >
              {t("viewTrophies")}
            </button>

            <Link
              href="/about"
              onClick={() => onOpenChange(false)}
              className="text-nano opacity-60 transition-colors hover:opacity-100"
              style={{ color: "rgba(110, 65, 15, 0.65)" }}
            >
              {tAbout("label")}
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
