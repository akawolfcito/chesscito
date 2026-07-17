import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { VictoryLandingFixture, type Variant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<Variant>(["easy", "medium", "hard"]);

export default function VictoryLandingDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw =
    typeof searchParams.variant === "string" ? searchParams.variant : "easy";
  const variant = VARIANTS.has(raw as Variant) ? (raw as Variant) : "easy";

  return <VictoryLandingFixture variant={variant} />;
}
