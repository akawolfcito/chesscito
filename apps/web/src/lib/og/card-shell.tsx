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

      {/* Mascot — smaller peek bottom-right so the brand cluster
          breathes and the silhouette is fully visible. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotUrl}
        alt=""
        width={300}
        height={300}
        style={{
          position: "absolute",
          right: 30,
          bottom: 30,
          filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
        }}
      />

      {/* Brand wordmark — centered horizontally, sits above the chip
          cluster. Centered-cluster reads as the "card signature"
          rather than a left-aligned footer. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1000,
          display: "flex",
          justifyContent: "center",
          fontSize: 56,
          fontFamily,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: WARM_MUTED,
          textShadow: CREAM_SHADOW,
        }}
      >
        CHESSCITO
      </div>

      {/* Context chip — candy-paper styled, centered. Cream fill +
          warm-brown text + amber border so it reads as part of the
          same family as the in-app candy chips, not a chocolate
          sticker pasted on. */}
      {chip && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1085,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "12px 28px",
              borderRadius: 999,
              background: "rgba(255, 245, 215, 0.85)",
              color: "rgba(63, 34, 8, 0.95)",
              border: "2px solid rgba(245, 158, 11, 0.55)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.04em",
              boxShadow:
                "0 3px 8px rgba(120, 65, 5, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
              textShadow: CREAM_SHADOW,
            }}
          >
            {chip}
          </div>
        </div>
      )}

      {/* Footer URL — subtle, centered, below the chip. Kept tiny so
          it reads as ownership signature, not a placeholder. */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1180,
            display: "flex",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 600,
            color: WARM_MUTED,
            textShadow: CREAM_SHADOW,
            opacity: 0.55,
            letterSpacing: "0.05em",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
