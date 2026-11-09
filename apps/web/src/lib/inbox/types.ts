/**
 * Inbox V0 — the contract, before any logic.
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md (approved 2026-08-25)
 *
 * ⛔ Scope of V0, stated here so it is not re-litigated in a component: an icon,
 * a badge, one screen, expandable cards. No claim, no rewards, no collection, no
 * push, no campaigns, and no Hub teaser (that is V0.1).
 */

/** The four kinds a message can be. One renderer serves all of them in V0; the
 *  discriminator exists so growing later does not need a migration. */
export const INBOX_MESSAGE_TYPES = [
  "announcement",
  "achievement",
  "gift",
  "milestone",
] as const;

export type InboxMessageType = (typeof INBOX_MESSAGE_TYPES)[number];

export function isInboxMessageType(value: unknown): value is InboxMessageType {
  return (
    typeof value === "string" &&
    (INBOX_MESSAGE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * A message as the CLIENT sees it.
 *
 * ⚠️ No `wallet`. The browser already knows whose inbox it asked for, and
 * echoing the address into every rendered row is an identifier with nothing to
 * do. The API filters by wallet; the payload does not repeat it.
 */
export type InboxMessage = {
  readonly id: string;
  readonly type: InboxMessageType;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  /** ISO. `null` means unread — the flag and the moment in one field. */
  readonly readAt: string | null;
  readonly createdAt: string;
};

/** What `/api/inbox` answers. */
export type InboxPayload = {
  readonly messages: readonly InboxMessage[];
  readonly unreadCount: number;
};

/** The Hub only needs the number, never the bodies. */
export type InboxSummary = {
  readonly unreadCount: number;
};

/**
 * What the badge shows.
 *
 * ⛔ Returns null at zero rather than "0": the badge must DISAPPEAR, not render
 * an empty state. Capped at "9+" so a long-neglected inbox cannot stretch a chip
 * that sits in a 390px header.
 */
export function badgeLabel(unreadCount: number): string | null {
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) return null;
  return unreadCount > 9 ? "9+" : String(Math.trunc(unreadCount));
}

/**
 * Split for the two sections of the screen.
 *
 * Newest first inside each group. Unread lead because the whole point of the
 * badge is to bring the player to something they have not seen.
 */
export function partitionInbox(messages: readonly InboxMessage[]): {
  unread: readonly InboxMessage[];
  read: readonly InboxMessage[];
} {
  const byNewest = [...messages].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return {
    unread: byNewest.filter((m) => m.readAt === null),
    read: byNewest.filter((m) => m.readAt !== null),
  };
}

/** Unread count derived from the list the client already holds, so marking one
 *  read updates the badge without a second round trip. */
export function countUnread(messages: readonly InboxMessage[]): number {
  return messages.reduce((n, m) => (m.readAt === null ? n + 1 : n), 0);
}

/**
 * A message is hidden once it expires.
 *
 * ⚠️ Applied on READ, not by deleting rows: a message that vanished from a
 * player's screen is still something we may need to explain later.
 */
export function isVisible(
  message: Pick<InboxMessage, "createdAt"> & { expiresAt?: string | null },
  nowMs: number,
): boolean {
  if (!message.expiresAt) return true;
  const expiry = Date.parse(message.expiresAt);
  return Number.isNaN(expiry) ? true : expiry > nowMs;
}
