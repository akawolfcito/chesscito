"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";

import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import type { HubTourOutcome, HubTourStep } from "@/lib/hub/hub-tour";

export type HubTourProps = {
  /** Built by `buildHubTourSteps` — the container owns the player's state. */
  steps: HubTourStep[];
  /** Fires once, on the way out. The container persists the flag. */
  onFinish: (outcome: HubTourOutcome) => void;
};

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(target: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour-target="${target}"]`);
}

function measure(target: string): Rect | null {
  const el = findTarget(target);
  if (!el) return null;
  const { top, left, width, height } = el.getBoundingClientRect();
  return { top, left, width, height };
}

/** Padding around the target, so the ring frames it instead of clipping it. */
const RING_PAD = 8;
/** Breathing room between the ring and the panel that points at it. */
const GAP = 18;
/** Keep in lockstep with `.hub-tour-panel` width in globals.css. */
const PANEL_WIDTH = 320;
/** Minimum distance from the arrow to the panel's rounded corners. */
const ARROW_INSET = 28;

/** The 3-step LEARN hub tour: a scrim with a hole over the step's target, a
 *  panel explaining it, and Next / Got it / Skip.
 *
 *  It is a GATE, not a competitor: the container only mounts it when no other
 *  `aria-modal` is on screen, and while it runs the scrim swallows every tap
 *  outside the panel. The spotlight is deliberately NOT clickable (spec
 *  no-goal) — the tour informs, it does not navigate. */
export function HubTour({ steps, onFinish }: HubTourProps) {
  const t = useTranslations("HUB_TOUR_COPY");

  // A step whose target never rendered gets dropped, not pointed at: a 2-step
  // tour beats an arrow aimed at nothing. Resolved once, at mount — the hub
  // does not add cards mid-tour, and re-filtering per render would let a
  // late-hydrating card shift the itinerary under the player's feet.
  const [reachable] = useState<HubTourStep[]>(() =>
    steps.filter((step) => findTarget(step.target) !== null),
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = reachable[index] ?? null;
  const isLast = index === reachable.length - 1;

  // Nothing to point at (a hub that rendered none of the three) → the tour is
  // over before it starts, and it counts as given: re-arming it would relaunch
  // on every mount for a player whose hub simply looks different.
  const empty = reachable.length === 0;
  useEffect(() => {
    if (empty) onFinish("completed");
  }, [empty, onFinish]);

  // Measured against the LIVE target every step, and again on resize/rotation,
  // so the ring tracks the element rather than a stale layout.
  useLayoutEffect(() => {
    if (!step) return;
    const sync = () => setRect(measure(step.target));
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [step]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onFinish("completed");
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  const handleSkip = useCallback(() => onFinish("skipped"), [onFinish]);

  if (!step) return null;

  // The panel is anchored TO THE TARGET, not to the screen: parked at a fixed
  // offset from the viewport edge it drifted far from whatever it was
  // describing (the header gift got a panel sitting on the floor, over Start
  // Focus). Target in the top half → panel hangs below it; bottom half → panel
  // sits above it. Either way it never covers the thing it points at.
  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;
  const targetBelowFold = rect != null && rect.top > viewportH / 2;

  const panelStyle: CSSProperties | undefined = rect
    ? targetBelowFold
      ? { bottom: Math.max(GAP, viewportH - rect.top + GAP) }
      : { top: rect.top + rect.height + GAP }
    : undefined;

  // The arrow tracks the target's horizontal center, clamped so it stays on the
  // panel even when the target hugs a screen edge (the daily gift does).
  const panelWidth = Math.min(PANEL_WIDTH, viewportW - 32);
  const panelLeft = (viewportW - panelWidth) / 2;
  const arrowLeft = rect
    ? Math.min(
        Math.max(rect.left + rect.width / 2 - panelLeft, ARROW_INSET),
        panelWidth - ARROW_INSET,
      )
    : panelWidth / 2;

  return (
    <div
      className="hub-tour-scrim"
      data-testid="hub-tour-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t("rootAriaLabel")}
    >
      {rect ? (
        <div
          className="hub-tour-spotlight"
          data-testid="hub-tour-spotlight"
          data-target={step.target}
          aria-hidden="true"
          style={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
          }}
        />
      ) : (
        // Target measured to nothing (hidden ancestor). Keep the tour running —
        // the copy still carries the message — but skip the ring rather than
        // drawing a 0×0 hole in the corner.
        <div
          className="hub-tour-spotlight is-unmeasured"
          data-testid="hub-tour-spotlight"
          data-target={step.target}
          aria-hidden="true"
        />
      )}

      <div
        className={`hub-tour-panel${targetBelowFold ? " is-above" : " is-below"}`}
        data-step={step.id}
        style={panelStyle}
      >
        <span
          className="hub-tour-arrow"
          data-testid="hub-tour-arrow"
          aria-hidden="true"
          style={{ left: arrowLeft }}
        />
        <p className="hub-tour-step-counter">
          {t("stepCounter", { current: index + 1, total: reachable.length })}
        </p>
        <h2 className="hub-tour-title">
          {t(
            step.id === "daily"
              ? "dailyTitle"
              : step.id === "challenge"
                ? "challengeTitle"
                : "startFocusTitle",
          )}
        </h2>
        <p className="hub-tour-body">{t(step.bodyKey)}</p>

        <PrincipalButton
          size="medium"
          onClick={handleNext}
          className="hub-tour-primary"
        >
          {isLast ? t("done") : t("next")}
        </PrincipalButton>

        {/* Skip lives on every step: the tour never becomes a wall. */}
        <button type="button" className="hub-tour-skip" onClick={handleSkip}>
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
