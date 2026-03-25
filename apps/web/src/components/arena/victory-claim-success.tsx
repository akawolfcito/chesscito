"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, Share2, Link2, Trophy } from "lucide-react";
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
          <StatCard icon="⚔" value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
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

          {/* Secondary row: icon-only share buttons (X, WhatsApp, Copy) */}
          {isShareReady && (
            <div className="flex w-full items-center justify-center gap-3">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(challengeText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(challengeText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                aria-label="Copy link"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-cyan-100/70 transition-all hover:bg-white/[0.1] active:scale-90"
              >
                <Link2 size={18} />
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
