import { InboxClient } from "./inbox-client";

/**
 * `/[locale]/inbox` — the whole Inbox surface.
 *
 * One screen, as approved. There is no `/inbox/[id]`: message detail is the card
 * expanding in place, so a message has no URL of its own in V0.
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md
 */
export const dynamic = "force-dynamic";

export default function InboxPage() {
  return <InboxClient />;
}
