"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, Share2, Users, Link2, Trophy } from "lucide-react";
import { ARENA_COPY, SHARE_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { StatCard } from "@/components/arena/stat-card";
import { formatTime } from "@/lib/game/arena-utils";
import type { ClaimData, ShareStatus } from "./arena-end-state";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  claimData: ClaimData;
  shareStatus: ShareStatus;
};

export function VictoryClaimSuccess({
  moves,
  elapsedMs,
  difficulty,
  onPlayAgain,
  onBackToHub,
  claimData,
  shareStatus,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const time = formatTime(elapsedMs);

  const shareUrl = claimData.shareLinkUrl ?? SHARE_COPY.url;
  const challengeText = VICTORY_CLAIM_COPY.challengeText(moves, shareUrl);
  const isShareReady = shareStatus === "ready";

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  /** Primary: native share (best UX — keeps context) */
  async function handleShareCard() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: challengeText });
        showToast(VICTORY_CLAIM_COPY.sharedToast);
        return;
      } catch { /* cancelled */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${challengeText}\n${shareUrl}`);
      showToast(VICTORY_CLAIM_COPY.copiedToast);
    } catch { /* silent */ }
  }

  /** Secondary: challenge a friend (native share with challenge text) */
  async function handleChallengeFriend() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: challengeText });
        showToast(VICTORY_CLAIM_COPY.sharedToast);
        return;
      } catch { /* cancelled */ }
    }
    // Fallback: copy challenge text
    try {
      await navigator.clipboard.writeText(`${challengeText}\n${shareUrl}`);
      showToast(VICTORY_CLAIM_COPY.copiedToast);
    } catch { /* silent */ }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(VICTORY_CLAIM_COPY.copiedToast);
    } catch { /* silent */ }
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles — intensified */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} speed={1.5} className="h-full w-full opacity-60" />
      </div>

      {/* Card */}
      <div className="relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[var(--surface-frosted)] px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(245,158,11,0.12)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy with amber glow (reward state) */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.18)_0%,rgba(217,180,74,0.08)_50%,transparent_70%)]" />
          <div className="relative h-32 w-32">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Title — amber reward state */}
        <h2 className="fantasy-title mb-1 text-2xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.35)]">
          {VICTORY_CLAIM_COPY.successTitle}
        </h2>

        {/* Subtitle */}
        <p className="mb-5 text-center text-sm text-cyan-100/50">
          {VICTORY_CLAIM_COPY.successSubtitle}
        </p>

        {/* Stats */}
        <div className="mb-5 flex w-full gap-2">
          <StatCard icon="⚔" value={difficulty.toUpperCase()} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>

        {/* Share area */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Share Card (native share — best UX) */}
          <button
            type="button"
            onClick={() => void handleShareCard()}
            disabled={!isShareReady}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.97] disabled:opacity-50"
          >
            <Share2 size={16} className="inline -mt-0.5" /> {VICTORY_CLAIM_COPY.shareCard}
          </button>

          {/* Secondary row: Challenge + Copy Link */}
          {isShareReady && (
            <div className="flex w-full gap-1.5">
              <button
                type="button"
                onClick={() => void handleChallengeFriend()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/15 bg-amber-500/[0.06] px-2 py-2 text-[0.6rem] font-semibold text-amber-300/70 transition-all hover:bg-amber-500/[0.12] active:scale-95"
              >
                <Users size={12} /> {VICTORY_CLAIM_COPY.challengeFriend}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2 text-[0.6rem] font-semibold text-cyan-100/60 transition-all hover:bg-white/[0.08] active:scale-95"
              >
                <Link2 size={12} /> {VICTORY_CLAIM_COPY.copyLink}
              </button>
            </div>
          )}

          {/* Toast feedback */}
          {toast && (
            <p className="text-center text-xs font-semibold text-emerald-400 animate-in fade-in duration-200">
              {toast}
            </p>
          )}

          {/* View Trophies */}
          <Link
            href="/trophies"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] py-2.5 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/[0.12] active:scale-[0.97]"
          >
            <Trophy size={16} /> {VICTORY_CLAIM_COPY.viewTrophies}
          </Link>

          {/* Play Again */}
          <Button
            type="button"
            variant="game-primary"
            size="game-sm"
            onClick={onPlayAgain}
            className="shadow-[0_0_12px_rgba(20,184,166,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.35)]"
          >
            <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Back to Hub */}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
      </div>
    </div>
  );
}
