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

const COPY = PITCH_A_COPY.scenes.solution;
const LIGHT = PITCH_THEME.light;

/**
 * v3.2 — Light editorial warm.
 *
 * Composition:
 *   left  : badge → editorial title (cognac italic on the final
 *           segment) → subtitle → 3 light pills → cognac CTA.
 *   right : ProductPhone as hero shot, warm halo behind it, soft
 *           grounded shadow, anchored tilt.
 *
 * The screenshot's existing cream/cognac palette flows into the
 * paper background, so the phone reads as part of the same plane —
 * not a mockup pasted on top.
 */
export const PitchSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();

  /* Phone slide-in + scale settle */
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

  /* Anchored ambient breathing — barely perceptible */
  const ambient = Math.sin((frame / fps) * Math.PI * 0.5);
  const breathScale = phoneScale * (1 + ambient * 0.005);
  const tiltDeg = landscape ? -1.2 + ambient * 0.25 : -2 + ambient * 0.3;

  /* Cascade — badge, title, highlight, subtitle, cards, CTA */
  const badgeOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0.2 * fps, 0.9 * fps], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(
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
  const subtitleOpacity = interpolate(
    frame,
    [1.0 * fps, 1.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ctaScale = spring({
    frame: frame - 1.8 * fps,
    fps,
    from: 0.97,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const ctaOpacity = interpolate(
    frame,
    [1.7 * fps, 2.1 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.base }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 80, y: 50 }} />

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
        {/* ── Left rail ── */}
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
          {COPY.badge && (
            <Badge
              label={COPY.badge}
              tone="lightCognac"
              opacity={badgeOpacity}
            />
          )}

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
              whiteSpace: "pre-line",
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
              fontSize: landscape ? 21 : 19,
              color: LIGHT.text.secondary,
              letterSpacing: 0.2,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {COPY.subtitle}
          </div>

          <ValueCardsRow
            frame={frame}
            fps={fps}
            cards={COPY.valueCards}
            align={landscape ? "flex-start" : "center"}
          />

          <CtaButton
            label={COPY.ctaLabel}
            opacity={ctaOpacity}
            scale={ctaScale}
          />
        </div>

        {/* ── Right rail: hero phone ── */}
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
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

interface CardsProps {
  frame: number;
  fps: number;
  cards: readonly string[];
  align: "flex-start" | "center";
}

const ValueCardsRow: React.FC<CardsProps> = ({ frame, fps, cards, align }) => {
  const ENTER_AT = 1.4 * fps;
  const STAGGER = 6;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: align,
        maxWidth: 720,
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

interface CtaProps {
  label: string;
  opacity: number;
  scale: number;
}

/**
 * Decorative-only luxury CTA. Cognac solid, cream text, soft drop.
 * The video has no real click target; this is a visual affordance.
 */
const CtaButton: React.FC<CtaProps> = ({ label, opacity, scale }) => (
  <div
    style={{
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: "left center",
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "18px 32px",
      borderRadius: PITCH_THEME.radius.pill,
      background: LIGHT.cta.bg,
      boxShadow: LIGHT.cta.bgShadow,
      color: LIGHT.cta.text,
      fontFamily: PITCH_THEME.type.sans,
      fontSize: 20,
      fontWeight: 600,
      letterSpacing: 0.4,
      marginTop: 8,
    }}
  >
    {label}
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 0,
        height: 0,
        borderTop: "6px solid transparent",
        borderBottom: "6px solid transparent",
        borderLeft: `8px solid ${LIGHT.cta.text}`,
      }}
    />
  </div>
);
