import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME, useIsLandscape } from "../../../lib/pitch-theme";
import { PhoneFrame } from "../_PhoneFrame";

const COPY = PITCH_B_COPY.scenes.solution;

export const PitchSolutionCaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  const titleOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(
    frame,
    [0.8 * fps, 1.3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const phoneOpacity = interpolate(
    frame,
    [0.5 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: PITCH_THEME.bg.gradient,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: landscape ? "row" : "column",
        gap: landscape ? 96 : 48,
        paddingLeft: PITCH_THEME.space.side,
        paddingRight: PITCH_THEME.space.side,
        paddingBottom: landscape ? 0 : 120,
      }}
    >
      <div style={{ textAlign: landscape ? "left" : "center", maxWidth: 920 }}>
        <div
          style={{
            opacity: titleOpacity,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: 56,
            fontWeight: 600,
            color: PITCH_THEME.text.primary,
            lineHeight: 1.2,
          }}
        >
          {COPY.title}
        </div>
        <div
          style={{
            opacity: subtitleOpacity,
            marginTop: 20,
            fontFamily: PITCH_THEME.type.sans,
            fontSize: PITCH_THEME.size.body,
            color: PITCH_THEME.accent.cyan,
            fontWeight: 600,
          }}
        >
          {COPY.subtitle}
        </div>
      </div>
      <div style={{ opacity: phoneOpacity }}>
        <PhoneFrame screenshotKey={COPY.screenshotKey} width={landscape ? 440 : 540} />
      </div>
    </AbsoluteFill>
  );
};
