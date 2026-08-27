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
 * `crown` draws no image: PRO's mark is a glyph, so it has no sprite to reuse.
 */
export type Medallion =
  | { kind: "piece"; asset: "w-rook" | "w-pawn" }
  | { kind: "crown" };

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
    medallion: { kind: "piece", asset: "w-rook" },
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
    medallion: { kind: "piece", asset: "w-pawn" },
    tone: "green",
    featured: true,
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
    medallion: { kind: "crown" },
    tone: "purple",
  },
];

/** Paid in stablecoins on Celo. Stated plainly because a pricing page has to
 *  say how money moves, and this is not a card checkout. */
export const PAYMENT_NOTE =
  "Prices in US dollars, paid in stablecoins on the Celo network.";

export const RENEWAL_NOTE =
  "PRO renews only when you choose to buy it again. There is no subscription to cancel and no stored payment method.";
