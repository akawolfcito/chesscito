import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import {
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
  ProductPhone,
  ValueCard,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Personal progress, no NFT-bait. Phone-right with victory state +
 * three light pills (Logros · Victorias · Rachas). Subtle cognac
 * sparkles around the hero phone — minimal, never confetti.
 */
export const PitchSovereignty: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.sovereignty;

  const phoneScale = spring({
    frame,
    fps,
    from: 0.95,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const phoneOpacity = interpolate(frame, [0.2 * fps, 1.0 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneX = interpolate(frame, [0.2 * fps, 1.2 * fps], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ambient = Math.sin((frame / fps) * Math.PI * 0.5);
  const breathScale = phoneScale * (1 + ambient * 0.005);
  const tiltDeg = landscape ? -1.2 + ambient * 0.25 : -2 + ambient * 0.3;

  const titleY = interpolate(frame, [0, 0.7 * fps], [22, 0], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const highlightOpacity = interpolate(
    frame,
    [0.5 * fps, 1.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const subtitleOpacity = interpolate(
    frame,
    [0.9 * fps, 1.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 78, y: 38 }} />

      <Sparkles frame={frame} fps={fps} landscape={landscape} />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: landscape ? "row" : "column",
          alignItems: "center",
          justifyContent: landscape ? "space-between" : "center",
          gap: landscape ? 80 : 32,
        }}
      >
        <div
          style={{
            maxWidth: landscape ? 880 : 720,
            display: "flex",
            flexDirection: "column",
            alignItems: landscape ? "flex-start" : "center",
            textAlign: landscape ? "left" : "center",
            gap: 24,
          }}
        >
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              fontFamily: PITCH_THEME.type.serif,
              fontSize: landscape ? 100 : 72,
              fontWeight: 500,
              lineHeight: 0.98,
              color: LIGHT.text.primary,
              letterSpacing: -0.6,
            }}
          >
            <HighlightWord
              text={COPY.title}
              highlight={COPY.highlight}
              highlightOpacity={highlightOpacity}
              color={LIGHT.accent.primary}
              glow={false}
            />
          </div>

          <div
            style={{
              opacity: subtitleOpacity,
              fontFamily: PITCH_THEME.type.sans,
              fontSize: landscape ? 22 : 20,
              color: LIGHT.text.secondary,
              letterSpacing: 0.2,
              fontWeight: 500,
              lineHeight: 1.5,
              maxWidth: 580,
            }}
          >
            {COPY.subtitle}
          </div>

          <PillsRow
            frame={frame}
            fps={fps}
            cards={COPY.valueCards}
            align={landscape ? "flex-start" : "center"}
          />
        </div>

        <ProductPhone
          screenshotKey={COPY.screenshotKey}
          width={landscape ? 420 : 420}
          opacity={phoneOpacity}
          translateX={phoneX}
          scale={breathScale}
          rotateDeg={tiltDeg}
          halo="warm"
          tone="light"
        />
      </AbsoluteFill>

      <BrandMasthead />
    </AbsoluteFill>
  );
};

interface PillsProps {
  frame: number;
  fps: number;
  cards: readonly string[];
  align: "flex-start" | "center";
}

const PillsRow: React.FC<PillsProps> = ({ frame, fps, cards, align }) => {
  const ENTER_AT = 1.4 * fps;
  const STAGGER = 6;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: align,
        marginTop: 4,
      }}
    >
      {cards.map((card, i) => {
        const enter = ENTER_AT + i * STAGGER;
        const opacity = interpolate(frame, [enter, enter + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(
          frame,
          [enter, enter + 12],
          [10, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <ValueCard
            key={card}
            label={card}
            opacity={opacity}
            translateY={translateY}
            variant="row"
            tone="light"
          />
        );
      })}
    </div>
  );
};

interface SparklesProps {
  frame: number;
  fps: number;
  landscape: boolean;
}

/**
 * 5 cognac dots breathing softly around the right side of the
 * canvas (where the hero phone sits). Sub-confetti, sub-glow:
 * just gentle motion that says "celebración controlada".
 */
const Sparkles: React.FC<SparklesProps> = ({ frame, fps, landscape }) => {
  const positions = landscape
    ? [
        { x: 62, y: 22 },
        { x: 70, y: 70 },
        { x: 88, y: 30 },
        { x: 92, y: 60 },
        { x: 78, y: 12 },
      ]
    : [
        { x: 22, y: 16 },
        { x: 78, y: 18 },
        { x: 30, y: 78 },
        { x: 84, y: 80 },
        { x: 50, y: 8 },
      ];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {positions.map((p, i) => {
        const phase = (frame / fps) * 1.2 + i * 0.7;
        const scale = 0.85 + Math.sin(phase * Math.PI) * 0.2;
        const opacity =
          interpolate(frame, [0.6 * fps + i * 4, 1.4 * fps + i * 4], [0, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: PITCH_THEME.light.accent.primary,
              opacity,
              transform: `scale(${scale})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
