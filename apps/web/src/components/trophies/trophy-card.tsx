"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { DIFFICULTY_LABELS, TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

const DIFFICULTY_CHIP: Record<number, { className: string }> = {
  1: { className: "bg-emerald-500/25 text-emerald-800" },
  2: { className: "bg-amber-500/30 text-amber-800" },
  3: { className: "bg-rose-500/25 text-rose-800" },
};

const UNKNOWN_CHIP = { className: "bg-[rgba(110,65,15,0.18)] text-[rgba(63,34,8,0.85)]" };

const DIFFICULTY_TINT: Record<number, string> = {
  1: "border-l-emerald-500/60",
  2: "border-l-amber-500/70",
  3: "border-l-purple-500/60",
};

const RANK_ACCENT: Record<number, string> = {
  1: "border-amber-500/55 shadow-[inset_0_1px_2px_rgba(255,245,215,0.55),0_0_10px_rgba(251,191,36,0.20)]",
  2: "border-slate-400/55 shadow-[inset_0_1px_2px_rgba(255,245,215,0.55),0_0_8px_rgba(148,163,184,0.18)]",
  3: "border-orange-600/55 shadow-[inset_0_1px_2px_rgba(255,245,215,0.55),0_0_8px_rgba(234,88,12,0.18)]",
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
  const chip = DIFFICULTY_CHIP[entry.difficulty] ?? UNKNOWN_CHIP;
  const difficultyLabel = DIFFICULTY_LABELS[entry.difficulty] ?? "???";
  const isHoF = variant === "hall-of-fame";
  const accentClass = rank && rank <= 3 ? RANK_ACCENT[rank] : "border-[rgba(110,65,15,0.25)] shadow-[inset_0_1px_2px_rgba(255,245,215,0.45)]";
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
        "rounded-xl border border-l-2 bg-white/15 px-3 py-2.5",
        accentClass,
        difficultyTint,
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {isHoF && rank ? (
          <span
            className="w-5 text-center text-sm font-extrabold"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            {rank}
          </span>
        ) : (
          <CandyIcon name="trophy" className="h-4 w-4 shrink-0" />
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-extrabold leading-none ${chip.className}`}
        >
          {difficultyLabel}
        </span>
        <span className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
          {TROPHY_VITRINE_COPY.nftIdPrefix} #{String(entry.tokenId)}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--paper-text-muted)" }}>
          {formatDate(entry.timestamp)}
        </span>
      </div>

      <div
        className="mt-1.5 flex items-center gap-3 text-xs font-semibold"
        style={{ color: "rgba(110, 65, 15, 0.75)" }}
      >
        <span className="flex items-center gap-1">
          <CandyIcon name="move" className="h-4 w-4" />
          {entry.totalMoves} {TROPHY_VITRINE_COPY.movesLabel}
        </span>
        <span className="flex items-center gap-1">
          <CandyIcon name="time" className="h-4 w-4" />
          {formatTimeMs(entry.timeMs)}
        </span>

        <span className="ml-auto">
          {isHoF ? (
            <span className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
              {truncateAddress(entry.player)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={TROPHY_VITRINE_COPY.shareLabel}
              className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white/20 active:scale-90"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              <CandyIcon name="share" className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      {toast && (
        <p className="mt-1 text-center text-xs font-bold text-emerald-700 animate-in fade-in duration-200">
          {toast}
        </p>
      )}
    </div>
  );
}
