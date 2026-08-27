/**
 * What Chesscito charges, mirrored for the public pricing page.
 *
 * ⛔ MIRRORED, NOT IMPORTED, and that is forced: the landing's `@/*` resolves to
 * its own `src` only, so `apps/web/src/lib/payments/rail-config.ts` is out of
 * reach. Two copies of a price is exactly how a published page ends up
 * advertising a number the app stopped charging, so
 * `__tests__/prices-match-the-app.test.ts` reads the app's config off disk and
 * fails when they diverge.
 *
 * ⛔ THE SEASON PASS IS NOT LISTED. Sales were paused on 2026-08-25 (0 of 18
 * eligible wallets ever completed the 21 days, and 10 of 17 buyers never
 * recorded a single day). Publishing a price for something nobody can buy is
 * the one thing a pricing page must never do. It comes back with the sale.
 */

/** Six-decimal USD, the unit the payment rail uses. */
export type PriceUsd6 = bigint;

export function formatUsd6(value: PriceUsd6): string {
  const cents = Number(value / 10_000n) / 100;
  return `$${cents.toFixed(2)}`;
}

/** $0.01 per Peón — `PEONES_UNIT_PRICE_USD6`. */
export const PEONES_UNIT_PRICE_USD6 = 10_000n;
export const PEONES_MIN_AMOUNT = 5;
export const PEONES_MAX_AMOUNT = 100;

/** $1.99 for 30 days — Chesscito PRO. */
export const PRO_PRICE_USD6 = 1_990_000n;
export const PRO_DURATION_DAYS = 30;

/**
 * The medallion's contents.
 *
 * ⛔ COMPOSED, NOT CROPPED. The mockup's medallions live inside 1 MB card PNGs;
 * cutting them out would ship three more raster assets that blur on a desktop
 * screen. A piece sprite (already a triplet in the app) inside a CSS ring stays
 * sharp at any size and adds nothing to download — and it obeys the house rule
 * about never upscaling art.
 *
 * ⚠️ PRO USES THE KING SPRITE, not a crown glyph. The first version drew `♔`,
 * which renders as a typographic symbol — flat, differently shaped on every
 * platform, and visibly not the same family as the two real pieces beside it
 * (founder). The king is the piece the tier means anyway.
 *
 * ⛔ MIRRORED FROM apps/web, NOT COPIED INTO /art/pricing. These files land
 * here via `pnpm art:sync-landing`, which reads `SHARED_LANDING_ASSETS` — so
 * replacing a piece in the theme-builder reaches this page too. The first
 * version duplicated them under `/art/pricing/`, where nothing cataloged them
 * and no replace could ever find them.
 */
export type Medallion = { asset: "w-rook" | "w-pawn" | "w-king" };

/** Where the mirrored sprites live. Shared with the game, so the path is the
 *  web app's, not a landing-local one.
 *
 *  ⚠️ THE TRAILING SLASH IS LOAD-BEARING. `landing-assets.test.ts` scans this
 *  app for art-path literals; one ending in a slash is read as an interpolated
 *  family and skipped, to be asserted by name instead. Without it this constant
 *  looks like a lone basename and the audit reports the directory as an orphan.
 *
 *  ⚠️ And the scanner does not know a comment from code — it matches quoted
 *  text anywhere in the file. Spelling a sample path here (even in backticks)
 *  makes the audit report the SAMPLE as a missing asset, which is how this very
 *  paragraph first turned the suite red. */
export const MEDALLION_ART_DIR = "/art/redesign/pieces/";

export type Plan = {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly cadence: string | null;
  readonly summary: string;
  readonly features: readonly string[];
  readonly medallion: Medallion;
  /** Drives the ribbon and price colour. Green for free play and currency,
   *  purple for PRO — the same pairing the app uses. */
  readonly tone: "green" | "purple";
  /** The one plan a first visit should read first. */
  readonly featured?: boolean;
  /** Why it is featured, said out loud.
   *
   *  ⚠️ NOT "Most popular". Peones has 14 buyers against PRO's 12 — a margin
   *  far too thin to claim in public, and impossible to defend if anyone asks.
   *  "Most flexible" is true by construction: 5 to 100 units, bought one at a
   *  time, with nothing recurring. A badge on a pricing page has to survive
   *  being questioned. */
  readonly badge?: string;
};

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Play",
    price: "Free",
    cadence: null,
    summary: "The whole game, at no cost.",
    features: [
      "Every piece and every exercise",
      "Daily tactic and your focus streak",
      "Mini-games and the Arena",
      "No account required to start",
    ],
    medallion: { asset: "w-rook" },
    tone: "green",
  },
  {
    id: "peones",
    name: "Peones",
    price: `${formatUsd6(PEONES_UNIT_PRICE_USD6 * BigInt(PEONES_MIN_AMOUNT))}+`,
    cadence: "pay as you go",
    summary: "The in-game currency. Buy only what you need.",
    features: [
      `From ${PEONES_MIN_AMOUNT} to ${PEONES_MAX_AMOUNT} Peones per purchase`,
      `${formatUsd6(PEONES_UNIT_PRICE_USD6)} per Peón`,
      "Saves scores, shields and coach reviews",
      "Also earned by playing, never only bought",
    ],
    medallion: { asset: "w-pawn" },
    tone: "green",
    featured: true,
    badge: "Most flexible",
  },
  {
    id: "pro",
    name: "PRO",
    price: formatUsd6(PRO_PRICE_USD6),
    cadence: `every ${PRO_DURATION_DAYS} days`,
    summary: "For players who train every day.",
    features: [
      "Unlimited coach reviews",
      "No daily limits",
      "Premium board and piece themes",
      "Everything in Play, included",
    ],
    medallion: { asset: "w-king" },
    tone: "purple",
  },
];

/** Paid in stablecoins on Celo. Stated plainly because a pricing page has to
 *  say how money moves, and this is not a card checkout. */
export const PAYMENT_NOTE =
  "Prices in US dollars, paid in stablecoins on the Celo network.";

export const RENEWAL_NOTE =
  "PRO renews only when you choose to buy it again. There is no subscription to cancel and no stored payment method.";
