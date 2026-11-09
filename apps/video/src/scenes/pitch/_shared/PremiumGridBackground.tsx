import React from "react";
import { AbsoluteFill } from "remotion";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  glow?: "cyan" | "amber" | "none";
  /** 0..1 — fade the grid in/out across the scene. */
  opacity?: number;
}

/**
 * Layered cinematic background:
 *  - rich gradient
 *  - faint SVG grid pattern (uses theme cellPx + stroke)
 *  - optional ellipse glow (top-third)
 *  - subtle vignette
 *
 * Place behind every product scene. Foreground content remains
 * crisp because the grid is inset at very low alpha.
 */
export const PremiumGridBackground: React.FC<Props> = ({
  glow = "cyan",
  opacity = 1,
}) => {
  const cell = PITCH_THEME.grid.cellPx;
  const stroke = PITCH_THEME.grid.strokeRgba;
  const gridSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${cell}' height='${cell}'><path d='M ${cell} 0 L 0 0 0 ${cell}' fill='none' stroke='${stroke}' stroke-width='1'/></svg>`,
  )}`;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ background: PITCH_THEME.bg.gradientRich }} />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${gridSvg})`,
          backgroundRepeat: "repeat",
          opacity: 0.7 * opacity,
          mixBlendMode: "screen",
        }}
      />
      {glow !== "none" && (
        <AbsoluteFill
          style={{
            background:
              glow === "amber"
                ? "radial-gradient(ellipse at 75% 18%, rgba(251,191,36,0.16) 0%, rgba(251,191,36,0) 55%)"
                : "radial-gradient(ellipse at 75% 18%, rgba(0,188,212,0.18) 0%, rgba(0,188,212,0) 55%)",
            opacity,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
