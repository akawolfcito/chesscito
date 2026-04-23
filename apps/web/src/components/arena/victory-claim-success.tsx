"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { ARENA_COPY, SHARE_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { AskCoachButton } from "@/components/coach/ask-coach-button";
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
  onAskCoach?: () => void;
};

export function VictoryClaimSuccess({
  moves,
  elapsedMs,
  difficulty,
  onPlayAgain,
  onBackToHub,
  claimData,
  shareStatus,
  onAskCoach,
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
      <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CandyGlassShell
          title={VICTORY_CLAIM_COPY.successTitle}
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          cta={
            <div className="flex w-full flex-col items-center gap-2.5">
              <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
                <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
              </Button>

              {isShareReady && (
                <div className="flex w-full items-center justify-center gap-3">
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(challengeText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
                    style={{
                      background: "rgba(255, 255, 255, 0.18)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      color: "rgba(110, 65, 15, 0.85)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(challengeText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
                    style={{
                      background: "rgba(255, 255, 255, 0.18)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      color: "rgba(110, 65, 15, 0.85)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    aria-label="Copy link"
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
                    style={{
                      background: "rgba(255, 255, 255, 0.18)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      color: "rgba(110, 65, 15, 0.85)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <CandyIcon name="copy" className="h-4 w-4" />
                  </button>
                </div>
              )}

              {toast && (
                <p className="text-center text-xs font-semibold text-emerald-700 animate-in fade-in duration-200">
                  {toast}
                </p>
              )}

              {onAskCoach && <AskCoachButton onClick={onAskCoach} />}

              <button
                type="button"
                onClick={onBackToHub}
                className="w-full py-1 text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Hero — Trophy with amber glow (reward state) */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_70%)]" />
              <div className="relative h-32 w-32">
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>

            {/* Subtitle */}
            <p
              className="text-sm"
              style={{
                color: "rgba(110, 65, 15, 0.85)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {VICTORY_CLAIM_COPY.successSubtitle}
            </p>

            {/* Claimed badge */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold"
              style={{
                background: "rgba(120, 65, 5, 0.85)",
                color: "rgba(255, 240, 180, 0.98)",
                letterSpacing: "0.03em",
              }}
            >
              {VICTORY_CLAIM_COPY.claimedBadge}
            </span>

            {/* Stats */}
            <div className="flex w-full gap-2">
              <PaperStatCard
                icon={<CandyIcon name="crosshair" className="h-4 w-4" />}
                value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty}
                label={VICTORY_CELEBRATION_COPY.stats.difficulty}
              />
              <PaperStatCard
                icon={<CandyIcon name="move" className="h-4 w-4" />}
                value={String(moves)}
                label={VICTORY_CELEBRATION_COPY.stats.moves}
              />
              <PaperStatCard
                icon={<CandyIcon name="time" className="h-4 w-4" />}
                value={time}
                label={VICTORY_CELEBRATION_COPY.stats.time}
              />
            </div>
          </div>
        </CandyGlassShell>
      </div>
    </div>
  );
}
