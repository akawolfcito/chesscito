import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { PeonesChipFixture, type PeonesChipVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS = new Set<PeonesChipVariant>(["balance", "earn", "spend"]);

export default function PeonesChipDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw =
    typeof searchParams.variant === "string" ? searchParams.variant : "balance";
  const variant = VARIANTS.has(raw as PeonesChipVariant)
    ? (raw as PeonesChipVariant)
    : "balance";

  return <PeonesChipFixture variant={variant} />;
}
