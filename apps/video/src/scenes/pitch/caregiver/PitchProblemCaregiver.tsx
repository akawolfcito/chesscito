import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME } from "../../../lib/pitch-theme";

const COPY = PITCH_B_COPY.scenes.problem;

export const PitchProblemCaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = interpolate(frame, [0, 0.6 * fps], [20, 0], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(
    frame,
    [0.9 * fps, 1.5 * fps],
    [0, 1],
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
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: PITCH_THEME.type.serif,
          fontSize: PITCH_THEME.size.title,
          fontWeight: 600,
          lineHeight: 1.1,
          color: PITCH_THEME.text.primary,
          textAlign: "center",
          maxWidth: 920,
        }}
      >
        {COPY.title}
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          marginTop: 32,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: PITCH_THEME.size.body,
          color: PITCH_THEME.text.muted,
          textAlign: "center",
          maxWidth: 820,
          lineHeight: 1.5,
        }}
      >
        {COPY.subtitle}
      </div>
    </AbsoluteFill>
  );
};
