import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PITCH_B_COPY } from "../../../lib/pitch-copy";
import { PITCH_THEME, useIsLandscape } from "../../../lib/pitch-theme";

const COPY = PITCH_B_COPY.scenes.academicBlock;

/**
 * B-Cut exclusive. Renders the verified Cibeira (2021) phrase plus
 * the mandatory limitations caption per spec §5. Visual treatment is
 * deliberately sober (no glow on the screen phrase, no animated
 * decorations on the caption) so the academic claim cannot read as
 * promotional. The caption MUST remain legible — never decorative —
 * per locked guardrail #3.
 *
 * Hybrid background mode: renders on paper cream so the audience
 * reads the academic frame as document/research, not as marketing.
 */
export const PitchAcademicBlock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  const badgeOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(
    frame,
    [0.5 * fps, 1.1 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionOpacity = interpolate(
    frame,
    [1.4 * fps, 2.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: PITCH_THEME.bg.paper,
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: PITCH_THEME.space.side,
        paddingRight: PITCH_THEME.space.side,
      }}
    >
      <div
        style={{
          opacity: badgeOpacity,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: PITCH_THEME.size.caption,
          fontWeight: 700,
          color: "#7a4a00",
          background: "rgba(251,191,36,0.20)",
          border: "1.5px solid rgba(176, 110, 0, 0.50)",
          padding: "10px 24px",
          borderRadius: PITCH_THEME.radius.pill,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        {COPY.classification}
      </div>

      <div
        style={{
          opacity: titleOpacity,
          marginTop: 48,
          fontFamily: PITCH_THEME.type.serif,
          fontSize: landscape ? 50 : 44,
          fontWeight: 500,
          lineHeight: 1.32,
          color: PITCH_THEME.text.onPaper,
          textAlign: "center",
          maxWidth: landscape ? 1280 : 900,
          letterSpacing: -0.2,
        }}
      >
        {COPY.title}
      </div>

      <div
        style={{
          opacity: captionOpacity,
          marginTop: 56,
          fontFamily: PITCH_THEME.type.sans,
          fontSize: PITCH_THEME.size.disclaimer,
          color: "rgba(31,32,36,0.75)",
          textAlign: "center",
          maxWidth: landscape ? 1280 : 880,
          lineHeight: 1.55,
          letterSpacing: 0.3,
          paddingTop: 24,
          borderTop: "1px solid rgba(31,32,36,0.18)",
        }}
      >
        {COPY.caption}
      </div>
    </AbsoluteFill>
  );
};
