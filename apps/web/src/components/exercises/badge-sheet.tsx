"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
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
import { JourneyRail } from "@/components/redesign/journey-rail";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import { THEME_CONFIG } from "@/lib/theme";
import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/** Switch-grid option — same shape the retired PiecePickerSheet used. */
export type PieceOption = {
  key: PieceId;
  label: string;
  enabled: boolean;
};

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
        <picture className="block h-full w-full">
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
          // Shop buy-pill style (founder 2026-06-11): same lush green
          // pill as the SHOP price buttons. nowrap auto-width also
          // kills the "Clai…" truncation the gold-carved sprite had
          // at this size.
          <button
            type="button"
            className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--green"
            onClick={onClaim}
            disabled={isClaimBusy}
            aria-busy={isThisBusy}
            aria-label={t("claimBadge")}
          >
            {isThisBusy ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              t("claim")
            )}
          </button>
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
  /** Render the built-in `<SheetTrigger>` dock button. Default `true`
   *  for legacy callers (`<ExercisesScreen>` mounts this inside the dock).
   *  Pass `false` from the scaffold, which controls open state via
   *  `onOpenChange` and never wants the orphan trigger floating in the
   *  layout tree. Without this gate, Radix renders the button as a real
   *  DOM node sibling of the scaffold — invisible only by accident. */
  showTrigger?: boolean;
  /** Unified Piece Sheet (surface redistribution D3). When provided,
   *  the sheet gains the active-piece journey section (migrated from
   *  Mission, D2) and — once at least one badge is claimed — the
   *  switch-piece grid. Hub callers omit these and keep the pure
   *  vitrine. */
  selectedPiece?: PieceId;
  pieces?: readonly PieceOption[];
  /** Tap on an enabled piece in the switch grid. The sheet closes
   *  itself before reporting. The grid renders ONLY when this handler
   *  AND a claimed badge exist (pedagogy gate, founder 2026-05-31:
   *  a fresh player learning their first piece is never offered a
   *  distraction to other pieces). */
  onSelectPiece?: (piece: PieceId) => void;
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
  showTrigger = true,
  selectedPiece,
  pieces,
  onSelectPiece,
}: BadgeSheetProps) {
  const t = useTranslations("BADGE_SHEET_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tRail = useTranslations("PIECE_RAIL_COPY");
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
  const piecesClaimed = badges.filter((b) => b.state === "claimed").length;
  const progressPct = totalAvailableStars === 0 ? 0 : (totalCollectedStars / totalAvailableStars) * 100;

  // Unified Piece Sheet (D3) derived state. Journey needs the active
  // piece's star total (already read from storage above); the switch
  // grid stays behind the claimed-badge pedagogy gate.
  const selectedPieceStars = selectedPiece
    ? (starsByPiece[selectedPiece] ?? []).reduce((sum, s) => sum + s, 0)
    : 0;
  const hasClaimedAnyBadge = Object.values(badgesClaimed).some(Boolean);
  const showJourney = Boolean(selectedPiece);
  const showSwitchGrid = Boolean(
    selectedPiece && pieces && onSelectPiece && hasClaimedAnyBadge,
  );

  // Phase 2 nudge: when a disconnected user opens the sheet AND has at
  // least one claimable badge (= local stars cross threshold but no
  // wallet on record), fire the one-shot prompt. Idempotent — the hook
  // no-ops after the flag is set. Depend on `.show` (memoized) rather
  // than the whole hook object to avoid re-running the effect on every
  // render (cf. /arena PLAY-button regression fix).
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const badgesConnectPrompt = useConnectPrompt("badges");
  const hasClaimable = badges.some((b) => b.state === "claimable");
  const showBadgesPrompt = badgesConnectPrompt.show;
  useEffect(() => {
    if (open && !isConnected && hasClaimable) {
      showBadgesPrompt();
    }
  }, [open, isConnected, hasClaimable, showBadgesPrompt]);

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

        {/* HERO BAND — visual anchor for the Badges vitrine.
         *  Brings the brand character (wolf wizard) + a glance-able
         *  preview of all 6 pieces (claimed in color, locked as
         *  silhouettes) + unified progress counters (pieces + stars).
         *  Replaces the previous stats banner (chip + bare progress
         *  bar) which read as a flat utility row. The hero is the
         *  first thing a visual-first user sees after the header. */}
        <div className="badge-vitrine-hero shrink-0 mt-3">
          <picture className="badge-vitrine-hero-wolf">
            <source srcSet="/art/scene-rooted/avatar-chesscito.avif" type="image/avif" />
            <source srcSet="/art/scene-rooted/avatar-chesscito.webp" type="image/webp" />
            <img
              src="/art/scene-rooted/avatar-chesscito.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          </picture>
          <div className="badge-vitrine-hero-content">
            <p className="badge-vitrine-hero-eyebrow">{t("title")}</p>
            <div className="badge-vitrine-hero-pieces" role="list">
              {PIECES.map((piece) => {
                const claimed = Boolean(badgesClaimed[piece]);
                return (
                  <span
                    key={piece}
                    role="listitem"
                    className={`badge-vitrine-hero-piece${claimed ? " is-claimed" : ""}`}
                    aria-label={tPiece(piece)}
                  >
                    <picture>
                      <source srcSet={`${THEME_CONFIG.piecesBase}/w-${piece}.avif`} type="image/avif" />
                      <source srcSet={`${THEME_CONFIG.piecesBase}/w-${piece}.webp`} type="image/webp" />
                      <img src={`${THEME_CONFIG.piecesBase}/w-${piece}.png`} alt="" aria-hidden="true" draggable={false} />
                    </picture>
                  </span>
                );
              })}
            </div>
            <p className="badge-vitrine-hero-stats">
              <span className="badge-vitrine-hero-stats-piece">{piecesClaimed}/{PIECES.length} {t("heroPiecesLabel")}</span>
              <span className="badge-vitrine-hero-stats-sep" aria-hidden="true">·</span>
              <span className="badge-vitrine-hero-stats-star">{totalCollectedStars}/{totalAvailableStars} ★</span>
            </p>
            <div className="badge-vitrine-hero-progress">
              <div
                className="badge-vitrine-hero-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
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

        {/* Onboarding hint — visible only when the user has zero stars
         *  collected. Sells the reward (digital collectible) in plain
         *  language before they have to read anything else. Disappears
         *  the moment they earn their first star. */}
        {totalCollectedStars === 0 ? (
          <p
            className="shrink-0 mt-3 text-center text-sm font-bold leading-snug"
            style={{ color: "rgba(63, 34, 8, 0.85)" }}
          >
            {t("firstStepHint")}
          </p>
        ) : null}

        {/* Scrollable body: journey (active piece) → badge grid →
            switch grid. Journey and switch only mount in unified
            Piece Sheet mode (selectedPiece provided, D3). */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pb-6">
          {showJourney && selectedPiece ? (
            <section aria-label={t("journeyTitle")}>
              <p
                className="mb-1 text-xs font-bold uppercase tracking-[0.08em]"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {t("journeyTitle")}
              </p>
              <JourneyRail
                currentPiece={selectedPiece}
                currentStars={selectedPieceStars}
                claimedBadges={badgesClaimed}
              />
            </section>
          ) : null}

          {badges.map((badge) => (
            <BadgeCard
              key={badge.piece}
              badge={badge}
              onClaim={() => onClaim(badge.piece)}
              isClaimBusy={isClaimBusy}
              claimingPiece={claimingPiece}
            />
          ))}

          {showSwitchGrid && pieces && onSelectPiece ? (
            <section aria-label={tRail("switchSectionLabel")}>
              <p
                className="mb-1 pt-2 text-center text-[0.7rem] font-extrabold uppercase tracking-[0.16em]"
                style={{ color: "rgba(110, 65, 15, 0.65)" }}
              >
                {tRail("switchSectionLabel")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {pieces.map((piece) => {
                  const isActive = selectedPiece === piece.key;
                  const isLocked = !piece.enabled;
                  const src = `${THEME_CONFIG.piecesBase}/w-${piece.key}`;
                  return (
                    <button
                      key={piece.key}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        onOpenChange(false);
                        onSelectPiece(piece.key);
                      }}
                      className={[
                        "flex min-h-[88px] flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all",
                        isActive
                          ? "border-amber-400/75 bg-amber-400/15 ring-2 ring-amber-400/40"
                          : isLocked
                            ? "cursor-not-allowed border-[rgba(255,255,255,0.25)] bg-white/10 opacity-55"
                            : "border-[rgba(255,255,255,0.45)] bg-white/15 hover:bg-white/25 active:scale-[0.97]",
                      ].join(" ")}
                      aria-label={piece.label}
                      aria-pressed={isActive}
                    >
                      <picture className="h-10 w-10 shrink-0">
                        {THEME_CONFIG.hasOptimizedFormats && (
                          <>
                            <source srcSet={`${src}.avif`} type="image/avif" />
                            <source srcSet={`${src}.webp`} type="image/webp" />
                          </>
                        )}
                        <img
                          src={`${src}.png`}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-contain"
                        />
                      </picture>
                      <span
                        className="fantasy-title text-xs font-extrabold uppercase tracking-[0.10em]"
                        style={{
                          color: "rgba(63, 34, 8, 0.95)",
                          textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                        }}
                      >
                        {tPiece(piece.key)}
                      </span>
                      {isLocked ? (
                        <span
                          className="text-nano inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-extrabold uppercase tracking-[0.12em]"
                          style={{
                            background: "rgba(120, 65, 5, 0.85)",
                            color: "rgba(255, 240, 180, 0.98)",
                          }}
                        >
                          <CandyIcon name="lock" className="h-2.5 w-2.5" />
                          {tRail("comingSoon")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
