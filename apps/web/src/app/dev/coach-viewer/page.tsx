import { notFound } from "next/navigation";

import { CoachViewerFixture } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set([
  "viewer-win-unminted",
  "viewer-win-minted",
  "viewer-loss",
  "viewer-partial-replay",
  // 2026-05-30 (#2 hint-variant baselines): hints rendered under the Ask
  // Coach tile when the wallet has paid credits or an active PRO pass.
  "viewer-win-credits-hint",
  "viewer-win-pro-hint",
]);

export default function CoachViewerDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw =
    typeof searchParams.variant === "string"
      ? searchParams.variant
      : "viewer-win-unminted";
  const variant = VARIANTS.has(raw) ? raw : "viewer-win-unminted";

  return <CoachViewerFixture variant={variant as never} />;
}
