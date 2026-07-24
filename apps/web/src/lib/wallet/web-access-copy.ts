import { CHESSCITO_MODE } from "@/lib/feature-flags";

/** The product surface a web deploy serves. Driven by the build mode
 *  (`CHESSCITO_MODE`), never by hostname — Learn and Play are separate
 *  deployments of `apps/web` (see the domain topology in
 *  docs/specs/2026-07-24-web-access-gate-contract.md §8). */
export type ProductSurface = "learn" | "play";

/**
 * Resolves the surface from the canonical build mode. `full` is an internal
 * mode that never ships as a public web deploy, so it falls back to the Learn
 * copy. The component receives this value as a prop; it must not read
 * `window.location`.
 */
export function resolveWebAccessSurface(): ProductSurface {
  return CHESSCITO_MODE === "play" ? "play" : "learn";
}

/** Copy for the mandatory web access gate. English UI (lib/content/editorial.ts
 *  is the app's voice; this stays free of em-dashes to match that ceiling). */
export const WEB_ACCESS_COPY = {
  title: "Every journey needs a key.",
  subtitle:
    "Sign in and your Chesscito wallet will be created automatically.",
  cta: "ENTER CHESSCITO",
  note: "No wallet setup required.",
  preparing: "Preparing your Chesscito wallet…",
  error: {
    title: "Something interrupted your sign in.",
    retry: "Try again",
    openMiniPay: "Open in MiniPay",
    backToDiscovery: "Back to chesscito.com",
  },
  /** The only line that varies between Learn and Play. */
  surfaceHeadline: {
    learn: "Unlock your learning journey",
    play: "Enter the Chesscito arena",
  },
} as const;
