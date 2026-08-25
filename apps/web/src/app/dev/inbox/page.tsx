import { notFound } from "next/navigation";

import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { InboxFixture } from "./fixture";

/**
 * `/dev/inbox` — the Inbox with its three seed messages and no database.
 *
 * The gate lives here; the fixture is a client component because `InboxScreen`
 * takes callbacks. See the note in `fixture.tsx`.
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md
 */
export const dynamic = "force-dynamic";

export default function InboxDevPage() {
  if (!isDevSurfaceEnabled()) notFound();

  return <InboxFixture />;
}
