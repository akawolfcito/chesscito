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
import {
  EditorialPaperBackground,
  HighlightWord,
  SignatureBlock,
} from "./_shared";

const COPY = PITCH_A_COPY.scenes.coachVo;
const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Founder/method scene. Paper cream + a small CSS knight pictogram
 * (no external assets). Serif statement + cognac italic on
 * "pensar jugando." → cognac hairline → SignatureBlock with
 * primary line + +100 detail. Warm, not solemn.
 */
export const PitchCoachVO: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  const knightOpacity = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const knightScale = spring({
    frame,
    fps,
    from: 0.92,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });

  const statementY = interpolate(frame, [0.2 * fps, 0.9 * fps], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const statementOpacity = interpolate(
    frame,
    [0.2 * fps, 0.9 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const highlightOpacity = interpolate(
    frame,
    [0.7 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const signatureOpacity = interpolate(
    frame,
    [1.2 * fps, 1.7 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 50, y: 30 }} />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: landscape ? "flex-start" : "center",
          justifyContent: "center",
          gap: 28,
          maxWidth: landscape ? 1500 : undefined,
          margin: "0 auto",
        }}
      >
        <KnightMark
          opacity={knightOpacity}
          scale={knightScale}
        />

        <div
          style={{
            opacity: statementOpacity,
            transform: `translateY(${statementY}px)`,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 80 : 56,
            fontWeight: 500,
            lineHeight: 1.1,
            color: LIGHT.text.primary,
            letterSpacing: -0.4,
            maxWidth: landscape ? 1200 : 880,
            textAlign: landscape ? "left" : "center",
          }}
        >
          <HighlightWord
            text={COPY.statement}
            highlight={COPY.highlight}
            highlightOpacity={highlightOpacity}
            color={LIGHT.accent.primary}
            glow={false}
          />
        </div>

        <div
          style={{
            opacity: signatureOpacity,
          }}
        >
          <SignatureBlock
            primary={COPY.signaturePrimary}
            secondary={COPY.signatureDetail}
            align={landscape ? "left" : "center"}
            onPaper
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface KnightProps {
  opacity: number;
  scale: number;
}

/**
 * Minimal CSS knight (L-step pattern) — two stacked cells offset
 * to suggest the L-move. Cognac stroke at low alpha. Not literal
 * pictogram, not external asset.
 */
const KnightMark: React.FC<KnightProps> = ({ opacity, scale }) => {
  const cell = 22;
  return (
    <div
      style={{
        position: "relative",
        width: cell * 3,
        height: cell * 2,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "left center",
      }}
    >
      {[
        { top: 0, left: 0 },
        { top: 0, left: cell },
        { top: cell, left: cell },
        { top: cell, left: cell * 2 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            width: cell,
            height: cell,
            border: `1px solid ${PITCH_THEME.light.accent.primary}`,
            background:
              i === 0 || i === 3
                ? `${PITCH_THEME.light.accent.primary}1f`
                : "transparent",
          }}
        />
      ))}
    </div>
  );
};
