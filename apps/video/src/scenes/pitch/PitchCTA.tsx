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

const COPY = PITCH_A_COPY.scenes.cta;
const LIGHT = PITCH_THEME.light;

export type CtaVariant = "in-minipay" | "social";

interface Props {
  variant?: CtaVariant;
}

/**
 * v3.2 — Light editorial warm.
 *
 * Final invitation. Centered editorial composition, badge-less.
 * Serif title with cognac italic on "tu primer reto" + cognac
 * hairline + subtitle (dynamic per channel) + cognac luxury CTA
 * button + URL footer in mono.
 */
export const PitchCTA: React.FC<Props> = ({ variant = "social" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const landscape = useIsLandscape();

  const titleScale = spring({
    frame,
    fps,
    from: 0.97,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const highlightOpacity = interpolate(
    frame,
    [0.5 * fps, 1.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subtitleOpacity = interpolate(
    frame,
    [0.7 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ruleOpacity = interpolate(frame, [0.9 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleScaleX = interpolate(frame, [0.9 * fps, 1.4 * fps], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaScale = spring({
    frame: frame - 1.4 * fps,
    fps,
    from: 0.97,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const ctaOpacity = interpolate(
    frame,
    [1.3 * fps, 1.8 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const urlOpacity = interpolate(
    frame,
    [1.6 * fps, 2.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitle =
    variant === "in-minipay" ? COPY.subtitleInMiniPay : COPY.subtitleSocial;

  return (
    <AbsoluteFill
      style={{ backgroundColor: LIGHT.bg.base, opacity: fadeOut }}
    >
      <EditorialPaperBackground
        opacity={bgOpacity}
        warmPool={{ x: 50, y: 38 }}
      />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 116 : 76,
            fontWeight: 500,
            color: LIGHT.text.primary,
            textAlign: "center",
            letterSpacing: -0.8,
            lineHeight: 1.04,
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
            width: 100,
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
            fontSize: landscape ? 22 : 20,
            color: LIGHT.text.secondary,
            letterSpacing: 0.3,
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>

        <CtaButton
          label={COPY.ctaLabel}
          opacity={ctaOpacity}
          scale={ctaScale}
        />

        <div
          style={{
            opacity: urlOpacity,
            marginTop: 14,
            fontFamily: PITCH_THEME.type.mono,
            fontSize: 18,
            color: LIGHT.text.muted,
            letterSpacing: 1.4,
          }}
        >
          {COPY.url}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface CtaProps {
  label: string;
  opacity: number;
  scale: number;
}

const CtaButton: React.FC<CtaProps> = ({ label, opacity, scale }) => (
  <div
    style={{
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: "center center",
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "20px 36px",
      borderRadius: PITCH_THEME.radius.pill,
      background: LIGHT.cta.bg,
      boxShadow: LIGHT.cta.bgShadow,
      color: LIGHT.cta.text,
      fontFamily: PITCH_THEME.type.sans,
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: 0.4,
      marginTop: 16,
    }}
  >
    {label}
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 0,
        height: 0,
        borderTop: "7px solid transparent",
        borderBottom: "7px solid transparent",
        borderLeft: `9px solid ${LIGHT.cta.text}`,
      }}
    />
  </div>
);
