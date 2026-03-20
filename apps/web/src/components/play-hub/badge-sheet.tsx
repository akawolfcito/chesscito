"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Trophy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BADGE_SHEET_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import { BADGE_THRESHOLD } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight"];

const BADGE_ART: Record<PieceId, string> = {
  rook: "/art/pieces/w-rook.png",
  bishop: "/art/pieces/w-bishop.png",
  knight: "/art/pieces/w-knight.png",
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
}: {
  badge: BadgeInfo;
  onClaim: () => void;
  isClaimBusy: boolean;
}) {
  const label = PIECE_LABELS[badge.piece];
  const title = `${label} Ascendant`;
  const isClaimed = badge.state === "claimed";
  const isClaimable = badge.state === "claimable";
  const isLocked = badge.state === "locked";
  const needed = Math.max(0, BADGE_THRESHOLD - badge.totalStars);

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
        isClaimed
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
          : isClaimable
            ? "bg-cyan-500/10 ring-1 ring-cyan-400/30"
            : "bg-slate-800/30",
      ].join(" ")}
    >
      <picture className={`h-12 w-12 shrink-0 ${isLocked ? "grayscale opacity-40" : ""}`}>
        <source srcSet={BADGE_ART[badge.piece].replace(".png", ".avif")} type="image/avif" />
        <source srcSet={BADGE_ART[badge.piece].replace(".png", ".webp")} type="image/webp" />
        <img
          src={BADGE_ART[badge.piece]}
          alt={title}
          className="h-full w-full object-contain"
        />
      </picture>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-cyan-50">{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isClaimed ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${(badge.totalStars / badge.maxStars) * 100}%` }}
            />
          </div>
          <span className="text-[0.6rem] font-semibold text-cyan-100/50 tabular-nums">
            {badge.totalStars}/{badge.maxStars}
          </span>
        </div>
        {isLocked ? (
          <p className="mt-0.5 text-[0.65rem] text-cyan-100/40">
            {badge.totalStars === 0 ? BADGE_SHEET_COPY.notStarted : BADGE_SHEET_COPY.locked(needed)}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        {isClaimed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> {BADGE_SHEET_COPY.owned}
          </span>
        ) : isClaimable ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={isClaimBusy}
            className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {isClaimBusy ? BADGE_SHEET_COPY.claiming : BADGE_SHEET_COPY.claimBadge}
          </button>
        ) : null}
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
  showNotification: boolean;
};

export function BadgeSheet({
  open,
  onOpenChange,
  badgesClaimed,
  onClaim,
  isClaimBusy,
  showNotification,
}: BadgeSheetProps) {
  const [starsByPiece, setStarsByPiece] = useState<Record<PieceId, number[]>>({
    rook: [0, 0, 0, 0, 0],
    bishop: [0, 0, 0, 0, 0],
    knight: [0, 0, 0, 0, 0],
  });

  useEffect(() => {
    if (!open) return;
    setStarsByPiece({
      rook: readStarsFromStorage("rook"),
      bishop: readStarsFromStorage("bishop"),
      knight: readStarsFromStorage("knight"),
    });
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
        <button
          type="button"
          aria-label="Badges"
          className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
        >
          <img src="/art/badge-menu.png" alt="" aria-hidden="true" className="h-full w-full object-contain p-0.5" />
          {showNotification ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell sheet-bg-badges rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">{BADGE_SHEET_COPY.title}</SheetTitle>
          <SheetDescription className="text-cyan-100/75">{BADGE_SHEET_COPY.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {badges.map((badge) => (
            <BadgeCard
              key={badge.piece}
              badge={badge}
              onClaim={() => onClaim(badge.piece)}
              isClaimBusy={isClaimBusy}
            />
          ))}
        </div>
        <Link
          href="/trophies"
          onClick={() => onOpenChange(false)}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 ring-1 ring-amber-400/20 transition hover:bg-amber-500/20"
        >
          <Trophy className="h-4 w-4" />
          {BADGE_SHEET_COPY.viewTrophies}
        </Link>
      </SheetContent>
    </Sheet>
  );
}
