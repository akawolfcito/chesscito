"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { countUnread, type InboxMessage } from "./types";

/**
 * The client side of the Inbox.
 *
 * ⛔ NO POLLING. V0 does not need realtime, and a Hub that re-asks on a timer is
 * how a cheap surface becomes an expensive one. The count refreshes on mount, on
 * an explicit `refresh()`, and — for free — whenever a message is marked read,
 * because the new count is derived from the list already in memory.
 *
 * ⛔ AND NO TELEMETRY IN HERE. `peones_balance_viewed` fires from a `useEffect`
 * when its fetch resolves, and now sits at 26.979 events nobody asked for: it is
 * the noisiest event in the product and it means nothing, because looking is not
 * an action. Inbox events are emitted at the TAP, by the component that owns the
 * tap.
 */

export type InboxState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; messages: readonly InboxMessage[]; unreadCount: number };

export function useInbox(wallet: string | undefined): {
  state: InboxState;
  refresh: () => void;
  markRead: (id: string) => Promise<void>;
} {
  const [state, setState] = useState<InboxState>({ status: "idle" });
  const [token, setToken] = useState(0);
  // Guards a setState after unmount, and a response from a wallet the user has
  // already switched away from.
  const activeWalletRef = useRef<string | undefined>(wallet);
  activeWalletRef.current = wallet;

  useEffect(() => {
    if (!wallet) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/inbox?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((json: { messages?: InboxMessage[]; unreadCount?: number }) => {
        if (cancelled || activeWalletRef.current !== wallet) return;
        const messages = json.messages ?? [];
        setState({
          status: "ok",
          messages,
          unreadCount: json.unreadCount ?? countUnread(messages),
        });
      })
      .catch(() => {
        if (cancelled) return;
        // An inbox that cannot load must never block the Hub. `error` renders
        // no badge, which is the same as having nothing new.
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [wallet, token]);

  const refresh = useCallback(() => setToken((n) => n + 1), []);

  const markRead = useCallback(
    async (id: string) => {
      if (!wallet) return;

      /* Optimistic, and deliberately so: the badge has to drop the instant the
       * card opens. The server call is idempotent (`is("read_at", null)`), so a
       * retry cannot move the timestamp twice, and a failure leaves the message
       * unread on the next load rather than lying forever. */
      setState((prev) => {
        if (prev.status !== "ok") return prev;
        const messages = prev.messages.map((m) =>
          m.id === id && m.readAt === null
            ? { ...m, readAt: new Date().toISOString() }
            : m,
        );
        return { status: "ok", messages, unreadCount: countUnread(messages) };
      });

      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, id }),
      }).catch(() => {
        // Swallowed on purpose: the read state is a convenience, not a
        // transaction. It reconciles on the next load.
      });
    },
    [wallet],
  );

  return { state, refresh, markRead };
}

/** The number the badge needs, with no message bodies attached. */
export function unreadCountOf(state: InboxState): number {
  return state.status === "ok" ? state.unreadCount : 0;
}
