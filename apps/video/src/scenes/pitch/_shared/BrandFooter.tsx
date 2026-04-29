import React from "react";
import { AbsoluteFill } from "remotion";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  /**
   * One or more brand tokens, joined by middle-dot. Render exactly
   * what you want visible (e.g. ["by Den Labs"] or ["by Den Labs",
   * "Powered by Celo", "@AKAwolfcito"]).
   */
  items: readonly string[];
  /** 0..1 entry opacity (animated externally). */
  opacity?: number;
  /**
   * Distance from the bottom edge in px. Defaults to 48 to keep the
   * footer well clear of typical mobile safe-area + video codec
   * compression that can crush content near the absolute edge.
   */
  bottom?: number;
}

/**
 * Editorial brand footer. Paper-cream uppercase tracked line,
 * pinned to the bottom-center of a scene. Used to consolidate the
 * "by Den Labs · Powered by Celo · @AKAwolfcito" lockup without
 * competing with the main composition.
 *
 * Renders inside an `AbsoluteFill` so any scene can drop it in once,
 * regardless of its inner layout.
 */
export const BrandFooter: React.FC<Props> = ({
  items,
  opacity = 1,
  bottom = 48,
}) => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: bottom,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 13,
          fontWeight: 600,
          color: PITCH_THEME.light.text.muted,
          letterSpacing: 2.0,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {items.join("  ·  ")}
      </div>
    </AbsoluteFill>
  );
};
