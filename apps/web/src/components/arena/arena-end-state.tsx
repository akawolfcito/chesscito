"use client";

import { type ReactNode, useEffect } from "react";
import { useTranslations } from "next-intl";

import type { ArenaStatus } from "@/lib/game/types";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { formatTime } from "@/lib/game/arena-utils";
import type { PlayerColor } from "@/lib/game/use-chess-game";
import { track } from "@/lib/telemetry";
import { VictoryCelebration } from "./victory-celebration";
import { VictoryClaiming } from "./victory-claiming";
import { VictoryClaimSuccess } from "./victory-claim-success";
import { VictoryClaimError } from "./victory-claim-error";

export type ClaimPhase = "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";

export type ShareStatus = "locked" | "generating" | "ready";

export type ClaimData = {
  tokenId: bigint | null;
  claimTxHash: string | null;
  shareCardUrl: string | null;
  shareLinkUrl: string | null;
};

/** Cluster E (§0.1) — game-record persistence lifecycle, surfaced to the
 *  end-state for CTA gating + toast / warning UI. */
export type PersistState = "idle" | "persisting" | "persisted" | "failed" | "dismissed";

type Props = {
  status: ArenaStatus;
  isPlayerWin: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  claimPhase: ClaimPhase;
  claimStep?: "signing" | "confirming" | "done";
  shareStatus: ShareStatus;
  claimData: ClaimData;
  onClaimVictory?: () => void;
  claimPrice?: string;
  claimError?: string | null;
  moves: number;
  elapsedMs: number;
  difficulty: string;
  fen?: string;
  playerColor?: PlayerColor;
  onAskCoach?: () => void;
  /** Cluster E — fires from the post-mint Victory success surface. Tags
   *  `coach_analyze_request{source:"victory-mint"}`. */
  onAskCoachFromVictory?: () => void;
  coachPreview?: ReactNode;
  /** Cluster E — persistence state for toast/warning + CTA gating. */
  persistState?: PersistState;
  gameRecordPersisted?: boolean;
  onRetryPersist?: () => void;
  onDismissPersistError?: () => void;
};

type ArenaTranslator = ReturnType<typeof useTranslations>;

function getLoseText(status: ArenaStatus, t: ArenaTranslator): string {
  switch (status) {
    case "checkmate":
      return t("endState.checkmate.lose");
    case "stalemate":
      return t("endState.stalemate");
    case "draw":
      return t("endState.draw");
    case "resigned":
      return t("endState.resigned");
    default:
      return "";
  }
}

export function ArenaEndState({
  status,
  isPlayerWin,
  onPlayAgain,
  onBackToHub,
  claimPhase,
  claimStep,
  shareStatus,
  claimData,
  onClaimVictory,
  claimPrice,
  claimError,
  moves,
  elapsedMs,
  difficulty,
  fen,
  playerColor,
  onAskCoach,
  onAskCoachFromVictory,
  coachPreview,
  persistState = "idle",
  gameRecordPersisted = false,
  onRetryPersist,
  onDismissPersistError,
}: Props) {
  const tArena = useTranslations("ARENA_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
  const tEntry = useTranslations("COACH_ENTRY_COPY");
  // Cluster E §0.1 — CTA gating + 0-move guard.
  // Fail-closed default: an unwired consumer renders CTAs disabled so a
  // forgotten prop never silently re-introduces the original race.
  const isTooShort = moves === 0;
  const coachCtaDisabled = !gameRecordPersisted || isTooShort;
  const isPersistBusy = persistState === "persisting";
  // Gate Mint Victory CTA on persistence. When the record isn't saved
  // yet, the parent should NOT receive a tap that would mint without an
  // anchor row in /api/games. Treating undefined as "not ready" mirrors
  // existing call-site semantics (`canClaim` guard).
  const guardedOnClaim = gameRecordPersisted ? onClaimVictory : undefined;
  const persistOverlay = (
    <PersistOverlay
      state={persistState}
      onRetry={onRetryPersist}
      onDismiss={onDismissPersistError}
      labels={{
        matchNotSaved: tEntry("matchNotSaved"),
        matchNotSavedRetry: tEntry("matchNotSavedRetry"),
        savingMatch: tEntry("savingMatch"),
        dismissLabel: tEntry("persistDismissLabel"),
      }}
    />
  );
  /* Hooks must run unconditionally on every render (React rules-of-hooks).
     Compute `text` here so the effect — and the early-return path below —
     share the same source. The effect's own guard skips the track() call
     on win / no-text, preserving previous behavior. */
  const text = getLoseText(status, tArena);

  useEffect(() => {
    if (!text || isPlayerWin) return;
    track("modal_open", {
      id: "arena-loss",
      status,
      difficulty,
      moves,
    });
  }, [text, isPlayerWin, status, difficulty, moves]);

  if (isPlayerWin) {
    const sharedProps = {
      moves,
      elapsedMs,
      difficulty,
      isCheckmate: status === "checkmate",
      onPlayAgain,
      onBackToHub,
    };

    // Cluster E — secondary Coach CTA under Mint Victory on win. Mounts
    // disabled + aria-busy until persistence settles. `aria-describedby`
    // points to a hidden span clarifying the Mint relationship per §0.4.
    const coachSecondaryCta = onAskCoach ? (
      <CoachAnalysisCta
        position="secondary-on-win"
        onClick={() => onAskCoach()}
        disabled={coachCtaDisabled}
        ariaBusy={isPersistBusy}
        tooShort={isTooShort}
      />
    ) : null;

    const composedCoachPreview = (
      <>
        {coachPreview}
        {coachSecondaryCta}
      </>
    );

    switch (claimPhase) {
      case "claiming":
        return (
          <>
            <VictoryClaiming {...sharedProps} claimStep={claimStep} />
            {persistOverlay}
          </>
        );
      case "success":
        // Post-mint: VictoryClaimSuccess renders its own AskCoach CTA via
        // the `onAskCoach` prop. We delegate the source-dim selection
        // there (victory-mint preferred) and do NOT inject the secondary
        // CTA into `coachPreview` to avoid double-rendering.
        return (
          <>
            <VictoryClaimSuccess
              {...sharedProps}
              claimData={claimData}
              shareStatus={shareStatus}
              onAskCoach={onAskCoachFromVictory ?? onAskCoach}
              coachPreview={coachPreview}
            />
            {persistOverlay}
          </>
        );
      case "error":
        return (
          <>
            <VictoryClaimError
              {...sharedProps}
              errorMessage={claimError}
              onRetry={onClaimVictory}
              kind="error"
            />
            {persistOverlay}
          </>
        );
      case "cancelled":
        return (
          <>
            <VictoryClaimError
              {...sharedProps}
              onRetry={onClaimVictory}
              kind="cancelled"
            />
            {persistOverlay}
          </>
        );
      case "timeout":
        return (
          <>
            <VictoryClaimError
              {...sharedProps}
              onRetry={onClaimVictory}
              kind="timeout"
            />
            {persistOverlay}
          </>
        );
      default:
        return (
          <>
            <VictoryCelebration
              {...sharedProps}
              onClaimVictory={guardedOnClaim}
              claimPrice={claimPrice}
              fen={fen}
              playerColor={playerColor}
              onAskCoach={onAskCoach}
              coachPreview={composedCoachPreview}
            />
            {persistOverlay}
          </>
        );
    }
  }

  if (!text) return null;

  const time = formatTime(elapsedMs);

  return (
    <div
      className="result-screen-overlay pointer-events-auto fixed inset-0 z-50 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={text}
    >
      <header
        className="absolute inset-x-0 top-0 z-10 border-b border-[rgba(110,65,15,0.30)] pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto w-full max-w-[var(--app-max-width)] px-2">
          <ContextualHeader
            variant="back-control"
            title={tArena("title")}
            back={{ onClick: onBackToHub, label: tArena("backToHubAria") }}
          />
        </div>
      </header>

      <main className="arena-result-screen">
        <section className="arena-result-header">
          <div className="arena-result-trophy">
            <div className="arena-result-trophy-glow" />
            <picture className="relative flex h-3/5 w-3/5 items-center justify-center">
              <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
              <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
              <img
                src="/art/favicon-wolf.png"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 opacity-50 drop-shadow-[0_4px_12px_rgba(120,65,5,0.30)]"
              />
            </picture>
          </div>

          <span className="arena-result-kicker">{tArena("matchEndedLabel")}</span>

          <h1 className="arena-result-title">{text}</h1>

          <p className="arena-result-subtitle">{tArena("matchEndedHint")}</p>
        </section>

        <div className="arena-result-stats">
          <PaperStatCard
            icon={<CandyIcon name="crosshair" className="h-4 w-4" />}
            value={(() => {
              const k = difficulty as "easy" | "medium" | "hard";
              return ["easy", "medium", "hard"].includes(k)
                ? tArena(`difficulty.${k}`)
                : difficulty;
            })()}
            label={tCelebration("stats.difficulty")}
          />
          <PaperStatCard
            icon={<CandyIcon name="move" className="h-4 w-4" />}
            value={String(moves)}
            label={tCelebration("stats.moves")}
          />
          <PaperStatCard
            icon={<CandyIcon name="time" className="h-4 w-4" />}
            value={time}
            label={tCelebration("stats.time")}
          />
        </div>

        {coachPreview && (
          <div className="arena-result-coach-wrap">{coachPreview}</div>
        )}

        {/* Cluster E — Coach CTA is PRIMARY on loss/draw/resigned (no
            Mint peer). Mounts disabled until the game record persists;
            aria-busy is reserved for the in-flight phase so screen
            readers don't announce a permanently-disabled CTA as busy. */}
        {onAskCoach && (
          <CoachAnalysisCta
            position="primary-on-lose"
            onClick={() => onAskCoach()}
            disabled={coachCtaDisabled}
            ariaBusy={isPersistBusy}
            tooShort={isTooShort}
          />
        )}

        <button
          type="button"
          onClick={onPlayAgain}
          className="arena-result-primary-cta arena-result-primary-cta--amber"
        >
          <CandyIcon name="refresh" className="h-5 w-5 shrink-0" />
          <span className="arena-result-primary-cta-label">{tArena("playAgain")}</span>
        </button>
      </main>
      {persistOverlay}
    </div>
  );
}

/**
 * Cluster E — Coach analysis CTA. Dual-position:
 *   - `primary-on-lose`: amber primary candy on loss/draw/resigned screens
 *   - `secondary-on-win`: muted secondary under the Mint Victory CTA
 *
 * Disabled when the underlying game record hasn't persisted (CTA mounts
 * with `aria-busy="true"`) or the match is too short to analyze
 * (`moves === 0`). On secondary mode the `aria-describedby` hidden span
 * clarifies the Mint relationship per spec §0.4.
 */
function CoachAnalysisCta({
  position,
  onClick,
  disabled,
  ariaBusy,
  tooShort,
}: {
  position: "primary-on-lose" | "secondary-on-win";
  onClick: () => void;
  disabled: boolean;
  ariaBusy: boolean;
  tooShort: boolean;
}) {
  const t = useTranslations("COACH_ENTRY_COPY");
  const describedById = t("victorySecondaryDescribedById");
  const label = t("getCoachAnalysis");
  const tooltip = tooShort ? t("matchTooShort") : undefined;

  const handleClick = () => {
    if (disabled) return;
    track("coach_victory_analyze_tap", { position, too_short: tooShort });
    onClick();
  };

  if (position === "primary-on-lose") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={ariaBusy || undefined}
        aria-disabled={disabled || undefined}
        title={tooltip}
        className="arena-result-primary-cta arena-result-primary-cta--amber mt-3 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <CandyIcon name="coach" className="h-5 w-5 shrink-0" />
        <span className="arena-result-primary-cta-label">{label}</span>
      </button>
    );
  }

  return (
    <div className="arena-result-coach-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={ariaBusy || undefined}
        aria-disabled={disabled || undefined}
        aria-describedby={describedById}
        title={tooltip}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "rgba(255, 245, 215, 0.65)",
          color: "rgba(110, 65, 15, 0.95)",
          border: "1px solid rgba(110, 65, 15, 0.25)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        <CandyIcon name="coach" className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
      <span id={describedById} className="sr-only">
        {t("victorySecondaryDescription")}
      </span>
    </div>
  );
}

/**
 * Cluster E — persistence overlay. Mounts as a fixed-position pill near
 * the bottom of the viewport while `/api/games` POST is in-flight, and
 * morphs into a warning row + Retry/Dismiss when the POST fails.
 */
type PersistOverlayLabels = {
  matchNotSaved: string;
  matchNotSavedRetry: string;
  savingMatch: string;
  dismissLabel: string;
};

export function PersistOverlay({
  state,
  onRetry,
  onDismiss,
  labels,
}: {
  state: PersistState;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** Locale-resolved copy. Optional so VR fixtures + storybook can render
   *  without an intl provider — defaults reproduce the EN literals. */
  labels?: Partial<PersistOverlayLabels>;
}) {
  const matchNotSaved = labels?.matchNotSaved ?? "Match not saved · play continues";
  const matchNotSavedRetry = labels?.matchNotSavedRetry ?? "Retry";
  const savingMatch = labels?.savingMatch ?? "Saving match…";
  const dismissLabel = labels?.dismissLabel ?? "Dismiss";

  if (state === "idle" || state === "dismissed") return null;

  if (state === "failed") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-label={matchNotSaved}
        className="pointer-events-auto fixed inset-x-0 bottom-24 z-[55] mx-auto flex w-full max-w-[var(--app-max-width,390px)] items-center gap-2 px-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div
          className="flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
          style={{
            background: "rgba(255, 228, 230, 0.92)",
            color: "rgba(159, 18, 57, 0.95)",
            border: "1px solid rgba(159, 18, 57, 0.4)",
            boxShadow: "0 2px 4px rgba(63, 34, 8, 0.15)",
          }}
        >
          <span aria-hidden="true">!</span>
          <span className="flex-1">{matchNotSaved}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full px-2 py-1 text-nano font-extrabold uppercase tracking-wider"
              style={{ background: "rgba(159, 18, 57, 0.15)" }}
            >
              {matchNotSavedRetry}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="rounded-full px-2 py-1 text-nano font-extrabold uppercase tracking-wider opacity-70"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center px-4 animate-in fade-in duration-200">
      <div className="pointer-events-auto">
        <TxProgressSteps
          variant="toast"
          steps={[{ code: "wait", label: savingMatch }]}
          current={state === "persisting" ? "wait" : "done"}
          flow="save-score"
        />
      </div>
    </div>
  );
}
