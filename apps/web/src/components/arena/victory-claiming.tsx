"use client";

import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { StatCard } from "@/components/arena/stat-card";
import { formatTime } from "@/lib/game/arena-utils";
import { Button } from "@/components/ui/button";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  claimStep?: "signing" | "confirming" | "done";
  onBackToHub: () => void;
};

export function VictoryClaiming({
  moves,
  elapsedMs,
  difficulty,
  claimStep = "signing",
  onBackToHub,
}: Props) {
  const time = formatTime(elapsedMs);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.18]" />
      </div>

      {/* Card — same layout as ready state */}
      <div className="panel-showcase relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center px-6 pb-6 pt-8 shadow-[0_0_60px_rgba(20,184,166,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.18)_0%,rgba(217,180,74,0.06)_50%,transparent_70%)]" />
          <div className="relative h-32 w-32">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Title */}
        <h2 className="fantasy-title mb-1 text-3xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
          {VICTORY_CELEBRATION_COPY.title}
        </h2>

        {/* Performance summary */}
        <p className="mb-5 text-sm text-cyan-100/50">
          {VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)}
        </p>

        {/* Stats — 3 mini-cards */}
        <div className="mb-6 flex w-full gap-2">
          <StatCard icon="⚔" value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>

        {/* Progress indicator */}
        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            {VICTORY_CLAIM_COPY.progressSteps.map((label, i) => {
              const stepKeys = ["signing", "confirming", "done"] as const;
              const currentIdx = stepKeys.indexOf(claimStep);
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        isDone
                          ? "bg-emerald-400"
                          : isActive
                            ? "bg-emerald-400 animate-pulse"
                            : "bg-cyan-100/20"
                      }`}
                    />
                    <span
                      className={`text-[0.6rem] ${
                        isDone
                          ? "text-emerald-400/70"
                          : isActive
                            ? "text-emerald-300/80"
                            : "text-cyan-100/30"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < VICTORY_CLAIM_COPY.progressSteps.length - 1 && (
                    <div
                      className={`mb-4 h-px w-6 ${
                        isDone ? "bg-emerald-400/50" : "bg-cyan-100/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.65rem] text-cyan-100/40">
            {VICTORY_CLAIM_COPY.progressTimeHint}
          </p>
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="mt-2 text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
      </div>
    </div>
  );
}
