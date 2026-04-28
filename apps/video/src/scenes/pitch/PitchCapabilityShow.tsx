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
  Badge,
  EditorialPaperBackground,
  HighlightWord,
  ProductPhone,
  ValueCard,
} from "./_shared";

const COPY = PITCH_A_COPY.scenes.capabilityShow;
const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Layout: phone-left / text-right (mirror of Solution h04 to vary
 * the rhythm). Badge "MÉTODO REAL" + serif title (3 categorical
 * words) + cognac italic relief on subtitle highlight + 3 light
 * pills (Atención · Patrones · Decisiones) on a hairline.
 */
export const PitchCapabilityShow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

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
  const phoneX = interpolate(frame, [0.2 * fps, 1.2 * fps], [-60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ambient = Math.sin((frame / fps) * Math.PI * 0.5);
  const breathScale = phoneScale * (1 + ambient * 0.005);
  const tiltDeg = landscape ? 1.2 + ambient * 0.25 : 2 + ambient * 0.3;

  const badgeOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [0.2 * fps, 0.9 * fps], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(
    frame,
    [0.2 * fps, 0.9 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const subtitleOpacity = interpolate(
    frame,
    [0.9 * fps, 1.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const highlightOpacity = interpolate(
    frame,
    [1.0 * fps, 1.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 22, y: 50 }} />

      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: landscape ? "row" : "column",
          alignItems: "center",
          justifyContent: "space-between",
          gap: landscape ? 80 : 48,
          paddingBottom: landscape ? 0 : 80,
        }}
      >
        {/* ── Left: hero phone ── */}
        <ProductPhone
          screenshotKey={COPY.screenshotKey}
          width={landscape ? 500 : 540}
          opacity={phoneOpacity}
          translateX={phoneX}
          scale={breathScale}
          rotateDeg={tiltDeg}
          halo="warm"
          tone="light"
        />

        {/* ── Right: editorial copy + pills ── */}
        <div
          style={{
            maxWidth: landscape ? 880 : 720,
            display: "flex",
            flexDirection: "column",
            alignItems: landscape ? "flex-start" : "center",
            textAlign: landscape ? "left" : "center",
            gap: 22,
          }}
        >
          <Badge
            label={COPY.badge}
            tone="lightCognac"
            opacity={badgeOpacity}
          />

          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              fontFamily: PITCH_THEME.type.serif,
              fontSize: landscape ? 92 : 64,
              fontWeight: 500,
              lineHeight: 1.02,
              color: LIGHT.text.primary,
              letterSpacing: -0.5,
            }}
          >
            {COPY.title}
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
            <HighlightWord
              text={COPY.subtitle}
              highlight={COPY.highlight}
              highlightOpacity={highlightOpacity}
              color={LIGHT.accent.primary}
              glow={false}
            />
          </div>

          <PillsRow
            frame={frame}
            fps={fps}
            cards={COPY.valueCards}
            align={landscape ? "flex-start" : "center"}
          />
        </div>
      </AbsoluteFill>
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
        marginTop: 6,
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
