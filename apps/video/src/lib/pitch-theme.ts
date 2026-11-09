/**
 * Design tokens for the Chesscito pitch video.
 * Mirrors landing-page accent palette but tuned for both 1080×1920
 * vertical (MiniPay/social) and 1920×1080 horizontal (deck).
 *
 * v3 (2026-04-27) — premium hybrid pass: extended with grid/noise
 * surfaces, card primitives, badge style, phone halo + deep shadow,
 * motion presets. Existing tokens preserved for backwards compat.
 */

import { useVideoConfig } from "remotion";

/** Returns true when the active composition is landscape (deck preset). */
export const useIsLandscape = (): boolean => {
  const { width, height } = useVideoConfig();
  return width > height;
};

export const PITCH_THEME = {
  bg: {
    base: "#0a0f1a",
    gradient: "linear-gradient(180deg, #0a0f1a 0%, #14253d 100%)",
    /**
     * v3.1 — richer multi-stop. Adds a warm bottom undertone (cognac
     * shadow) for cinematic depth without raising glow saturation.
     */
    gradientRich:
      "radial-gradient(ellipse at 28% 4%, rgba(0, 188, 212, 0.08) 0%, rgba(0, 188, 212, 0) 55%), radial-gradient(ellipse at 78% 96%, rgba(154, 110, 60, 0.10) 0%, rgba(154, 110, 60, 0) 60%), linear-gradient(180deg, #08101c 0%, #0d1a2c 45%, #122236 100%)",
    /** v3 — paper warm with cream gradient */
    paperWarm:
      "radial-gradient(ellipse at 40% 30%, #fbf8f0 0%, #f3ecdb 55%, #ece2c8 100%)",
    paper: "#f7f4ec",
  },
  text: {
    primary: "#f4f9fb",
    primaryWarm: "#fbecd2",
    muted: "rgba(244, 249, 251, 0.65)",
    faint: "rgba(244, 249, 251, 0.40)",
    onPaper: "#1f2024",
    onPaperMuted: "rgba(31, 32, 36, 0.65)",
  },
  accent: {
    cyan: "#00bcd4",
    cyanGlow: "rgba(0, 188, 212, 0.32)",
    cyanGlowSoft: "rgba(0, 188, 212, 0.14)",
    /**
     * v3.1 — warmer, less saturated amber. Reads as cognac/honey
     * instead of caution-yellow. Used as emotional anchor.
     */
    amber: "#e6b252",
    amberWarm: "#d99e3a",
    amberDeep: "#b97f2c",
    amberGlow: "rgba(230, 178, 82, 0.30)",
    amberGlowSoft: "rgba(230, 178, 82, 0.12)",
    green: "#34d399",
  },
  type: {
    serif: "'Cormorant Garamond', 'Times New Roman', serif",
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  },
  size: {
    hero: 96,
    title: 72,
    subtitle: 36,
    body: 28,
    caption: 22,
    micro: 16,
    disclaimer: 18,
  },
  space: {
    side: 96,
    sectionGap: 48,
    blockGap: 24,
  },
  radius: {
    card: 28,
    cardSm: 18,
    pill: 999,
  },

  /* ─────────── v3 surfaces ─────────── */

  /** SVG-encoded subtle grid for premium product backgrounds. */
  grid: {
    cellPx: 64,
    strokeRgba: "rgba(255, 255, 255, 0.045)",
  },

  card: {
    surface: "rgba(255, 255, 255, 0.04)",
    surfaceHi: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.08)",
    borderHi: "rgba(255, 255, 255, 0.14)",
    shadow:
      "0 24px 48px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255, 255, 255, 0.06) inset",
  },

  badge: {
    bg: "rgba(0, 188, 212, 0.08)",
    border: "rgba(0, 188, 212, 0.32)",
    text: "#9ce0eb",
    bgAmber: "rgba(230, 178, 82, 0.10)",
    borderAmber: "rgba(230, 178, 82, 0.42)",
    textAmber: "#ecc77f",
    letterSpacing: 2.2,
    fontSize: 15,
    paddingY: 8,
    paddingX: 16,
  },

  phone: {
    /** v3.1 grounded shadow + softer, wider halo */
    shadowDeep:
      "0 80px 140px rgba(0, 0, 0, 0.62), 0 24px 56px rgba(0, 0, 0, 0.44), 0 0 0 8px rgba(255, 255, 255, 0.04)",
    haloCyan:
      "radial-gradient(ellipse at center, rgba(0, 188, 212, 0.20) 0%, rgba(0, 188, 212, 0.06) 35%, rgba(0, 188, 212, 0) 70%)",
    haloAmber:
      "radial-gradient(ellipse at center, rgba(230, 178, 82, 0.20) 0%, rgba(230, 178, 82, 0.06) 35%, rgba(230, 178, 82, 0) 70%)",
  },

  cta: {
    bgAmber: "linear-gradient(180deg, #ecc77f 0%, #d99e3a 100%)",
    bgAmberShadow:
      "0 22px 44px rgba(185, 127, 44, 0.30), 0 0 0 1px rgba(230, 178, 82, 0.50) inset",
    text: "#1f1608",
  },

  motion: {
    /** Common spring presets for product reveals (consume in scene springs). */
    spring: {
      soft: { damping: 14, stiffness: 90, mass: 0.7 },
      snap: { damping: 18, stiffness: 140, mass: 0.6 },
    },
    /** Frame counts (at 30fps) used as default windows. */
    frames: {
      enter: 18, // ~0.6s
      reveal: 12, // ~0.4s
      stagger: 6, // ~0.2s
    },
  },

  /* ─────────── v3.2 Light editorial warm — pilot on h02 + h04 ─────────── */

  /**
   * Parallel namespace for the light editorial pivot. Dark tokens
   * above remain valid for B-Cut and any kept-dark scenes. h02/h04
   * read exclusively from `light.*` for the pilot.
   */
  light: {
    bg: {
      base: "#F5F1E8",
      soft: "#F3EEE4",
      alt: "#EFE8DC",
      /**
       * Composite paper gradient with a warm light pool top-right.
       * Used as scene background.
       */
      gradient:
        "radial-gradient(ellipse at 78% 22%, rgba(255, 244, 220, 0.55) 0%, rgba(255, 244, 220, 0) 55%), linear-gradient(180deg, #F5F1E8 0%, #F3EEE4 60%, #EFE8DC 100%)",
    },
    text: {
      primary: "#2B241D",
      secondary: "#5E554B",
      muted: "#7C7268",
    },
    accent: {
      primary: "#B8893B",
      secondary: "#C39245",
      /** Used very sparingly to connect with the product's chess green. */
      product: "#3F7D4C",
      /** Soft cognac wash for hairlines. */
      hairlineRgba: "rgba(184, 137, 59, 0.35)",
    },
    surface: {
      base: "#FCFAF6",
      soft: "rgba(255, 255, 255, 0.55)",
    },
    border: {
      soft: "rgba(43, 36, 29, 0.08)",
      mid: "rgba(43, 36, 29, 0.14)",
    },
    shadow: {
      soft: "0 12px 32px rgba(43, 36, 29, 0.08)",
      card: "0 18px 48px rgba(43, 36, 29, 0.10)",
      /** Phone gets a deeper, still-soft shadow. */
      phone:
        "0 32px 80px rgba(24, 20, 16, 0.18), 0 12px 24px rgba(24, 20, 16, 0.10)",
    },
    badge: {
      bg: "rgba(184, 137, 59, 0.08)",
      border: "rgba(184, 137, 59, 0.32)",
      text: "#8E6726",
    },
    cta: {
      /** Cognac solid CTA — feels luxury product, not SaaS button. */
      bg: "linear-gradient(180deg, #C39245 0%, #B8893B 100%)",
      bgShadow:
        "0 18px 40px rgba(184, 137, 59, 0.28), 0 0 0 1px rgba(142, 103, 38, 0.50) inset",
      text: "#FFF8EC",
    },
    halo: {
      /** Warm light pool used behind hero phones. Very subtle. */
      warm: "radial-gradient(ellipse at center, rgba(255, 234, 196, 0.55) 0%, rgba(255, 234, 196, 0.18) 35%, rgba(255, 234, 196, 0) 70%)",
    },
  },
} as const;
