import React from "react";
import { PITCH_THEME } from "../../../lib/pitch-theme";

interface Props {
  text: string;
  highlight: string;
  /** Animation progress 0..1 — gates the highlight reveal */
  highlightOpacity?: number;
  /** Optional explicit color override (used by light pivot for cognac). */
  color?: string;
  /** Soft micro-shadow toggle. Off by default in light mode usage. */
  glow?: boolean;
}

/**
 * Renders `text` (which may contain newlines) and tints the LAST
 * occurrence of `highlight` with an independent opacity reveal.
 * Whitespace and line-breaks before/after the highlight segment are
 * preserved so titles like "No necesitas más pantalla.\nNecesitas
 * mejor juego." keep their composition.
 *
 * v3.2 — accepts an explicit `color` for the light pivot. When omitted
 * falls back to the dark-system amber accent.
 */
export const HighlightWord: React.FC<Props> = ({
  text,
  highlight,
  highlightOpacity = 1,
  color,
  glow = true,
}) => {
  const idx = text.lastIndexOf(highlight);
  if (idx < 0) {
    return <>{text}</>;
  }
  const before = text.slice(0, idx);
  const after = text.slice(idx + highlight.length);
  const accentColor = color ?? PITCH_THEME.accent.amber;
  const shadowGlow = color
    ? `0 0 10px ${color}33`
    : `0 0 14px ${PITCH_THEME.accent.amberGlowSoft}`;

  return (
    <>
      {before}
      <span
        style={{
          color: accentColor,
          opacity: highlightOpacity,
          textShadow: glow ? shadowGlow : undefined,
          fontStyle: "italic",
          letterSpacing: -0.4,
        }}
      >
        {highlight}
      </span>
      {after}
    </>
  );
};
