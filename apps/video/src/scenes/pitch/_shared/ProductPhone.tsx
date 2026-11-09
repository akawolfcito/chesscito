import React from "react";
import type { ScreenshotKey } from "../../../lib/pitch-copy";
import { PITCH_THEME } from "../../../lib/pitch-theme";
import { PhoneFrame } from "../_PhoneFrame";

interface Props {
  screenshotKey: ScreenshotKey;
  width?: number;
  /** 0..1 entry opacity */
  opacity?: number;
  /** translation X for slide-in entries (px) */
  translateX?: number;
  /** translation Y for slide-up entries (px) */
  translateY?: number;
  /** scale for breathing or product reveal */
  scale?: number;
  /** rotation in degrees (subtle tilt) */
  rotateDeg?: number;
  /** halo behind the phone */
  halo?: "cyan" | "amber" | "warm" | "none";
  /** "dark" (default) or "light" — switches drop-shadow filter to the warm-paper friendly version. */
  tone?: "dark" | "light";
  /**
   * v3.2 — image fit inside the phone frame. "cover" (default) fills
   * the frame and may crop edges (best for 9:19.5 sources). "contain"
   * shows the full image with paper letterboxing (best for 1:1 or
   * landscape sources to avoid distortion).
   */
  cropMode?: "cover" | "contain";
}

/**
 * Wraps PhoneFrame with a halo backdrop, deeper drop shadow and a
 * tilt-friendly transform stack. v3.2 adds a "warm" halo + "light"
 * tone option for the paper editorial pivot — the shadow becomes
 * softer/warmer to feel grounded on cream surfaces.
 */
export const ProductPhone: React.FC<Props> = ({
  screenshotKey,
  width = 480,
  opacity = 1,
  translateX = 0,
  translateY = 0,
  scale = 1,
  rotateDeg = 0,
  halo = "cyan",
  tone = "dark",
  cropMode = "cover",
}) => {
  const haloBg = (() => {
    if (halo === "cyan") return PITCH_THEME.phone.haloCyan;
    if (halo === "amber") return PITCH_THEME.phone.haloAmber;
    if (halo === "warm") return PITCH_THEME.light.halo.warm;
    return null;
  })();

  const phoneShadow =
    tone === "light"
      ? PITCH_THEME.light.shadow.phone
      : PITCH_THEME.phone.shadowDeep;
  const dropShadowFilter =
    tone === "light"
      ? "drop-shadow(0 36px 60px rgba(24,20,16,0.20))"
      : "drop-shadow(0 60px 80px rgba(0,0,0,0.45))";

  return (
    <div
      style={{
        position: "relative",
        opacity,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotateDeg}deg)`,
        transformOrigin: "center center",
        filter: dropShadowFilter,
      }}
    >
      {haloBg && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -width * 0.55,
            background: haloBg,
            zIndex: 0,
            pointerEvents: "none",
            filter: "blur(20px)",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          boxShadow: phoneShadow,
          borderRadius: 56,
        }}
      >
        <PhoneFrame
          screenshotKey={screenshotKey}
          width={width}
          cropMode={cropMode}
          tone={tone}
        />
      </div>
    </div>
  );
};
