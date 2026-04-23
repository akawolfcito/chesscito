import type { ReactNode } from "react";

/** Card dimensions — portrait 4:5, matches the Duolingo reference
 *  composition. Still unfurls on Twitter (smart-cropped to center,
 *  where the board + chip sit), WhatsApp/IG/FB render native. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const WARM_MUTED = "rgb(110, 65, 15)";
const CREAM_SHADOW = "0 2px 0 rgba(255, 245, 215, 0.85)";

export type CardShellProps = {
  /** Absolute URL to the forest bg-ch.png. Pass null to drop the forest
   *  image and render only the cream gradient (cleaner look for invite
   *  / lobby cards that don't need the hub context). */
  bgUrl: string | null;
  /** Absolute URL to the wolf mascot. */
  mascotUrl: string;
  /** Hero content occupying the 860×860 slot at the top — board render,
   *  piece art, trophy illustration, etc. */
  heroSlot?: ReactNode;
  /** Contextual chip (e.g. "Rook puzzle", "Easy · 12 moves · 1:34",
   *  "Piece Complete"). Rendered as a warm-brown pill under the brand
   *  wordmark — the single piece of content text the card carries. */
  chip?: string;
  /** Footer URL. Defaults to "chesscito.vercel.app". Set empty string
   *  to hide. */
  footer?: string;
  /** True when the Cinzel font was loaded; otherwise we fall back to serif. */
  useCinzel: boolean;
};

/**
 * CardShell — Duolingo-style branded OG card (1080×1350 portrait 4:5).
 *
 * Layout:
 *   - Top: hero slot (board / piece art / trophy) centered, big
 *   - Bottom-left: CHESSCITO wordmark + single context chip
 *   - Bottom-right: oversized wolf mascot peeking off the card edge
 *   - Optional forest bg; cream gradient always underneath
 * The shell carries minimal text so the hero content does the talking.
 * Callers pick the hero + one chip and ship.
 */
export function CardShell({
  bgUrl,
  mascotUrl,
  heroSlot,
  chip,
  footer = "chesscito.vercel.app",
  useCinzel,
}: CardShellProps) {
  const fontFamily = useCinzel ? "Cinzel" : "serif";

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        position: "relative",
        background: "#f6e6b8",
      }}
    >
      {/* Forest bg — optional, omitted on invite/lobby cards */}
      {bgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgUrl}
          alt=""
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      )}

      {/* Cream wash — over forest when present, stands alone otherwise */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: bgUrl
            ? "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,245,215,0.45) 40%, rgba(246,230,184,0.62) 100%)"
            : "linear-gradient(180deg, rgba(255,250,235,1) 0%, rgba(250,240,210,1) 55%, rgba(240,225,185,1) 100%)",
        }}
      />

      {/* Hero slot — top-center, 860×860, the board fills the upper two-thirds */}
      {heroSlot && (
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 80,
            width: 860,
            height: 860,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {heroSlot}
        </div>
      )}

      {/* Mascot — big peek bottom-right, overflows card edge */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotUrl}
        alt=""
        width={460}
        height={460}
        style={{
          position: "absolute",
          right: -30,
          bottom: -50,
          filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
        }}
      />

      {/* Brand wordmark — bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 990,
          display: "flex",
          fontSize: 46,
          fontFamily,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: WARM_MUTED,
          textShadow: CREAM_SHADOW,
        }}
      >
        CHESSCITO
      </div>

      {/* Context chip — single piece of descriptive text under the brand */}
      {chip && (
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 1070,
            display: "flex",
            alignSelf: "flex-start",
            padding: "10px 22px",
            borderRadius: 999,
            background: "rgb(120, 65, 5)",
            color: "rgb(255, 240, 180)",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.04em",
            boxShadow: "0 3px 8px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
          }}
        >
          {chip}
        </div>
      )}

      {/* Footer URL — tiny accent bottom-left under the chip */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 1150,
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            color: WARM_MUTED,
            textShadow: CREAM_SHADOW,
            opacity: 0.6,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
