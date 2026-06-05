import { notFound } from "next/navigation";

import { ExercisesPopupsFixture } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set([
  "piece-complete-next",
  "piece-complete-labyrinth",
  "piece-complete-choose",
  "piece-complete-arena-fallback",
  "labyrinth-solved-perfect",
  "labyrinth-solved-suboptimal",
  "labyrinth-solved-new-best",
  "score-saved",
]);

export default function ExercisesPopupsDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "piece-complete-next";
  const variant = VARIANTS.has(raw) ? raw : "piece-complete-next";

  return <ExercisesPopupsFixture variant={variant as never} />;
}
