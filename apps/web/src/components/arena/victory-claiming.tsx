"use client";

import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { formatTime } from "@/lib/game/arena-utils";
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
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.18]" />
      </div>

      {/* Card */}
      <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CandyGlassShell
          title={VICTORY_CELEBRATION_COPY.title}
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          cta={
            <div className="flex w-full flex-col items-center gap-3">
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
                              ? "bg-emerald-600"
                              : isActive
                                ? "bg-emerald-500 animate-pulse"
                                : ""
                          }`}
                          style={!isDone && !isActive ? { background: "rgba(110,65,15,0.25)" } : undefined}
                        />
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: isDone
                              ? "rgba(4, 120, 87, 0.95)"
                              : isActive
                                ? "rgba(5, 150, 105, 0.98)"
                                : "rgba(110, 65, 15, 0.60)",
                            textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      {i < VICTORY_CLAIM_COPY.progressSteps.length - 1 && (
                        <div
                          className="mb-4 h-px w-6"
                          style={{
                            background: isDone ? "rgba(4, 120, 87, 0.55)" : "rgba(110,65,15,0.25)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
                {VICTORY_CLAIM_COPY.progressTimeHint}
              </p>
              <button
                type="button"
                onClick={onBackToHub}
                className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Hero — Trophy with amber halo */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.22)_0%,rgba(217,180,74,0.10)_50%,transparent_70%)]" />
              <div className="relative h-32 w-32">
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>

            {/* Performance summary */}
            <p className="text-sm" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
              {VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)}
            </p>

            {/* Stats — 3 mini-cards */}
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
