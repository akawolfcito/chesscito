import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useACopy, useBrand } from "../../lib/pitch-locale";
import { PITCH_THEME, useIsLandscape } from "../../lib/pitch-theme";
import { Img, staticFile } from "remotion";
import {
  BrandFooter,
  BrandMasthead,
  EditorialPaperBackground,
  HighlightWord,
} from "./_shared";

const LIGHT = PITCH_THEME.light;

export type CtaVariant = "in-minipay" | "social";

interface Props {
  variant?: CtaVariant;
}

/**
 * v3.2 — Light editorial warm.
 *
 * Final invitation. Centered editorial composition, badge-less.
 * Serif title with cognac italic on "tu primer reto" + cognac
 * hairline + subtitle (dynamic per channel) + cognac luxury CTA
 * button + URL footer in mono.
 */
export const PitchCTA: React.FC<Props> = ({ variant = "social" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const landscape = useIsLandscape();
  const COPY = useACopy().scenes.cta;
  const PITCH_BRAND = useBrand();

  const titleScale = spring({
    frame,
    fps,
    from: 0.97,
    to: 1,
    config: PITCH_THEME.motion.spring.soft,
  });
  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
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
    [0.7 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ruleOpacity = interpolate(frame, [0.9 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleScaleX = interpolate(frame, [0.9 * fps, 1.4 * fps], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(
    frame,
    [1.3 * fps, 1.8 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const urlOpacity = interpolate(
    frame,
    [1.6 * fps, 2.0 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const brandFooterOpacity = interpolate(
    frame,
    [1.9 * fps, 2.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgOpacity = interpolate(frame, [0, 1.0 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitle =
    variant === "in-minipay" ? COPY.subtitleInMiniPay : COPY.subtitleSocial;

  return (
    <AbsoluteFill
      style={{ backgroundColor: LIGHT.bg.base, opacity: fadeOut }}
    >
      <EditorialPaperBackground
        opacity={bgOpacity}
        warmPool={{ x: 50, y: 38 }}
      />

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
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            fontFamily: PITCH_THEME.type.serif,
            fontSize: landscape ? 96 : 64,
            fontWeight: 500,
            color: LIGHT.text.primary,
            textAlign: "center",
            letterSpacing: -0.8,
            lineHeight: 1.04,
            maxWidth: landscape ? 1500 : 920,
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
          aria-hidden
          style={{
            width: 100,
            height: 1,
            background: `linear-gradient(90deg, rgba(184,137,59,0) 0%, ${LIGHT.accent.hairlineRgba} 50%, rgba(184,137,59,0) 100%)`,
            opacity: ruleOpacity,
            transform: `scaleX(${ruleScaleX})`,
            transformOrigin: "center",
          }}
        />

        {/*
          v3.8 — URL is now the dominant CTA (this is video, not
          interactive). The decorative button is removed; the URL is
          rendered very large alongside a QR code so the audience
          can scan straight to chesscito.vercel.app.
        */}
        <div
          style={{
            opacity: urlOpacity,
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 36,
          }}
        >
          <Img
            src={staticFile("brands/qr.png")}
            style={{
              width: 200,
              height: 200,
              borderRadius: 16,
              background: LIGHT.surface.base,
              padding: 12,
              boxShadow: LIGHT.shadow.card,
              objectFit: "contain",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: PITCH_THEME.type.sans,
                fontSize: 12,
                fontWeight: 700,
                color: LIGHT.accent.primary,
                letterSpacing: 2.4,
                textTransform: "uppercase",
              }}
            >
              Escanea o visita
            </div>
            <div
              style={{
                fontFamily: PITCH_THEME.type.mono,
                fontSize: landscape ? 56 : 32,
                fontWeight: 600,
                color: LIGHT.text.primary,
                letterSpacing: 0.4,
                lineHeight: 1.1,
              }}
            >
              {COPY.url}
            </div>
            <div
              style={{
                fontFamily: PITCH_THEME.type.serif,
                fontStyle: "italic",
                fontSize: 18,
                color: LIGHT.text.secondary,
                marginTop: 4,
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <BrandMasthead
        size="lg"
        showDescriptor
        showByline={false}
        opacity={brandFooterOpacity}
        top={64}
      />
      <BrandFooter
        items={[
          PITCH_BRAND.byline,
          PITCH_BRAND.poweredBy,
          PITCH_BRAND.contact,
        ]}
        opacity={brandFooterOpacity}
      />
    </AbsoluteFill>
  );
};

