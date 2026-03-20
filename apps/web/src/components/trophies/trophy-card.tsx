"use client";

import { Trophy, Clock, Footprints } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const DIFFICULTY_PILL: Record<number, { label: string; className: string }> = {
  1: { label: "Easy", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  2: { label: "Medium", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  3: { label: "Hard", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function formatTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(unix: number): string {
  if (unix <= 0) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type Props = {
  entry: VictoryEntry;
  showPlayer?: boolean;
  showShare?: boolean;
};

export function TrophyCard({ entry, showPlayer, showShare }: Props) {
  const pill = DIFFICULTY_PILL[entry.difficulty] ?? DIFFICULTY_PILL[1];
  const victoryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/victory/${entry.tokenId}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${pill.className}`}
          >
            {pill.label}
          </span>
          <span className="text-xs text-slate-400">#{String(entry.tokenId)}</span>
        </div>
        <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-slate-300">
        <span className="flex items-center gap-1">
          <Footprints className="h-4 w-4 text-slate-500" />
          {entry.totalMoves} moves
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-slate-500" />
          {formatTimeMs(entry.timeMs)}
        </span>
      </div>

      {showPlayer && (
        <p className="mt-2 text-xs text-slate-500">
          {truncateAddress(entry.player)}
        </p>
      )}

      {showShare && (
        <div className="mt-3">
          <ShareButton
            text={VICTORY_CLAIM_COPY.challengeText(entry.totalMoves, victoryUrl)}
            url={victoryUrl}
            label="Share"
          />
        </div>
      )}
    </div>
  );
}
