import { notFound } from "next/navigation";

import { SeasonPassCelebrationFixture, type CelebrationVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<CelebrationVariant>(["credited", "pending"]);

/**
 * Post-purchase celebration probe — renders the "You are in!" screen without
 * spending a cent, so the flow can be validated on preview without a live
 * payment.
 *
 * Gated on VERCEL_ENV (not NODE_ENV) on purpose: preview builds also run with
 * NODE_ENV=production, and a probe that 404s on preview cannot be used for the
 * validation it exists for. Dead in production.
 *
 *   /dev/season-pass-celebration              → shields credited (+3)
 *   /dev/season-pass-celebration?variant=pending → shields not yet granted
 */
export default function SeasonPassCelebrationDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "credited";
  const variant = VARIANTS.has(raw as CelebrationVariant)
    ? (raw as CelebrationVariant)
    : "credited";

  return <SeasonPassCelebrationFixture variant={variant} />;
}
