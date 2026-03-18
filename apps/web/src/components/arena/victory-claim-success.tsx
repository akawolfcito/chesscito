"use client";

import { useState } from "react";
import { ARENA_COPY, SHARE_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { formatTime } from "@/lib/game/arena-utils";
import type { ClaimData, ShareStatus } from "./arena-end-state";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  isCheckmate?: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  claimData: ClaimData;
  shareStatus: ShareStatus;
};

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <span className="text-sm leading-none opacity-60">{icon}</span>
      <span className="text-base font-bold leading-none text-white/90">{value}</span>
      <span className="text-[0.6rem] uppercase tracking-widest text-cyan-200/40">{label}</span>
    </div>
  );
}

function SocialButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2 text-[0.6rem] font-semibold text-cyan-100/60 transition-all hover:bg-white/[0.08] hover:text-cyan-100/80 active:scale-95"
    >
      {label}
    </button>
  );
}

export function VictoryClaimSuccess({
  moves,
  elapsedMs,
  difficulty,
  isCheckmate = true,
  onPlayAgain,
  onBackToHub,
  claimData,
  shareStatus,
}: Props) {
  const [copied, setCopied] = useState(false);
  const time = formatTime(elapsedMs);
  const performanceLine = isCheckmate
    ? VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)
    : VICTORY_CELEBRATION_COPY.performanceLine(moves, time);

  const shareText = claimData.tokenId != null
    ? VICTORY_CELEBRATION_COPY.shareTextClaimed(moves, claimData.tokenId, SHARE_COPY.url)
    : VICTORY_CELEBRATION_COPY.shareTextBasic(moves, SHARE_COPY.url);

  const shareUrl = claimData.shareLinkUrl ?? SHARE_COPY.url;
  const isShareReady = shareStatus === "ready";

  async function handleShareCard() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  function handleShareToX() {
    const text = encodeURIComponent(shareText);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener");
  }

  function handleShareToWhatsApp() {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles — intensified */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} speed={1.5} className="h-full w-full opacity-60" />
      </div>

      {/* Card */}
      <div className="relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(245,158,11,0.12)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

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

        {/* Share area — unlocked reward block */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Share Card */}
          <button
            type="button"
            onClick={() => void handleShareCard()}
            disabled={!isShareReady}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.97] disabled:opacity-50"
          >
            {copied ? VICTORY_CLAIM_COPY.copiedToast : VICTORY_CLAIM_COPY.shareCard}
          </button>

          {/* Social actions row */}
          {isShareReady && (
            <div className="flex w-full gap-1.5">
              <SocialButton label={VICTORY_CLAIM_COPY.shareToX} onClick={handleShareToX} />
              <SocialButton label={VICTORY_CLAIM_COPY.shareToWhatsApp} onClick={handleShareToWhatsApp} />
              <SocialButton label={VICTORY_CLAIM_COPY.copyLink} onClick={() => void handleCopyLink()} />
            </div>
          )}

          {/* Generating state hint */}
          {shareStatus === "generating" && (
            <p className="text-center text-[0.65rem] text-amber-300/50 animate-pulse">
              {VICTORY_CLAIM_COPY.claimProgress2}
            </p>
          )}

          {/* Play Again */}
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 py-2.5 text-sm font-bold text-white shadow-[0_0_12px_rgba(20,184,166,0.2)] transition-all hover:shadow-[0_0_20px_rgba(20,184,166,0.35)] active:scale-[0.97]"
          >
            {ARENA_COPY.playAgain}
          </button>

          {/* Back to Hub */}
          <button
            type="button"
            onClick={onBackToHub}
            className="w-full py-2 text-center text-xs font-medium text-white/30 transition-all hover:text-white/50 active:scale-[0.97]"
          >
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </div>
    </div>
  );
}
