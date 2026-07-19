"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { useThemeBackground } from "@/lib/themes/use-theme-background";

import type { ArenaStatus } from "@/lib/game/types";
import { mapArenaResult } from "@/lib/coach/game-result";
import { saveCtaLabelKey } from "@/lib/coach/save-cta-label";
import { MintSuccessToast } from "@/components/coach/mint-success-toast";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CoachCostRibbon } from "@/components/coach/coach-cost-ribbon";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { formatTime } from "@/lib/game/arena-utils";
import type { PlayerColor } from "@/lib/game/use-chess-game";
import { track } from "@/lib/telemetry";
import { VictoryCelebration } from "./victory-celebration";
import { VictoryClaiming } from "./victory-claiming";
import { VictoryClaimSuccess } from "./victory-claim-success";
import { VictoryClaimError } from "./victory-claim-error";
import { ClaimCancelledToast } from "./claim-cancelled-toast";
import type { TxErrorKind } from "@/lib/errors";

/** Re-exported from the hook that owns the machine. This used to be a second,
 *  independent union with the same name, so dropping a member upstream left the
 *  dead variant reachable here and typecheck stayed green. */
export type { ClaimPhase } from "@/lib/coach/use-mint-victory";
import type { ClaimPhase } from "@/lib/coach/use-mint-victory";

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
  /** One-shot from useMintVictory: the last claim was rejected in the wallet.
   *  Renders a transient "Not saved yet" toast over the untouched victory
   *  screen. Cancelling must never cost the player the celebration. */
  justCancelled?: boolean;
  claimStep?: "signing" | "confirming" | "done";
  shareStatus: ShareStatus;
  claimData: ClaimData;
  onClaimVictory?: () => void;
  claimPrice?: string;
  claimError?: string | null;
  /** Locale-agnostic kind from useMintVictory(). Forwarded to
   *  VictoryClaimError so it can surface the AddCashCta recovery
   *  deeplink when the failure is insufficientFunds + MiniPay. */
  claimErrorKind?: TxErrorKind | null;
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
  /** Loss-screen popup close handler. When provided, the X button +
   *  backdrop tap call this instead of `onBackToHub`, so the player
   *  stays on the final board view instead of being kicked out to the
   *  hub. Sally's retention-loop guidance (2026-05-26). Falls back to
   *  `onBackToHub` when omitted so legacy callers keep working. */
  onClose?: () => void;
  /** PRO status — forwarded into VictoryCelebration so it doesn't
   *  call useIsProActive() itself (the dev fixture renders this
   *  outside a WagmiProvider). */
  proActive?: boolean;
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

/* Per-status hero icon — themed asset that visually summarises the
 * outcome (checkmate flash, stalemate red Xs, draw equals sign,
 * resignation white flag). All in /art/new-assets-chesscito/games/. */
type LossStatus = "checkmate" | "stalemate" | "draw" | "resigned";
const HERO_ICON_BY_STATUS: Record<LossStatus, ThemeAssetKey> = {
  checkmate: "arena.result-checkmate",
  stalemate: "arena.result-stalemate",
  draw: "arena.result-draw",
  resigned: "arena.result-resign",
};

/* Per-status coach avatar — emotional register matching the outcome:
 *   checkmate → asombrado (shocked at AI's mate)
 *   stalemate → interrogativo (unusual outcome, "what just happened?")
 *   draw → confiado (neutral, no loser)
 *   resigned → triste (player gave up) */
const AVATAR_BY_STATUS: Record<LossStatus, ThemeAssetKey> = {
  checkmate: "shared.feedback-surprised",
  stalemate: "shared.feedback-questioning",
  draw: "shared.feedback-confident",
  resigned: "shared.feedback-sad",
};

function isLossStatus(s: ArenaStatus): s is LossStatus {
  return s === "checkmate" || s === "stalemate" || s === "draw" || s === "resigned";
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
  claimErrorKind,
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
  onClose,
  proActive = false,
  justCancelled = false,
}: Props) {
  const tArena = useTranslations("ARENA_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
  const tEntry = useTranslations("COACH_ENTRY_COPY");
  const panelBackground = useThemeBackground("shared.panel-bg");
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

  // M1 funnel (Commit 2 + Commit 4, 2026-06-01) — Coach-primary CTA
  // hierarchy. Commit 2 covered checkmate-lost + resigned; Commit 4
  // extends to stalemate + draw (the "no winner" outcomes). All four
  // share the same secondary Play Again + subtitle treatment; only the
  // primary Coach CTA label diverges per outcome semantic.
  const isLossOrResign = status === "checkmate" || status === "resigned";
  const isDrawOrStalemate = status === "draw" || status === "stalemate";
  const isCoachPrimaryVariant = isLossOrResign || isDrawOrStalemate;
  const endgameContext: "endgame_loss" | "endgame_resign" | "endgame_draw" | null =
    status === "resigned"
      ? "endgame_resign"
      : status === "checkmate"
        ? "endgame_loss"
        : isDrawOrStalemate
          ? "endgame_draw"
          : null;

  useEffect(() => {
    if (!text || isPlayerWin) return;
    track("modal_open", {
      id: "arena-loss",
      status,
      difficulty,
      moves,
    });
  }, [text, isPlayerWin, status, difficulty, moves]);

  useEffect(() => {
    if (!text || isPlayerWin || !isCoachPrimaryVariant || !endgameContext) return;
    track("monetization.coach_review_offered", { context: endgameContext });
  }, [text, isPlayerWin, isCoachPrimaryVariant, endgameContext]);

  // F8 phase (b) — inline Save (mint) lifecycle for the loss/draw/resign
  // popup. Unlike the win path (full-screen VictoryClaiming/Success/Error),
  // a non-win Save stays INLINE: the button goes busy, success raises the
  // neutral MintSuccessToast, and a failure swaps in a retry row. The real
  // outcome drives both the label (via saveCtaLabelKey → "Save match") and
  // the funnel `result` dimension. Hooks run unconditionally (the win branch
  // returns below), guarded by `isPlayerWin` so wins are untouched.
  const saveResult = mapArenaResult(status, isPlayerWin);
  const [saveToastDismissed, setSaveToastDismissed] = useState(false);
  // The hook's `justCancelled` stays raised until the next claim or reset, so the
  // toast needs its own dismissal latch to auto-hide. Re-arms whenever the flag
  // drops, so a second cancellation re-announces.
  const [cancelToastDismissed, setCancelToastDismissed] = useState(false);
  useEffect(() => {
    if (!justCancelled && cancelToastDismissed) setCancelToastDismissed(false);
  }, [justCancelled, cancelToastDismissed]);
  const showCancelToast = justCancelled && !cancelToastDismissed;
  const saveSuccessFiredRef = useRef(false);
  useEffect(() => {
    if (isPlayerWin) return;
    if (claimPhase === "success") {
      if (!saveSuccessFiredRef.current) {
        saveSuccessFiredRef.current = true;
        track("monetization.save_victory_success", {
          context: endgameContext ?? undefined,
          result: saveResult,
        });
      }
    } else {
      // Reset so a re-save re-announces and re-fires the funnel event.
      saveSuccessFiredRef.current = false;
      if (saveToastDismissed) setSaveToastDismissed(false);
    }
  }, [claimPhase, isPlayerWin, endgameContext, saveResult, saveToastDismissed]);

  if (isPlayerWin) {
    const sharedProps = {
      moves,
      elapsedMs,
      difficulty,
      isCheckmate: status === "checkmate",
      onPlayAgain,
      onBackToHub,
      onClose,
    };

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
        // the `onAskCoach` prop. The `coachPreview` slot is intentionally
        // omitted to avoid double-rendering — the prop was removed from
        // VictoryClaimSuccess so a future regression can't slip back in.
        // `onSaveAgain` re-invokes the mint for unlimited re-save (founder
        // spec 2026-06-13). `fen`/`playerColor` enable the share card
        // fallback before the on-chain victory OG is available.
        return (
          <>
            <VictoryClaimSuccess
              {...sharedProps}
              fen={fen}
              playerColor={playerColor}
              claimData={claimData}
              shareStatus={shareStatus}
              onAskCoach={onAskCoachFromVictory ?? onAskCoach}
              onSaveAgain={guardedOnClaim}
              coachCtaDisabled={coachCtaDisabled}
              coachCtaBusy={isPersistBusy}
              coachTooShort={isTooShort}
              proActive={proActive}
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
              errorKind={claimErrorKind}
              onRetry={onClaimVictory}
              kind="error"
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
              coachCtaDisabled={coachCtaDisabled}
              coachCtaBusy={isPersistBusy}
              coachTooShort={isTooShort}
              proActive={proActive}
            />
            {showCancelToast && (
              <ClaimCancelledToast onDismiss={() => setCancelToastDismissed(true)} />
            )}
            {persistOverlay}
          </>
        );
    }
  }

  if (!text) return null;

  const time = formatTime(elapsedMs);
  const difficultyLabel = (() => {
    const k = difficulty as "easy" | "medium" | "hard";
    return ["easy", "medium", "hard"].includes(k)
      ? tArena(`difficulty.${k}`)
      : difficulty;
  })();
  const reviewHeadline = isTooShort
    ? tEntry("reviewHeadlineTooShort")
    : tEntry("reviewHeadlineReady");
  const reviewBody = isTooShort
    ? tEntry("reviewBodyTooShort")
    : tEntry("reviewBodyReady");

  // Per-status asset paths — fall back to the resigned variant if
  // somehow status arrives outside the LossStatus union.
  const lossKey: LossStatus = isLossStatus(status) ? status : "resigned";
  const heroIconSlot = HERO_ICON_BY_STATUS[lossKey];
  const avatarSlot = AVATAR_BY_STATUS[lossKey];

  // Close handler: Sally's retention-loop guidance — X + backdrop tap
  // dismiss the popup without navigating away from /arena. When the
  // parent doesn't wire `onClose`, fall back to the legacy hub
  // navigation so callers like /coach/history keep working.
  const handleClose = onClose ?? onBackToHub;

  // F8 phase (b) — Save affordance (only when the parent wired a claimable,
  // persisted mint; guests / 0-move games get `undefined` and no tile).
  const saveLabel = tArena(saveCtaLabelKey(saveResult));
  const saveAriaLabel = tArena("saveMatchAriaLabel", { price: claimPrice ?? "" });
  const isSaveBusy = claimPhase === "claiming";
  const isSaved = claimPhase === "success";
  // A cancellation is not a failure: it leaves the phase at "ready" and the Save
  // tile untouched, so the player can claim again without the tile shouting.
  const isSaveFailed = claimPhase === "error" || claimPhase === "timeout";
  const handleSaveClick = () => {
    if (!guardedOnClaim || isSaveBusy) return;
    track("monetization.save_victory_tap", {
      context: endgameContext ?? undefined,
      result: saveResult,
    });
    guardedOnClaim();
  };

  return (
    /* Canonical candy modal pattern — same vocabulary as MissionDetailSheet
       (scrim, panel asset, close button position). Backdrop tap closes
       without navigating; only the panel stops propagation. */
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="candy-modal-scrim pointer-events-auto fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={text}
      onClick={() => handleClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        style={{
          /* panel-bg1 has a taller native aspect (4:5) than the square
             panel-mision-icon, so the popup foliage corners stretch
             less vertically when the content is tall. */
          backgroundImage: panelBackground,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Close X — canonical candy-close-asset-button with the same
            corner inset as MissionDetailSheet (4% from top + right). */}
        <button
          type="button"
          onClick={handleClose}
          aria-label={tArena("closeResultAria")}
          className="candy-close-asset-button absolute right-[4%] top-[4%] z-10"
        >
          <ThemeAssetPicture slot="shared.close" alt="" aria-hidden="true" className="h-10 w-10 object-contain" draggable={false} />
        </button>

        <div className="flex flex-col arena-result-popup-content">

          {/* Section order (Wolfcito 2026-05-26): hero row → coach
              review → stats → PLAY. Hero is a single row with the
              resign-game icon on the LEFT and the message (kicker +
              title + subtitle) on the RIGHT. */}

          {/* Hero — resign-game icon LEFT + title RIGHT. Sally pass
              2026-05-26: dropped the kicker band "---ANOTHER ROUND?---"
              and the subtitle "Try again when ready." The double-kicker
              pattern (this + COACH REVIEW) read as "drawer inside a
              drawer" — keeping only the COACH REVIEW band separates
              the popup into ONE coherent surface. Subtitle is
              redundant with the PLAY CTA below. */}
          {/* Cross-balance: hero icon LEFT pairs with coach avatar RIGHT
              below, creating a zig-zag diagonal of visual weight that
              keeps the popup balanced instead of all-heavy on one side. */}
          <div className="arena-result-hero-row">
            <ThemeAssetPicture slot={heroIconSlot} pictureClassName="arena-result-hero-icon" alt="" aria-hidden="true" draggable={false} />
            <div className="arena-result-hero-text">
              <h1 className="arena-result-title">{text}</h1>
              {isCoachPrimaryVariant && (
                <p
                  className="arena-result-hero-subtitle mt-1 text-xs font-semibold"
                  style={{ color: "rgba(110, 65, 15, 0.78)" }}
                >
                  {tArena("lossSubtitle")}
                </p>
              )}
            </div>
          </div>

          {/* coachPreview slot intentionally NOT rendered in the loss
              popup — the Coach Review section below replaces it with
              the canonical avatar + headline + CTA pattern. The prop
              is still accepted so the win path (VictoryCelebration /
              VictoryClaimSuccess) can keep using it unchanged. */}

          {/* Coach Review — its own kicker divider replaces the
              section rule above (visual band is enough separation). */}
          {onAskCoach && (
            <div className="arena-result-coach-section" aria-labelledby="arena-coach-review-headline">
                <div className="arena-result-coach-kicker-row">
                  <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
                  <span className="arena-result-kicker">{tEntry("reviewKicker")}</span>
                  <span className="arena-result-coach-kicker-rule" aria-hidden="true" />
                </div>
                {/* Text + CTA LEFT, half-body floating wolf RIGHT — Sally
                    pass + Wolfcito cross-balance: avatar is character
                    (NOT a portrait), so frame it transparent and let it
                    peek from the right side of the panel. */}
                <div className="arena-result-coach-body">
                  <div className="arena-result-coach-text">
                    <h2 id="arena-coach-review-headline" className="arena-result-coach-headline">
                      {reviewHeadline}
                    </h2>
                    <p className="arena-result-coach-body-text">{reviewBody}</p>
                    <CoachAnalysisCta
                      position="primary-on-lose"
                      proActive={proActive}
                      onClick={() => {
                        if (isCoachPrimaryVariant && endgameContext) {
                          track("monetization.coach_review_tap", {
                            context: endgameContext,
                            source: "endgame",
                          });
                        }
                        onAskCoach();
                      }}
                      disabled={coachCtaDisabled}
                      ariaBusy={isPersistBusy}
                      tooShort={isTooShort}
                      label={
                        isLossOrResign
                          ? tEntry("lossReviewCta")
                          : isDrawOrStalemate
                            ? tEntry("drawReviewCta")
                            : undefined
                      }
                    />
                  </div>
                  <ThemeAssetPicture slot={avatarSlot} pictureClassName="arena-result-coach-avatar" alt="" aria-hidden="true" draggable={false} />
                </div>
            </div>
          )}

          {/* Stats — .candy-stat-pill chips (same as MISSION popup
              "1500 pts" / "1s" pills). Icon INSIDE the pill (no
              overhang), cream-amber base, single-shape rounded pill. */}
          <div className="arena-result-stats-row arena-result-stats-row--missionpills">
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="star" className="h-4 w-4" />
              </span>
              {difficultyLabel}
            </span>
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <ThemeAssetPicture slot="board.piece.white.pawn" alt="" aria-hidden="true" draggable={false} className="block h-full w-full object-contain" />
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

          {/* SAVE — F8 phase (b). Secondary affordance below Coach (which
              stays primary on a loss); lets the player keep ANY outcome as
              an on-chain collectible. Inline lifecycle: busy while minting,
              a retry row on failure, and the neutral MintSuccessToast on
              success (rendered at modal level). Hidden for guests / 0-move
              games (parent passes no `onClaimVictory`).

              Re-save cooldown (resolved 2026-06-14): the contract enforces a 30s
              per-player mintCooldown (VictoryNFTUpgradeable:117). Rather than
              re-arm Save after success (an immediate re-tap would revert with a
              generic "Transaction failed"), the tile becomes a non-tappable
              "Saved" confirmation (`isSaved` branch). The win re-save path
              (VictoryClaimSuccess "Save again") still re-arms — parity is a
              follow-up. */}
          {guardedOnClaim && !isTooShort && (
            <div className="arena-result-save-section">
              {isSaveFailed ? (
                <div
                  role="alert"
                  className="flex flex-col gap-1 rounded-2xl px-3 py-2 text-xs font-semibold"
                  style={{
                    background: "rgba(255, 228, 230, 0.92)",
                    color: "rgba(159, 18, 57, 0.95)",
                    border: "1px solid rgba(159, 18, 57, 0.4)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">!</span>
                    <span className="flex-1">{claimError ?? tArena("saveError")}</span>
                    <button
                      type="button"
                      onClick={handleSaveClick}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-nano font-extrabold uppercase tracking-wider"
                      style={{ background: "rgba(159, 18, 57, 0.15)" }}
                    >
                      {tArena("saveRetry")}
                    </button>
                  </div>
                  {/* T4 — reassurance line (parity with the win error popup's
                      "Your progress is safe" copy); the match record persists
                      regardless of the mint outcome. */}
                  <span className="text-[0.7rem] font-medium opacity-80">
                    {tArena("saveErrorHint")}
                  </span>
                </div>
              ) : isSaved ? (
                /* Post-success: a non-tappable "Saved" confirmation replaces the
                   Save button so an immediate re-tap can't hit the 30s contract
                   mintCooldown (founder request 2026-06-14). The toast also
                   confirms. The collectible is already saved; re-save is dropped
                   here by design. */
                <div
                  className="arena-result-save-cta arena-result-save-cta--done"
                  aria-label={tArena("saved")}
                >
                  <span aria-hidden="true">✓</span>
                  <span className="arena-result-primary-cta-label">{tArena("saved")}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={isSaveBusy}
                  aria-busy={isSaveBusy || undefined}
                  aria-label={saveAriaLabel}
                  className="arena-result-save-cta disabled:cursor-not-allowed"
                >
                  {isSaveBusy ? (
                    <span className="arena-result-save-cta-spinner" aria-hidden="true" />
                  ) : (
                    <ThemeAssetPicture slot="arena.save" pictureClassName="arena-result-save-cta-icon" alt="" draggable={false} />
                  )}
                  <span className="arena-result-primary-cta-label">
                    {isSaveBusy ? tEntry("savingMatch") : saveLabel}
                  </span>
                  {claimPrice && !isSaveBusy && (
                    <span className="arena-result-treasure-price-ribbon" aria-hidden="true">
                      {claimPrice}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* PLAY button — M1 funnel (Commit 2 + Commit 4): demoted to
              secondary cream when Coach Review owns the primary slot
              (loss/resign + draw/stalemate). Wins use the dedicated
              VictoryCelebration popup and never reach this branch. */}
          <button
            type="button"
            onClick={() => {
              if (isCoachPrimaryVariant && endgameContext) {
                track("monetization.play_again_tap", { context: endgameContext });
              }
              onPlayAgain();
            }}
            className={
              isCoachPrimaryVariant
                ? "arena-result-secondary-action"
                : "arena-result-primary-cta arena-result-primary-cta--amber arena-result-primary-cta--inset"
            }
          >
            <span className="arena-result-primary-cta-label">
              {isCoachPrimaryVariant ? tArena("lossPlayAgainCta") : tArena("playAgain")}
            </span>
          </button>
        </div>
      </div>
      {persistOverlay}
      {/* F8 phase (b) — neutral save confirmation. Keyed on the token id so a
          re-save re-mounts and re-announces. */}
      {claimPhase === "success" && !saveToastDismissed && claimData.tokenId != null && (
        <MintSuccessToast
          key={String(claimData.tokenId)}
          tokenId={String(claimData.tokenId)}
          onDismiss={() => setSaveToastDismissed(true)}
        />
      )}
      {/* Same notice on the inline (loss/draw/resign) Save path — a rejected
          prompt leaves the popup as it was and says so, once. */}
      {showCancelToast && (
        <ClaimCancelledToast onDismiss={() => setCancelToastDismissed(true)} />
      )}
    </div>
  );
}

/**
 * Cluster E — Coach analysis CTA. Amber primary candy on the
 * loss/draw/resigned end-state screens. (The win flow renders its own
 * coach CTA inside VictoryCelebration / VictoryClaimSuccess, so the old
 * `secondary-on-win` position was dead and has been removed.)
 *
 * Disabled when the underlying game record hasn't persisted (CTA mounts
 * with `aria-busy="true"`) or the match is too short to analyze
 * (`moves === 0`).
 */
export function CoachAnalysisCta({
  position,
  onClick,
  disabled,
  ariaBusy,
  tooShort,
  label: labelOverride,
  proActive = false,
}: {
  position: "primary-on-lose";
  onClick: () => void;
  disabled: boolean;
  ariaBusy: boolean;
  tooShort: boolean;
  /** Override the default `getCoachAnalysis` label. M1 funnel uses this
   *  to surface a context-specific copy on the loss/resign popup
   *  without affecting the shared win-secondary slot. */
  label?: string;
  /** Plan 3 — drives the coach cost ribbon (crown "PRO" vs "♟ 1") on the
   *  primary-on-lose CTA. */
  proActive?: boolean;
}) {
  const t = useTranslations("COACH_ENTRY_COPY");
  const label = labelOverride ?? t("getCoachAnalysis");
  const tooltip = tooShort ? t("matchTooShort") : undefined;

  const handleClick = () => {
    if (disabled) return;
    track("coach_victory_analyze_tap", { position, too_short: tooShort });
    onClick();
  };

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
      {!disabled && <CoachCostRibbon proActive={proActive} variant="cta" />}
    </button>
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
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-nano font-extrabold uppercase tracking-wider"
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
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-nano font-extrabold uppercase tracking-wider opacity-70"
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
