import { Fredoka, Rowdies } from "next/font/google";
import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { SeasonPassCelebrationFixture, type CelebrationVariant } from "./fixture";

export const dynamic = "force-dynamic";

// The /dev tree is its own root layout and never loads the app fonts, so
// `--font-game-action` resolved to nothing here and the celebration rendered in
// system type — a probe that misreports the typography it exists to validate.
// Scoped to this page rather than the /dev layout on purpose: the VR fixtures
// share that layout and their baselines were captured font-less, so hoisting
// this would churn every one of them. Mirrors [locale]/layout.tsx.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-fredoka",
  display: "swap",
});
const rowdies = Rowdies({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-rowdies",
  display: "swap",
});

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<CelebrationVariant>(["credited", "pending"]);

/**
 * Post-purchase celebration probe — renders the "You are in!" screen without
 * spending a cent, so the flow can be validated on preview without a live
 * payment.
 *
 * Gated by isDevSurfaceEnabled() — alive on preview (which is the point: a probe
 * that 404s there cannot do the validation it exists for), dead in production.
 * This page found that rule first; it now lives in lib/dev/dev-surface.ts.
 *
 *   /dev/season-pass-celebration              → shields credited (+3)
 *   /dev/season-pass-celebration?variant=pending → shields not yet granted
 */
export default function SeasonPassCelebrationDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "credited";
  const variant = VARIANTS.has(raw as CelebrationVariant)
    ? (raw as CelebrationVariant)
    : "credited";

  // `--font-game-action` is declared on :root as `var(--font-rowdies), ...` and
  // custom properties substitute where they are DECLARED, not where they are
  // used — so :root already resolved it against an undefined --font-rowdies.
  // Re-declaring the derived tokens here (not just the base vars) is what
  // actually puts Rowdies on the title.
  const fontVars = {
    "--font-rowdies": rowdies.style.fontFamily,
    "--font-fredoka": fredoka.style.fontFamily,
    "--font-game-action": `${rowdies.style.fontFamily}, system-ui, sans-serif`,
    "--font-game-display": `${fredoka.style.fontFamily}, sans-serif`,
  } as React.CSSProperties;

  return (
    <div style={fontVars}>
      <SeasonPassCelebrationFixture variant={variant} />
    </div>
  );
}
