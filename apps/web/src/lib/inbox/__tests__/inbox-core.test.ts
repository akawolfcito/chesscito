/**
 * Inbox V0 — the pure layer and the schema contract.
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  badgeLabel,
  countUnread,
  isInboxMessageType,
  isVisible,
  partitionInbox,
  type InboxMessage,
} from "../types";

const msg = (over: Partial<InboxMessage> = {}): InboxMessage => ({
  id: "m1",
  type: "announcement",
  title: "t",
  body: "b",
  ctaLabel: null,
  ctaHref: null,
  readAt: null,
  createdAt: "2026-08-20T00:00:00.000Z",
  ...over,
});

describe("badgeLabel", () => {
  it("shows nothing at zero, so the badge disappears instead of reading 0", () => {
    expect(badgeLabel(0)).toBeNull();
  });

  it("shows the number from 1 to 9", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
  });

  it("caps at 9+ so a neglected inbox cannot stretch a 390px header", () => {
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(250)).toBe("9+");
  });

  it("never renders a badge for a nonsense count", () => {
    expect(badgeLabel(-3)).toBeNull();
    expect(badgeLabel(Number.NaN)).toBeNull();
  });
});

describe("partitionInbox", () => {
  it("puts unread first and sorts each group newest first", () => {
    const older = msg({ id: "a", createdAt: "2026-08-01T00:00:00.000Z" });
    const newer = msg({ id: "b", createdAt: "2026-08-10T00:00:00.000Z" });
    const readOne = msg({
      id: "c",
      createdAt: "2026-08-05T00:00:00.000Z",
      readAt: "2026-08-06T00:00:00.000Z",
    });

    const { unread, read } = partitionInbox([older, readOne, newer]);

    expect(unread.map((m) => m.id)).toEqual(["b", "a"]);
    expect(read.map((m) => m.id)).toEqual(["c"]);
  });

  it("does not mutate the input", () => {
    const list = [msg({ id: "x" }), msg({ id: "y" })];
    partitionInbox(list);
    expect(list.map((m) => m.id)).toEqual(["x", "y"]);
  });

  it("handles an empty inbox", () => {
    expect(partitionInbox([])).toEqual({ unread: [], read: [] });
  });
});

describe("countUnread", () => {
  it("counts only the unread ones", () => {
    expect(
      countUnread([msg(), msg({ readAt: "2026-08-21T00:00:00.000Z" }), msg()]),
    ).toBe(2);
  });

  it("reaches zero once everything is read — this is what clears the badge", () => {
    expect(countUnread([msg({ readAt: "2026-08-21T00:00:00.000Z" })])).toBe(0);
    expect(badgeLabel(countUnread([msg({ readAt: "x" })]))).toBeNull();
  });
});

describe("isVisible", () => {
  const now = Date.parse("2026-08-25T00:00:00.000Z");

  it("keeps a message with no expiry", () => {
    expect(isVisible(msg(), now)).toBe(true);
  });

  it("hides an expired one", () => {
    expect(
      isVisible({ ...msg(), expiresAt: "2026-08-24T00:00:00.000Z" }, now),
    ).toBe(false);
  });

  it("keeps one whose expiry is still ahead", () => {
    expect(
      isVisible({ ...msg(), expiresAt: "2026-08-26T00:00:00.000Z" }, now),
    ).toBe(true);
  });

  it("keeps a message with an unparseable expiry rather than hiding it", () => {
    // Losing a message is worse than showing one a day too long.
    expect(isVisible({ ...msg(), expiresAt: "not a date" }, now)).toBe(true);
  });
});

describe("message types", () => {
  it("accepts the four declared kinds and nothing else", () => {
    for (const t of ["announcement", "achievement", "gift", "milestone"]) {
      expect(isInboxMessageType(t)).toBe(true);
    }
    expect(isInboxMessageType("reward")).toBe(false);
    expect(isInboxMessageType(null)).toBe(false);
  });
});

describe("inbox_messages schema", () => {
  // No live DB in the suite, so the contract is asserted against the migration
  // text — same pattern as focus-day-ledger-schema.test.ts.
  const migration = readFileSync(
    path.resolve(
      process.cwd(),
      "supabase/migrations/20260825000000_inbox_v0.sql",
    ),
    "utf8",
  );

  it("keys messages by wallet, never by account_ref", () => {
    // ⛔ account_ref is derived server-side from a secret the browser never
    // holds. A product table using it could not be queried by its own owner,
    // and would be the join that finally links analytics to identity.
    //
    // Comments stripped first: the claim is about COLUMNS, and the design notes
    // legitimately name account_ref to explain why it is NOT the key here.
    const ddl = migration.replace(/--.*$/gm, "");
    expect(ddl).toMatch(/wallet\s+text\s+NOT NULL/i);
    expect(ddl).not.toMatch(/account_ref/);
  });

  it("constrains type to the four declared kinds", () => {
    expect(migration).toMatch(
      /CHECK \(type IN \('announcement', 'achievement', 'gift', 'milestone'\)\)/i,
    );
  });

  it("carries NO reward columns while the claim does not exist", () => {
    const ddl = migration.replace(/--.*$/gm, "");
    expect(ddl).not.toMatch(/reward_type|reward_payload|claimed_at/);
  });

  it("indexes the unread count, which the Hub asks for on every load", () => {
    expect(migration).toMatch(/ON inbox_messages \(wallet, read_at\)/i);
  });

  it("denies anon and authenticated outright", () => {
    expect(migration).toMatch(
      /ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY/i,
    );
    expect(migration).toMatch(/TO anon, authenticated/i);
    expect(migration).toMatch(/USING \(false\)/i);
    expect(migration).toMatch(/WITH CHECK \(false\)/i);
  });
});
