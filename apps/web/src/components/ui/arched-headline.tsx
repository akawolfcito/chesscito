"use client";

import { useId } from "react";
import type { CSSProperties } from "react";

/** The celebration palette, shared by every success overlay so the exercises
 *  flash and the Daily flash cannot drift apart. The gold is the outer band of
 *  the sign edge; the brown is the hard shadow the whole sign casts, so the
 *  word keeps its silhouette on forest, paper or board backgrounds. */
export const CELEBRATION_ACCENT = "rgb(245, 190, 60)"; // warm sign gold
export const CELEBRATION_STROKE = "rgba(63, 34, 8, 0.95)"; // darkest paper text
/** Inner keyline between the cream fill and the gold. Dark red rather than
 *  brown: it is the only cool-ish note in the stack, which is what stops the
 *  cream, the gold and the extrusion from melting into one warm mass. */
export const CELEBRATION_INNER = "rgb(140, 26, 24)";
/** The lit face of the extrusion under the sign — gold's own shadow tone. */
export const CELEBRATION_EXTRUDE = "rgb(214, 106, 26)";

/** Half the arc the whole word spans. */
const HALF_SPAN_DEG = 19;
/** Rough horizontal advance per glyph, in em. This ONLY sizes the box and
 *  picks the radius — where each glyph actually lands is the browser's job
 *  (see below), so a bad estimate shifts the layout box a little and never
 *  breaks the word. */
const GLYPH_ADVANCE_EM = 0.62;
/** Extra tracking, in em. A centred stroke this thick eats half its width out
 *  of each side bearing, so at the font's natural spacing the gold outlines of
 *  neighbouring letters merge into one blob. */
const TRACKING_EM = 0.08;
/* ── The sign edge, painted back to front ─────────────────────────────────
 * Every layer is the same word stroked at a different width, so a band's
 * visible thickness is HALF the gap to the width under it. Widths, not
 * offsets, are what make the bands concentric — the two offset layers below
 * are the only ones that move. */
/** Gold: the outer band. Centred on the glyph outline, so half shows outside. */
const OUTLINE_EM = 0.26;
/** Dark red keyline, inside the gold. Narrower than the gold by design: the
 *  gold reads as the sign and the red as the line drawn on it. */
const INNER_EM = 0.12;
/** How far the hard shadow's silhouette out-grows the gold, giving the sign a
 *  thin dark rim on every side instead of only under the extrusion. */
const RIM_EM = 0.02;
/** Drop of the extrusion — the depth of the sign itself. */
const EXTRUDE_DY_EM = 0.08;
/** Drop of the hard shadow. Reads as the distance from the sign to whatever it
 *  hangs over, so it has to clearly outrun the extrusion. */
const SHADOW_DY_EM = 0.17;

/* ── viewBox geometry ──────────────────────────────────────────────────────
 * The SVG is authored at font-size 100 and then sized in `em`, so the caller
 * still controls the scale with plain `font-size` and every constant here can
 * be read as hundredths of an em. */
const UNIT = 100;
/** Baseline of the apex glyph: leaves room for the ascender plus both strokes. */
const APEX_Y = 118;
/** Room under the lowest baseline for descenders, the strokes, and the two
 *  offset layers — the hard shadow is the deepest thing in the box. */
const FOOT_PAD = 62;
/** Slack on each side, so the box holds the word even when the per-glyph
 *  estimate above runs short. */
const SIDE_PAD = 160;
/** How much of the circle the path covers. Only the middle of it gets used —
 *  the text is centred on the path — but it must comfortably outrun the
 *  longest locale string or the tail glyphs would fall off the end. */
const PATH_HALF_DEG = 55;

export type ArchedHeadlineProps = {
  /** The already-translated headline. */
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
 * The arch is an SVG `<textPath>` on a real circular arc, and that choice is
 * the whole point. The first build laid the glyphs out in a flex row and gave
 * each one `translateY` + `rotate` about its own bottom edge. Two things went
 * wrong and both were structural:
 *
 *  - Rotating a glyph about its own foot swings its TOP sideways by about
 *    `height · sin θ` — a third of an em at the shoulders — so the tall
 *    letters piled into their neighbours (founder, 2026-07-29: "se ven
 *    montados").
 *  - The angle came from the glyph's INDEX while its x came from its real
 *    advance width. A `W` and an `l` got the same angular step and different
 *    horizontal ones, so the curve kinked at every width change and the word
 *    read as a tent rather than an arch ("más triangular que redondo").
 *
 * `textPath` fixes both by construction: the browser walks the real font
 * metrics along the arc, so position and tilt come from the same measurement
 * and always agree. No JS measuring pass, no layout effect, correct on the
 * server's first paint.
 *
 * The two-tone sign edge is two `<use>` clones of ONE `<text>` living in
 * `<defs>` — a wide dark stroke under a narrower gold one. Cloning rather than
 * repeating the markup keeps a single copy of the string in the DOM, so text
 * queries stay unambiguous; the clones are hidden from assistive tech and the
 * `<svg>` carries the label instead.
 */
export function ArchedHeadline({
  text,
  stroke,
  accent,
  className,
  style,
}: ArchedHeadlineProps) {
  // `useId` is stable across server and client, and the colons it emits are
  // not safe inside a URL fragment reference.
  const uid = useId().replace(/:/g, "");
  const pathId = `arch-path-${uid}`;
  const textId = `arch-text-${uid}`;

  const steps = Math.max([...text].length - 1, 1);
  const halfSpanRad = (HALF_SPAN_DEG * Math.PI) / 180;
  // Estimated word width fixes the radius, which is what keeps the arch the
  // same shape whatever the locale writes: a longer word gets a bigger circle
  // rather than a deeper curve.
  const estWidth = (GLYPH_ADVANCE_EM + TRACKING_EM) * UNIT * steps;
  const radius = estWidth / (2 * halfSpanRad);
  // Sagitta at the ends of the span: how far below the apex baseline the last
  // glyph sits, and therefore how much taller than one line the box is.
  const drop = radius * (1 - Math.cos(halfSpanRad));

  const boxWidth = estWidth + 2 * SIDE_PAD;
  const boxHeight = APEX_Y + drop + FOOT_PAD;
  const centreX = boxWidth / 2;
  const centreY = APEX_Y + radius;

  const pathHalfRad = (PATH_HALF_DEG * Math.PI) / 180;
  const armX = radius * Math.sin(pathHalfRad);
  const armY = radius * Math.cos(pathHalfRad);
  const arc = [
    `M ${(centreX - armX).toFixed(2)} ${(centreY - armY).toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1`,
    `${(centreX + armX).toFixed(2)} ${(centreY - armY).toFixed(2)}`,
  ].join(" ");

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        lineHeight: 0,
        // No CSS filter here on purpose: every blurred shadow this headline
        // ever carried read as a muddy brown glow around the word (founder,
        // 2026-07-29). The depth is painted instead — a hard-edged extrusion
        // and a hard shadow, both real layers below.
        ...style,
      }}
    >
      <svg
        role="img"
        aria-label={text}
        viewBox={`0 0 ${boxWidth.toFixed(2)} ${boxHeight.toFixed(2)}`}
        style={{
          display: "block",
          width: `${(boxWidth / UNIT).toFixed(4)}em`,
          height: `${(boxHeight / UNIT).toFixed(4)}em`,
          // The box is sized off an estimate; never let a long word be clipped
          // by it. Overflow here is invisible — the art has no edges.
          overflow: "visible",
        }}
      >
        <defs>
          <path id={pathId} fill="none" d={arc} />
          <text
            id={textId}
            fontSize={UNIT}
            letterSpacing={TRACKING_EM * UNIT}
            textAnchor="middle"
            style={{
              // A custom property cannot ride in an SVG presentation
              // attribute, so the font has to come through `style`.
              // Lilita One only ships one weight; asking for 700 would make
              // the browser synthesise a fake bold on an already-heavy face.
              fontFamily: "var(--font-game-celebration)",
              fontWeight: 400,
            }}
          >
            <textPath href={`#${pathId}`} startOffset="50%">
              {text}
            </textPath>
          </text>
        </defs>
        {/* Back to front: hard shadow → orange extrusion → gold → dark red
            keyline → cream. Each layer fills as well as strokes, so it is a
            solid slug the next one sits on rather than a hollow outline, and
            `paint-order` keeps the stroke behind that fill — without it the
            stroke paints OVER it, since a text stroke is centred on the glyph
            outline rather than sitting outside it. */}
        <use
          aria-hidden="true"
          href={`#${textId}`}
          y={SHADOW_DY_EM * UNIT}
          fill={stroke}
          stroke={stroke}
          strokeWidth={(OUTLINE_EM + 2 * RIM_EM) * UNIT}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke fill" }}
        />
        <use
          aria-hidden="true"
          href={`#${textId}`}
          y={EXTRUDE_DY_EM * UNIT}
          fill={CELEBRATION_EXTRUDE}
          stroke={CELEBRATION_EXTRUDE}
          strokeWidth={OUTLINE_EM * UNIT}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke fill" }}
        />
        <use
          aria-hidden="true"
          href={`#${textId}`}
          fill={accent}
          stroke={accent}
          strokeWidth={OUTLINE_EM * UNIT}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke fill" }}
        />
        <use
          aria-hidden="true"
          href={`#${textId}`}
          fill={CELEBRATION_INNER}
          stroke={CELEBRATION_INNER}
          strokeWidth={INNER_EM * UNIT}
          strokeLinejoin="round"
          style={{ paintOrder: "stroke fill" }}
        />
        <use aria-hidden="true" href={`#${textId}`} fill="#fff6df" />
      </svg>
    </span>
  );
}
