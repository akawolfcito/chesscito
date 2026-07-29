"use client";

import type { CSSProperties } from "react";

/** The celebration palette, shared by every success overlay so the exercises
 *  flash and the Daily flash cannot drift apart. Warm amber on grass reads
 *  better than emerald or rose; the stroke is the darkest paper-text brown, so
 *  the glyph silhouette stays crisp on forest, paper or board backgrounds. */
export const CELEBRATION_ACCENT = "rgb(245, 158, 11)"; // amber-500
export const CELEBRATION_STROKE = "rgba(63, 34, 8, 0.95)"; // darkest paper text

/** How far the outer glyphs tilt away from vertical, in degrees. */
const MAX_TILT_DEG = 18;
/** How far the outer glyphs drop below the centre one, in em. */
const ARCH_DEPTH_EM = 0.32;

export type ArchedHeadlineProps = {
  /** The already-translated headline. Split per glyph for the arch. */
  text: string;
  /** Outline colour painted on all four corners. */
  stroke: string;
  /** Glow colour behind the glyphs. */
  accent: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Celebration headline with the circus arch the retired `welldone-sms` art
 * baked in — rebuilt as live text so it translates.
 *
 * The curve is per-glyph rotation plus a parabolic drop, not an SVG
 * `<textPath>`: the four-corner `text-shadow` outline that keeps the glyphs
 * readable on grass has no SVG equivalent, and a path would also fight the
 * font metrics every time the string length changes with the locale.
 *
 * Splitting into glyphs would make assistive tech spell the word out, so the
 * real string is rendered once as visually-hidden text and the arched glyphs
 * are decorative. That also keeps the headline findable by its text — an
 * aria-label alone would leave the string unqueryable for anything reading the
 * DOM, tests included.
 */
export function ArchedHeadline({
  text,
  stroke,
  accent,
  className,
  style,
}: ArchedHeadlineProps) {
  const glyphs = [...text];
  // A single glyph has no arch to describe, and dividing by zero would put
  // NaN in the transform.
  const half = Math.max((glyphs.length - 1) / 2, 1);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        justifyContent: "center",
        whiteSpace: "pre",
        // Lilita One only ships one weight; asking for 700 would make the
        // browser synthesise a fake bold on top of an already-heavy face.
        fontFamily: "var(--font-game-celebration)",
        fontWeight: 400,
        lineHeight: 1,
        color: "#fff6df",
        textShadow: `-2px -2px 0 ${stroke}, 2px -2px 0 ${stroke}, -2px 2px 0 ${stroke}, 2px 2px 0 ${stroke}, 0 0 12px ${accent}, 0 6px 14px rgba(120, 65, 5, 0.45)`,
        ...style,
      }}
    >
      <span className="sr-only">{text}</span>
      {glyphs.map((glyph, index) => {
        const offset = (index - (glyphs.length - 1) / 2) / half;
        return (
          <span
            key={`${glyph}-${index}`}
            aria-hidden="true"
            style={{
              display: "inline-block",
              transformOrigin: "center bottom",
              transform: `translateY(${(offset * offset * ARCH_DEPTH_EM).toFixed(4)}em) rotate(${(offset * MAX_TILT_DEG).toFixed(2)}deg)`,
            }}
          >
            {glyph}
          </span>
        );
      })}
    </span>
  );
}
