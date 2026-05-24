"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyChip } from "@/components/redesign/candy-chip";
import { DIFFICULTY_LABELS } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

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

export function TrophyCard({ entry, variant, featured = false, rank }: Props) {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const [toast, setToast] = useState<string | null>(null);
  const difficultyLabel = DIFFICULTY_LABELS[entry.difficulty] ?? "???";
  const chipVariant = DIFFICULTY_VARIANT[entry.difficulty] ?? "warm";
  const isHoF = variant === "hall-of-fame";

  const victoryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/victory/${entry.tokenId}`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          text: tClaim("challengeText", { moves: entry.totalMoves, url: victoryUrl }),
        });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(victoryUrl);
      setToast(t("copiedToast"));
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
              {t("cardIdPrefix")} #{String(entry.tokenId)}
            </span>
            <span className="text-nano font-bold text-[rgba(63,34,8,0.50)] uppercase tracking-widest">
              {formatDate(entry.timestamp)}
            </span>
          </div>
          
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(63,34,8,0.08)] text-[rgba(63,34,8,0.80)]">
                <CandyIcon name="trophy" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black leading-tight tracking-tight text-[rgba(63,34,8,0.95)]">
                  {t("verifiableVictoryHeadline")}
                </p>
                <CandyChip variant={chipVariant} tone="subtle">
                  {difficultyLabel}
                </CandyChip>
              </div>
            </div>
          </div>

          <div className="victory-card-metadata mt-6">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-[rgba(63,34,8,0.06)] p-2 border border-[rgba(63,34,8,0.10)]">
              <CandyIcon name="move" className="h-4 w-4 text-[rgba(63,34,8,0.60)]" />
              <div className="flex flex-col">
                <span className="text-nano font-bold uppercase text-[rgba(63,34,8,0.40)] leading-none">{t("movesStatLabel")}</span>
                <span className="text-sm font-black tabular-nums leading-none mt-1 text-[rgba(63,34,8,0.90)]">{entry.totalMoves}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-[rgba(63,34,8,0.06)] p-2 border border-[rgba(63,34,8,0.10)]">
              <CandyIcon name="time" className="h-4 w-4 text-[rgba(63,34,8,0.60)]" />
              <div className="flex flex-col">
                <span className="text-nano font-bold uppercase text-[rgba(63,34,8,0.40)] leading-none">{t("timeStatLabel")}</span>
                <span className="text-sm font-black tabular-nums leading-none mt-1 text-[rgba(63,34,8,0.90)]">{formatTimeMs(entry.timeMs)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-nano font-bold uppercase text-[rgba(63,34,8,0.40)] tracking-wider">{t("playerStatLabel")}</span>
              <span className="text-xs font-mono text-[rgba(63,34,8,0.70)]">{truncateAddress(entry.player)}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="flex h-10 px-4 items-center gap-2 rounded-xl bg-[rgba(63,34,8,0.10)] font-bold text-xs text-[rgba(63,34,8,0.80)] transition active:scale-95"
            >
              <CandyIcon name="share" className="h-3.5 w-3.5" />
              {t("shareLabel")}
            </button>
          </div>
          
          {toast && (
            <p className="absolute -bottom-6 left-0 right-0 text-center text-xs font-bold text-emerald-700 animate-in fade-in">
              {toast}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="victory-card-compact relative">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="victory-card-id">#{String(entry.tokenId)}</span>
          <CandyChip variant={chipVariant} tone="subtle">
            {difficultyLabel}
          </CandyChip>
          {isHoF && (
            <span className="text-xs text-[rgba(63,34,8,0.60)] font-mono">
              {truncateAddress(entry.player)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-nano font-bold uppercase text-[rgba(63,34,8,0.75)]">
            <CandyIcon name="move" className="h-3 w-3 text-amber-600" />
            {entry.totalMoves}
          </span>
          <span className="flex items-center gap-1 text-nano font-bold uppercase text-[rgba(63,34,8,0.75)]">
            <CandyIcon name="time" className="h-3 w-3 text-amber-600" />
            {formatTimeMs(entry.timeMs)}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <span className="text-nano font-bold text-[rgba(63,34,8,0.40)] uppercase tracking-widest">
          {formatDate(entry.timestamp)}
        </span>
        {!isHoF && (
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(63,34,8,0.08)] transition active:scale-90"
          >
            <CandyIcon name="share" className="h-3.5 w-3.5 text-[rgba(63,34,8,0.60)]" />
          </button>
        )}
        {isHoF && rank && (
          <span className="text-sm font-black italic text-[rgba(63,34,8,0.15)]">#{rank}</span>
        )}
      </div>

      {toast && (
        <p className="absolute right-14 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 animate-in fade-in">
          {toast}
        </p>
      )}
    </div>
  );
}
