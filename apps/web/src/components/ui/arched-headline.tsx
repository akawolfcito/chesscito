"use client";

import type { CSSProperties } from "react";

/** The celebration palette, shared by every success overlay so the exercises
 *  flash and the Daily flash cannot drift apart. The gold is the thick outline
 *  around the cream fill; the brown is the dark edge outside the gold, so the
 *  word keeps its silhouette on forest, paper or board backgrounds. */
export const CELEBRATION_ACCENT = "rgb(245, 190, 60)"; // warm sign gold
export const CELEBRATION_STROKE = "rgba(63, 34, 8, 0.95)"; // darkest paper text

/** Half the arc the whole word spans. */
const HALF_SPAN_DEG = 19;
/** Rough horizontal advance per glyph, in em. Only sets the arc's radius —
 *  the shape stays circular whatever the real metrics turn out to be. */
const GLYPH_ADVANCE_EM = 0.62;
/** Thickness of the gold outline, relative to the font size. Only half of a
 *  centred text-stroke shows outside the glyph, so the visible band is half
 *  this — which is what the dark ring below has to clear. */
const OUTLINE_EM = 0.26;

export type ArchedHeadlineProps = {
  /** The already-translated headline. Split per glyph for the arch. */
  text: string;
  /** Dark edge painted outside the outline. */
  stroke: string;
  /** Thick outline colour hugging the letters. */
  accent: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Celebration headline with the circus arch the retired `welldone-sms` art
 * baked in — rebuilt as live text so it translates.
 *
 * The arc is a REAL circle, derived rather than dialled in. Rotating each
 * glyph linearly while dropping it on a separate parabola let the two curves
 * disagree, and the word read as a tent with a kink at each shoulder. Here one
 * parameter — the half-span angle — fixes everything: the glyphs sit at equal
 * arc-length steps along one circle, so the radius follows from the string
 * length and both the tilt and the drop come out of the same geometry.
 *
 * Not an SVG `<textPath>`: the layered outline that keeps the glyphs readable
 * on grass has no clean SVG equivalent, and a path would fight the font
 * metrics every time the string length changes with the locale.
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
  const halfSpanRad = (HALF_SPAN_DEG * Math.PI) / 180;
  // Equal arc-length spacing: adjacent glyphs are one advance apart along the
  // arc, which fixes the radius. A one-glyph string has no arc — guard the
  // division rather than emit NaN into the transform.
  const steps = Math.max(glyphs.length - 1, 1);
  const radiusEm = (GLYPH_ADVANCE_EM * steps) / (2 * halfSpanRad);

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
        // The sign look: cream fill, a thick matte gold outline hugging it, a
        // dark edge outside that, and one soft drop shadow. `paint-order` is
        // what makes it work — without it the stroke paints OVER the fill and
        // swallows the letters, since -webkit-text-stroke is centred on the
        // glyph outline rather than sitting outside it.
        WebkitTextStrokeWidth: `${OUTLINE_EM}em`,
        WebkitTextStrokeColor: accent,
        paintOrder: "stroke fill",
        // The dark edge rings the GOLD, not the letters: in Blink the shadow
        // silhouette already includes the stroke, so these offsets must clear
        // the visible half of it (OUTLINE_EM / 2) or the ring paints over the
        // gold and the whole band disappears. Then one solid lift and one soft
        // shadow underneath.
        textShadow: [
          `-2px 0 0 ${stroke}`,
          `2px 0 0 ${stroke}`,
          `0 -2px 0 ${stroke}`,
          `0 2px 0 ${stroke}`,
          `-1.5px -1.5px 0 ${stroke}`,
          `1.5px -1.5px 0 ${stroke}`,
          `-1.5px 1.5px 0 ${stroke}`,
          `1.5px 1.5px 0 ${stroke}`,
          "0 7px 0 rgba(140, 84, 10, 0.8)",
          "0 10px 16px rgba(70, 36, 4, 0.5)",
        ].join(", "),
        ...style,
      }}
    >
      <span className="sr-only">{text}</span>
      {glyphs.map((glyph, index) => {
        // −1 … +1 across the word.
        const t = glyphs.length === 1 ? 0 : (index - steps / 2) / (steps / 2);
        const angleRad = t * halfSpanRad;
        // Circular drop: the apex is the middle glyph, every other one falls
        // by the circle's sagitta at its own angle.
        const dropEm = radiusEm * (1 - Math.cos(angleRad));
        return (
          <span
            key={`${glyph}-${index}`}
            aria-hidden="true"
            style={{
              display: "inline-block",
              transformOrigin: "center bottom",
              transform: `translateY(${dropEm.toFixed(4)}em) rotate(${((angleRad * 180) / Math.PI).toFixed(2)}deg)`,
            }}
          >
            {glyph}
          </span>
        );
      })}
    </span>
  );
}
