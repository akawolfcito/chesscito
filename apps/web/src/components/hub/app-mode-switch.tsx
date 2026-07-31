"use client";

import { useTranslations } from "next-intl";

import { appModeUrl, type ChesscitoAppMode } from "@/lib/hub/app-mode";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

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
