"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { DIFFICULTY_LABELS, TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const RANK_SHADOW: Record<number, string> = {
  1: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 10px rgba(245, 158, 11, 0.22)",
  2: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 8px rgba(217, 180, 74, 0.18)",
  3: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 8px rgba(190, 18, 60, 0.16)",
};

const DIFFICULTY_VARIANT: Record<number, "success" | "warm" | "danger"> = {
  1: "success",
  2: "warm",
  3: "danger",
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
  });
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type Props = {
  entry: VictoryEntry;
  variant: "victory" | "hall-of-fame";
  rank?: number;
  featured?: boolean;
};

export function TrophyCard({ entry, variant, rank, featured = false }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const difficultyLabel = DIFFICULTY_LABELS[entry.difficulty] ?? "???";
  const chipVariant = DIFFICULTY_VARIANT[entry.difficulty] ?? "warm";
  const isHoF = variant === "hall-of-fame";
  const rankShadow = rank && rank <= 3 ? RANK_SHADOW[rank] : "inset 0 1px 2px rgba(255,245,215,0.45)";

  const victoryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/victory/${entry.tokenId}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          text: VICTORY_CLAIM_COPY.challengeText(entry.totalMoves, victoryUrl),
        });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(victoryUrl);
      setToast(TROPHY_VITRINE_COPY.copiedToast);
      setTimeout(() => setToast(null), 2000);
    } catch { /* silent */ }
  }

  if (featured) {
    return (
      <div className="victory-card-featured">
        <div className="victory-card-featured-glow" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="victory-card-id">
              {TROPHY_VITRINE_COPY.cardIdPrefix} #{String(entry.tokenId)}
            </span>
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
              {formatDate(entry.timestamp)}
            </span>
          </div>
          
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600">
                <CandyIcon name="trophy" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black leading-tight tracking-tight text-[rgba(63,34,8,0.95)]">
                  Verifiable Victory
                </p>
                <CandyChip variant={chipVariant} tone="subtle">
                  {difficultyLabel}
                </CandyChip>
              </div>
            </div>
          </div>

          <div className="victory-card-metadata mt-6">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 p-2 border border-white/10">
              <CandyIcon name="move" className="h-4 w-4 opacity-60" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase opacity-40 leading-none">Moves</span>
                <span className="text-sm font-black tabular-nums leading-none mt-1">{entry.totalMoves}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 p-2 border border-white/10">
              <CandyIcon name="time" className="h-4 w-4 opacity-60" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase opacity-40 leading-none">Time</span>
                <span className="text-sm font-black tabular-nums leading-none mt-1">{formatTimeMs(entry.timeMs)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase opacity-40 tracking-wider">Player</span>
              <span className="text-[10px] font-mono opacity-80">{truncateAddress(entry.player)}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-10 px-4 items-center gap-2 rounded-xl bg-white/20 font-bold text-xs transition active:scale-95"
            >
              <CandyIcon name="share" className="h-3.5 w-3.5" />
              {TROPHY_VITRINE_COPY.shareLabel}
            </button>
          </div>
          
          {toast && (
            <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-bold text-emerald-600 animate-in fade-in">
              {toast}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="victory-card-compact">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="victory-card-id">#{String(entry.tokenId)}</span>
          <CandyChip variant={chipVariant} tone="subtle">
            {difficultyLabel}
          </CandyChip>
          {isHoF && (
            <span className="text-[10px] opacity-40 font-mono">
              {truncateAddress(entry.player)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 opacity-70">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase">
            <CandyIcon name="move" className="h-3 w-3" />
            {entry.totalMoves}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase">
            <CandyIcon name="time" className="h-3 w-3" />
            {formatTimeMs(entry.timeMs)}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">
          {formatDate(entry.timestamp)}
        </span>
        {!isHoF && (
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition active:scale-90"
          >
            <CandyIcon name="share" className="h-3.5 w-3.5 opacity-60" />
          </button>
        )}
        {isHoF && rank && (
          <span className="text-sm font-black italic opacity-20">#{rank}</span>
        )}
      </div>

      {toast && (
        <p className="absolute right-14 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600 animate-in fade-in">
          {toast}
        </p>
      )}
    </div>
  );
}
