import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME } from "../../../lib/pitch-theme";

const COPY = PITCH_B_COPY.scenes.hook;

export const PitchHookCaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    from: 0.94,
    to: 1,
    config: { damping: 16, stiffness: 80, mass: 0.9 },
  });
  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(
    frame,
    [0.7 * fps, 1.3 * fps],
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
          transform: `scale(${titleScale})`,
          fontFamily: PITCH_THEME.type.serif,
          fontSize: 88,
          fontWeight: 600,
          lineHeight: 1.08,
          color: PITCH_THEME.text.primaryWarm,
          textAlign: "center",
          maxWidth: 920,
        }}
      >
        {COPY.title}
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          marginTop: PITCH_THEME.space.sectionGap,
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
