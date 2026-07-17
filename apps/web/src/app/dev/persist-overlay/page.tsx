import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { PersistOverlayFixture } from "./fixture";
import type { PersistState } from "@/components/arena/arena-end-state";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const STATES: ReadonlySet<PersistState> = new Set([
  "idle",
  "persisting",
  "persisted",
  "failed",
  "dismissed",
]);

function parseState(raw: string | undefined): PersistState {
  if (raw && STATES.has(raw as PersistState)) return raw as PersistState;
  return "persisting";
}

export default function PersistOverlayDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!isDevSurfaceEnabled()) notFound();

  const state = parseState(
    typeof searchParams.state === "string" ? searchParams.state : undefined,
  );

  return <PersistOverlayFixture state={state} />;
}
