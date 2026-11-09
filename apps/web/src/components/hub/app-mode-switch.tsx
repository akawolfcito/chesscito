"use client";

import { useTranslations } from "next-intl";

import { appModeUrl, type ChesscitoAppMode } from "@/lib/hub/app-mode";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { track } from "@/lib/telemetry";

type AppModeSwitchProps = {
  activeMode: ChesscitoAppMode;
};

const MODES: Array<{
  mode: ChesscitoAppMode;
  labelKey: "learnLabel" | "playLabel";
  slot: ThemeAssetKey;
  width: number;
  height: number;
}> = [
  {
    mode: "learn",
    labelKey: "learnLabel",
    slot: "hub.train-pieces",
    width: 200,
    height: 196,
  },
  {
    mode: "play",
    labelKey: "playLabel",
    slot: "hub.btn-battle",
    width: 512,
    height: 510,
  },
];

export function AppModeSwitch({ activeMode }: AppModeSwitchProps) {
  const t = useTranslations("APP_MODE_SWITCH_COPY");

  const selectMode = (mode: ChesscitoAppMode) => {
    if (mode === activeMode) return;
    /* ⛔ BEFORE the navigation, never after. `window.location.assign` tears the
     *  page down, and this event only survives because `track` flushes on
     *  `pagehide` through `sendBeacon`.
     *
     *  Why it exists: once the mini-tour is removed, this switch is the ONLY
     *  surface that names the TRAINING side — tour step 1 was the other one.
     *  The removal is accepted on the reading that the tour's apparent lift
     *  (64.6% vs 21.9%) was selection rather than causation, but that reading
     *  has to stay falsifiable. Without this event there is no way to tell
     *  whether TRAINING entry fell afterwards, and the question becomes
     *  arguable instead of answerable. */
    track("app_mode_switch_tap", { from: activeMode, to: mode });
    window.location.assign(appModeUrl(mode, new URL(window.location.href)));
  };

  return (
    <div
      role="group"
      aria-label={t("groupLabel")}
      className="hub-app-mode-switch"
    >
      {MODES.map(({ mode, labelKey, slot, width, height }) => {
        const label = t(labelKey);
        return (
        <button
          key={mode}
          type="button"
          aria-pressed={activeMode === mode}
          aria-label={t("switchTo", { mode: label })}
          onClick={() => selectMode(mode)}
          className="hub-app-mode-switch-pill"
        >
          <ThemeAssetPicture
            slot={slot}
            pictureClassName="hub-app-mode-switch-icon"
            alt=""
            aria-hidden="true"
            width={width}
            height={height}
            draggable={false}
          />
          <span>{label}</span>
        </button>
        );
      })}
    </div>
  );
}
