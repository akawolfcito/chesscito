"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useTranslations } from "next-intl";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { PRO_DURATION_DAYS } from "@/lib/contracts/shop-catalog";
import type {
  HubTourMode,
  HubTourOutcome,
  HubTourStep,
  HubTourStepId,
} from "@/lib/hub/hub-tour";

export type HubTourProps = {
  mode?: HubTourMode;
  steps: HubTourStep[];
  challenge?: { days: number; shields: number; price: string };
  pro?: { active: boolean; price: string };
  onFinish: (outcome: HubTourOutcome) => void;
};

/** Exported so a test can assert every entry resolves to real copy: the panel
 *  looks titles up dynamically, so a stale mapping renders the raw key path. */
export const TOUR_TITLE_KEYS: Record<HubTourStep["bodyKey"], string> = {
  dailyStart: "dailyTitleStart",
  dailyKeep: "dailyTitleKeep",
  dailyDone: "dailyTitle",
  challengeJoin: "challengeTitle",
  challengeEnrolled: "challengeTitleEnrolled",
  rookStart: "rookTitle",
  kingdomBody: "kingdomTitle",
  proJoin: "proTitle",
  proActive: "proTitleActive",
  playStart: "playTitle",
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

/** Enough room to keep floating price chips inside the illuminated cutout. */
const RING_PAD = 12;
const GAP = 18;
const PANEL_WIDTH = 320;
const ARROW_INSET = 28;
const MIN_PANEL_HEIGHT = 220;

/** Shared mini-tour presenter. The overlay itself is the Next control: every
 * tap advances, while the themed X is the single explicit exit. */
export function HubTour({
  mode = "learn",
  steps,
  challenge,
  pro,
  onFinish,
}: HubTourProps) {
  const t = useTranslations("HUB_TOUR_COPY");
  const tCard = useTranslations("CHALLENGE_CARD_COPY");
  const scrimRef = useRef<HTMLDivElement>(null);

  const [reachableIds] = useState<HubTourStepId[]>(() =>
    steps.filter((step) => findTarget(step.target) !== null).map((step) => step.id),
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const reachable = reachableIds
    .map((id) => steps.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is HubTourStep => candidate !== undefined);
  const step = reachable[index] ?? null;
  const isLast = index === reachable.length - 1;
  /** Ritual variants only. `dailyDone` deliberately falls through to the plain
   *  body: pairing the gift → tactic → streak strip with "come back tomorrow"
   *  advertises a sequence the player cannot run today. */
  const isDailyRitual =
    step?.bodyKey === "dailyStart" || step?.bodyKey === "dailyKeep";
  const isChallengeSale = step?.bodyKey === "challengeJoin";
  const isProStep = step?.id === "pro";
  const isActionStep = step?.id === "rook" || step?.id === "play";
  const empty = reachable.length === 0;

  useEffect(() => {
    if (empty) onFinish("completed");
  }, [empty, onFinish]);

  useEffect(() => {
    scrimRef.current?.focus();
  }, []);

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

  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    el?.setAttribute("data-tour-spotlight", "active");
    return () => el?.removeAttribute("data-tour-spotlight");
  }, [step]);

  const advance = useCallback(() => {
    if (isLast) {
      onFinish("completed");
      return;
    }
    setIndex((current) => current + 1);
  }, [isLast, onFinish]);

  const close = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onFinish("skipped");
    },
    [onFinish],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "Enter" &&
        event.key !== " " &&
        event.key !== "ArrowRight"
      ) {
        return;
      }
      if ((event.target as HTMLElement).closest(".hub-tour-close")) return;
      event.preventDefault();
      advance();
    },
    [advance],
  );

  if (!step) return null;

  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;
  const spaceBelow = rect ? viewportH - (rect.top + rect.height) - GAP * 2 : 0;
  const spaceAbove = rect ? rect.top - GAP * 2 : 0;
  const targetBelowFold = rect != null && spaceAbove > spaceBelow;
  const available = Math.max(
    MIN_PANEL_HEIGHT,
    targetBelowFold ? spaceAbove : spaceBelow,
  );
  const panelStyle: CSSProperties | undefined = rect
    ? targetBelowFold
      ? {
          bottom: Math.max(GAP, viewportH - rect.top + GAP),
          maxHeight: available,
        }
      : { top: rect.top + rect.height + GAP, maxHeight: available }
    : undefined;
  const panelWidth = Math.min(PANEL_WIDTH, viewportW - 32);
  const panelLeft = (viewportW - panelWidth) / 2;
  const arrowLeft = rect
    ? Math.min(
        Math.max(rect.left + rect.width / 2 - panelLeft, ARROW_INSET),
        panelWidth - ARROW_INSET,
      )
    : panelWidth / 2;

  const challengeTerms = challenge ?? { days: 21, shields: 3, price: "" };

  return (
    <div
      ref={scrimRef}
      className="hub-tour-scrim"
      data-testid="hub-tour-scrim"
      data-mode={mode}
      role="dialog"
      aria-modal="true"
      aria-label={t("rootAriaLabel")}
      tabIndex={-1}
      onClick={advance}
      onKeyDown={handleKeyDown}
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
        <button
          type="button"
          className="hub-tour-close"
          aria-label={t("closeAriaLabel")}
          onClick={close}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ThemeAssetPicture
            slot="shared.close"
            pictureClassName="hub-tour-close-icon"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </button>

        <p className="hub-tour-step-counter">
          {t("stepCounter", { current: index + 1, total: reachable.length })}
        </p>
        <h2 className="hub-tour-title">{t(TOUR_TITLE_KEYS[step.bodyKey])}</h2>

        {isDailyRitual ? (
          <>
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
            <p className="hub-tour-body">{t(step.bodyKey)}</p>
          </>
        ) : null}

        {!isDailyRitual && !isChallengeSale && !isProStep ? (
          <p className="hub-tour-body">
            {t(step.bodyKey, {
              days: challengeTerms.days,
              shields: challengeTerms.shields,
              price: challengeTerms.price,
            })}
          </p>
        ) : null}

        {isChallengeSale ? (
          <>
            <p className="hub-tour-body">{t(step.bodyKey)}</p>
            <div className="hub-tour-benefits" data-testid="hub-tour-benefits">
              <div className="hub-tour-benefit">
                <TileIconSlot slot="hub.21-day-icon" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">
                  {tCard("offerBenefitDays", { days: challengeTerms.days })}
                </span>
              </div>
              <div className="hub-tour-benefit">
                <TileIconSlot slot="hub.training-icon" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">
                  {tCard("offerBenefitTrainings")}
                </span>
              </div>
              <div className="hub-tour-benefit">
                <TileIconSlot slot="shared.shield" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">
                  {tCard("offerBenefitShields", { count: challengeTerms.shields })}
                </span>
              </div>
            </div>
            <p className="hub-tour-price" data-testid="hub-tour-value">
              {t("challengePrice", { price: challengeTerms.price })}
            </p>
          </>
        ) : null}

        {isProStep ? (
          <>
            <p className="hub-tour-body">{t(step.bodyKey)}</p>
            {/* The subscription's own perks. These are NOT the KingdomCard's
                Quick Match / Coach Review / Rewards chips: those describe hub
                navigation, and reusing them made the context step and the sale
                step render the same strip back to back. */}
            <div
              className="hub-tour-benefits hub-tour-benefits--pro"
              data-testid="hub-tour-pro-benefits"
            >
              <div className="hub-tour-benefit">
                <TileIconSlot slot="hub.pro-benefit-season-pass" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">{t("proBenefitSeasonPass")}</span>
              </div>
              <div className="hub-tour-benefit">
                <TileIconSlot slot="hub.pro-benefit-coach" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">{t("proBenefitUnlimitedCoach")}</span>
              </div>
              <div className="hub-tour-benefit">
                <TileIconSlot slot="hub.pro-benefit-complete" className="hub-tour-benefit-icon" />
                <span className="hub-tour-benefit-label">
                  {t("proBenefitCompleteExperience")}
                </span>
              </div>
            </div>
            {!pro?.active && pro?.price ? (
              <p className="hub-tour-price" data-testid="hub-tour-pro-price">
                {t("proPrice", { price: pro.price, days: PRO_DURATION_DAYS })}
              </p>
            ) : null}
          </>
        ) : null}

        {isActionStep ? (
          <TileIconSlot
            slot={step.id === "rook" ? "board.piece.white.rook" : "hub.enter-arena"}
            className="hub-tour-action-icon"
          />
        ) : null}

        <p className="hub-tour-continue" aria-hidden="true">
          {isLast ? t("tapToExplore") : t("tapToContinue")}
        </p>
      </div>
    </div>
  );
}
