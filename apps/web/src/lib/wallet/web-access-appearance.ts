import type { PrivyClientConfig } from "@privy-io/react-auth";

import type { ProductSurface } from "@/lib/wallet/web-access-copy";

/**
 * Look of the Privy login modal — the sheet that opens when the gate's ENTER is
 * tapped.
 *
 * It lives here rather than in `globals.css` because PrivyProvider renders that
 * modal in its own portal: no class of ours reaches it, and `config.appearance`
 * is the only surface Privy exposes. Nothing in this module touches auth, the
 * session or the wallet — it is styling that happens to travel as a prop.
 */

/** Modal background. Privy derives every foreground tone from this by
 *  modulating luminance, and requires under 20% or over 80% so the derived text
 *  stays readable; this sits at 0.8%. It is the same ink as the gate's copy
 *  scrim (`.web-access-screen--gate::after`), so the modal reads as one more
 *  layer of the screen behind it instead of a separate white sheet. */
const MODAL_BACKGROUND = "#09182c";

/** Accent per surface: the greens and blues already carrying START FOCUS on
 *  Learn and PLAY CHESS on Play. Both sit near 50% luminance, which is why they
 *  accent buttons and active borders and never fill the background. */
const ACCENT_BY_SURFACE: Record<ProductSurface, `#${string}`> = {
  learn: "#72db2d",
  play: "#45c4f4",
};

/** Privy's `logo` takes one URL, so the extension is composed here. `.webp`
 *  rather than `.png`: every browser Privy supports reads it, at ~40% of the
 *  bytes. The `<picture>` the app uses elsewhere is not an option — Privy
 *  overwrites the style props of any element passed here. */
const LOGO_EXTENSION = "webp";

/** Continues the key metaphor the gate opens with, one screen earlier. Privy
 *  caps the header at 35 characters and the message at 100 and ellipsifies past
 *  that, so the suite asserts both lengths. */
export const WEB_ACCESS_MODAL_COPY = {
  header: "Your key to Chesscito",
  message:
    "Sign in and your wallet is ready. No passwords to remember, nothing to install.",
} as const;

/**
 * Builds the `appearance` block for `PrivyProvider`.
 *
 * `surface` comes from the build mode, like every other Learn/Play split in
 * this branch, so the accent is fixed per deploy and never read from the
 * hostname.
 *
 * `wordmarkBase` must come from the `brand.title` resolver, not from an `/art`
 * literal. That slot is already on the theme registry: writing the path by hand
 * would leave the modal showing the stock wordmark after a creator replaced it
 * everywhere else, and `audit-theme-runtime-coverage` fails the build for it.
 * An empty base (the slot resolved to `none`) drops `logo` entirely so Privy
 * falls back to its dashboard logo instead of fetching `.webp`.
 */
export function buildWebAccessAppearance(
  surface: ProductSurface,
  wordmarkBase: string,
): NonNullable<PrivyClientConfig["appearance"]> {
  return {
    theme: MODAL_BACKGROUND,
    accentColor: ACCENT_BY_SURFACE[surface],
    ...(wordmarkBase ? { logo: `${wordmarkBase}.${LOGO_EXTENSION}` } : {}),
    landingHeader: WEB_ACCESS_MODAL_COPY.header,
    loginMessage: WEB_ACCESS_MODAL_COPY.message,
  };
}
