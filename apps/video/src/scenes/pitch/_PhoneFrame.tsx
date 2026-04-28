import React from "react";
import { Img, staticFile } from "remotion";
import type { ScreenshotKey } from "../../lib/pitch-copy";

const SCREENSHOT_PATHS: Record<ScreenshotKey, string> = {
  "play-hub": "screenshots/play-hub.png",
  "exercise-rook-pattern": "screenshots/exercise-rook-pattern.png",
  arena: "screenshots/arena.png",
  "victory-state": "screenshots/victory-state.png",
};

interface Props {
  screenshotKey: ScreenshotKey;
  width?: number;
  rotateDeg?: number;
}

/**
 * Vertical phone frame for inline screenshots. 9:19.5 aspect.
 * Screenshots come from apps/video/scripts/capture-screenshots.ts.
 */
export const PhoneFrame: React.FC<Props> = ({
  screenshotKey,
  width = 720,
  rotateDeg = 0,
}) => {
  const height = (width * 19.5) / 9;
  const path = SCREENSHOT_PATHS[screenshotKey];

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 56,
        background: "#1a1f2e",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.55), 0 0 0 8px rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
        transform: `rotate(${rotateDeg}deg)`,
      }}
    >
      <Img
        src={staticFile(path)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
};
