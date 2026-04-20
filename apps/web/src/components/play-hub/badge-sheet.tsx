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
        "relative flex items-center gap-3 px-3 py-3 transition",
        isLocked ? "panel-base" : "panel-elevated",
      ].join(" ")}
    >
      {isClaimed && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]">
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
        <p className={`text-sm ${isClaimed ? "font-bold text-white" : "font-semibold text-cyan-50"}`}>{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isClaimed ? "bg-gradient-to-r from-emerald-400 to-emerald-300" : "bg-amber-400"
              }`}
              style={{ width: `${(badge.totalStars / badge.maxStars) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-cyan-100/50 tabular-nums">
            {badge.totalStars}/{badge.maxStars}
          </span>
        </div>
        {isLocked ? (
          <p className="mt-0.5 text-xs text-cyan-100/40">
            {badge.totalStars === 0 ? BADGE_SHEET_COPY.notStarted : BADGE_SHEET_COPY.locked(needed)}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        {isClaimed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
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
          <CandyIcon name="lock" className="h-4 w-4 opacity-50" />
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
};

export function BadgeSheet({
  open,
  onOpenChange,
  badgesClaimed,
  onClaim,
  isClaimBusy,
  claimingPiece = null,
  showNotification,
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
            className="h-full w-full object-contain p-0.5 dock-treat-base"
          />
          {showNotification ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-badges flex max-h-[85dvh] flex-col rounded-t-3xl border-white/[0.10] pb-[5rem]">
        <div className="shrink-0 border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 pb-5 pt-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title flex items-center gap-2 text-slate-100"><CandyIcon name="trophy" className="h-5 w-5" />{BADGE_SHEET_COPY.title}</SheetTitle>
            <SheetDescription className="text-cyan-100/75">{BADGE_SHEET_COPY.subtitle}</SheetDescription>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                  style={{ width: `${(badges.reduce((s, b) => s + b.totalStars, 0) / badges.reduce((s, b) => s + b.maxStars, 0)) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-amber-300/80">
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
          <Link
            href="/trophies"
            onClick={() => onOpenChange(false)}
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-amber-500/[0.08] px-4 py-3.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/15 transition hover:bg-amber-500/20"
          >
            <CandyIcon name="trophy" className="h-5 w-5" />
            {BADGE_SHEET_COPY.viewTrophies}
          </Link>
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="mt-3 block text-center text-xs text-cyan-300/40 transition-colors hover:text-cyan-200/60"
          >
            {ABOUT_LINK_COPY.label}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
