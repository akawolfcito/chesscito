import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import {
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
  ValueCard,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Layout: editorial manifesto. Left rail (serif title with cognac
 * italic highlight on the final segment + subtitle). Right rail
 * (3 numbered value cards on a cognac vertical thread). A horizontal
 * cognac hairline crosses both rails at the title baseline so the
 * timeline reads as part of the same plane — not as accessory column.
 *
 * Atmosphere: paper cream, warm light pool top-right, soft ink
 * typography, no neon glow.
 */
export const PitchProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.problem;

  const titleY = interpolate(frame, [0, 0.6 * fps], [22, 0], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const highlightOpacity = interpolate(
    frame,
    [0.55 * fps, 1.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const subtitleOpacity = interpolate(
    frame,
    [0.9 * fps, 1.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  /* Hair-line: gradient sweep, very fine */
  const threadOpacity = interpolate(frame, [0.7 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const threadScaleX = interpolate(frame, [0.7 * fps, 1.4 * fps], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} />

      {/* ── Hair-line connector ── */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "78%",
            height: 1,
            background: `linear-gradient(90deg, rgba(184,137,59,0) 0%, ${LIGHT.accent.hairlineRgba} 30%, ${LIGHT.accent.hairlineRgba} 70%, rgba(184,137,59,0) 100%)`,
            opacity: threadOpacity,
            transform: `scaleX(${threadScaleX})`,
            transformOrigin: "center",
            marginTop: 80,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: landscape ? "row" : "column",
          alignItems: "center",
          justifyContent: landscape ? "space-between" : "center",
          gap: landscape ? 64 : 48,
        }}
      >
        {/* ── Left rail: editorial title ── */}
        <div
          style={{
            maxWidth: landscape ? 1200 : 880,
            textAlign: landscape ? "left" : "center",
            display: "flex",
            flexDirection: "column",
            alignItems: landscape ? "flex-start" : "center",
            gap: 28,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              fontFamily: PITCH_THEME.type.serif,
              fontSize: landscape ? 88 : 64,
              fontWeight: 500,
              lineHeight: 0.98,
              color: LIGHT.text.primary,
              letterSpacing: -0.6,
              whiteSpace: "pre-line",
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
            style={{
              opacity: subtitleOpacity,
              fontFamily: PITCH_THEME.type.sans,
              fontSize: landscape ? 22 : 20,
              color: LIGHT.text.secondary,
              letterSpacing: 0.2,
              fontWeight: 500,
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            {COPY.subtitle}
          </div>
        </div>

        {/* ── Right rail: value timeline ── */}
        <Timeline frame={frame} fps={fps} cards={COPY.valueCards} />
      </AbsoluteFill>

      <BrandMasthead />
    </AbsoluteFill>
  );
};

interface TimelineProps {
  frame: number;
  fps: number;
  cards: readonly string[];
}

const Timeline: React.FC<TimelineProps> = ({ frame, fps, cards }) => {
  const STAGGER = 7;
  const ENTER_AT = 1.0 * fps;

  const lineOpacity = interpolate(
    frame,
    [ENTER_AT - 4, ENTER_AT + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        paddingLeft: 36,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          bottom: 14,
          width: 1.5,
          background: `linear-gradient(180deg, rgba(184,137,59,0) 0%, ${LIGHT.accent.hairlineRgba} 50%, rgba(184,137,59,0) 100%)`,
          opacity: lineOpacity,
          borderRadius: 2,
        }}
      />

      {cards.map((card, i) => {
        const enterFrame = ENTER_AT + i * STAGGER;
        const cardOpacity = interpolate(
          frame,
          [enterFrame, enterFrame + 14],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const cardScale = spring({
          frame: frame - enterFrame,
          fps,
          from: 0.97,
          to: 1,
          config: PITCH_THEME.motion.spring.soft,
        });
        const translateY = interpolate(
          frame,
          [enterFrame, enterFrame + 14],
          [10, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div
            key={card}
            style={{
              position: "relative",
              transform: `scale(${cardScale})`,
              transformOrigin: "left center",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -28,
                top: "50%",
                transform: "translateY(-50%)",
                width: 9,
                height: 9,
                borderRadius: 999,
                background: LIGHT.accent.primary,
                border: `2px solid ${LIGHT.bg.base}`,
                opacity: cardOpacity,
              }}
            />
            <ValueCard
              label={card}
              index={i}
              opacity={cardOpacity}
              translateY={translateY}
              variant="stack"
              tone="light"
            />
          </div>
        );
      })}
    </div>
  );
};
