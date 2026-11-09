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
  headline: "Unlock your Chesscito journey",
  lede: "Every journey begins with a key.",
  body: ["Sign in to enter.", "Your wallet will be created automatically."],
  cta: "ENTER",
  note: "No setup. No extensions. Just start playing.",
  preparing: "Preparing your Chesscito wallet…",
  error: {
    title: "Something interrupted your sign in.",
    retry: "Try again",
    openMiniPay: "Open in MiniPay",
    backToDiscovery: "Back to chesscito.com",
  },
} as const;

/**
 * Copy for the Early Access intake (design 2026-08-10 §B2).
 *
 * TONE RULE, and it is the requirement most likely to be lost in an edit: this
 * must never read as a ban, an auth error, a paywall or a bug. It is controlled
 * access to something being opened on purpose, a few players at a time. Nothing
 * here says "denied", "not allowed" or "error" — the two failure lines below
 * are about the FORM (a typo, a lost request), never about the person.
 *
 * The request link is deliberately secondary and lives UNDER the ENTER button:
 * a player who already has a key must keep seeing exactly the screen they have
 * always seen, with no permanent email field competing with the CTA.
 */
export const EARLY_ACCESS_COPY = {
  requestLink: "No key yet? Request access",
  request: {
    title: "Your journey is almost ready ✨",
    body: "Chesscito Web is opening gradually to small groups of players.",
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    cta: "REQUEST MY KEY",
    note: "We'll let you know when your access is ready.",
    /* About the address, not the player. */
    invalid: "That email looks incomplete. Check it and try again.",
    /* About our side failing, and it says so. */
    failed: "We could not save your request. Please try again.",
    back: "Back",
  },
  waiting: {
    title: "You're on the list! 🔑",
    body: "Your request is saved. We'll let you know when your Chesscito key is ready.",
    back: "Back",
  },
} as const;

/* The wallpaper is the only thing that differs between Learn and Play: the copy
   is identical on both surfaces (founder, 2026-07-25). `surface` still drives
   the art — via `data-surface` in globals.css — so it stays derived from the
   build mode, never the hostname. */
