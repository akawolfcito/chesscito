import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_A_COPY } from "../../lib/pitch-copy";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import { EditorialPaperBackground, HighlightWord } from "./_shared";

const COPY = PITCH_A_COPY.scenes.teamMini;
const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Foundational scene. Asymmetric paper layout: oversized outline
 * "100+" numeral on one side (decorative, NOT a metric), serif
 * title with cognac italic on "Convertido en juego." + caption +
 * cognac hairline + founders signature line.
 *
 * "100+" is methodological/pedagogical origin, not app traction —
 * caption "estudiantes" reinforces that.
 */
export const PitchTeamMini: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  const numberScale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const numberOpacity = interpolate(frame, [0, 0.7 * fps], [0, 0.18], {
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [0.2 * fps, 0.9 * fps], [22, 0], {
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

  const subtitleOpacity = interpolate(
    frame,
    [1.0 * fps, 1.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ruleOpacity = interpolate(frame, [1.3 * fps, 1.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleScaleX = interpolate(frame, [1.3 * fps, 1.8 * fps], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const signatureOpacity = interpolate(
    frame,
    [1.5 * fps, 2.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: LIGHT.bg.alt,
      }}
    >
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 28, y: 50 }} />

      {/* ── Oversized "100+" outline numeral (decorative) ── */}
      <BigNumber
        opacity={numberOpacity}
        scale={numberScale}
        landscape={landscape}
        label={COPY.foundingNumber}
        caption={COPY.foundingNumberCaption}
      />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: landscape ? "flex-end" : "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 88 : 60,
            fontWeight: 500,
            lineHeight: 1.02,
            color: LIGHT.text.primary,
            letterSpacing: -0.5,
            whiteSpace: "pre-line",
            textAlign: landscape ? "right" : "center",
            maxWidth: landscape ? 980 : 880,
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
            lineHeight: 1.5,
            maxWidth: 720,
            textAlign: landscape ? "right" : "center",
          }}
        >
          {COPY.subtitle}
        </div>

        <div
          aria-hidden
          style={{
            width: 120,
            height: 1,
            background: `linear-gradient(90deg, rgba(184,137,59,0) 0%, ${LIGHT.accent.hairlineRgba} 50%, rgba(184,137,59,0) 100%)`,
            opacity: ruleOpacity,
            transform: `scaleX(${ruleScaleX})`,
            transformOrigin: landscape ? "right" : "center",
            alignSelf: landscape ? "flex-end" : "center",
            marginTop: 6,
          }}
        />

        <div
          style={{
            opacity: signatureOpacity,
            fontFamily: PITCH_THEME.type.serif,
            fontStyle: "italic",
            fontSize: landscape ? 26 : 20,
            color: LIGHT.text.secondary,
            letterSpacing: 0.1,
            textAlign: landscape ? "right" : "center",
            alignSelf: landscape ? "flex-end" : "center",
          }}
        >
          {COPY.signatureLine}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface BigNumberProps {
  opacity: number;
  scale: number;
  landscape: boolean;
  label: string;
  caption: string;
}

/**
 * Oversized outline-only numeral. Cognac stroke at low alpha,
 * positioned on the left rail, slightly off-center. Reads as
 * editorial decoration, not as a chart number.
 */
const BigNumber: React.FC<BigNumberProps> = ({
  opacity,
  scale,
  landscape,
  label,
  caption,
}) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: landscape ? "6%" : "50%",
          top: landscape ? "50%" : "18%",
          transform: `translate(${landscape ? 0 : "-50%"}, -50%) scale(${scale})`,
          transformOrigin: "left center",
          opacity,
        }}
      >
        <div
          style={{
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 460 : 240,
            fontWeight: 300,
            lineHeight: 0.85,
            color: "transparent",
            WebkitTextStroke: `2px ${PITCH_THEME.light.accent.primary}`,
            letterSpacing: -8,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: PITCH_THEME.type.sans,
            fontSize: landscape ? 16 : 14,
            fontWeight: 600,
            color: PITCH_THEME.light.accent.primary,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginTop: 12,
            marginLeft: 6,
            opacity: 0.7,
          }}
        >
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};
