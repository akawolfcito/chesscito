"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { InboxTrigger } from "@/components/inbox/inbox-trigger";
import { useInbox, unreadCountOf } from "@/lib/inbox/use-inbox";
import { track } from "@/lib/telemetry";

/**
 * The Inbox entry point in the header — the STATEFUL half.
 *
 * Everything visual lives in `<InboxTrigger>`, which takes the count as a prop
 * so the hub fixture can photograph it. See the note there: this component
 * cannot be rendered under `/dev` (no wagmi provider), which is exactly why the
 * split exists.
 *
 * ⛔ Renders NOTHING without a wallet. An inbox belongs to somebody; a chip that
 * opens an empty screen for a visitor is a dead end in the header.
 */
export function InboxChip() {
  const { address } = useAccount();
  const locale = useLocale();
  const router = useRouter();
  const { state } = useInbox(address);

  if (!address) return null;

  const unread = unreadCountOf(state);

  return (
    <InboxTrigger
      unread={unread}
      onClick={() => {
        // On the tap. Never on render — see the note in inbox-screen.tsx.
        track("inbox_chip_tap", { unread_count: unread });
        router.push(`/${locale}/inbox`);
      }}
    />
  );
}
