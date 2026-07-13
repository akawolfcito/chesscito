import { notFound } from "next/navigation";

import { PlayHubFixture, type PlayHubVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<PlayHubVariant>(["guest", "connected", "pro"]);

export default function PlayHubDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "guest";
  const variant = VARIANTS.has(raw as PlayHubVariant) ? (raw as PlayHubVariant) : "guest";

  return <PlayHubFixture variant={variant} />;
}
