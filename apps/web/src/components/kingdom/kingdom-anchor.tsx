import type { CSSProperties } from "react";

import { HOME_ANCHOR_COPY } from "@/lib/content/editorial";

export type KingdomAnchorVariant =
  | "playhub"
  | "arena-preview"
  | "landing-hero";

export type Atmosphere = "adventure" | "scholarly";

type Props = {
  variant?: KingdomAnchorVariant;
  /** Visual register. Adventure (default) = warm gold-leaf; Scholarly =
   *  warm-paper / paper-craft for /about + legal surfaces. */
  atmosphere?: Atmosphere;
  className?: string;
  style?: CSSProperties;
};

const ASPECT_RATIO: Record<KingdomAnchorVariant, string> = {
  playhub: "1 / 1",
  "arena-preview": "1.3 / 1",
  "landing-hero": "1.5 / 1",
};

const ASSET_BASE = "/art/redesign/bg/splash-loading";

/** Central diegetic visual that turns the Hub from menu into a place. Adventure
 *  atmosphere primitive — gold-leaf border + warm halo + drop shadow, hosting
 *  the kingdom hero render via AVIF/WebP/PNG fallback chain. Ambient idle
 *  animation is opt-in via CSS and disabled under `prefers-reduced-motion:
 *  reduce`. Not interactive; tap is captured by the `<PrimaryPlayCta>` zone. */
export function KingdomAnchor({
  variant = "playhub",
  atmosphere = "adventure",
  className = "",
  style,
}: Props) {
  const classes = [
    "kingdom-anchor",
    `kingdom-anchor--${variant}`,
    `is-atmosphere-${atmosphere}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="img"
      aria-label={HOME_ANCHOR_COPY.alt}
      className={classes}
      style={{ aspectRatio: ASPECT_RATIO[variant], ...style }}
    >
      <picture className="kingdom-anchor-picture">
        <source srcSet={`${ASSET_BASE}.avif`} type="image/avif" />
        <source srcSet={`${ASSET_BASE}.webp`} type="image/webp" />
        <img
          src={`${ASSET_BASE}.png`}
          alt=""
          aria-hidden="true"
          className="kingdom-anchor-img"
        />
      </picture>
    </div>
  );
}
