import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { ExercisesPopupsFixture, type ExercisesPopupsVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

/* ⛔ Typed as the fixture's own union, so adding a variant there and forgetting
 * it here is a COMPILE error. It used to be a bare string Set next to an
 * `as never` cast at the render site, which made the two silently divergent:
 * an unknown variant falls back to `piece-complete-final`, so a VR test for a
 * missing variant photographs the WRONG overlay and records a green baseline
 * under the new test's name. That happened once (2026-08-08) and was caught
 * only by opening the PNG. */
const VARIANTS = new Set<ExercisesPopupsVariant>([
  "piece-complete-final",
  "labyrinth-king-solved",
  "labyrinth-consequence-worst-case",
  "score-saved",
  "score-saved-peones",
  "saved-chip",
  "save-cta",
  "reward-dual",
  "result-badge",
  "result-shop",
  "result-error",
]);

export default function ExercisesPopupsDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw =
    typeof searchParams.variant === "string"
      ? searchParams.variant
      : "piece-complete-final";
  const variant: ExercisesPopupsVariant = VARIANTS.has(
    raw as ExercisesPopupsVariant,
  )
    ? (raw as ExercisesPopupsVariant)
    : "piece-complete-final";

  return <ExercisesPopupsFixture variant={variant} />;
}
