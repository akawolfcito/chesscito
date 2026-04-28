import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME, useIsLandscape } from "../../../lib/pitch-theme";

const COPY = PITCH_B_COPY.scenes.disclaimer;

/**
 * v2 — Fine-print professional treatment.
 * Reduced from 8s → 5s with smaller, calmer typography. Reads as a
 * professional note at the close of the institutional cut, never as
 * an alarming full-screen warning. Per locked guardrail #6 (B-Cut
 * still must surface this disclaimer once).
 */
export const PitchDisclaimerCaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  const labelOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ruleWidth = interpolate(
    frame,
    [0.4 * fps, 0.9 * fps],
    [0, 280],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const bodyOpacity = interpolate(
    frame,
    [0.8 * fps, 1.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: PITCH_THEME.bg.base,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: PITCH_THEME.space.side,
        paddingRight: PITCH_THEME.space.side,
      }}
    >
      <div
        style={{
          opacity: labelOpacity,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: PITCH_THEME.text.muted,
          marginBottom: 20,
        }}
      >
        {COPY.label}
      </div>
      <div
        style={{
          width: ruleWidth,
          height: 1,
          background: "rgba(244,249,251,0.30)",
          marginBottom: 28,
        }}
      />
      <div
        style={{
          opacity: bodyOpacity,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: landscape ? 20 : 22,
          color: "rgba(244,249,251,0.78)",
          textAlign: "center",
          maxWidth: landscape ? 1280 : 880,
          lineHeight: 1.55,
          letterSpacing: 0.2,
          fontWeight: 400,
        }}
      >
        {COPY.body}
      </div>
    </AbsoluteFill>
  );
};
