import React from "react";
import { Img, staticFile } from "remotion";
import { PITCH_THEME } from "../../../lib/pitch-theme";

export type PortraitKey = "cesar-litvinov" | "luis-ushina";

const PORTRAIT_PATHS: Record<PortraitKey, string> = {
  "cesar-litvinov": "portraits/cesar-litvinov.jpg",
  "luis-ushina": "portraits/luis-ushina.jpg",
};

interface Props {
  name: string;
  role?: string;
  portraitKey?: PortraitKey;
  /**
   * Explicit flag — must be set to true only after the real, approved
   * asset has been dropped at apps/video/public/portraits/<key>.jpg.
   * When false or undefined the placeholder slot is rendered, holding
   * the exact same dimensions so the layout never shifts.
   */
  hasAsset?: boolean;
  /** "sm" → 240×300 (h08 founders), "md" → 360×450 (h05 coach). */
  size?: "sm" | "md";
  opacity?: number;
  rotateDeg?: number;
}

const SIZES = {
  sm: { w: 240, h: 300, initialsFontSize: 56, nameFontSize: 12 },
  md: { w: 360, h: 450, initialsFontSize: 96, nameFontSize: 14 },
} as const;

const initialsFromName = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Editorial portrait card with paper-cream framing and soft shadow.
 *
 * - When hasAsset is true and portraitKey is provided, renders the
 *   image from public/portraits/<key>.jpg with object-fit cover.
 * - Otherwise renders a typography-only placeholder (initials in
 *   serif italic + uppercase tracked name) holding the same
 *   dimensions, so a real-asset drop is a one-flag change.
 *
 * Frame styling matches the V3.2 light editorial system: paper
 * surface, cognac border, soft shadow, optional gentle tilt.
 */
export const Portrait: React.FC<Props> = ({
  name,
  role,
  portraitKey,
  hasAsset = false,
  size = "md",
  opacity = 1,
  rotateDeg = 0,
}) => {
  const dim = SIZES[size];
  const showImage = hasAsset && portraitKey;

  return (
    <div
      style={{
        width: dim.w,
        height: dim.h,
        borderRadius: 18,
        background: PITCH_THEME.light.surface.base,
        border: `1px solid ${PITCH_THEME.light.border.mid}`,
        boxShadow: PITCH_THEME.light.shadow.card,
        overflow: "hidden",
        position: "relative",
        opacity,
        transform: `rotate(${rotateDeg}deg)`,
      }}
    >
      {showImage ? (
        <Img
          src={staticFile(PORTRAIT_PATHS[portraitKey!])}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <Placeholder
          name={name}
          role={role}
          initialsFontSize={dim.initialsFontSize}
          nameFontSize={dim.nameFontSize}
        />
      )}
    </div>
  );
};

interface PlaceholderProps {
  name: string;
  role?: string;
  initialsFontSize: number;
  nameFontSize: number;
}

const Placeholder: React.FC<PlaceholderProps> = ({
  name,
  role,
  initialsFontSize,
  nameFontSize,
}) => {
  const initials = initialsFromName(name);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "24px 16px",
        background: `radial-gradient(ellipse at center, ${PITCH_THEME.light.surface.base} 0%, ${PITCH_THEME.light.bg.alt} 100%)`,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 1,
          background: PITCH_THEME.light.accent.primary,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          fontFamily: PITCH_THEME.type.serif,
          fontStyle: "italic",
          fontSize: initialsFontSize,
          fontWeight: 400,
          color: PITCH_THEME.light.accent.primary,
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {initials}
      </div>
      <div
        style={{
          fontFamily: PITCH_THEME.type.sans,
          fontSize: nameFontSize,
          fontWeight: 600,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: PITCH_THEME.light.text.secondary,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {name}
      </div>
      {role && (
        <div
          style={{
            fontFamily: PITCH_THEME.type.sans,
            fontSize: nameFontSize - 2,
            color: PITCH_THEME.light.text.muted,
            letterSpacing: 0.4,
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: "85%",
          }}
        >
          {role}
        </div>
      )}
    </div>
  );
};
