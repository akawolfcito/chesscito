import React from "react";
import { AbsoluteFill } from "remotion";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  /** 0..1 — fade the warm light pool in across the scene */
  opacity?: number;
  /** Optional warm pool position (x,y in %). Defaults top-right. */
  warmPool?: { x: number; y: number };
}

/**
 * Light editorial warm background.
 * Layered:
 *  - paper gradient (cream → soft → alt)
 *  - soft warm light pool (low alpha)
 *  - vignette extremely subtle (so the screen feels grounded but
 *    not boxed in)
 *
 * Designed for h02/h04 (V3.2 pilot). No SVG grid, no neon glow —
 * the grain feel comes from the gradient itself.
 */
export const EditorialPaperBackground: React.FC<Props> = ({
  opacity = 1,
  warmPool,
}) => {
  const pool = warmPool ?? { x: 78, y: 22 };
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ background: PITCH_THEME.light.bg.gradient }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${pool.x}% ${pool.y}%, rgba(255, 234, 196, 0.40) 0%, rgba(255, 234, 196, 0) 55%)`,
          opacity,
          mixBlendMode: "normal",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(43,36,29,0) 65%, rgba(43,36,29,0.08) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
