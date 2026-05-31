import { notFound } from "next/navigation";

import { RescueModalFixture } from "./fixture";
import type { RescueModalVariant } from "@/lib/exercises/use-rescue-modal-state";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VARIANTS: ReadonlySet<RescueModalVariant> = new Set(["A", "B", "C", "D"]);

function parseVariant(raw: string | undefined): RescueModalVariant {
  if (raw && VARIANTS.has(raw as RescueModalVariant)) {
    return raw as RescueModalVariant;
  }
  return "A";
}

function parseShields(raw: string | undefined): number {
  if (!raw) return 8;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 8;
  return parsed;
}

export default function RescueModalDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const variant = parseVariant(
    typeof searchParams.variant === "string" ? searchParams.variant : undefined,
  );
  const shields = parseShields(
    typeof searchParams.shields === "string" ? searchParams.shields : undefined,
  );

  return <RescueModalFixture variant={variant} shieldsCount={shields} />;
}
