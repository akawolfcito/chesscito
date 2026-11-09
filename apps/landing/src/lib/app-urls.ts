import type { PreferredMode } from "@/lib/onboarding/types";

/**
 * Deployment URLs are origins, not route prefixes. Normalizing through URL
 * also removes stale `/hub` values left in an older environment configuration.
 */
export function normalizeAppOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/hub\/?$/, "").replace(/\/+$/, "");
  }
}

export const LEARN_URL = normalizeAppOrigin(
  process.env.NEXT_PUBLIC_LEARN_URL ?? "https://learn.chesscito.com",
);
export const PLAY_URL = normalizeAppOrigin(
  process.env.NEXT_PUBLIC_PLAY_URL ??
    process.env.NEXT_PUBLIC_FULL_URL ??
    "https://play.chesscito.com",
);
export const LEGAL_URL = process.env.NEXT_PUBLIC_LEGAL_URL ?? LEARN_URL;

export function destinationForMode(mode: PreferredMode): string {
  return mode === "learn" ? LEARN_URL : PLAY_URL;
}
