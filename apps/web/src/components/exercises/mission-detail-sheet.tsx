"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { getNextChallenge, type TrainingNode } from "@/lib/training/path";
import type { PieceId } from "@/lib/game/types";

type Props = {
  /** Controlled open state — parent closes it when a dock sheet opens,
   *  so the user never sees stacked pickers. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPiece: PieceId;
  targetLabel: string;
  isCapture: boolean;
  /** Curated one-line prompt for the ACTIVE exercise ("You cannot jump over
   *  your own piece. Go around it."). Absent on uncurated pieces → the generic
   *  per-piece movement hint stands in. */
  exercisePrompt?: string;
  /** Local score, surfaced on the save-score button so the player
   *  knows what they're saving. */
  score: string;
  /** Integrated per-piece path. Surface redistribution D1: Mission no
   *  longer renders the path — it only derives the one live "Now: X"
   *  line via `getNextChallenge()`. Absent → no line. */
  trainingPath?: TrainingNode[];
  /** Tap on the "Now: Special Training N" line. The sheet closes itself
   *  before reporting so the player lands straight on the board.
   *  Absent → the line renders nothing. */
  onLabyrinthSelect?: (labyrinthId: string) => void;
  /** MiniPay Lote 2 (B2): the off-chain save auto-runs on completion and is
   *  free, so the sheet no longer renders a green "Save score" CTA. It shows
   *  an informative saved state — or, only if the background auto-save failed,
   *  a free manual retry.
   *  `canSaveScore`: a new score is pending (auto-save in flight / just ran).
   *  `scoreSaved`: the score is persisted → show "✓ Score saved".
   *  `saveFailed`: the auto-save failed → show the free "Retry save" fallback.
   */
  canSaveScore?: boolean;
  isSavingScore?: boolean;
  scoreSaved?: boolean;
  saveFailed?: boolean;
  onRetrySave?: () => void;
  /** Score transparency: total exercise stars for the selected piece.
   *  When provided alongside maxPossibleStars, renders the breakdown
   *  line "12★ × 100 pts" (or "Max" indicator when at cap).
   *  Labyrinths are NOT counted here. */
  totalStars?: number;
  /** Maximum achievable stars for the piece (pool size × 3). */
  maxPossibleStars?: number;
  /** QA round 2 (2026-06-11) — the revived on-chain SAVE (gas-only
   *  submitScoreSigned flow). Renders only when available: no dead
   *  buttons (fail-closed). */
  canSaveOnChain?: boolean;
  onSaveOnChain?: () => void;
  isSavingOnChain?: boolean;
  /** The peek-card element that opens the modal. Cloned with an
   *  injected onClick that flips `open` true; any pre-existing
   *  handler on the trigger is preserved. */
  trigger: React.ReactNode;
};

const FADE_MS = 300;

export function MissionDetailSheet({
  open,
  onOpenChange,
  selectedPiece,
  targetLabel,
  isCapture,
  exercisePrompt,
  score,
  trainingPath,
  onLabyrinthSelect,
  canSaveScore = false,
  isSavingScore = false,
  scoreSaved = false,
  saveFailed = false,
  onRetrySave,
  canSaveOnChain = false,
  onSaveOnChain,
  isSavingOnChain = false,
  totalStars,
  maxPossibleStars,
  trigger,
}: Props) {
  const tBriefing = useTranslations("MISSION_BRIEFING_COPY");
  const tDetail = useTranslations("MISSION_DETAIL_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  // Two-stage open/close so the fade-out animation completes before
  // unmounting. `mounted` controls DOM presence; `exiting` flips the
  // panel opacity for the closing transition.
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Escape closes — Radix did this for us under <Sheet>; we own it now.
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onOpenChange]);

  // Surface redistribution D1: the one live "what now" line. Number is
  // the node's 1-based position within the path's labyrinth leg.
  const nextChallenge = trainingPath ? getNextChallenge(trainingPath) : null;
  const nextChallengeNumber = nextChallenge
    ? trainingPath!
        .filter((node) => node.kind === "labyrinth")
        .findIndex((node) => node.id === nextChallenge.id) + 1
    : 0;
  const showNowLine = Boolean(nextChallenge && onLabyrinthSelect);
  // B2: the off-chain save is not a CTA. Surface its state (saved / retrying /
  // just-saved) whenever there is a pending or persisted score to reflect.
  const showSaveState = Boolean(canSaveScore || scoreSaved || saveFailed);
  const showSaveOnChain = Boolean(canSaveOnChain && onSaveOnChain);
  const pieceName = (() => {
    try {
      return tPiece(selectedPiece);
    } catch {
      return selectedPiece;
    }
  })();
  const objective = isCapture
    ? tBriefing("captureHint")
    : tBriefing("moveObjective", { piece: pieceName, target: targetLabel });
  // The curated prompt states the lesson THIS exercise teaches; the generic
  // per-piece hint only restates how the piece moves, which the player already
  // knows by exercise six. Curated copy wins wherever it exists (A1/A7).
  const hint = exercisePrompt ?? tBriefing(`moveHint.${selectedPiece}`);

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (e: ReactMouseEvent) => void }>, {
        onClick: (e: ReactMouseEvent) => {
          const orig = (trigger as ReactElement<{ onClick?: (e: ReactMouseEvent) => void }>)
            .props.onClick;
          if (orig) orig(e);
          if (!e.defaultPrevented) onOpenChange(true);
        },
      })
    : trigger;

  // Portal to <body> so the overlay escapes any ancestor stacking
  // context (the host tray + dock both render their own layered
  // surfaces). Matches what Radix Sheet/Dialog used to do for us.
  const modal = mounted ? (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim transition-opacity duration-300 ${
        exiting ? "opacity-0" : "animate-in fade-in duration-300"
      }`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mission-detail-objective"
      onClick={() => onOpenChange(false)}
    >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className={`relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain transition-opacity duration-300 ${
              exiting ? "opacity-0" : "animate-in fade-in duration-300"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Candy panel — same cream wood + grass border as
                <MissionBriefing>. `backgroundSize: 100% 100%` lets the
                asset stretch with content so the grass border always
                wraps the panel, even when the journey list grows.
                `minHeight` keeps a short mission (a one-line prompt) from
                collapsing the panel into a letterbox — the art needs room to
                read as a panel (founder, 2026-07-16). The same stretch that
                grows it also fills it. */}
            <div
              className="relative w-full"
              style={{
                backgroundImage:
                  'image-set(url("/art/screen-mission/panel-mision-icon.avif") type("image/avif"), url("/art/screen-mission/panel-mision-icon.webp") type("image/webp"), url("/art/screen-mission/panel-mision-icon.png") type("image/png"))',
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                minHeight: "300px",
              }}
            >
              {/* Close button — absolute against the panel frame so it
                  hugs the actual top-right corner (outside the inner
                  safe-area inset). Touch target 44×44 via
                  .candy-close-asset-button. */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={tDetail("closeLabelFormat", { title: tDetail("title") })}
                className="candy-close-asset-button absolute right-[4%] top-[4%] z-10"
              >
                <picture>
                  <source
                    srcSet="/art/screen-mission/close-icon.avif"
                    type="image/avif"
                  />
                  <source
                    srcSet="/art/screen-mission/close-icon.webp"
                    type="image/webp"
                  />
                  <img
                    src="/art/screen-mission/close-icon.png"
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 object-contain"
                    draggable={false}
                  />
                </picture>
              </button>

              <div className="flex flex-col items-center px-[10%] pt-[6%] pb-[5%]">
                <div className="flex w-full items-center">
                  <h2
                    className="fantasy-title text-2xl font-extrabold tracking-wide"
                    style={{
                      color: "var(--popup-title-color)",
                      textShadow: "var(--popup-title-text-shadow)",
                    }}
                  >
                    {tDetail("title").toUpperCase()}
                  </h2>
                </div>

                <div className="mt-3 flex w-full items-center gap-3">
                  <picture className="shrink-0">
                    <source
                      srcSet="/art/screen-mission/avatar-icon.avif"
                      type="image/avif"
                    />
                    <source
                      srcSet="/art/screen-mission/avatar-icon.webp"
                      type="image/webp"
                    />
                    <img
                      src="/art/screen-mission/avatar-icon.png"
                      alt=""
                      aria-hidden="true"
                      className="h-20 w-20 object-contain drop-shadow-[0_3px_10px_rgba(120,65,5,0.45)]"
                      draggable={false}
                    />
                  </picture>
                  <div className="min-w-0 flex-1">
                    <p
                      id="mission-detail-objective"
                      className="text-left text-base font-extrabold leading-tight"
                      style={{
                        color: "rgba(63, 34, 8, 0.95)",
                        textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                      }}
                    >
                      {objective}
                    </p>
                    <p
                      className="mt-1 text-left text-xs font-medium leading-snug"
                      style={{
                        color: "rgba(110, 65, 15, 0.75)",
                        textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                      }}
                    >
                      {hint}
                    </p>
                  </div>
                </div>

                {(showNowLine || showSaveState || showSaveOnChain) && (
                  <picture>
                    <source
                      srcSet="/art/screen-mission/adorno-icon.avif"
                      type="image/avif"
                    />
                    <source
                      srcSet="/art/screen-mission/adorno-icon.webp"
                      type="image/webp"
                    />
                    <img
                      src="/art/screen-mission/adorno-icon.png"
                      alt=""
                      aria-hidden="true"
                      className="mt-3 h-4 w-44 object-contain"
                      draggable={false}
                    />
                  </picture>
                )}

                {/* D1 — the one live "what do I do now" line. Tap closes
                    the sheet first so the player lands on the board. */}
                {showNowLine ? (
                  <button
                    type="button"
                    aria-label={tDetail("nowLabyrinthAriaFormat", {
                      number: nextChallengeNumber,
                    })}
                    onClick={() => {
                      onOpenChange(false);
                      onLabyrinthSelect!(nextChallenge!.id);
                    }}
                    className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--blue mt-3"
                  >
                    {tDetail("nowLabyrinthFormat", {
                      number: nextChallengeNumber,
                    })}
                  </button>
                ) : null}

                {/* B2 (Lote 2) — the off-chain score save is automatic and
                    free, so there is NO green "Save score" CTA here. We only
                    reflect its state: the stars breakdown, then an informative
                    "Score saved" line (or a free manual retry if the silent
                    auto-save failed). The on-chain proof below stays the only
                    explicit value action. */}
                {showSaveState && totalStars !== undefined && maxPossibleStars !== undefined ? (
                  <p
                    data-testid="score-breakdown"
                    className="mt-3 text-center text-xs font-medium"
                    style={{
                      color: "rgba(110, 65, 15, 0.55)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.4)",
                    }}
                  >
                    {totalStars >= maxPossibleStars
                      ? tDetail("scoreAtMax", {
                          stars: totalStars,
                          maxStars: maxPossibleStars,
                        })
                      : tDetail("scoreBreakdown", { stars: totalStars })}
                  </p>
                ) : null}
                {saveFailed && onRetrySave ? (
                  /* Auto-save failed → free manual retry (never a paywall,
                     never a competing protagonist CTA). */
                  <button
                    type="button"
                    aria-label={tDetail("retrySaveCta")}
                    onClick={onRetrySave}
                    disabled={isSavingScore}
                    aria-busy={isSavingScore}
                    data-testid="score-save-retry"
                    className="candy-tray-pill mt-1.5"
                  >
                    {isSavingScore ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        />
                        <span>{tDetail("saving")}</span>
                      </>
                    ) : (
                      tDetail("retrySaveCta")
                    )}
                  </button>
                ) : scoreSaved ? (
                  <p
                    data-testid="score-saved-state"
                    className="mt-1.5 text-center text-sm font-semibold"
                    style={{
                      color: "rgba(21, 128, 61, 0.95)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.5)",
                    }}
                  >
                    ✓ {tDetail("scoreSaved")}
                  </p>
                ) : isSavingScore ? (
                  <p
                    data-testid="score-saving-state"
                    className="mt-1.5 text-center text-xs font-medium opacity-70"
                  >
                    {tDetail("saving")}
                  </p>
                ) : null}

                {/* QA round 2 — the revived on-chain SAVE: the original
                    gas-only submitScoreSigned flow. "For life" lives
                    here, never on the off-chain action. */}
                {showSaveOnChain ? (
                  <>
                    <p
                      className="mt-3 text-center text-xs font-semibold"
                      style={{
                        color: "rgba(110, 65, 15, 0.78)",
                        textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                      }}
                    >
                      {tDetail("saveOnChainPromise")}
                    </p>
                    <button
                      type="button"
                      aria-label={tDetail("saveOnChainCta")}
                      onClick={onSaveOnChain}
                      disabled={isSavingOnChain}
                      aria-busy={isSavingOnChain}
                      className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--gold mt-1.5"
                    >
                      {isSavingOnChain ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          />
                          <span>{tDetail("saving")}</span>
                        </>
                      ) : (
                        tDetail("saveOnChainCta")
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
  ) : null;

  return (
    <>
      {triggerEl}
      {modal && typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
