"use client";

import { useTranslations } from "next-intl";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";
import { VictoryPopupShell } from "./victory-popup-shell";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  claimStep?: "signing" | "confirming" | "done";
  onBackToHub: () => void;
  /** Optional dismiss-without-navigate handler. Mint continues in the
   *  background regardless — closing only hides the UI. */
  onClose?: () => void;
};

const AVATAR_BASE = "/art/new-assets-chesscito/fun/avatar-confiado";
const STEP_KEYS = ["signing", "confirming", "done"] as const;

/**
 * Victory claiming popup — shown while the Mint Victory NFT
 * transaction is mid-flight (signing → confirming → done).
 *
 * Same popup vocabulary as the loss popup. Trophy lottie in the hero
 * slot, "Saving Victory…" title, animated progress dots, avatar-confiado
 * floating right (calm wolf, "trust the chain"). Close X hides the
 * popup but the mint continues — parent will surface success/error
 * when settled.
 */
export function VictoryClaiming({
  moves,
  elapsedMs,
  difficulty,
  claimStep = "signing",
  onBackToHub,
  onClose,
}: Props) {
  const tArena = useTranslations("ARENA_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
  const time = formatTime(elapsedMs);
  const progressSteps = tClaim.raw("progressSteps") as readonly string[];
  const currentIdx = STEP_KEYS.indexOf(claimStep);
  const difficultyKey = difficulty as "easy" | "medium" | "hard";
  const difficultyLabel = ["easy", "medium", "hard"].includes(difficultyKey)
    ? tArena(`difficulty.${difficultyKey}`)
    : difficulty;
  const handleClose = onClose ?? onBackToHub;
  const title = tClaim("progressTitle");

  return (
    <VictoryPopupShell
      onClose={handleClose}
      ariaLabel={title}
      role="alert"
      ariaLive="assertive"
      closeLabel={tArena("backToHubAria")}
    >
      <div className="victory-popup-sparkles" aria-hidden="true">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-30" />
      </div>

      {/* Hero — centered headline alone (no trophy). Matches the win-
          celebration hero so all win-* variants share the same opener. */}
      <div className="victory-popup-hero-solo">
        <h1 className="arena-result-title">{title}</h1>
      </div>

      {/* Stats row — same MISSION-style pills. */}
      <div className="arena-result-stats-row arena-result-stats-row--missionpills">
        <span className="candy-stat-pill">
          <span className="candy-stat-pill-icon">
            <CandyIcon name="star" className="h-4 w-4" />
          </span>
          {difficultyLabel}
        </span>
        <span className="candy-stat-pill">
          <span className="candy-stat-pill-icon">
            <picture>
              <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
              <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
              <img
                src="/art/redesign/pieces/w-pawn.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="block h-full w-full object-contain"
              />
            </picture>
          </span>
          {String(moves)}
        </span>
        <span className="candy-stat-pill">
          <span className="candy-stat-pill-icon">
            <CandyIcon name="time" className="h-4 w-4" />
          </span>
          {time}
        </span>
      </div>

      {/* Progress steps + calm wolf avatar floating right. */}
      <div className="victory-popup-mint-row">
        <div className="victory-popup-progress">
          <div className="victory-popup-progress-steps">
            {progressSteps.map((label, i) => {
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={label} className="victory-popup-progress-step">
                  <span
                    className={`victory-popup-progress-dot${
                      isDone ? " is-done" : isActive ? " is-active" : ""
                    }`}
                  />
                  <span
                    className={`victory-popup-progress-label${
                      isDone ? " is-done" : isActive ? " is-active" : ""
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="victory-popup-progress-hint">{tClaim("progressTimeHint")}</p>
        </div>
        <picture className="arena-result-coach-avatar victory-popup-avatar">
          <source srcSet={`${AVATAR_BASE}.avif`} type="image/avif" />
          <source srcSet={`${AVATAR_BASE}.webp`} type="image/webp" />
          <img src={`${AVATAR_BASE}.png`} alt="" aria-hidden="true" draggable={false} />
        </picture>
      </div>
    </VictoryPopupShell>
  );
}
