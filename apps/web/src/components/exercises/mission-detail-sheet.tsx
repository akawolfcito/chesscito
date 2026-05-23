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
import { CandyIcon } from "@/components/redesign/candy-icon";
import { JourneyRail } from "@/components/redesign/journey-rail";
import {
  MISSION_BRIEFING_COPY,
  MISSION_DETAIL_COPY,
  PIECE_LABELS,
  SCORE_UNIT,
} from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";

type Props = {
  /** Controlled open state — parent closes it when a dock sheet opens,
   *  so the user never sees stacked pickers. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPiece: PieceId;
  targetLabel: string;
  isCapture: boolean;
  score: string;
  timeMs: string;
  /** Total stars earned on the current piece (0–15). Powers the journey
   *  rail "badge" tier progress. */
  currentStars: number;
  /** On-chain badge claim status per piece. Drives the journey rail
   *  unlock/locked states. */
  claimedBadges: Partial<Record<PieceId, boolean>>;
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
  score,
  timeMs,
  currentStars,
  claimedBadges,
  trigger,
}: Props) {
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

  const hasStats = Number(score) > 0 || Number(timeMs) > 0;
  const pieceName = PIECE_LABELS[selectedPiece] ?? selectedPiece;
  const objective = isCapture
    ? MISSION_BRIEFING_COPY.captureHint
    : MISSION_BRIEFING_COPY.moveObjective(pieceName, targetLabel);
  const hint = MISSION_BRIEFING_COPY.moveHint[selectedPiece];

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
                wraps the panel, even when the journey list grows. */}
            <div
              className="relative w-full"
              style={{
                backgroundImage:
                  'image-set(url("/art/screen-mission/panel-mision-icon.avif") type("image/avif"), url("/art/screen-mission/panel-mision-icon.webp") type("image/webp"), url("/art/screen-mission/panel-mision-icon.png") type("image/png"))',
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Close button — absolute against the panel frame so it
                  hugs the actual top-right corner (outside the inner
                  safe-area inset). Touch target 44×44 via
                  .candy-close-asset-button. */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close mission"
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
                      color: "rgba(63, 34, 8, 0.95)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                    }}
                  >
                    {MISSION_DETAIL_COPY.title.toUpperCase()}
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

                {hasStats ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                    <span className="candy-stat-pill">
                      <span className="candy-stat-pill-icon">
                        <CandyIcon name="star" className="h-4 w-4" />
                      </span>
                      {`${score} ${SCORE_UNIT}`}
                    </span>
                    <span className="candy-stat-pill">
                      <span className="candy-stat-pill-icon">
                        <CandyIcon name="time" className="h-4 w-4" />
                      </span>
                      {`${Number(timeMs) / 1000}s`}
                    </span>
                  </div>
                ) : (
                  <p
                    className="mt-3 text-center text-xs"
                    style={{ color: "rgba(110, 65, 15, 0.65)" }}
                  >
                    {MISSION_DETAIL_COPY.preFirstMoveHint}
                  </p>
                )}

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

                <h3
                  className="mt-2 text-center text-base font-extrabold tracking-tight"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                  }}
                >
                  {MISSION_DETAIL_COPY.journeyTitle}
                </h3>

                <div className="mt-2 w-full">
                  <JourneyRail
                    currentPiece={selectedPiece}
                    currentStars={currentStars}
                    claimedBadges={claimedBadges}
                  />
                </div>
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
