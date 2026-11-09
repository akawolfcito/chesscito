import React from "react";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  label: string;
  tone?: "cyan" | "amber" | "lightCognac";
  opacity?: number;
}

/**
 * Editorial pill badge. Uppercase, tracked, low-saturation surface.
 * Used as scene-locator (e.g. "PRE-AJEDREZ", "ACCESO INSTANTÁNEO").
 *
 * Tones:
 *  - cyan / amber: dark scenes (V3 base)
 *  - lightCognac : V3.2 light pivot
 */
export const Badge: React.FC<Props> = ({
  label,
  tone = "cyan",
  opacity = 1,
}) => {
  const styles = (() => {
    if (tone === "lightCognac") {
      return {
        bg: PITCH_THEME.light.badge.bg,
        border: PITCH_THEME.light.badge.border,
        text: PITCH_THEME.light.badge.text,
        dot: PITCH_THEME.light.accent.primary,
        dotShadow: "none",
      };
    }
    if (tone === "amber") {
      return {
        bg: PITCH_THEME.badge.bgAmber,
        border: PITCH_THEME.badge.borderAmber,
        text: PITCH_THEME.badge.textAmber,
        dot: PITCH_THEME.accent.amber,
        dotShadow: `0 0 12px ${PITCH_THEME.accent.amberGlow}`,
      };
    }
    return {
      bg: PITCH_THEME.badge.bg,
      border: PITCH_THEME.badge.border,
      text: PITCH_THEME.badge.text,
      dot: PITCH_THEME.accent.cyan,
      dotShadow: `0 0 12px ${PITCH_THEME.accent.cyanGlow}`,
    };
  })();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: `${PITCH_THEME.badge.paddingY}px ${PITCH_THEME.badge.paddingX}px`,
        borderRadius: PITCH_THEME.radius.pill,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
        fontFamily: PITCH_THEME.type.sans,
        fontSize: PITCH_THEME.badge.fontSize,
        fontWeight: 600,
        letterSpacing: PITCH_THEME.badge.letterSpacing,
        textTransform: "uppercase",
        opacity,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: PITCH_THEME.radius.pill,
          background: styles.dot,
          boxShadow: styles.dotShadow === "none" ? undefined : styles.dotShadow,
        }}
      />
      {label}
    </div>
  );
};
