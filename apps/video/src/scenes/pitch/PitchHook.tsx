import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy, useBrand } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import {
  Badge,
  BrandFooter,
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Premium opening. Paper cream background, faint chess-board
 * silhouette accent (CSS-only), badge above the title, serif
 * manifesto with cognac italic on the closing fragment, subtitle
 * under a hairline rule.
 */
export const PitchHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.hook;
  const PITCH_BRAND = useBrand();

  const badgeOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({
    frame,
    fps,
    from: 0.97,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const titleY = interpolate(frame, [0.2 * fps, 0.9 * fps], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(
    frame,
    [0.2 * fps, 0.9 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const highlightOpacity = interpolate(
    frame,
    [0.7 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ruleOpacity = interpolate(frame, [1.0 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleScaleX = interpolate(frame, [1.0 * fps, 1.5 * fps], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(
    frame,
    [1.2 * fps, 1.6 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const boardOpacity = interpolate(frame, [0.3 * fps, 1.4 * fps], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const brandFooterOpacity = interpolate(
    frame,
    [1.4 * fps, 1.9 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 50, y: 14 }} />

      <BoardSilhouette opacity={boardOpacity} landscape={landscape} />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px) scale(${titleScale})`,
            transformOrigin: "center center",
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 96 : 72,
            fontWeight: 500,
            lineHeight: 1.02,
            color: LIGHT.text.primary,
            letterSpacing: -0.8,
            textAlign: "center",
            maxWidth: landscape ? 1500 : 920,
          }}
        >
          <HighlightWord
            text={COPY.title}
            highlight={COPY.highlight}
            highlightOpacity={highlightOpacity}
            color={LIGHT.accent.primary}
            glow={false}
          />
        </div>

        <div
          aria-hidden
          style={{
            width: 120,
            height: 1,
            background: `linear-gradient(90deg, rgba(184,137,59,0) 0%, ${LIGHT.accent.hairlineRgba} 50%, rgba(184,137,59,0) 100%)`,
            opacity: ruleOpacity,
            transform: `scaleX(${ruleScaleX})`,
            transformOrigin: "center",
          }}
        />

        <div
          style={{
            opacity: subtitleOpacity,
            fontFamily: PITCH_THEME.type.sans,
            fontSize: landscape ? 24 : 22,
            color: LIGHT.text.secondary,
            letterSpacing: 0.3,
            fontWeight: 500,
            textAlign: "center",
            maxWidth: 760,
            lineHeight: 1.5,
          }}
        >
          {COPY.subtitle}
        </div>
      </AbsoluteFill>

      <BrandMasthead
        size="lg"
        showDescriptor
        showByline
        opacity={brandFooterOpacity}
        top={64}
      />
      <BrandFooter items={[PITCH_BRAND.byline]} opacity={brandFooterOpacity} />
    </AbsoluteFill>
  );
};

interface BoardProps {
  opacity: number;
  landscape: boolean;
}

/**
 * Faint 4×4 chessboard pattern (simplified) as decorative element.
 * CSS-only — no external SVG asset. Sits in the bottom-right corner
 * at very low alpha + slight rotation, evoking chess without being
 * literal.
 */
const BoardSilhouette: React.FC<BoardProps> = ({ opacity, landscape }) => {
  const size = landscape ? 360 : 240;
  const cell = size / 4;
  const cells: React.ReactElement[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) {
        cells.push(
          <div
            key={`${r}-${c}`}
            style={{
              position: "absolute",
              top: r * cell,
              left: c * cell,
              width: cell,
              height: cell,
              background: PITCH_THEME.light.accent.primary,
              opacity: 0.06,
            }}
          />,
        );
      }
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: landscape ? -size * 0.25 : -size * 0.35,
          bottom: landscape ? -size * 0.25 : -size * 0.35,
          width: size,
          height: size,
          opacity,
          transform: "rotate(-8deg)",
          border: `1px solid ${PITCH_THEME.light.border.soft}`,
        }}
      >
        {cells}
      </div>
    </AbsoluteFill>
  );
};
