import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const PIECES = [
  { src: "piece-rook.png", text: "Master the Rook" },
  { src: "piece-bishop.png", text: "Learn the Bishop" },
  { src: "piece-knight.png", text: "Conquer the Knight" },
] as const;

const FRAMES_PER_PIECE = 80; // ~2.67s each

const PieceReveal: React.FC<{ src: string; text: string }> = ({
  src,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance: slide up + scale
  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  const translateY = interpolate(entrance, [0, 1], [80, 0]);
  const scale = interpolate(entrance, [0, 1], [0.8, 1]);

  // Glow pulse: loops using modular frame math
  const glowOpacity = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.4, 0.8]
  );

  // Text fade-in with delay
  const textOpacity = interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Glow */}
      <Img
        src={staticFile("reward-glow.png")}
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          opacity: glowOpacity,
        }}
      />
      {/* Piece */}
      <Img
        src={staticFile(src)}
        style={{
          width: 280,
          height: 280,
          objectFit: "contain",
          transform: `translateY(${translateY}px) scale(${scale})`,
          position: "relative",
          zIndex: 1,
        }}
      />
      {/* Text */}
      <div
        style={{
          position: "absolute",
          bottom: 580,
          opacity: textOpacity,
          color: "#e0f7fa",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "sans-serif",
          textAlign: "center",
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const PiecesShowcase: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Background */}
      <Img
        src={staticFile("bg-chesscitov3.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
        }}
      />
      {/* Pieces sequence */}
      {PIECES.map((piece, i) => (
        <Sequence
          key={piece.src}
          from={i * FRAMES_PER_PIECE}
          durationInFrames={FRAMES_PER_PIECE}
          premountFor={30}
        >
          <PieceReveal src={piece.src} text={piece.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
