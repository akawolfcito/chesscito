import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/onboarding/art-image";
import { ICONS } from "@/lib/onboarding/slides";
import type { PreferredMode } from "@/lib/onboarding/types";

/**
 * The slide-4 control. Wears the in-app mode switch's face, but each half is a
 * LINK, not a toggle: there is no mode to be "in" on the landing, and tapping
 * navigates rather than selecting.
 *
 * Two signals live here and they answer different questions, so they are
 * allowed to disagree:
 *
 *  - The gold half is the product's recommendation ("start here"). It is
 *    always LEARN and never moves.
 *  - The green label is the visitor's own history. It sits over whichever half
 *    they last used, which may well be the other one.
 *
 * That divergence is designed, not a bug: a returning PLAY player sees LEARN
 * in gold and "Last used" over PLAY. Founder call, 2026-07-29.
 *
 * `data-recommended` carries the gold, not `aria-pressed` — that attribute
 * belongs to role=button, and on a link it is ARIA no reader interprets,
 * present only to drive a stylesheet.
 */
export function ModeSwitch({ lastUsedMode }: { lastUsedMode: PreferredMode | null }) {
  const t = useTranslations("onboarding.slide4");
  const labelId = useId();
  const [pendingMode, setPendingMode] = useState<PreferredMode | null>(null);
  // State updates are asynchronous. This ref closes the small gap before
  // React commits `pendingMode`, so a double tap cannot queue a second
  // document navigation.
  const navigationStartedRef = useRef(false);
  const frameIdsRef = useRef<number[]>([]);

  const halves = [
    { mode: "learn" as const, label: t("learnLabel"), icon: ICONS.learn },
    { mode: "play" as const, label: t("playLabel"), icon: ICONS.play },
  ];

  useEffect(() => {
    return () => {
      frameIdsRef.current.forEach((id) => window.cancelAnimationFrame(id));
    };
  }, []);

  const scheduleFrame = (callback: FrameRequestCallback) => {
    const id = window.requestAnimationFrame(callback);
    frameIdsRef.current.push(id);
  };

  const emitSelectionEvent = (
    event: "selection_tap" | "selection_feedback_painted",
    mode: PreferredMode,
    at: number,
    tapAt: number,
  ) => {
    // The landing has no client telemetry transport. Keep these as User Timing
    // marks plus DOM events so a RUM bridge can consume them without adding a
    // second request to this critical navigation path. Detail is deliberately
    // limited to the selected product and elapsed client time.
    performance.mark(event);
    window.dispatchEvent(
      new CustomEvent(`chesscito:${event}`, {
        detail: { mode, at, elapsedMs: at - tapAt },
      }),
    );
  };

  const beginNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    mode: PreferredMode,
  ) => {
    if (navigationStartedRef.current) {
      event.preventDefault();
      return;
    }

    // Keep the real href for no-JS/native-link accessibility, but defer this
    // ordinary activation by two frames: one commits the pending UI and one
    // lets the browser paint it before the cross-origin document unloads.
    event.preventDefault();
    navigationStartedRef.current = true;
    const destination = event.currentTarget.href;
    const tapAt = performance.now();
    setPendingMode(mode);
    emitSelectionEvent("selection_tap", mode, tapAt, tapAt);

    scheduleFrame(() => {
      const paintedAt = performance.now();
      emitSelectionEvent("selection_feedback_painted", mode, paintedAt, tapAt);
      scheduleFrame(() => window.location.assign(destination));
    });
  };

  return (
    <div className="onboarding-mode-switch-wrap">
      <div
        className="hub-app-mode-switch"
        role="group"
        aria-label={t("titleAlt")}
        aria-busy={pendingMode !== null}
        data-pending={pendingMode ?? undefined}
      >
        {halves.map(({ mode, label, icon }) => {
          const isLastUsed = lastUsedMode === mode;
          return (
            <a
              key={mode}
              href={`/api/enter?mode=${mode}`}
              className="hub-app-mode-switch-pill"
              data-recommended={mode === "learn" ? "true" : undefined}
              aria-describedby={isLastUsed ? labelId : undefined}
              aria-disabled={pendingMode !== null}
              onClick={(event) => beginNavigation(event, mode)}
            >
              <ArtImage
                src={icon}
                alt=""
                className="hub-app-mode-switch-icon"
              />
              <span>{label}</span>
            </a>
          );
        })}
      </div>

      {pendingMode ? (
        <p className="onboarding-mode-switch-status" role="status" aria-live="polite">
          <span className="onboarding-mode-switch-spinner" aria-hidden="true" />
          {t(pendingMode === "learn" ? "openingLearn" : "openingPlay")}
        </p>
      ) : null}

      {/* Anchored to the outer edge of the half it belongs to, so the eye
          reads it as attached to that button rather than floating between
          the two. */}
      {lastUsedMode ? (
        <span
          id={labelId}
          className="onboarding-last-used"
          data-side={lastUsedMode === "learn" ? "left" : "right"}
        >
          {t("lastUsed")}
        </span>
      ) : null}
    </div>
  );
}
