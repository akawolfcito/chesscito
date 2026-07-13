import { notFound } from "next/navigation";

import { ArenaRailsFixture, type ArenaRailsVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<ArenaRailsVariant>([
  "rival-idle",
  "rival-thinking",
  "you-active",
  "you-no-meta",
  "rails-pro",
]);

export default function ArenaRailsDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "rival-idle";
  const variant = VARIANTS.has(raw as ArenaRailsVariant)
    ? (raw as ArenaRailsVariant)
    : "rival-idle";

  return <ArenaRailsFixture variant={variant} />;
}
