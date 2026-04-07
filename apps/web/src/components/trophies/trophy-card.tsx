"use client";

import { useState } from "react";
import { Trophy, Clock, Footprints, Share2 } from "lucide-react";
import { DIFFICULTY_LABELS, TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const DIFFICULTY_CHIP: Record<number, { className: string }> = {
  1: { className: "bg-emerald-500/20 text-emerald-400" },
  2: { className: "bg-amber-500/20 text-amber-400" },
  3: { className: "bg-rose-500/20 text-rose-400" },
};

const DIFFICULTY_TINT: Record<number, string> = {
  1: "border-l-emerald-500/40",
  2: "border-l-amber-500/40",
  3: "border-l-purple-500/40",
};

const RANK_ACCENT: Record<number, string> = {
  1: "border-[rgba(220,190,100,0.35)] shadow-[inset_0_1px_3px_rgba(255,255,255,0.04),inset_0_-1px_3px_rgba(0,0,0,0.3),0_0_10px_rgba(200,170,100,0.10)]",
  2: "border-slate-300/35 shadow-[inset_0_1px_3px_rgba(255,255,255,0.04),inset_0_-1px_3px_rgba(0,0,0,0.3),0_0_8px_rgba(203,213,225,0.08)]",
  3: "border-orange-600/35 shadow-[inset_0_1px_3px_rgba(255,255,255,0.04),inset_0_-1px_3px_rgba(0,0,0,0.3),0_0_8px_rgba(234,88,12,0.08)]",
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
};

export function TrophyCard({ entry, variant, rank }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const chip = DIFFICULTY_CHIP[entry.difficulty] ?? DIFFICULTY_CHIP[1];
  const difficultyLabel = DIFFICULTY_LABELS[entry.difficulty] ?? DIFFICULTY_LABELS[1];
  const isHoF = variant === "hall-of-fame";
  const accentClass = rank && rank <= 3 ? RANK_ACCENT[rank] : "border-[rgba(200,170,100,0.20)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.03),inset_0_-1px_2px_rgba(0,0,0,0.2)]";
  const difficultyTint = DIFFICULTY_TINT[entry.difficulty] ?? "";

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

  return (
    <div
      className={[
        "rounded-xl border border-l-2 px-3 py-2.5",
        accentClass,
        difficultyTint,
      ].join(" ")}
      style={{ background: "var(--trophy-card-bg)" }}
    >
      <div className="flex items-center gap-2">
        {isHoF && rank ? (
          <span className="text-sm font-bold text-slate-100 w-5 text-center">
            {rank}
          </span>
        ) : (
          <Trophy className="h-4 w-4 shrink-0 text-amber-400 drop-shadow-[0_0_4px_rgba(200,170,100,0.3)]" />
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold leading-none ${chip.className}`}
        >
          {difficultyLabel}
        </span>
        <span className="text-[0.65rem] text-slate-500">{TROPHY_VITRINE_COPY.nftIdPrefix} #{String(entry.tokenId)}</span>
        <span className="ml-auto text-[0.65rem] text-slate-500">{formatDate(entry.timestamp)}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Footprints className="h-3.5 w-3.5" />
          {entry.totalMoves} {TROPHY_VITRINE_COPY.movesLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTimeMs(entry.timeMs)}
        </span>

        <span className="ml-auto">
          {isHoF ? (
            <span className="text-[0.65rem] text-slate-500">
              {truncateAddress(entry.player)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={TROPHY_VITRINE_COPY.shareLabel}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-cyan-100/50 transition hover:bg-white/5 active:scale-90"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      {toast && (
        <p className="mt-1 text-center text-[0.6rem] font-semibold text-emerald-400 animate-in fade-in duration-200">
          {toast}
        </p>
      )}
    </div>
  );
}
