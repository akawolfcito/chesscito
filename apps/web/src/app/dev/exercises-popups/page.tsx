import { notFound } from "next/navigation";

import { ExercisesPopupsFixture } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set([
  "piece-complete-final",
  "labyrinth-king-solved",
  "score-saved",
  "score-saved-peones",
  "saved-chip",
  "save-cta",
  "result-badge",
  "result-shop",
  "result-error",
]);

export default function ExercisesPopupsDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw =
    typeof searchParams.variant === "string"
      ? searchParams.variant
      : "piece-complete-final";
  const variant = VARIANTS.has(raw) ? raw : "piece-complete-final";

  return <ExercisesPopupsFixture variant={variant as never} />;
}
