import type { ReactNode } from "react";

const W = 1200;
const H = 630;

const WARM_TEXT = "rgb(63, 34, 8)";
const WARM_MUTED = "rgb(110, 65, 15)";
const CREAM_SHADOW = "0 2px 0 rgba(255, 245, 215, 0.85)";

const DIFFICULTY_STYLE: Record<string, { bg: string; fg: string }> = {
  EASY: { bg: "rgb(16, 185, 129)", fg: "rgb(236, 253, 245)" },
  MEDIUM: { bg: "rgb(245, 158, 11)", fg: "rgb(63, 34, 8)" },
  HARD: { bg: "rgb(244, 63, 94)", fg: "rgb(255, 241, 242)" },
};

export type CardShellProps = {
  /** Absolute URL to the forest bg-ch.png. */
  bgUrl: string;
  /** Absolute URL to the wolf mascot. */
  mascotUrl: string;
  /** Main headline (e.g. "CHECKMATE!"). */
  title: string;
  /** Subtitle or performance line (e.g. "12 moves · 1:34"). Hidden if falsy. */
  subtitle?: string;
  /** Difficulty chip copy (EASY / MEDIUM / HARD) — colored by tier. */
  difficulty?: string;
  /** Right-side slot — typically the board render. */
  rightSlot?: ReactNode;
  /** Footer text, e.g. "chesscito.vercel.app · Victory #42 · by 0xABC…123". */
  footer?: string;
  /** True when the Cinzel font was loaded; otherwise we fall back to serif. */
  useCinzel: boolean;
};

/**
 * CardShell — candy-light branded OG card (1200×630).
 *
 * Layout:
 *   - Full-bleed forest bg-ch + cream gradient wash (matches in-app sheets)
 *   - Left column: fantasy-title headline, subtitle, difficulty chip, footer
 *   - Right slot: optional board render (or trophy / badge art)
 *   - Wolf mascot peeks from the bottom-right so every card carries brand
 */
export function CardShell({
  bgUrl,
  mascotUrl,
  title,
  subtitle,
  difficulty,
  rightSlot,
  footer,
  useCinzel,
}: CardShellProps) {
  const fontFamily = useCinzel ? "Cinzel" : "serif";
  const diffStyle = difficulty ? DIFFICULTY_STYLE[difficulty] ?? DIFFICULTY_STYLE.MEDIUM : null;

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
      {/* Forest bg */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgUrl}
        alt=""
        width={W}
        height={H}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      {/* Cream wash — matches in-app sheet-bg-hub::after gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,245,215,0.45) 40%, rgba(246,230,184,0.62) 100%)",
        }}
      />

      {/* Wolf mascot — bottom-right peek */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotUrl}
        alt=""
        width={220}
        height={220}
        style={{
          position: "absolute",
          right: 56,
          bottom: 28,
          filter: "drop-shadow(0 8px 12px rgba(120, 65, 5, 0.35))",
        }}
      />

      {/* Right content slot (board / art) */}
      {rightSlot && (
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 84,
            display: "flex",
          }}
        >
          {rightSlot}
        </div>
      )}

      {/* Left content column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 80,
          top: 100,
          width: 620,
          gap: 18,
        }}
      >
        {/* Brand tag */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.24em",
            color: WARM_MUTED,
            textShadow: CREAM_SHADOW,
          }}
        >
          CHESSCITO
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontFamily,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: WARM_TEXT,
            textShadow: CREAM_SHADOW,
            lineHeight: 1,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 600,
              color: WARM_MUTED,
              textShadow: CREAM_SHADOW,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Difficulty chip */}
        {difficulty && diffStyle && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: 999,
              background: diffStyle.bg,
              color: diffStyle.fg,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.16em",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
            }}
          >
            {difficulty}
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 48,
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            color: WARM_MUTED,
            textShadow: CREAM_SHADOW,
            opacity: 0.8,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
