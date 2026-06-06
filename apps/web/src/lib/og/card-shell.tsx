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
  /** Optional absolute URL to a panel asset (e.g. panel-mision-icon.png)
   *  that REPLACES the cream gradient as the card surface. When provided,
   *  the cream wash is skipped and the asset is stretched to fill the
   *  full 1080×1350 card. Used by share cards that want the cream wood +
   *  grass border baked into the asset instead of the flat gradient. */
  panelBgUrl?: string;
  /** Absolute URL to the wolf mascot. */
  mascotUrl: string;
  /** Hero content occupying the 860×860 slot at the top — board render,
   *  piece art, trophy illustration, etc. */
  heroSlot?: ReactNode;
  /** Contextual chip (e.g. "Rook puzzle", "Easy · 12 moves · 1:34",
   *  "Piece Complete"). Rendered as a warm-brown pill under the brand
   *  wordmark — the single piece of content text the card carries. */
  chip?: string;
  /** Footer URL. Defaults to "chesscito.com". Set empty string
   *  to hide. */
  footer?: string;
  /** True when the Cinzel font was loaded; otherwise we fall back to serif. */
  useCinzel: boolean;
  /** Drops the centered "CHESSCITO" wordmark + chip cluster, freeing
   *  the lower band for the heroSlot's own content (tagline, score
   *  pill, etc.). Footer stays as the subtle brand signature. Used by
   *  the exercise share card where the wordmark was dominating the
   *  composition and competing with the achievement headline. */
  hideWordmark?: boolean;
  /** Mascot crop mode. "circle" (default) renders the avatar as a
   *  circular peek — the original wolf treatment. "half-body" anchors
   *  a full-body avatar in the lower-right of the card (top edge at
   *  y ≈ 950 so the character peeks up from below the achievement
   *  cluster) — the in-app avatar pattern used by popups and the Hub.
   *  "none" skips the shell mascot entirely — used by cards that
   *  embed an avatar inside their own heroSlot composition (e.g. the
   *  victory share card mirrors the in-app coach-section avatar). */
  mascotMode?: "circle" | "half-body" | "none";
  /** Multiplier applied to the half-body avatar's natural size
   *  (default 1.0 → width 560 / height 680). Lower values (e.g. 0.65)
   *  let the hero composition dominate when the avatar is supporting
   *  cast rather than the main subject. Ignored for "circle". */
  mascotScale?: number;
  /** Drops a warm-cream wash on top of the panel asset so the baked-in
   *  green leaf-frame reads as a softer sage tone instead of saturated
   *  grass. Used by achievement cards where the heavy frame was
   *  competing with the celebration content. */
  softenPanel?: boolean;
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
  panelBgUrl,
  mascotUrl,
  heroSlot,
  chip,
  footer = "chesscito.com",
  useCinzel,
  hideWordmark = false,
  mascotMode = "circle",
  mascotScale = 1,
  softenPanel = false,
}: CardShellProps) {
  const fontFamily = useCinzel ? "Cinzel" : "serif";

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        position: "relative",
        /* Background fallback. Grass green when a panel asset is
           provided (fills the asset's transparent corners with a
           colour that blends into its baked grass border). Softened
           sage when softenPanel is on, so the fallback colour around
           the leaf-frame corners matches the muted-green tone of the
           cream wash. */
        background: panelBgUrl
          ? softenPanel
            ? "#7da856"
            : "#5fa329"
          : "linear-gradient(180deg, rgb(255, 248, 220) 0%, rgb(248, 231, 184) 60%, rgb(243, 220, 162) 100%)",
      }}
    >
      {/* Panel bg — when provided, replaces the cream gradient entirely
          with a baked-in cream-wood + grass-border asset. Stretched to
          fill the full 1080×1350 card. When softenPanel is on, the
          asset is scaled 10% and re-centered so the outer green frame
          falls outside the visible card bounds — only the inner cream
          and grass-decoration band reads. */}
      {panelBgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={panelBgUrl}
          alt=""
          width={softenPanel ? Math.round(CARD_WIDTH * 1.1) : CARD_WIDTH}
          height={softenPanel ? Math.round(CARD_HEIGHT * 1.1) : CARD_HEIGHT}
          style={{
            position: "absolute",
            top: softenPanel ? Math.round(-CARD_HEIGHT * 0.05) : 0,
            left: softenPanel ? Math.round(-CARD_WIDTH * 0.05) : 0,
          }}
        />
      )}

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

      {/* Cream wash — overlay applied ONLY over the forest bgUrl to soften
          the trees enough for warm-brown text to read on top. Skipped when
          panelBgUrl is provided (the asset already carries its own cream
          surface) or when no bg is provided at all. */}
      {bgUrl && !panelBgUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,245,215,0.45) 40%, rgba(246,230,184,0.62) 100%)",
          }}
        />
      )}

      {/* Soften wash — overlay applied on top of the panel asset to mute
          the baked-in green leaf-frame to a softer sage. Cream interior
          is barely affected (already low saturation); the saturated green
          border drops a couple steps. */}
      {panelBgUrl && softenPanel && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(255, 245, 200, 0.32) 0%, rgba(245, 230, 175, 0.32) 100%)",
          }}
        />
      )}

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

      {/* Mascot — bottom-right peek. "circle" renders as a circular
          avatar (legacy wolf treatment). "half-body" anchors a wider
          frame at the same corner and clips the bottom half so only
          head + torso show — the in-app avatar pattern. */}
      {mascotMode === "none" ? null : mascotMode === "half-body" ? (
        // Full-body avatar peek anchored from the top so the character
        // rises up from below the achievement cluster. Natural aspect
        // (avatar PNG is 1012x1228 ≈ 0.82). Sized so feet stay inside
        // the cream area (panel-mision-icon's bottom leaf-frame starts
        // around y=1300, so bottom must be ≤ 1290).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mascotUrl}
          alt=""
          width={Math.round(560 * mascotScale)}
          height={Math.round(680 * mascotScale)}
          style={{
            position: "absolute",
            right: Math.round(-100 * mascotScale),
            top: Math.round(800 + (1 - mascotScale) * 240),
            filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mascotUrl}
          alt=""
          width={300}
          height={300}
          style={{
            position: "absolute",
            right: 30,
            bottom: 30,
            borderRadius: 999,
            filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
          }}
        />
      )}

      {/* Brand wordmark — centered horizontally, sits above the chip
          cluster. Centered-cluster reads as the "card signature"
          rather than a left-aligned footer. Hidden when the route
          opts out (hideWordmark) so the heroSlot owns the lower band. */}
      {!hideWordmark && (
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
      )}

      {/* Context chip — styled as a secondary CTA button (solid cream
          fill, taller padding, layered shadow with amber under-glow)
          so it reads as a tappable invitation rather than a passive
          label. Matches the in-app `.arena-result-secondary-action`
          register used by Continue / Dismiss CTAs. */}
      {chip && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1070,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "20px 44px",
              borderRadius: 999,
              background: "rgb(255, 245, 215)",
              color: "rgba(63, 34, 8, 0.95)",
              border: "2px solid rgba(220, 165, 50, 0.75)",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "0.04em",
              boxShadow:
                "0 5px 0 rgba(200, 145, 35, 0.55), 0 10px 18px rgba(120, 65, 5, 0.30), inset 0 2px 0 rgba(255, 255, 255, 0.80)",
              textShadow: CREAM_SHADOW,
            }}
          >
            {chip}
          </div>
        </div>
      )}

      {/* Footer URL — subtle ownership signature. Centered when the
          CHESSCITO wordmark sits above it (the natural caption to the
          brand cluster); shifted left-aligned when the wordmark is
          hidden AND a half-body avatar dominates the bottom-right
          corner (so the avatar's outstretched paw doesn't collide
          with the centered text). */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            top: 1180,
            display: "flex",
            justifyContent:
              hideWordmark && mascotMode === "half-body"
                ? "flex-start"
                : "center",
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
