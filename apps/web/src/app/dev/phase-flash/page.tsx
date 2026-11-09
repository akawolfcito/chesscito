import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { PhaseFlashFixture, type PhaseFlashVariant } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

/* Typed with the fixture's own union, never a bare string set: an unknown
 * variant falls back to the default, so a VR test naming a variant that does
 * not exist photographs the WRONG surface and records a green baseline under
 * the new test's name. That happened on the exercises-popups fixture the same
 * day this file was written (2026-08-08). Here it is a compile error. */
const VARIANTS: ReadonlySet<PhaseFlashVariant> = new Set([
  "success-plain",
  "success-consequence",
]);

export default function PhaseFlashDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const raw =
    typeof searchParams.variant === "string" ? searchParams.variant : "";
  const variant: PhaseFlashVariant = VARIANTS.has(raw as PhaseFlashVariant)
    ? (raw as PhaseFlashVariant)
    : "success-plain";

  return <PhaseFlashFixture variant={variant} />;
}
