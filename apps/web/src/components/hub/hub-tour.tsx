"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";

import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import type {
  HubTourOutcome,
  HubTourStep,
  HubTourStepId,
} from "@/lib/hub/hub-tour";

export type HubTourProps = {
  /** Built by `buildHubTourSteps` — the container owns the player's state. */
  steps: HubTourStep[];
  /** The pass's real terms, from the SAME config that feeds the ChallengeCard
   *  (`rail-config.ts`). Interpolated, never typed into the copy: a "$0.99"
   *  baked into a string rots the day pricing moves, silently, with the suite
   *  still green. */
  challenge: { days: number; shields: number; price: string };
  /** Fires once, on the way out. The container persists the flag. */
  onFinish: (outcome: HubTourOutcome) => void;
};

/** The headline changes with the body: a fresh profile is invited to START a
 *  streak, a veteran to KEEP one, and a pass holder is not sold anything. */
const TITLE_KEY: Record<HubTourStep["bodyKey"], string> = {
  dailyStart: "dailyTitleStart",
  dailyKeep: "dailyTitle",
  dailyDone: "dailyTitle",
  challengeJoin: "challengeTitle",
  challengeEnrolled: "challengeTitleEnrolled",
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
/** Floor for the panel. Below this even a squeezed hero has nothing left to
 *  give, so the panel keeps its size and overlaps the target instead of
 *  amputating its own button — a tour you cannot finish is worse than a tour
 *  that covers the card for a moment. */
const MIN_PANEL_HEIGHT = 260;
/** Room the panel needs before the hero art earns its place. Under this the art
 *  is DROPPED, not shrunk: squeezing it just collided it with the price row. The
 *  order of sacrifice is deliberate — the art goes first, the deal and the
 *  button never go at all. */
const HERO_MIN_SPACE = 340;

/** The 2-step LEARN hub tour: a scrim with a hole over the step's target, a
 *  panel explaining it, and Next / Got it / Skip.
 *
 *  It is a GATE, not a competitor: the container only mounts it when no other
 *  `aria-modal` is on screen, and while it runs the scrim swallows every tap
 *  outside the panel. The spotlight is deliberately NOT clickable (spec
 *  no-goal) — the tour informs, it does not navigate. */
export function HubTour({ steps, challenge, onFinish }: HubTourProps) {
  const t = useTranslations("HUB_TOUR_COPY");

  // WHICH steps run is frozen at mount: a step whose target never rendered gets
  // dropped, not pointed at, and re-filtering per render would let a
  // late-hydrating card shift the itinerary under the player's feet.
  //
  // Only the IDs are frozen. Freezing the step OBJECTS froze their copy too, so
  // a pass that confirmed one tick after the tour opened kept being sold to its
  // own owner — the exact lie this component exists to avoid. The bodies are
  // read LIVE from `steps` on every render.
  const [reachableIds] = useState<HubTourStepId[]>(() =>
    steps.filter((s) => findTarget(s.target) !== null).map((s) => s.id),
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // The daily step's full copy lives behind a `?` popover; closed by default and
  // reset whenever the step advances so it never carries over to the challenge.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const reachable = reachableIds
    .map((id) => steps.find((s) => s.id === id))
    .filter((s): s is HubTourStep => s !== undefined);

  const step = reachable[index] ?? null;
  const isLast = index === reachable.length - 1;
  const isChallenge = step?.id === "challenge";
  /** Only a player who can still buy gets the terms + the ask. */
  const isSalesStep = step?.bodyKey === "challengeJoin";
  /** The daily ritual steps carry the message as an art strip (gift → tactic →
   *  combo) with the full sentence tucked behind a `?`. The "already solved"
   *  variant (`dailyDone`) keeps its plain paragraph — there is no gift/tactic
   *  to promise once today is done. */
  const isDailyStrip =
    step?.bodyKey === "dailyStart" || step?.bodyKey === "dailyKeep";

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
    setDetailsOpen(false);
    setIndex((i) => i + 1);
  }, [isLast, onFinish]);


  if (!step) return null;

  // The panel is anchored TO THE TARGET, not to the screen. Which SIDE of the
  // target it takes is decided by measuring both, never by a top-half/
  // bottom-half guess: that guess assumed a 844px-tall viewport, and MiniPay's
  // chrome eats enough of it that the panel — and with it "Got it" — walked off
  // the bottom of a real phone. The tour became uncompletable.
  //
  // So: measure the room on each side, take the roomier one, and CAP the panel
  // to what is actually there. The hero art absorbs the squeeze (it shrinks);
  // the button never does.
  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;

  const spaceBelow = rect ? viewportH - (rect.top + rect.height) - GAP * 2 : 0;
  const spaceAbove = rect ? rect.top - GAP * 2 : 0;
  const targetBelowFold = rect != null && spaceAbove > spaceBelow;
  const available = Math.max(
    MIN_PANEL_HEIGHT,
    targetBelowFold ? spaceAbove : spaceBelow,
  );

  // On a short viewport (MiniPay's chrome, a small phone) the art is the first
  // thing to go. It is the only child that can be dropped without breaking the
  // step: the price row still states the deal and "Got it" still ends the tour.
  const showHero = !rect || available >= HERO_MIN_SPACE;

  const panelStyle: CSSProperties | undefined = rect
    ? targetBelowFold
      ? {
          bottom: Math.max(GAP, viewportH - rect.top + GAP),
          maxHeight: available,
        }
      : { top: rect.top + rect.height + GAP, maxHeight: available }
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
        {isChallenge ? (
          // The headline is ART: the words are baked into the image, so the alt
          // text is what a screen reader — and any non-EN locale — actually
          // receives. It is not decorative.
          // eslint-disable-next-line jsx-a11y/aria-unsupported-elements
          <ThemeAssetPicture
            slot="hub.tour-title"
            pictureClassName="hub-tour-title-art"
            alt={t("challengeTitleAlt")}
            width={780}
            height={89}
            draggable={false}
          />
        ) : isDailyStrip ? (
          // Title + `?` share a relative box so the details popover can float
          // below the chip WITHOUT reflowing the art strip / Next button under
          // it (a popover, not a row — the scrim already owns the aria-modal).
          <div className="hub-tour-habit">
            <h2 className="hub-tour-title">
              {t(TITLE_KEY[step.bodyKey])}
              <button
                type="button"
                data-testid="hub-tour-details-toggle"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
                aria-controls="hub-tour-details"
                aria-label={t("dailyDetailsLabel")}
                className="hub-tour-help-chip"
              >
                ?
              </button>
            </h2>
            {detailsOpen ? (
              <div
                id="hub-tour-details"
                data-testid="hub-tour-details"
                className="hub-tour-details"
                role="note"
              >
                <p>{t(step.bodyKey)}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <h2 className="hub-tour-title">{t(TITLE_KEY[step.bodyKey])}</h2>
        )}

        {isDailyStrip ? (
          // The ritual as art: gift → tactic → combo, labelled. Same catalog
          // slots as the season-pass sheet's story row, so a theme re-skins both
          // at once. Icons are decorative (aria-hidden via TileIconSlot); the
          // labels carry the meaning.
          <div className="hub-tour-story" data-testid="hub-tour-story">
            <div className="hub-tour-story-step">
              <TileIconSlot slot="shared.welcome-gift" className="hub-tour-story-icon" />
              <span className="hub-tour-story-label">{t("dailyStripGift")}</span>
            </div>
            <TileIconSlot slot="season.story-arrow" className="hub-tour-story-arrow" />
            <div className="hub-tour-story-step">
              <TileIconSlot slot="hub.train-pieces" className="hub-tour-story-icon" />
              <span className="hub-tour-story-label">{t("dailyStripTactic")}</span>
            </div>
            <TileIconSlot slot="season.story-arrow" className="hub-tour-story-arrow" />
            <div className="hub-tour-story-step">
              <TileIconSlot slot="shared.flame-color" className="hub-tour-story-icon" />
              <span className="hub-tour-story-label">{t("dailyStripCombo")}</span>
            </div>
          </div>
        ) : (
          <p className="hub-tour-body">
            {t(step.bodyKey, {
              days: challenge.days,
              shields: challenge.shields,
              price: challenge.price,
            })}
          </p>
        )}

        {isChallenge && showHero ? (
          // eslint-disable-next-line jsx-a11y/aria-unsupported-elements
          <ThemeAssetPicture
            slot="hub.tour-hero"
            pictureClassName="hub-tour-hero"
            alt={t("challengeHeroAlt")}
            width={840}
            height={370}
            draggable={false}
          />
        ) : null}

        {/* The terms stay VISIBLE, but as one line instead of a paragraph — the
            art carries the pitch, the row keeps the deal honest, and the ask
            names the button the player has to press. Only for a player who can
            still buy: an owner gets the art and nothing else. */}
        {isSalesStep ? (
          <>
            <p className="hub-tour-value" data-testid="hub-tour-value">
              {t("challengeValue", {
                days: challenge.days,
                shields: challenge.shields,
                price: challenge.price,
              })}
            </p>
            <p className="hub-tour-ask">{t("challengeAsk")}</p>
          </>
        ) : null}

        {/* No Skip. At two steps the tour is shorter than the escape hatch was
            worth: an exit link next to the primary just bled players out of the
            one screen that names the ritual and the pass. Two taps and it is
            over. */}
        <PrincipalButton
          size="medium"
          onClick={handleNext}
          className="hub-tour-primary"
        >
          {isLast ? t("done") : t("next")}
        </PrincipalButton>
      </div>
    </div>
  );
}
