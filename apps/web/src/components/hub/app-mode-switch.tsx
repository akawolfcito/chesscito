"use client";

import { appModeUrl, type ChesscitoAppMode } from "@/lib/hub/app-mode";

type AppModeSwitchProps = {
  activeMode: ChesscitoAppMode;
};

const MODES: Array<{
  mode: ChesscitoAppMode;
  label: string;
  asset: string;
  width: number;
  height: number;
}> = [
  {
    mode: "learn",
    label: "Training",
    asset: "/art/hub/train-pieces",
    width: 200,
    height: 196,
  },
  {
    mode: "play",
    label: "Play",
    asset: "/art/redesign/banners/btn-battle",
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
      {MODES.map(({ mode, label, asset, width, height }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={activeMode === mode}
          aria-label={`Switch to ${label}`}
          onClick={() => selectMode(mode)}
          className="hub-app-mode-switch-pill"
        >
          <picture className="hub-app-mode-switch-icon">
            <source srcSet={`${asset}.avif`} type="image/avif" />
            <source srcSet={`${asset}.webp`} type="image/webp" />
            <img
              src={`${asset}.png`}
              alt=""
              aria-hidden="true"
              width={width}
              height={height}
              draggable={false}
            />
          </picture>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
