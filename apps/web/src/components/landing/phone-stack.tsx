import type { ReactNode } from "react";
import { PhoneFrame } from "./phone-frame";

type ScreenSlot = {
  src: string;
  alt: string;
  label?: string;
};

type PhoneStackProps = {
  /** Front-facing phone — the hero screenshot. */
  primary: ScreenSlot;
  /** Secondary phone behind/beside the primary. Smaller + tilted. */
  secondary: ScreenSlot;
  /** Direction the secondary leans away from the primary. */
  variant?: "right" | "left";
  /** Extra slot rendered on top of the primary as a floating chip
   *  (e.g., a streak badge, a trophy callout). Optional. */
  floatingNode?: ReactNode;
};

/**
 * PhoneStack — two PhoneFrames composed for richer mockups. Inspired
 * by the marketing references the user shared (Duolingo / Linear
 * landing pages where multiple device screenshots overlap with a
 * subtle tilt). The secondary frame sits behind and rotated so the
 * primary keeps clear hierarchy as the visual anchor.
 *
 * Layout:
 *   - Mobile: vertically stacked (secondary still tilted, smaller).
 *   - Desktop: secondary is positioned absolutely with negative offset
 *     so it peeks behind the primary.
 */
export function PhoneStack({
  primary,
  secondary,
  variant = "right",
  floatingNode,
}: PhoneStackProps) {
  const secondaryOffset =
    variant === "right"
      ? "md:right-[-22%] md:rotate-[8deg]"
      : "md:left-[-22%] md:-rotate-[8deg]";

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      {/* Secondary frame — desktop-only. On mobile we keep just the
          primary so the hero stays compact (the secondary screenshot
          re-appears later in the §3 cognitive section anyway). */}
      <div
        aria-hidden={true}
        className={`hidden md:absolute md:top-[10%] md:block md:w-[58%] md:opacity-95 ${secondaryOffset}`}
        style={{
          filter: "drop-shadow(0 14px 24px rgba(40, 22, 8, 0.28))",
        }}
      >
        <PhoneFrame label={secondary.label}>
          <picture>
            <source srcSet={`${secondary.src}.avif`} type="image/avif" />
            <source srcSet={`${secondary.src}.webp`} type="image/webp" />
            <img
              src={`${secondary.src}.png`}
              alt={secondary.alt}
              className="h-full w-full object-cover"
            />
          </picture>
        </PhoneFrame>
      </div>

      {/* Primary frame — full opacity, anchors the composition. The
          relative wrapper keeps the floating node positioned over it
          rather than over the stack container. */}
      <div className="relative z-10 mx-auto md:mt-0">
        <PhoneFrame label={primary.label}>
          <picture>
            <source srcSet={`${primary.src}.avif`} type="image/avif" />
            <source srcSet={`${primary.src}.webp`} type="image/webp" />
            <img
              src={`${primary.src}.png`}
              alt={primary.alt}
              className="h-full w-full object-cover"
            />
          </picture>
        </PhoneFrame>
        {floatingNode && (
          <div className="pointer-events-none absolute right-[-8%] top-[18%] z-20 hidden md:block">
            {floatingNode}
          </div>
        )}
      </div>
    </div>
  );
}
