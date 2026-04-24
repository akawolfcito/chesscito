"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ABOUT_LINK_COPY, BADGE_SHEET_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
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
  const label = PIECE_LABELS[badge.piece];
  const title = `${label} Ascendant`;
  const isClaimed = badge.state === "claimed";
  const isClaimable = badge.state === "claimable";
  const isLocked = badge.state === "locked";
  const needed = Math.max(0, BADGE_THRESHOLD - badge.totalStars);
  const isThisBusy = claimingPiece === badge.piece;

  return (
    <div
      className={[
        "relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
        isLocked
          ? "border-[rgba(255,255,255,0.35)] bg-white/10 opacity-85"
          : "border-[rgba(255,255,255,0.45)] bg-white/15",
      ].join(" ")}
    >
      {isClaimed && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-[0_0_8px_rgba(5,150,105,0.35)]">
          &#10003;
        </span>
      )}
      <picture className={`h-12 w-12 shrink-0 ${isLocked ? "badge-treat-locked" : isClaimed ? "badge-treat-owned" : isClaimable ? "badge-treat-claimable" : ""}`}>
        {THEME_CONFIG.hasOptimizedFormats && (
          <>
            <source srcSet={BADGE_ART[badge.piece].replace(".png", ".avif")} type="image/avif" />
            <source srcSet={BADGE_ART[badge.piece].replace(".png", ".webp")} type="image/webp" />
          </>
        )}
        <img
          src={BADGE_ART[badge.piece]}
          alt={title}
          className="h-full w-full object-contain"
        />
      </picture>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-extrabold"
          style={{
            color: "rgba(63, 34, 8, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
          }}
        >
          {title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(110, 65, 15, 0.18)" }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isClaimed ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-amber-500"
              }`}
              style={{ width: `${(badge.totalStars / badge.maxStars) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: "rgba(110, 65, 15, 0.85)" }}>
            {badge.totalStars}/{badge.maxStars}
          </span>
        </div>
        {isLocked ? (
          <p className="mt-0.5 text-xs" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
            {badge.totalStars === 0 ? BADGE_SHEET_COPY.notStarted : BADGE_SHEET_COPY.locked(needed)}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        {isClaimed ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CandyIcon name="check" className="h-3.5 w-3.5" /> {BADGE_SHEET_COPY.owned}
          </span>
        ) : isClaimable ? (
          <Button
            type="button"
            variant="game-solid"
            onClick={onClaim}
            disabled={isClaimBusy}
            className="min-h-[44px] rounded-xl px-3 text-xs"
          >
            {isThisBusy && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {isThisBusy ? BADGE_SHEET_COPY.claiming : BADGE_SHEET_COPY.claimBadge}
          </Button>
        ) : (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-nano font-extrabold uppercase"
            style={{
              background: "rgba(120, 65, 5, 0.85)",
              color: "rgba(255, 240, 180, 0.98)",
              letterSpacing: "0.10em",
            }}
          >
            <CandyIcon name="lock" className="h-2.5 w-2.5" />
            Locked
          </span>
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
  showNotification: boolean;
  /** Switch to the Trophies sheet. Parent closes this sheet and opens
   *  the trophy drawer in-place — no route navigation. */
  onNavigateToTrophies: () => void;
};

export function BadgeSheet({
  open,
  onOpenChange,
  badgesClaimed,
  onClaim,
  isClaimBusy,
  claimingPiece = null,
  showNotification,
  onNavigateToTrophies,
}: BadgeSheetProps) {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {/* No explicit h/w classes needed: .chesscito-dock-item > button in globals.css enforces 2.75rem x 2.75rem via !important */}
        <button
          type="button"
          aria-label="Badges"
          className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
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
      <SheetContent side="bottom" className="mission-shell sheet-bg-badges flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]">
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="trophy" className="h-5 w-5" />
              {BADGE_SHEET_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {BADGE_SHEET_COPY.subtitle}
            </SheetDescription>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(110, 65, 15, 0.18)" }}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                  style={{ width: `${(badges.reduce((s, b) => s + b.totalStars, 0) / badges.reduce((s, b) => s + b.maxStars, 0)) * 100}%` }}
                />
              </div>
              <span
                className="text-xs font-extrabold tabular-nums"
                style={{
                  color: "rgba(110, 65, 15, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                {badges.reduce((s, b) => s + b.totalStars, 0)}/{badges.reduce((s, b) => s + b.maxStars, 0)}
              </span>
            </div>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-4 space-y-2">
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
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNavigateToTrophies}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-extrabold transition hover:bg-amber-500/30 active:scale-[0.98]"
            style={{
              background: "rgba(245, 158, 11, 0.22)",
              color: "rgba(120, 65, 5, 0.95)",
              boxShadow: "inset 0 0 0 1px rgba(245, 158, 11, 0.45)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            <CandyIcon name="trophy" className="h-5 w-5" />
            {BADGE_SHEET_COPY.viewTrophies}
          </button>
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="mt-3 block text-center text-xs transition-colors hover:opacity-80"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {ABOUT_LINK_COPY.label}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
