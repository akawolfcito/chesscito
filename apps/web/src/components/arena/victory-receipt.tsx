"use client";

import { ARENA_COPY, SHARE_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { ShareButton } from "@/components/ui/share-button";
import { StatPill } from "@/components/ui/stat-pill";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";

type Props = {
  tokenId: bigint | null;
  moves: number;
  elapsedMs: number;
  difficulty: string;
  onPlayAgain: () => void;
  onBackToHub: () => void;
};

export function VictoryReceipt({
  tokenId,
  moves,
  elapsedMs,
  difficulty,
  onPlayAgain,
  onBackToHub,
}: Props) {
  const title = tokenId != null
    ? VICTORY_CELEBRATION_COPY.mintedTitle(tokenId)
    : VICTORY_CELEBRATION_COPY.mintedTitleFallback;

  const shareText = tokenId != null
    ? VICTORY_CELEBRATION_COPY.shareTextMinted(moves, tokenId, SHARE_COPY.url)
    : VICTORY_CELEBRATION_COPY.shareTextBasic(moves, SHARE_COPY.url);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Lottie sparkles — intensified (1.5x speed) */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} speed={1.5} className="h-full w-full opacity-60" />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[#0b1628]/90 px-8 py-8 backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.15)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        {/* Wolf icon — amber glow */}
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-16 w-16 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
        />

        {/* Title */}
        <h2 className="fantasy-title text-3xl font-bold text-amber-400 drop-shadow-[0_0_16px_rgba(245,158,11,0.5)]">
          {title}
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-white/50">
          {VICTORY_CELEBRATION_COPY.mintedSubtitle}
        </p>

        {/* Stat pills — amber */}
        <div className="flex items-center gap-2">
          <StatPill label={difficulty.toUpperCase()} variant="amber" />
          <StatPill label={`♟ ${moves}`} variant="amber" />
          <StatPill label={`⏱ ${formatTime(elapsedMs)}`} variant="amber" />
        </div>

        {/* Buttons */}
        <div className="flex w-full flex-col items-center gap-3">
          {/* Share (upgraded — amber, primary) */}
          <ShareButton
            text={shareText}
            url={SHARE_COPY.url}
            label={`🏆 ${VICTORY_CELEBRATION_COPY.shareVictory}`}
            copiedLabel={VICTORY_CELEBRATION_COPY.copiedToast}
            variant="amber"
          />

          {/* Play Again / Back to Hub */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onPlayAgain}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-6 py-2.5 font-semibold text-white shadow-[0_0_16px_rgba(34,211,238,0.3)] transition-all hover:shadow-[0_0_24px_rgba(34,211,238,0.5)] active:scale-95"
            >
              {ARENA_COPY.playAgain}
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95"
            >
              {ARENA_COPY.backToHub}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
