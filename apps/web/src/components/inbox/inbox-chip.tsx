"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { badgeLabel } from "@/lib/inbox/types";
import { useInbox, unreadCountOf } from "@/lib/inbox/use-inbox";
import { track } from "@/lib/telemetry";

/**
 * The Inbox entry point in the header.
 *
 * ⛔ ITS OWN ICON, NOT THE GIFT. The gift in the header is the Welcome Package
 * claim (`useLiteWelcomeGiftClaim`, three surfaces). `welcome_pack` has 7.101
 * rows in `peones_ledger` — the most used source of Peones in the product and
 * the first thing a new player ever taps. Reusing it for the Inbox would take a
 * newcomer's welcome gift away to show them an empty tray (founder, 2026-08-25).
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
  const badge = badgeLabel(unread);

  return (
    <button
      aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
      className="inbox-chip"
      data-testid="inbox-chip"
      data-unread={unread > 0 || undefined}
      onClick={() => {
        // On the tap. Never on render — see the note in inbox-screen.tsx.
        track("inbox_chip_tap", { unread_count: unread });
        router.push(`/${locale}/inbox`);
      }}
      type="button"
    >
      <span aria-hidden="true" className="inbox-chip-icon">
        ✉️
      </span>
      {badge ? (
        <span className="inbox-chip-badge" data-testid="inbox-chip-badge">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
