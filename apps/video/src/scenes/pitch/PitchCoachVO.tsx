import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy, useTeam } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import {
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
  Portrait,
  SignatureBlock,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm with portrait slot.
 *
 * Founder/method scene. Paper cream + KnightMark CSS accent on left
 * rail. Statement with cognac italic on "pensar jugando." → cognac
 * hairline → SignatureBlock. Right rail holds a Portrait slot for
 * César Litvinov — renders the approved photo when dropped at
 * apps/video/public/portraits/cesar-litvinov.jpg, otherwise a paper
 * placeholder card with serif italic initials. Layout stays fixed
 * either way (drop-in upgrade).
 */
export const PitchCoachVO: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.coachVo;
  const CESAR = useTeam().founders.find(
    (f) => f.portraitKey === "cesar-litvinov",
  );

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

  /* Portrait card enters slightly after the statement, anchored entry */
  const portraitOpacity = interpolate(
    frame,
    [0.5 * fps, 1.3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const portraitY = interpolate(frame, [0.5 * fps, 1.3 * fps], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          flexDirection: landscape ? "row" : "column",
          alignItems: "center",
          justifyContent: landscape ? "space-between" : "center",
          gap: landscape ? 80 : 32,
          maxWidth: landscape ? 1700 : undefined,
          margin: "0 auto",
        }}
      >
        {/* ── Left rail: KnightMark + statement + signature ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: landscape ? "flex-start" : "center",
            gap: 26,
            maxWidth: landscape ? 1000 : 880,
          }}
        >
          <KnightMark opacity={knightOpacity} scale={knightScale} />

          <div
            style={{
              opacity: statementOpacity,
              transform: `translateY(${statementY}px)`,
              fontFamily: PITCH_THEME.type.serif,
              fontSize: landscape ? 90 : 64,
              fontWeight: 500,
              lineHeight: 1.1,
              color: LIGHT.text.primary,
              letterSpacing: -0.4,
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

          <div style={{ opacity: signatureOpacity }}>
            <SignatureBlock
              primary={COPY.signaturePrimary}
              secondary={COPY.signatureDetail}
              align={landscape ? "left" : "center"}
              onPaper
            />
          </div>
        </div>

        {/* ── Right rail / vertical bottom: portrait card (real or placeholder) ── */}
        {CESAR && (
          <div
            style={{
              opacity: portraitOpacity,
              transform: `translateY(${portraitY}px)`,
            }}
          >
            <Portrait
              name={CESAR.realName}
              role={CESAR.role}
              portraitKey={CESAR.portraitKey ?? undefined}
              hasAsset={CESAR.hasPortraitAsset}
              size={landscape ? "md" : "sm"}
              rotateDeg={0}
            />
          </div>
        )}
      </AbsoluteFill>

      <BrandMasthead />
    </AbsoluteFill>
  );
};

interface KnightProps {
  opacity: number;
  scale: number;
}

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
