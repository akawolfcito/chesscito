"use client";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
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
      {/* A BELL, not an envelope (2026-08-30). The Inbox carries
          `announcement · achievement · gift · milestone` — three of the four
          are "something happened to you", which is notification semantics, not
          correspondence. A bell also promises recurrence, which is what a
          population where 434 of 443 wallets play a single day needs promised.

          ⛔ The bell is NEWS; the gift beside it is a MECHANIC. They share an
          art register (gold with purple bands) and sit adjacent, so the rule
          has to be explicit: the 🎁 is the Daily and is tapped to claim, the
          bell is read. An Inbox message of type `gift` announces a gift — it
          never replaces the Daily. */}
      <ThemeAssetPicture
        slot="shared.inbox-bell"
        pictureClassName="inbox-chip-icon"
        alt=""
        aria-hidden="true"
        width={320}
        height={355}
      />
      {badge ? (
        <span className="inbox-chip-badge" data-testid="inbox-chip-badge">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
