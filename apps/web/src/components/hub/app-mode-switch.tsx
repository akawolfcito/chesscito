"use client";

import { appModeUrl, type ChesscitoAppMode } from "@/lib/hub/app-mode";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

type AppModeSwitchProps = {
  activeMode: ChesscitoAppMode;
};

const MODES: Array<{
  mode: ChesscitoAppMode;
  label: string;
  slot: ThemeAssetKey;
  width: number;
  height: number;
}> = [
  {
    mode: "learn",
    label: "Training",
    slot: "hub.train-pieces",
    width: 200,
    height: 196,
  },
  {
    mode: "play",
    label: "Play",
    slot: "hub.btn-battle",
    width: 512,
    height: 510,
  },
];

export function AppModeSwitch({ activeMode }: AppModeSwitchProps) {
  const selectMode = (mode: ChesscitoAppMode) => {
    if (mode === activeMode) return;
    window.location.assign(appModeUrl(mode, new URL(window.location.href)));
  };

  return (
    <div
      role="group"
      aria-label="Choose app mode"
      className="hub-app-mode-switch"
    >
      {MODES.map(({ mode, label, slot, width, height }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={activeMode === mode}
          aria-label={`Switch to ${label}`}
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
      ))}
    </div>
  );
}
