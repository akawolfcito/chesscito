import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { LearnHubFixture, type LearnHubVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<LearnHubVariant>(["guest", "active", "pro"]);

export default function LearnHubDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw = typeof searchParams.variant === "string" ? searchParams.variant : "guest";
  const variant = VARIANTS.has(raw as LearnHubVariant) ? (raw as LearnHubVariant) : "guest";

  return <LearnHubFixture variant={variant} />;
}
