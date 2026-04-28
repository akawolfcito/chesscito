import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME } from "../../../lib/pitch-theme";

const COPY = PITCH_B_COPY.scenes.cta;

export const PitchCTACaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(
    frame,
    [0.7 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const borderOpacity = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.4, 1],
  );
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: PITCH_THEME.bg.gradient,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: PITCH_THEME.space.side,
        paddingRight: PITCH_THEME.space.side,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          fontFamily: PITCH_THEME.type.serif,
          fontSize: 80,
          fontWeight: 700,
          color: PITCH_THEME.text.primaryWarm,
          textAlign: "center",
          letterSpacing: -0.4,
          lineHeight: 1.08,
          maxWidth: 920,
        }}
      >
        {COPY.title}
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          marginTop: 36,
          padding: "18px 48px",
          border: `2px solid rgba(251, 191, 36, ${borderOpacity})`,
          borderRadius: PITCH_THEME.radius.pill,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 28,
          fontWeight: 600,
          color: PITCH_THEME.accent.amber,
          letterSpacing: 0.5,
          textAlign: "center",
        }}
      >
        {COPY.subtitle}
      </div>
    </AbsoluteFill>
  );
};
