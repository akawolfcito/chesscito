import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy, useBrand, useTeam } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import {
  BrandFooter,
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
  Portrait,
  type PortraitKey,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

/**
 * v3.4 — centered team-presentation hierarchy + "100+" as global
 * editorial watermark.
 *
 * Layered composition:
 *   1. paper gradient + warm pool (EditorialPaperBackground)
 *   2. "100+" outline at very low alpha — sits behind everything as
 *      ambient context (NOT a closing module)
 *   3. content stack: title → subtitle → 2 founder cards → caption
 *
 * The watermark behaves as editorial depth: the eye reads the
 * portraits first, then the giant "100+" feels like context the
 * scene is drawing on, not a metric block competing for attention.
 */

/** Display order on h08: César first, Luis second. */
const PORTRAIT_DISPLAY_ORDER = ["cesar-litvinov", "luis-ushina"] as const;

export const PitchTeamMini: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.teamMini;
  const PITCH_BRAND = useBrand();
  const team = useTeam();
  const PORTRAIT_FOUNDERS = PORTRAIT_DISPLAY_ORDER.flatMap((key) => {
    const found = team.founders.find((f) => f.portraitKey === key);
    return found ? [found] : [];
  });

  /* Watermark fades in early and stays as ambient depth */
  const watermarkOpacity = interpolate(
    frame,
    [0.2 * fps, 1.4 * fps],
    [0, 0.09],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
    [0.8 * fps, 1.3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const cardsOpacity = interpolate(
    frame,
    [1.1 * fps, 1.7 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cardsY = interpolate(frame, [1.1 * fps, 1.7 * fps], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionOpacity = interpolate(
    frame,
    [1.7 * fps, 2.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const brandFooterOpacity = interpolate(
    frame,
    [2.0 * fps, 2.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.bg.alt }}>
      <EditorialPaperBackground opacity={bgOpacity} warmPool={{ x: 50, y: 30 }} />

      {/* ── "100+" global editorial watermark ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: watermarkOpacity,
        }}
      >
        <div
          aria-hidden
          style={{
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 720 : 360,
            fontWeight: 300,
            lineHeight: 0.85,
            color: "transparent",
            WebkitTextStroke: `2px ${LIGHT.accent.primary}`,
            letterSpacing: landscape ? -10 : -6,
          }}
        >
          {COPY.foundingNumber}
        </div>
      </AbsoluteFill>

      {/* ── Content stack ── */}
      <AbsoluteFill
        style={{
          padding: `0 ${PITCH_THEME.space.side}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {/* Section title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 60 : 44,
            fontWeight: 500,
            lineHeight: 1.05,
            color: LIGHT.text.primary,
            letterSpacing: -0.4,
            whiteSpace: "pre-line",
            textAlign: "center",
            maxWidth: 1100,
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

        {/* Brief team intro subtitle */}
        <div
          style={{
            opacity: subtitleOpacity,
            fontFamily: PITCH_THEME.type.sans,
            fontSize: landscape ? 22 : 18,
            color: LIGHT.text.secondary,
            letterSpacing: 0.3,
            fontWeight: 500,
            textAlign: "center",
            maxWidth: 720,
          }}
        >
          {COPY.subtitle}
        </div>

        {/* Founder cards row — Luis first, César second */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: landscape ? 56 : 28,
            opacity: cardsOpacity,
            transform: `translateY(${cardsY}px)`,
            marginTop: landscape ? 24 : 18,
          }}
        >
          {PORTRAIT_FOUNDERS.map((founder, i) => (
            <FounderBlock
              key={founder.realName}
              founder={founder}
              rotateDeg={0}
            />
          ))}
        </div>

        {/* Caption — closing line, paired with watermark via meaning */}
        <div
          style={{
            opacity: captionOpacity,
            fontFamily: PITCH_THEME.type.serif,
            fontStyle: "italic",
            fontSize: landscape ? 22 : 18,
            color: LIGHT.text.secondary,
            letterSpacing: 0.2,
            textAlign: "center",
            maxWidth: 720,
            marginTop: landscape ? 28 : 22,
          }}
        >
          {COPY.foundingNumberCaption}
        </div>
      </AbsoluteFill>

      <BrandMasthead
        size="md"
        showDescriptor={false}
        showByline
        opacity={brandFooterOpacity}
      />
      <BrandFooter items={[PITCH_BRAND.byline]} opacity={brandFooterOpacity} />
    </AbsoluteFill>
  );
};

interface FounderBlockProps {
  founder: {
    realName: string;
    role: string;
    tagline: string;
    portraitKey: PortraitKey | null;
    hasPortraitAsset: boolean;
  };
  rotateDeg: number;
}

const FounderBlock: React.FC<FounderBlockProps> = ({ founder, rotateDeg }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        width: 380,
      }}
    >
      <Portrait
        name={founder.realName}
        role={founder.role}
        portraitKey={founder.portraitKey ?? undefined}
        hasAsset={founder.hasPortraitAsset}
        size="md"
        rotateDeg={rotateDeg}
      />
      <div
        style={{
          fontFamily: PITCH_THEME.type.serif,
          fontSize: 38,
          fontWeight: 500,
          color: LIGHT.text.primary,
          letterSpacing: -0.4,
          textAlign: "center",
          marginTop: 14,
          lineHeight: 1.04,
        }}
      >
        {founder.realName}
      </div>
      <div
        style={{
          fontFamily: PITCH_THEME.type.sans,
          fontSize: 15,
          fontWeight: 700,
          color: LIGHT.accent.primary,
          letterSpacing: 1.8,
          textTransform: "uppercase",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {founder.role}
      </div>
      <div
        style={{
          fontFamily: PITCH_THEME.type.serif,
          fontStyle: "italic",
          fontSize: 19,
          color: LIGHT.text.secondary,
          letterSpacing: 0.1,
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 360,
          marginTop: 6,
        }}
      >
        {founder.tagline}
      </div>
    </div>
  );
};
