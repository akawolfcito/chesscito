import React from "react";
import { AbsoluteFill } from "remotion";
import { useBrand } from "../../../lib/pitch-locale";
import { PITCH_THEME } from "../../../lib/pitch-theme";
import { ChessKingIcon } from "./ChessKingIcon";

interface Props {
  /** 0..1 entry opacity (animated externally per scene). */
  opacity?: number;
  /**
   * Distance from the top edge in px. Defaults to 36 to mirror the
   * BrandFooter safe-area treatment.
   */
  top?: number;
  /**
   * Logo size variant.
   *  - "sm": persistent eyebrow (h02..h07). King 22px + wordmark 18px.
   *  - "md": stronger eyebrow (h08). King 30px + wordmark 26px.
   *  - "lg": hero lockup (h01, h09). King 64px + wordmark 56px,
   *          rendered larger and centered as the dominant brand
   *          declaration.
   */
  size?: "sm" | "md" | "lg";
  /** Show "JUEGOS PREAJEDRECÍSTICOS" descriptor under the wordmark. */
  showDescriptor?: boolean;
  /** Show "BY DEN LABS" under the descriptor (or wordmark). */
  showByline?: boolean;
}

const SIZE_TOKENS = {
  sm: {
    iconHeight: 44,
    wordmark: 28,
    wordmarkTracking: 4,
    descriptor: 14,
    descriptorTracking: 0.6,
    byline: 12,
    bylineTracking: 2.6,
    gapIcon: 14,
    gapStack: 3,
  },
  md: {
    iconHeight: 70,
    wordmark: 44,
    wordmarkTracking: 6,
    descriptor: 15,
    descriptorTracking: 0.6,
    byline: 13,
    bylineTracking: 2.8,
    gapIcon: 18,
    gapStack: 6,
  },
  lg: {
    iconHeight: 132,
    wordmark: 100,
    wordmarkTracking: 12,
    descriptor: 18,
    descriptorTracking: 4,
    byline: 13,
    bylineTracking: 3,
    gapIcon: 28,
    gapStack: 10,
  },
} as const;

/**
 * Persistent CHESSCITO brand lockup. Inline horizontal layout:
 * `[King] CHESSCITO` with optional `JUEGOS PREAJEDRECÍSTICOS` and
 * `BY DEN LABS` lines stacked under the wordmark column.
 *
 * Sizes:
 *   sm — h02..h07 (always-on eyebrow, low intensity)
 *   md — h08 founders scene
 *   lg — h01 + h09 hero / closing brand declaration
 */
export const BrandMasthead: React.FC<Props> = ({
  opacity = 1,
  top = 36,
  size = "sm",
  showDescriptor = true,
  showByline = false,
}) => {
  const LIGHT = PITCH_THEME.light;
  const t = SIZE_TOKENS[size];
  const brand = useBrand();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: top,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          display: "flex",
          alignItems: "center",
          gap: t.gapIcon,
        }}
      >
        <ChessKingIcon size={t.iconHeight} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: t.gapStack,
          }}
        >
          <div
            style={{
              fontFamily: PITCH_THEME.type.serif,
              fontSize: t.wordmark,
              fontWeight: 600,
              color: LIGHT.text.primary,
              letterSpacing: t.wordmarkTracking,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {brand.name.toUpperCase()}
          </div>
          {showDescriptor && (
            <div
              style={{
                fontFamily: PITCH_THEME.type.sans,
                fontSize: t.descriptor,
                fontWeight: 600,
                color: LIGHT.accent.primary,
                letterSpacing: t.descriptorTracking,
                textTransform: "uppercase",
              }}
            >
              {brand.descriptor}
            </div>
          )}
          {showByline && (
            <div
              style={{
                fontFamily: PITCH_THEME.type.sans,
                fontSize: t.byline,
                fontWeight: 600,
                color: LIGHT.text.muted,
                letterSpacing: t.bylineTracking,
                textTransform: "uppercase",
              }}
            >
              {brand.byline}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
