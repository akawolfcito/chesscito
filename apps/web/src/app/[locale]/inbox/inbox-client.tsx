"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";

import { InboxScreen } from "@/components/inbox/inbox-screen";
import { useInbox } from "@/lib/inbox/use-inbox";
import { track } from "@/lib/telemetry";

/**
 * Everything the Inbox needs from the framework, in one small file — the same
 * shape `DuelArenaRoute` uses, and for the same reason: the screen itself stays
 * a pure component that a test can render with plain props.
 */
export function InboxClient() {
  const { address } = useAccount();
  const locale = useLocale();
  const router = useRouter();
  const { state, markRead } = useInbox(address);

  /* `inbox_opened` fires ONCE per visit, on arrival — this is a navigation, so
   * arriving IS the action. The ref is what keeps StrictMode's double effect
   * and any re-render from turning one visit into several events. */
  const announcedRef = useRef(false);
  useEffect(() => {
    if (announcedRef.current || state.status !== "ok") return;
    announcedRef.current = true;
    track("inbox_opened", { unread_count: state.unreadCount });
  }, [state]);

  const onBack = useCallback(() => {
    router.push(`/${locale}`);
  }, [locale, router]);

  const messages = state.status === "ok" ? state.messages : [];

  return (
    <InboxScreen messages={messages} onBack={onBack} onMarkRead={markRead} />
  );
}
