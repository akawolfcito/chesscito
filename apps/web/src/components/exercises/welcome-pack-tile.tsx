"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

/**
 * Welcome Pack tile — pinned at the TOP of the Shop sheet.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §4. Implements the Forcing-Function-for-Catalog-
 * Awareness pattern (docs/design-patterns/game-economy-patterns.md):
 * a free starter inventory tile that breaks the "shop = paywall"
 * mental model and forces the first shop visit at a high-motivation
 * moment.
 *
 * Visual contract:
 *   - Tile frame: `.shop-item-tile` + `data-tone="welcome"` (warm
 *     cream-amber gradient, differentiates from purple/orange/blue
 *     tiles without competing for the Featured ribbon slot)
 *   - Sticker sprite overhang: DEFERRED. Asset (shield-gift,
 *     triplet PNG/WEBP/AVIF) is requested in spec §3.6 backlog;
 *     this commit ships the layout slot and tone but no sprite art
 *     to avoid blocking on a design dependency. When the sprite
 *     lands, slot into `.welcome-pack-tile-sticker`.
 *   - CTA: candy-pill `--green` family (matches the standard buy CTA
 *     vocabulary so users recognize the affordance).
 *
 * Commit 5 of 10 in cluster: this component renders the visual + the
 * post-claim collapse state. Commit 6 wires it to wagmi
 * useSignMessage + POST /api/welcome-pack/claim.
 */

export type WelcomePackTileState =
  /** Default. User has not claimed and wallet is connected. CTA: "Claim free". */
  | "idle"
  /** Wallet not connected. CTA: "Connect to claim". */
  | "connect"
  /** Claim in-flight. CTA shows spinner + disabled. */
  | "claiming"
  /** Claim succeeded. Tile collapses to a compact "Claimed · {date}"
   *  affordance. Does NOT disappear: preserves trust + serves as
   *  anchor for future seasonal welcome packs. */
  | "claimed";

type WelcomePackTileProps = {
  state: WelcomePackTileState;
  /** ISO timestamp from the server's `claimed_at` column. Renders
   *  short-format ("May 31") inside the post-claim collapsed row. */
  claimedAt?: string | null;
  /** Primary action handler. Required for `idle` state; ignored when
   *  the tile is in a non-actionable state. */
  onClaim?: () => void;
  /** Connect handler — opens the wallet connect flow when `state` is
   *  `connect`. */
  onConnect?: () => void;
  /** When true, render as a half-width mini-card (2-col grid format,
   *  smaller sticker, condensed copy). Used inside the new "mini
   *  cards" zone of the Shop sheet (user feedback 2026-06-01: too
   *  much scroll, want everything closer to the fold). When false
   *  (default), renders the original full-width pinned tile. */
  compact?: boolean;
};

function formatClaimedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function WelcomePackTile({
  state,
  claimedAt,
  onClaim,
  onConnect,
  compact = false,
}: WelcomePackTileProps) {
  const t = useTranslations("WELCOME_PACK_COPY");

  if (state === "claimed") {
    const dateStr = formatClaimedDate(claimedAt);
    return (
      <div
        className="welcome-pack-tile welcome-pack-tile--claimed"
        data-tone="welcome"
        role="status"
      >
        <span className="welcome-pack-tile-checkmark" aria-hidden="true">
          ✓
        </span>
        <p className="welcome-pack-tile-claimed-label">
          {t("claimedLabel")}
          {dateStr ? ` · ${dateStr}` : ""}
        </p>
      </div>
    );
  }

  const isConnectGated = state === "connect";
  const isClaiming = state === "claiming";
  const ctaLabel = isConnectGated ? t("cta.connect") : t("cta.claim");
  const handleClick = isConnectGated ? onConnect : onClaim;

  return (
    <div
      className={[
        "shop-item-tile",
        "welcome-pack-tile",
        compact ? "shop-item-tile--compact welcome-pack-tile--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-tone="welcome"
      data-copy-key="welcomePack"
    >
      {/* Sticker overhang sprite — shipped 2026-06-01 from
       *  design/version1-new/welcome-gift-icon.png. Overhangs the
       *  tile via the existing slot reserved earlier in the cluster.
       *  Triplet under /art/shop/welcome-gift. */}
      <ThemeAssetPicture slot="shared.welcome-gift" pictureClassName="welcome-pack-tile-sticker-slot welcome-pack-tile-sticker" alt="" aria-hidden="true" draggable={false} />

      <div className="shop-item-tile-identity welcome-pack-tile-identity">
        <p className="shop-item-tile-name">{t("tile.title")}</p>
        <p className="shop-item-tile-subtitle">{t("tile.subtitle")}</p>
        <p className="welcome-pack-tile-body">{t("tile.body")}</p>
      </div>

      <div className="shop-item-tile-footer welcome-pack-tile-footer">
        <button
          type="button"
          className="candy-tray-pill shop-item-tile-buy-pill shop-item-tile-buy-pill--green"
          disabled={isClaiming || !handleClick}
          onClick={handleClick}
          aria-label={ctaLabel}
        >
          {isClaiming ? "…" : ctaLabel}
        </button>
      </div>
    </div>
  );
}
