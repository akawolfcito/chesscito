import type { ReactNode } from "react";

const W = 1200;
const H = 630;

const WARM_MUTED = "rgb(110, 65, 15)";
const CREAM_SHADOW = "0 2px 0 rgba(255, 245, 215, 0.85)";

export type CardShellProps = {
  /** Absolute URL to the forest bg-ch.png. Pass null to drop the forest
   *  image and render only the cream gradient (cleaner look for invite
   *  / lobby cards that don't need the hub context). */
  bgUrl: string | null;
  /** Absolute URL to the wolf mascot. */
  mascotUrl: string;
  /** Hero content occupying the 440×440 slot on the left — board render,
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
 * CardShell v2 — Duolingo-style branded OG card (1200×630).
 *
 * Layout:
 *   - Left: hero slot (board / piece art / trophy) at the visual center
 *   - Right: oversized wolf mascot peek
 *   - Bottom-left: CHESSCITO wordmark + single context chip + url
 *   - Optional forest bg; cream gradient always underneath
 * The shell deliberately carries minimal text so the hero content does
 * the talking. Callers pick the hero + one chip and ship.
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
        width: W,
        height: H,
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
          width={W}
          height={H}
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

      {/* Hero slot — left, 440×440 */}
      {heroSlot && (
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 60,
            width: 440,
            height: 440,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {heroSlot}
        </div>
      )}

      {/* Mascot — big peek bottom-right */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotUrl}
        alt=""
        width={360}
        height={360}
        style={{
          position: "absolute",
          right: -20,
          bottom: -30,
          filter: "drop-shadow(0 8px 16px rgba(120, 65, 5, 0.35))",
        }}
      />

      {/* Brand wordmark — bottom-left, above the chip */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 520,
          display: "flex",
          fontSize: 28,
          fontFamily,
          fontWeight: 700,
          letterSpacing: "0.28em",
          color: WARM_MUTED,
          textShadow: CREAM_SHADOW,
        }}
      >
        CHESSCITO
      </div>

      {/* Context chip — single piece of descriptive text */}
      {chip && (
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 562,
            display: "flex",
            alignSelf: "flex-start",
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgb(120, 65, 5)",
            color: "rgb(255, 240, 180)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.04em",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
          }}
        >
          {chip}
        </div>
      )}

      {/* Footer URL */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 612,
            display: "flex",
            fontSize: 14,
            fontWeight: 600,
            color: WARM_MUTED,
            textShadow: CREAM_SHADOW,
            opacity: 0.7,
          }}
        >
          {footer}
        </div>
      )}

    </div>
  );
}
