"use client";

import { useRef, useState } from "react";

import { track } from "@/lib/telemetry";
import {
  partitionInbox,
  type InboxMessage,
  type InboxMessageType,
} from "@/lib/inbox/types";

/**
 * The Inbox screen — one list, expandable cards.
 *
 * ⛔ NO SECOND SCREEN FOR DETAIL (founder, 2026-08-25). The messages are a few
 * lines long; a dedicated route would be an extra tap and a back button in
 * exchange for nothing. The card grows in place.
 *
 * ⛔ EVENTS FIRE ON THE TAP, never from an effect. That is the difference
 * between this and `peones_balance_viewed`, which resolves a fetch inside a
 * `useEffect` and has produced 26.979 events that record no intention at all.
 */

const TYPE_ICON: Record<InboxMessageType, string> = {
  announcement: "📣",
  achievement: "⭐",
  gift: "🎁",
  milestone: "🔥",
};

function relativeDay(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.floor((nowMs - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toISOString().slice(0, 10);
}

export function InboxScreen({
  messages,
  onMarkRead,
  onBack,
  nowMs = Date.now(),
}: {
  messages: readonly InboxMessage[];
  onMarkRead: (id: string) => void;
  onBack: () => void;
  nowMs?: number;
}) {
  /* ⛔ THE SECTIONS ARE FROZEN ON MOUNT, and this is a bug fix, not a style.
   *
   * Partitioning live meant that opening an unread card marked it read, which
   * moved it from "New for you" to "Earlier" — React unmounted it from one
   * section and mounted it in the other, and the card's local `open` state went
   * with it. The body opened and closed itself in the same tap. Caught by the
   * DOM smoke (`bodyOpen: 0` after the click), never by the 29 unit tests, which
   * render a fixed list and cannot see a remount.
   *
   * Freezing also fixes the UX underneath the bug: a message must not jump out
   * from under the finger that is reading it. The list re-sorts on the next
   * visit, which is when a player expects it to. */
  const [initialUnreadIds] = useState(
    () => new Set(messages.filter((m) => m.readAt === null).map((m) => m.id)),
  );

  const grouped = partitionInbox(messages);
  const unread = [...grouped.unread, ...grouped.read].filter((m) =>
    initialUnreadIds.has(m.id),
  );
  const read = [...grouped.unread, ...grouped.read].filter(
    (m) => !initialUnreadIds.has(m.id),
  );

  return (
    <main className="inbox-screen" data-testid="inbox-screen">
      <header className="inbox-header">
        <button
          aria-label="Back"
          className="inbox-back"
          data-testid="inbox-back"
          onClick={onBack}
          type="button"
        >
          ←
        </button>
        <h1 className="inbox-title">Inbox</h1>
      </header>

      {messages.length === 0 ? (
        <p className="inbox-empty" data-testid="inbox-empty">
          Nothing new right now.
        </p>
      ) : null}

      {unread.length > 0 ? (
        <section data-testid="inbox-section-unread">
          <h2 className="inbox-section-title">New for you</h2>
          {unread.map((m) => (
            <InboxCard
              key={m.id}
              message={m}
              nowMs={nowMs}
              onMarkRead={onMarkRead}
            />
          ))}
        </section>
      ) : null}

      {read.length > 0 ? (
        <section data-testid="inbox-section-read">
          <h2 className="inbox-section-title">Earlier</h2>
          {read.map((m) => (
            <InboxCard
              key={m.id}
              message={m}
              nowMs={nowMs}
              onMarkRead={onMarkRead}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}

function InboxCard({
  message,
  onMarkRead,
  nowMs,
}: {
  message: InboxMessage;
  onMarkRead: (id: string) => void;
  nowMs: number;
}) {
  const [open, setOpen] = useState(false);
  /* ⛔ A LOCAL LATCH, not a re-read of `message.readAt`. The parent does update
   * that prop optimistically, but relying on it made a re-expand fire a SECOND
   * `onMarkRead` whenever the parent had not re-rendered yet — the card must not
   * depend on somebody else's state landing first. Caught by its own test. */
  const markedRef = useRef(false);
  const isUnread = message.readAt === null && !markedRef.current;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return; // Collapsing is not a read.

    track("inbox_message_opened", {
      message_id: message.id,
      message_type: message.type,
      was_unread: isUnread,
    });

    if (isUnread) {
      markedRef.current = true;
      onMarkRead(message.id);
    }
  }

  return (
    <article
      className={`inbox-card${isUnread ? " is-unread" : ""}`}
      data-testid="inbox-card"
      data-type={message.type}
      data-unread={isUnread || undefined}
    >
      <button
        aria-expanded={open}
        className="inbox-card-head"
        onClick={handleToggle}
        type="button"
      >
        <span aria-hidden="true" className="inbox-card-icon">
          {TYPE_ICON[message.type]}
        </span>
        <span className="inbox-card-text">
          <span className="inbox-card-title">{message.title}</span>
          <span className="inbox-card-date">
            {relativeDay(message.createdAt, nowMs)}
          </span>
        </span>
        {isUnread ? (
          <span className="inbox-card-flag" data-testid="inbox-card-new">
            New
          </span>
        ) : (
          <span aria-hidden="true" className="inbox-card-check">
            ✓
          </span>
        )}
      </button>

      {open ? (
        <div className="inbox-card-body" data-testid="inbox-card-body">
          <p>{message.body}</p>
          {message.ctaLabel ? (
            <a
              className="inbox-card-cta"
              href={message.ctaHref ?? "#"}
              onClick={() =>
                track("inbox_message_cta_clicked", {
                  message_id: message.id,
                  message_type: message.type,
                })
              }
            >
              {message.ctaLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
