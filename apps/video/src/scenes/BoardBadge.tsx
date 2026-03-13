import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const BoardBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Board entrance: scale 0.9 → 1.0
  const boardScale = spring({
    frame,
    fps,
    config: { damping: 200 },
  });
  const boardScaleValue = interpolate(boardScale, [0, 1], [0.9, 1]);

  // Rook movement: starts at frame 20, moves from left to right on board
  const rookProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const rookX = interpolate(rookProgress, [0, 1], [-120, 120]);
  const rookY = interpolate(rookProgress, [0, 1], [60, -60]);

  // Badge entrance: starts at ~2.5s (75 frames), bounce effect
  const badgeEntrance = spring({
    frame: frame - 75,
    fps,
    config: { damping: 8 }, // Bouncy
  });
  const badgeScale = interpolate(badgeEntrance, [0, 1], [0, 1]);

  // Badge glow pulse (starts after badge enters)
  const badgeGlowOpacity =
    frame > 75
      ? interpolate(
          Math.sin(((frame - 75) / fps) * Math.PI * 3),
          [-1, 1],
          [0.3, 0.9]
        )
      : 0;

  // Text fade-in: starts at ~3.5s (105 frames)
  const textOpacity = interpolate(frame, [105, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a1a1a",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Board */}
      <div
        style={{
          transform: `scale(${boardScaleValue})`,
          position: "relative",
          width: 700,
          height: 647, // Maintains board aspect ratio 1011/934
        }}
      >
        <Img
          src={staticFile("chesscito-board.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
        {/* Rook piece moving on the board */}
        <Img
          src={staticFile("piece-rook.png")}
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            objectFit: "contain",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${rookX}px), calc(-50% + ${rookY}px))`,
          }}
        />
      </div>

      {/* Badge with glow */}
      <div
        style={{
          position: "absolute",
          bottom: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <Img
            src={staticFile("reward-glow.png")}
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              opacity: badgeGlowOpacity,
            }}
          />
          <Img
            src={staticFile("badge-chesscito.png")}
            style={{
              width: 200,
              height: 200,
              objectFit: "contain",
              transform: `scale(${badgeScale})`,
            }}
          />
        </div>
      </div>

      {/* Text */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          opacity: textOpacity,
          color: "#e0f7fa",
          fontSize: 40,
          fontWeight: 700,
          fontFamily: "sans-serif",
          textAlign: "center",
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}
      >
        Earn on-chain badges
      </div>
    </AbsoluteFill>
  );
};
