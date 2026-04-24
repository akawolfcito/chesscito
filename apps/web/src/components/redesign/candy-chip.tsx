import type { ReactNode } from "react";

type Variant = "warm" | "success" | "danger";
type Tone = "subtle" | "solid";

type Props = {
  /** Chip color family. `warm` is the neutral default for every "Soon"
   *  tag, stats chip, and difficulty pill. `success` / `danger` are
   *  the only semantic exceptions, rendered with muted candy colors
   *  so they don't look like raw Tailwind classes. */
  variant?: Variant;
  /** `subtle` = soft glass pill, `solid` = filled pill for strong accent. */
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

const STYLES: Record<Variant, Record<Tone, { background: string; color: string; borderColor?: string }>> = {
  warm: {
    subtle: {
      background: "rgba(255, 245, 215, 0.55)",
      color: "rgba(110, 65, 15, 0.95)",
      borderColor: "rgba(110, 65, 15, 0.25)",
    },
    solid: {
      background: "rgb(120, 65, 5)",
      color: "rgb(255, 240, 180)",
    },
  },
  success: {
    subtle: {
      background: "rgba(220, 252, 231, 0.75)",
      color: "rgba(6, 95, 70, 0.95)",
      borderColor: "rgba(6, 95, 70, 0.28)",
    },
    solid: {
      background: "rgb(6, 95, 70)",
      color: "rgb(220, 252, 231)",
    },
  },
  danger: {
    subtle: {
      background: "rgba(255, 228, 230, 0.75)",
      color: "rgba(159, 18, 57, 0.95)",
      borderColor: "rgba(159, 18, 57, 0.28)",
    },
    solid: {
      background: "rgb(159, 18, 57)",
      color: "rgb(255, 228, 230)",
    },
  },
};

/**
 * CandyChip — the only pill primitive for secondary-page accents.
 * Replaces the cyan/violet/emerald one-offs that were sprinkled across
 * /trophies and its rows with three canonical variants on the warm
 * candy-brown palette.
 */
export function CandyChip({ variant = "warm", tone = "subtle", className = "", children }: Props) {
  const s = STYLES[variant][tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${className}`.trim()}
      style={{
        background: s.background,
        color: s.color,
        ...(s.borderColor ? { border: `1px solid ${s.borderColor}` } : {}),
        textShadow: tone === "subtle" ? "0 1px 0 rgba(255, 245, 215, 0.55)" : undefined,
      }}
    >
      {children}
    </span>
  );
}
