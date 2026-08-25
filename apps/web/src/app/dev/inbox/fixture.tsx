"use client";

import { useState } from "react";

import { InboxScreen } from "@/components/inbox/inbox-screen";
import type { InboxMessage } from "@/lib/inbox/types";

/**
 * The three seed messages, with no database behind them.
 *
 * ⛔ CLIENT COMPONENT, and that is not a detail: `InboxScreen` takes callbacks,
 * and a server component cannot pass a function to a client one. Typecheck does
 * not catch it — it fails when the page is opened, which is why the fixture is
 * split from the gate exactly like every other `/dev` route.
 *
 * ⚠️ It renders the REAL `InboxScreen`, never a copy. The learn-hub fixture
 * builds its view by hand, and that is precisely why the VR stayed green through
 * two behaviour changes it should have caught (2026-08-25).
 *
 * ⛔ Nothing here writes a row. `inbox_messages` is never touched, so these
 * cannot leak into production data.
 */

const SEED: InboxMessage[] = [
  {
    id: "seed-milestone",
    type: "milestone",
    title: "10 Focus Days 🔥",
    body: "Thanks for coming back.\n\nYou are one of the few players who kept showing up for Focus sessions.\n\nWe have a small thank-you prepared for you. We'll let you know here when it's available.",
    ctaLabel: null,
    ctaHref: null,
    readAt: null,
    createdAt: "2026-08-25T09:00:00.000Z",
  },
  {
    id: "seed-achievement",
    type: "achievement",
    title: "New record in Rook Rail ⭐",
    body: "You improved your score.",
    ctaLabel: "See it",
    ctaHref: "/exercises",
    readAt: null,
    createdAt: "2026-08-24T18:00:00.000Z",
  },
  {
    id: "seed-announcement",
    type: "announcement",
    title: "New mini-game available",
    body: "Try N-Queens today.",
    ctaLabel: null,
    ctaHref: null,
    readAt: "2026-08-23T10:00:00.000Z",
    createdAt: "2026-08-22T10:00:00.000Z",
  },
];

export function InboxFixture() {
  // Local state so the fixture behaves like the real thing: opening a card
  // marks it read and moves it to Earlier, without any network.
  const [messages, setMessages] = useState<InboxMessage[]>(SEED);

  return (
    <InboxScreen
      messages={messages}
      nowMs={Date.parse("2026-08-25T12:00:00.000Z")}
      onBack={() => {}}
      onMarkRead={(id) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id && m.readAt === null
              ? { ...m, readAt: new Date().toISOString() }
              : m,
          ),
        )
      }
    />
  );
}
