import React from "react";
import { Img, staticFile } from "remotion";
import type { ScreenshotKey } from "../../lib/pitch-copy";
import { PITCH_THEME } from "../../lib/pitch-theme";

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
  /**
   * v3.2 — how to fit the source image inside the 9:19.5 phone frame.
   *  - "cover"   (default): fill, may crop edges. Use for tall sources.
   *  - "contain"          : show entire image, letterbox revealed. Use
   *                         for square/landscape sources to avoid stretch.
   */
  cropMode?: "cover" | "contain";
  /**
   * Letterbox / wrapper background tone. Defaults to the dark `#1a1f2e`
   * for backwards compat. "light" uses paper cream so cropMode="contain"
   * letterboxing blends with the V3.2 light editorial system.
   */
  tone?: "dark" | "light";
}

/**
 * Vertical phone frame for inline screenshots. 9:19.5 aspect.
 * Screenshots come from apps/video/scripts/capture-screenshots.ts.
 *
 * v3.2 — adds cropMode + tone for the light pivot. When cropMode is
 * "contain", we render two image layers: a blurred cover layer in the
 * back (acts as soft ambient bleed) and a contain layer on top with
 * the full undistorted screenshot.
 */
export const PhoneFrame: React.FC<Props> = ({
  screenshotKey,
  width = 720,
  rotateDeg = 0,
  cropMode = "cover",
  tone = "dark",
}) => {
  const height = (width * 19.5) / 9;
  const path = SCREENSHOT_PATHS[screenshotKey];
  const src = staticFile(path);

  const wrapperBg =
    tone === "light" ? PITCH_THEME.light.bg.base : "#1a1f2e";

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 56,
        background: wrapperBg,
        boxShadow:
          tone === "light"
            ? PITCH_THEME.light.shadow.phone
            : "0 30px 80px rgba(0,0,0,0.55), 0 0 0 8px rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
        transform: `rotate(${rotateDeg}deg)`,
      }}
    >
      {cropMode === "contain" && (
        <Img
          src={src}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(28px) saturate(0.85)",
            opacity: 0.45,
            transform: "scale(1.1)",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <Img
        src={src}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          objectFit: cropMode,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
};
