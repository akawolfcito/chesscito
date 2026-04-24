"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { DIFFICULTY_LABELS, TROPHY_VITRINE_COPY, VICTORY_CLAIM_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

// Three warm-brown accent tints for the top-3 rank border — light,
// medium, deep. Uses the same palette as every other candy-light
// surface: no amber/slate/orange one-offs.
const RANK_SHADOW: Record<number, string> = {
  1: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 10px rgba(245, 158, 11, 0.22)",
  2: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 8px rgba(217, 180, 74, 0.18)",
  3: "inset 0 1px 2px rgba(255,245,215,0.55), 0 0 8px rgba(190, 18, 60, 0.16)",
};

const DIFFICULTY_VARIANT: Record<number, "success" | "warm" | "danger"> = {
  1: "success", // easy = muted success green
  2: "warm",    // medium = warm brown
  3: "danger",  // hard = muted rose
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

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(255, 255, 255, 0.18)",
        border: "1px solid rgba(110, 65, 15, 0.25)",
        boxShadow: rankShadow,
      }}
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
        <CandyChip variant={chipVariant} tone="subtle">
          {difficultyLabel}
        </CandyChip>
        <span
          className="text-xs"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
          {TROPHY_VITRINE_COPY.nftIdPrefix} #{String(entry.tokenId)}
        </span>
        <span
          className="ml-auto text-xs"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
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
            <span
              className="text-xs"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
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
        <p
          className="mt-1 text-center text-xs font-bold animate-in fade-in duration-200"
          style={{ color: "rgba(6, 95, 70, 0.95)" }}
        >
          {toast}
        </p>
      )}
    </div>
  );
}
