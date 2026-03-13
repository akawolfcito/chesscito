import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const APP_URL = "chesscito.vercel.app";

export const CtaOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Sequential fade-ins
  const titleOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(
    frame,
    [0.5 * fps, 0.9 * fps],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const ctaOpacity = interpolate(frame, [1 * fps, 1.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const urlOpacity = interpolate(frame, [1.5 * fps, 1.9 * fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // CTA border pulse
  const borderOpacity = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.4, 1]
  );

  // Fade to black at end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0f1a",
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 72,
          fontWeight: 800,
          color: "#e0f7fa",
          fontFamily: "serif",
          letterSpacing: 2,
          textShadow: "0 0 40px rgba(0, 188, 212, 0.4)",
        }}
      >
        Chesscito
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: 28,
          color: "rgba(224, 247, 250, 0.5)",
          fontFamily: "sans-serif",
          marginTop: 12,
        }}
      >
        on Celo
      </div>

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          marginTop: 60,
          padding: "16px 48px",
          border: `2px solid rgba(0, 188, 212, ${borderOpacity})`,
          borderRadius: 16,
          fontSize: 32,
          fontWeight: 700,
          color: "#00bcd4",
          fontFamily: "sans-serif",
        }}
      >
        Play now
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          marginTop: 24,
          fontSize: 22,
          color: "rgba(224, 247, 250, 0.4)",
          fontFamily: "monospace",
        }}
      >
        {APP_URL}
      </div>
    </AbsoluteFill>
  );
};
