"use client";

import { badgeLabel } from "@/lib/inbox/types";

export type InboxTriggerProps = {
  /** Unread messages. 0 renders the envelope with no badge. */
  unread: number;
  onClick: () => void;
};

/**
 * The Inbox header entry, as pure presentation.
 *
 * ⛔ NO HOOKS IN HERE — that is the whole point. `InboxChip` reads the wallet
 * (`useAccount`) and the inbox, and `/dev` mounts no wagmi provider, so the chip
 * rendered NOTHING in the fixture: the vr17 play-hub baselines were photographs
 * of a header missing the envelope that actually ships. A fixture photographs
 * only what it is handed, so the thing being photographed has to be handed in.
 *
 * Same split the repo already made twice: `HubDailyTile` → `HubDailyTrigger`,
 * and the Peones chip, which stopped reading the wallet two levels below a
 * scaffold that advertised itself as presentational.
 *
 * ⛔ ITS OWN ICON, NOT THE GIFT. The gift in the header is the Welcome Package
 * claim (`useLiteWelcomeGiftClaim`, three surfaces). `welcome_pack` has 7.101
 * rows in `peones_ledger` — the most used source of Peones in the product and
 * the first thing a new player ever taps. Reusing it for the Inbox would take a
 * newcomer's welcome gift away to show them an empty tray (founder, 2026-08-25).
 */
export function InboxTrigger({ unread, onClick }: InboxTriggerProps) {
  const badge = badgeLabel(unread);

  return (
    <button
      aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
      className="inbox-chip"
      data-testid="inbox-chip"
      data-unread={unread > 0 || undefined}
      onClick={onClick}
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
