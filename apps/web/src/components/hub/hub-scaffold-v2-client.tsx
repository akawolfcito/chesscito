"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { PrimitiveBoundary } from "@/components/error/primitive-boundary";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import { ProSheet } from "@/components/pro/pro-sheet";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { HUB_V2_DOCK_COPY } from "@/lib/content/editorial";
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
import type { PieceId } from "@/lib/game/types";

import {
  MasteryDashboard,
  type MasteryTileData,
} from "./mastery-dashboard";
import { TrainingPassBand } from "./training-pass-band";
import type { MasteryState } from "./mastery-tile";

/** Each shield purchase grants this many on-chain uses (Retry Shield
 *  v1 spec). The on-chain `buyItem` quantity is always 1; the per-buy
 *  3-use multiplier is the UX abstraction surfaced as the chip count. */
const SHIELDS_PER_PURCHASE = 3;

/** Stars-per-piece ceiling (3 stars × 6 pieces = 18). Used to normalize
 *  `masteryProgress` into a 0..1 ratio for the PLAY-tap telemetry payload
 *  consumed by §7.4 promote criterion 1. */
const MASTERY_STARS_TOTAL = 18;

type Atmosphere = "cool-stone" | "warm-wood";
export type HubV2InitialSheet = "shop" | "pro" | "badges";

/** Splash is dynamic+ssr:false (Phase 7 nota in
 *  `2026-05-09-hub-phase-3-handoff.md` §"Notas Phase 7") to keep the
 *  first-paint critical path free of localStorage / matchMedia work that
 *  only matters once on first-ever-visit. */
const HubV2Splash = dynamic(
  () => import("./hub-splash").then((m) => m.HubV2Splash),
  { ssr: false },
);

/** Placeholder mastery tile data. Real on-chain badges + exercise stars
 *  wiring is intentionally NOT in this commit — the design-lock §6.1 row
 *  2 wiring lands once the contract reads consolidate behind a single
 *  hook. Until then, every buildable piece renders as `locked-buildable`
 *  with 0/3 stars and Q/K stay `coming-soon`. The dashboard's tap +
 *  telemetry contract is independent of the data source, so the V2
 *  composition test exercises layout + payload shape without any
 *  on-chain mocks here. */
const PLACEHOLDER_TILES: Record<PieceId, MasteryTileData> = {
  rook: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
  bishop: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
  knight: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
  pawn: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
  queen: { state: "coming-soon", starsEarned: 0, starsTotal: 3 },
  king: { state: "coming-soon", starsEarned: 0, starsTotal: 3 },
};

/** Phase 7 commit a — V2 composition + flag mechanics.
 *
 *  Layout (design-lock §1 + §9.5):
 *    1. HubV2Splash overlay (dynamic, first-visit only)
 *    2. Atmosphere-aware Training Pass band
 *    3. Mastery dashboard (2x3 piece tiles)
 *    4. Sticky dock — PrincipalButton PLAY ARENA + secondary links + shield ribbon
 *
 *  Atmosphere is `cool-stone` on mount and shifts to `warm-wood` when a
 *  PRO purchase succeeds. The `[data-pro-active]` data attribute on the
 *  scaffold root is the hook for the §7.2 CSS palette swap that lands
 *  in commit b alongside the contrast gate.
 *
 *  Mastery tile + sheet wiring stay placeholder/in-place; real on-chain
 *  reads are scoped to a follow-up commit per §6.1 row 2. The four
 *  primitives this scaffold composes (splash / mastery / training band /
 *  dock) each own their own test file — this client owns the
 *  composition + flag + atmosphere contract only. */
export function HubScaffoldV2Client({
  initialSheet,
}: {
  initialSheet?: HubV2InitialSheet;
}) {
  const router = useRouter();
  const { address } = useAccount();
  const [atmosphere, setAtmosphere] = useState<Atmosphere>("cool-stone");
  const [shields, setShields] = useState<number>(0);

  const handleProPurchaseSuccess = useCallback(
    (receipt: ProPurchaseReceipt) => {
      // Cross-wallet receipt guard (design-lock §6.4 race 3): drop
      // silently if the active wallet has changed since purchase init.
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
    onPurchaseSuccess: handleProPurchaseSuccess,
  });

  // BadgeSheet orchestration — owns claim flow + on-chain reads.
  const badgeSheet = useBadgeSheetState({
    onNavigateToTrophies: () => router.push("/trophies"),
  });

  const handleShopPurchaseSuccess = useCallback(
    (receipt: ShopPurchaseReceipt) => {
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
  const openBadgeSheet = badgeSheet.openSheet;
  const openProSheet = proSheet.openSheet;
  const openShopSheet = shopSheet.openSheet;
  const initialSheetOpenedRef = useRef(false);

  useEffect(() => {
    if (!initialSheet || initialSheetOpenedRef.current) return;
    initialSheetOpenedRef.current = true;
    if (initialSheet === "shop") {
      openShopSheet();
    } else if (initialSheet === "pro") {
      openProSheet();
    } else {
      openBadgeSheet();
    }
  }, [initialSheet, openBadgeSheet, openProSheet, openShopSheet]);

  const handleMasteryTileTap = useCallback(
    (_piece: PieceId, _state: MasteryState) => {
      // Tile-level telemetry already fires inside `<MasteryDashboard>`.
      // The scaffold's role is to open the BadgeSheet for buildable
      // pieces; coming-soon pieces are intercepted by the dashboard.
      badgeSheet.openSheet();
    },
    [badgeSheet],
  );

  const handlePlayTap = useCallback(() => {
    const totalStars = (Object.values(PLACEHOLDER_TILES) as MasteryTileData[])
      .reduce((sum, tile) => sum + tile.starsEarned, 0);
    const masteryProgress = totalStars / MASTERY_STARS_TOTAL;
    track("hub_v2_play_dock_tap", { masteryProgress });
    router.push("/arena");
  }, [router]);

  const proActive = atmosphere === "warm-wood";

  return (
    <PrimitiveBoundary primitiveName="HubScaffoldV2" surface="hub">
      <div
        data-testid="hub-v2-root"
        data-hub-v2=""
        data-atmosphere={atmosphere}
        {...(proActive ? { "data-pro-active": "" } : {})}
        className="hub-v2-root"
      >
        <HubV2Splash />

        <header className="hub-v2-topbar" aria-label="Hub status">
          <span className="hub-v2-status-pill hub-v2-status-pill-trophy">
            <img
              src="/art/redesign/icons/trophy.webp"
              alt=""
              aria-hidden="true"
              className="hub-v2-status-icon"
            />
            <span>1</span>
          </span>
          <button
            type="button"
            className="hub-v2-status-pill hub-v2-status-pill-coach"
            onClick={() => proSheet.openSheet()}
          >
            <img
              src="/art/redesign/icons/coach.webp"
              alt=""
              aria-hidden="true"
              className="hub-v2-status-icon"
            />
            <span>Coach</span>
          </button>
        </header>

        <main className="hub-v2-stage" aria-label="Chesscito hub">
          <div className="hub-v2-title-banner" aria-hidden="true">
            Chesscito
          </div>

          <div className="hub-v2-stage-grid">
            <MasteryDashboard
              tiles={PLACEHOLDER_TILES}
              claimed={badgeSheet.badgesClaimed}
              streakDays={0}
              onTileTap={handleMasteryTileTap}
            />

            <TrainingPassBand
              active={proActive}
              daysRemaining={proActive ? 30 : undefined}
              sessionsUsed={proActive ? 0 : undefined}
              sessionsTotal={proActive ? 12 : undefined}
              renewsAt={proActive ? "" : undefined}
              testId="hub-v2-pro-chip"
              onTap={() => proSheet.openSheet()}
            />
          </div>
        </main>

        <footer
          data-component="hub-v2-dock"
          aria-label={HUB_V2_DOCK_COPY.primaryActionsAriaLabel}
          className="hub-v2-dock"
        >
          <button
            type="button"
            data-testid="hub-v2-shield-ribbon"
            data-shields={shields}
            className="hub-v2-dock-shields"
            aria-label={HUB_V2_DOCK_COPY.shieldsRibbonAriaLabel(shields)}
            onClick={() => shopSheet.openSheet()}
          >
            {HUB_V2_DOCK_COPY.shieldsRibbonLabel(shields)}
          </button>

          <div className="hub-v2-dock-links">
            <Link
              href="/exercises"
              data-testid="hub-v2-practice-link"
              className="hub-v2-dock-link"
              aria-label={HUB_V2_DOCK_COPY.practiceLinkAriaLabel}
            >
              {HUB_V2_DOCK_COPY.practiceLinkLabel}
            </Link>
            <Link
              href="/trophies"
              data-testid="hub-v2-trophies-link"
              className="hub-v2-dock-link"
              aria-label={HUB_V2_DOCK_COPY.trophiesLinkAriaLabel}
            >
              {HUB_V2_DOCK_COPY.trophiesLinkLabel}
            </Link>
          </div>

          <PrincipalButton
            size="large"
            onClick={handlePlayTap}
            aria-label={HUB_V2_DOCK_COPY.playAriaLabel}
            className="hub-v2-dock-play"
          >
            <span data-testid="hub-v2-play-cta">
              {HUB_V2_DOCK_COPY.playLabel}
            </span>
          </PrincipalButton>
        </footer>

        <ProSheet {...proSheet.sheetProps} />
        <BadgeSheet {...badgeSheet.sheetProps} />
        <ShopSheet {...shopSheet.sheetProps} />
        <PurchaseConfirmSheet {...shopSheet.confirmProps} />
      </div>
    </PrimitiveBoundary>
  );
}
