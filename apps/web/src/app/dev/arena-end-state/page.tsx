import { notFound } from "next/navigation";

import { ArenaEndStateFixture } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set([
  "resigned",
  "checkmate",
  "stalemate",
  "draw",
  "coach-cta-enabled",
  "coach-cta-disabled-short",
  "coach-cta-disabled-persisting",
]);

export default function ArenaEndStateDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "resigned";
  const variant = VARIANTS.has(raw) ? raw : "resigned";

  return <ArenaEndStateFixture variant={variant as never} />;
}
