import React from "react";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  label: string;
  index?: number;
  opacity?: number;
  translateY?: number;
  variant?: "row" | "stack";
  /** "dark" (default) — V3 navy. "light" — V3.2 paper editorial. */
  tone?: "dark" | "light";
}

/**
 * Premium mini-card used to break titles into 2-3 value chunks.
 * Variants:
 *  - "row"   : horizontal pill with leading rune dot.
 *  - "stack" : square-ish block with index numeral.
 *
 * Tones:
 *  - "dark"  : V3 navy palette.
 *  - "light" : V3.2 paper editorial — surface.base + soft shadow,
 *              ink-warm text, cognac dot/numeral.
 */
export const ValueCard: React.FC<Props> = ({
  label,
  index,
  opacity = 1,
  translateY = 0,
  variant = "row",
  tone = "dark",
}) => {
  const isLight = tone === "light";

  if (variant === "stack") {
    const numeral =
      typeof index === "number" ? String(index + 1).padStart(2, "0") : null;
    return (
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 22px",
          background: isLight
            ? PITCH_THEME.light.surface.base
            : PITCH_THEME.card.surface,
          border: `1px solid ${
            isLight ? PITCH_THEME.light.border.soft : PITCH_THEME.card.border
          }`,
          borderRadius: PITCH_THEME.radius.cardSm,
          boxShadow: isLight
            ? PITCH_THEME.light.shadow.soft
            : PITCH_THEME.card.shadow,
          minWidth: 280,
        }}
      >
        {numeral && (
          <span
            style={{
              fontFamily: PITCH_THEME.type.mono,
              fontSize: 16,
              color: isLight
                ? PITCH_THEME.light.accent.primary
                : PITCH_THEME.accent.amber,
              letterSpacing: 1.4,
              opacity: isLight ? 1 : 0.85,
              fontWeight: 600,
            }}
          >
            {numeral}
          </span>
        )}
        <span
          style={{
            fontFamily: PITCH_THEME.type.sans,
            fontSize: 21,
            color: isLight
              ? PITCH_THEME.light.text.primary
              : PITCH_THEME.text.primary,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 20px",
        background: isLight
          ? PITCH_THEME.light.surface.base
          : PITCH_THEME.card.surface,
        border: `1px solid ${
          isLight ? PITCH_THEME.light.border.soft : PITCH_THEME.card.border
        }`,
        borderRadius: PITCH_THEME.radius.pill,
        boxShadow: isLight
          ? PITCH_THEME.light.shadow.soft
          : PITCH_THEME.card.shadow,
        fontFamily: PITCH_THEME.type.sans,
        fontSize: 18,
        fontWeight: 600,
        color: isLight
          ? PITCH_THEME.light.text.primary
          : PITCH_THEME.text.primary,
        letterSpacing: 0.2,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: PITCH_THEME.radius.pill,
          background: isLight
            ? PITCH_THEME.light.accent.primary
            : PITCH_THEME.accent.cyan,
          boxShadow: isLight
            ? undefined
            : `0 0 14px ${PITCH_THEME.accent.cyanGlow}`,
        }}
      />
      {label}
    </div>
  );
};
