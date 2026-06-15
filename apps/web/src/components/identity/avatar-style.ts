import type { StyleKey } from "@/lib/identity/identity-lite";

/** Disc background color per style. Presentational; OQ1 in the spec — founder
 *  may retune these hexes during visual QA without touching derivation. */
export const STYLE_DISC_COLOR: Record<StyleKey, string> = {
  golden: "#E8B23A",
  green: "#43B36B",
  blue: "#3E8EE0",
  coral: "#F3766A",
  tropical: "#25C2AE",
  bright: "#B583F0",
};

export type AvatarSize = "sm" | "md" | "lg";

/** Outer disc diameter in px per size token. */
export const AVATAR_PX: Record<AvatarSize, number> = {
  sm: 20,
  md: 28,
  lg: 44,
};
