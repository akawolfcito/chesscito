import { useId } from "react";
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

  const halves = [
    { mode: "learn" as const, label: t("learnLabel"), icon: ICONS.learn },
    { mode: "play" as const, label: t("playLabel"), icon: ICONS.play },
  ];

  return (
    <div className="onboarding-mode-switch-wrap">
      <div className="hub-app-mode-switch" role="group" aria-label={t("titleAlt")}>
        {halves.map(({ mode, label, icon }) => {
          const isLastUsed = lastUsedMode === mode;
          return (
            <a
              key={mode}
              href={`/api/enter?mode=${mode}`}
              className="hub-app-mode-switch-pill"
              data-recommended={mode === "learn" ? "true" : undefined}
              aria-describedby={isLastUsed ? labelId : undefined}
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
