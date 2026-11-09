/**
 * Art the landing renders but the WEB app owns.
 *
 * `apps/landing` is a separate Next app with its own `public/`, so anything
 * both apps show has to exist twice on disk. Rather than catalog those twice
 * — which would break the "one slot = one file" rule and let a replace update
 * only half the product — the web copy stays the single cataloged slot and
 * this manifest declares what gets mirrored into the landing.
 *
 * Run `pnpm art:sync-landing` after replacing any of these in the
 * theme-builder. Drift is not hypothetical: before this manifest existed,
 * `redesign/icons/{fingerprint,star}` had already diverged between the apps.
 *
 * NOT in here: `/art/landing/*` and `/art/landing-slides/*`. Those are
 * landing-OWNED (cataloged with `root: "landing"`). The stale copies of
 * `/art/landing/*` sitting in `apps/web/public` are orphans — mirroring them
 * would overwrite the live landing art with the dead one.
 */

/** Icons `CandyIcon` composes at runtime (`/art/redesign/icons/${name}`).
 *  Mirrored as a whole family: no literal exists to detect them one by one,
 *  so covering the union is the only honest guarantee. */
const CANDY_ICONS = [
  "check",
  "chevron-down",
  "close",
  "coach",
  "copy",
  "crosshair",
  "crown",
  "fingerprint",
  "loading",
  "lock",
  "move",
  "refresh",
  "share",
  "shield",
  "shop",
  "star",
  "time",
  "trophy",
  "wallet",
].map((name) => `/art/redesign/icons/${name}`);

export const SHARED_LANDING_ASSETS: readonly string[] = [
  // Onboarding carousel — the plan/feature icons reused from the game.
  "/art/bg-wallpaper-lite",
  "/art/hub/train-pieces",
  "/art/redesign/banners/btn-battle",
  "/art/focus-passport/flame-color",
  "/art/new-icons-chesscito/save",
  "/art/new-assets-chesscito/btns/ask-coach-icon",
  // /pricing medallions. The page composes the path — `/art/redesign/pieces/
  // ${asset}` — so no literal exists for the scanner to find, which is why
  // `landing-assets.test.ts` asserts this family BY NAME off the Medallion
  // union, the same way it does for CandyIcon.
  //
  // ⚠️ These were copies under /art/pricing/ until 2026-08-27. Byte-identical
  // to the web originals and cataloged nowhere, so replacing a piece in the
  // theme-builder updated the game and left /pricing showing the old one.
  "/art/redesign/pieces/w-rook",
  "/art/redesign/pieces/w-pawn",
  "/art/redesign/pieces/w-king",
  ...CANDY_ICONS,
];
