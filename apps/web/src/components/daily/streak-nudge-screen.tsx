"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { track } from "@/lib/telemetry";

type Props = {
  /** Close and resume the navigation the player originally asked for.
   *  "Tap to continue" has to mean continue to where they were going, so the
   *  caller owns the deferred exit and this component never cancels it. */
  onDismiss: () => void;
  /** Open today's Daily Tactic. Counts as an appearance AND retires the
   *  screen: the lesson landed, so it stops spending its remaining slots. */
  onOpenDaily: () => void;
};

/**
 * StreakNudgeScreen — the one sentence the flame never says out loud.
 *
 * Shown on the way OUT of a training session, never on top of a win. The 3rd
 * victory already carries `great-focus-session`, `first-great-session` and
 * often `first-reward`; a message that has to be READ cannot be the fourth
 * card in that stack. See docs/specs/2026-07-27-daily-streak-two-paths.md.
 *
 * Dismiss is deliberately generous: tapping anywhere works, including inside
 * the panel. The single exception is the CTA, whose own handler stops
 * propagation so the dismiss-anywhere surface can never eat the tap that was
 * the entire point of the screen.
 */
export function StreakNudgeScreen({ onDismiss, onOpenDaily }: Props) {
  const t = useTranslations("STREAK_NUDGE_COPY");

  useEffect(() => {
    track("modal_open", { id: "streak-nudge" });
  }, []);

  return (
    <VictoryPopupShell
      onClose={onDismiss}
      ariaLabel={t("rootAriaLabel")}
      closeLabel={t("closeLabel")}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="flex flex-col items-center gap-3" onClick={onDismiss}>
        <ThemeAssetPicture
          slot="shared.feedback-happy"
          pictureClassName="pointer-events-none h-20 w-20"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-full w-full object-contain"
        />

        <h1 className="arena-result-title">{t("title")}</h1>

        <p
          className="px-2 text-center text-sm font-semibold"
          style={{
            color: "rgba(63, 34, 8, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
          }}
        >
          {t("body")}
        </p>

        {/* The CTA's REGION stops propagation, not the button: PrincipalButton
            takes a `() => void` and never sees the event. Without this wrapper
            the tap that opens the Daily would also bubble into the
            dismiss-anywhere surface and be read as "not now". */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={(event) => event.stopPropagation()}>
          <PrincipalButton size="medium" onClick={onOpenDaily}>
            {t("cta")}
          </PrincipalButton>
        </div>

        <p className="text-center text-xs" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
          {t("dismissHint")}
        </p>
      </div>
    </VictoryPopupShell>
  );
}
