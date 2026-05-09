"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { PrimitiveBoundary } from "@/components/error/primitive-boundary";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import { ProSheet } from "@/components/pro/pro-sheet";
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { SHIELD_ITEM_ID } from "@/lib/contracts/shop-catalog";
import {
  useProSheetState,
  type ProPurchaseReceipt,
} from "@/lib/pro/use-pro-sheet-state";
import {
  useShopSheetState,
  type ShopPurchaseReceipt,
} from "@/lib/shop/use-shop-sheet-state";
import { track } from "@/lib/telemetry";

/** Each shield purchase grants this many on-chain uses (Retry Shield
 *  v1 spec). The on-chain `buyItem` quantity is always 1; the per-buy
 *  3-use multiplier is the UX abstraction surfaced as the chip count. */
const SHIELDS_PER_PURCHASE = 3;

type Atmosphere = "cool-stone" | "warm-wood";

/** Phase 3 commit 1 of the hub redesign — minimal V2 scaffold that ports
 *  `<ProSheet>` in-place. Lives parallel to V1 (`<HubScaffoldClient>`)
 *  and is NOT yet wired to `app/hub/page.tsx`; the `?hub=v2` flag arrives
 *  in Phase 7. The mastery dashboard, splash, and training band are
 *  scoped to phases 4–6 — this commit only validates the sheet port +
 *  atmosphere shift telemetry contract.
 *
 *  Design-lock spec: `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` */
export function HubScaffoldV2Client() {
  const router = useRouter();
  const { address } = useAccount();
  const [atmosphere, setAtmosphere] = useState<Atmosphere>("cool-stone");
  const [shields, setShields] = useState<number>(0);

  const handlePurchaseSuccess = useCallback(
    (receipt: ProPurchaseReceipt) => {
      // Cross-wallet receipt guard (design-lock §6.4 race 3): if the
      // active wallet has changed between purchase initiation and receipt
      // confirmation (multi-tab session drift), drop silently rather than
      // leak atmosphere into another session's state.
      if (address && receipt.buyer.toLowerCase() !== address.toLowerCase()) {
        return;
      }

      const from: Atmosphere = "cool-stone";
      const to: Atmosphere = "warm-wood";
      setAtmosphere(to);
      track("hub_atmosphere_shift", { from, to, trigger: "purchase" });
    },
    [address],
  );

  const proSheet = useProSheetState({
    onPurchaseSuccess: handlePurchaseSuccess,
  });

  // BadgeSheet orchestration — owns claim flow + on-chain reads. Mastery
  // tile taps open the sheet in-place; tile state reads `badgesClaimed`
  // from the same hook so the post-claim refetch propagates without an
  // extra `useReadContracts` call here (design-lock §6.1 row 2).
  const badgeSheet = useBadgeSheetState({
    onNavigateToTrophies: () => router.push("/trophies"),
  });
  const rookClaimed = badgeSheet.badgesClaimed.rook === true;

  const handleShopPurchaseSuccess = useCallback(
    (receipt: ShopPurchaseReceipt) => {
      // Cross-wallet receipt guard (design-lock §6.4 race 3): drop
      // silently if the active wallet has changed since purchase init.
      if (address && receipt.buyer.toLowerCase() !== address.toLowerCase()) {
        return;
      }
      if (receipt.itemId === SHIELD_ITEM_ID) {
        setShields(
          (prev) => prev + receipt.quantity * SHIELDS_PER_PURCHASE,
        );
      }
    },
    [address],
  );

  const shopSheet = useShopSheetState({
    onPurchaseSuccess: handleShopPurchaseSuccess,
  });

  return (
    <PrimitiveBoundary primitiveName="HubScaffoldV2" surface="hub">
      <div data-hub-v2="" data-atmosphere={atmosphere}>
        <button
          type="button"
          data-testid="hub-v2-pro-chip"
          onClick={() => proSheet.openSheet()}
        >
          PRO
        </button>
        <button
          type="button"
          data-testid="hub-v2-mastery-tile-rook"
          data-claimed={rookClaimed ? "true" : "false"}
          onClick={() => badgeSheet.openSheet()}
        >
          Rook
        </button>
        <button
          type="button"
          data-testid="hub-v2-shield-ribbon"
          data-shields={shields}
          onClick={() => shopSheet.openSheet()}
        >
          Shield ×{shields}
        </button>
        <ProSheet {...proSheet.sheetProps} />
        <BadgeSheet {...badgeSheet.sheetProps} />
        <ShopSheet {...shopSheet.sheetProps} />
        <PurchaseConfirmSheet {...shopSheet.confirmProps} />
      </div>
    </PrimitiveBoundary>
  );
}
