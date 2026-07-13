"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/navigation";
import { PlayHubScaffold } from "@/components/hub/play-hub-scaffold";
import { usePlayHubData } from "@/components/hub/use-play-hub-data";
import type { HubInitialSheet } from "@/components/hub/hub-scaffold-client";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { useShopSheetState } from "@/lib/shop/use-shop-sheet-state";
import { track } from "@/lib/telemetry";

const ProSheet = dynamic(
  () => import("@/components/pro/pro-sheet").then((module) => module.ProSheet),
  { ssr: false },
);
const ShopSheet = dynamic(
  () => import("@/components/exercises/shop-sheet").then((module) => module.ShopSheet),
  { ssr: false },
);
const PurchaseConfirmSheet = dynamic(
  () =>
    import("@/components/exercises/purchase-confirm-sheet").then(
      (module) => module.PurchaseConfirmSheet,
    ),
  { ssr: false },
);

type ProShape =
  | { active: true; daysRemaining: number }
  | { active: false };

function deriveProShape(
  status: { active: boolean; expiresAt: number | null } | null,
): ProShape {
  if (!status?.active) return { active: false };
  const remaining = daysRemaining(status.expiresAt, Date.now());
  return remaining == null
    ? { active: false }
    : { active: true, daysRemaining: remaining };
}

export function PlayHubClient({
  initialSheet,
}: {
  initialSheet?: HubInitialSheet;
}) {
  const router = useRouter();
  const { address, isConnected, mintedVictoryCount } = usePlayHubData();
  const { connectWallet } = useConnectWallet();
  const proSheet = useProSheetState();
  const shopSheet = useShopSheetState({
    onSelectProItem: proSheet.openSheet,
  });
  const initialSheetOpenedRef = useRef(false);
  const pro = useMemo(() => deriveProShape(proSheet.proStatus), [proSheet.proStatus]);

  useEffect(() => {
    if (!initialSheet || initialSheetOpenedRef.current) return;
    initialSheetOpenedRef.current = true;
    if (initialSheet === "pro") proSheet.openSheet();
    if (initialSheet === "shop") shopSheet.openSheet();
    if (initialSheet === "trophies") router.push("/trophies");
  }, [initialSheet, proSheet, router, shopSheet]);

  useEffect(() => {
    track("play_hub_view", { wallet_connected: isConnected });
  }, [isConnected]);

  const handleArenaPress = useCallback(() => {
    track("play_hub_arena_tap");
    router.push("/arena?fresh=1");
  }, [router]);

  return (
    <>
      <PlayHubScaffold
        mintedVictoryCount={mintedVictoryCount}
        isWalletConnected={isConnected}
        pro={pro}
        onConnectTap={() => {
          track("play_hub_connect_tap");
          connectWallet();
        }}
        onTrophyTap={() => {
          track("play_hub_victories_tap", {
            count: mintedVictoryCount,
            wallet_connected: isConnected,
          });
          router.push("/trophies");
        }}
        onProTap={() => {
          track("play_hub_pro_tap", { pro_active: pro.active });
          proSheet.openSheet();
        }}
        onCoachTap={() => {
          // The Coach opens the room instead of selling the door. The journal
          // was never PRO-gated — /coach/history renders for any connected
          // wallet — so the paywall here only guaranteed that a player who
          // never bought PRO never learned the analysis existed. The sale now
          // lives inside, behind the player's own matches. `pro_active` stays
          // on the event: it is how we count free players entering.
          track("play_hub_coach_tap", { pro_active: pro.active });
          router.push("/coach/history");
        }}
        onShopTap={() => {
          track("play_hub_shop_tap", { wallet_connected: Boolean(address) });
          shopSheet.openSheet();
        }}
        onArenaPress={handleArenaPress}
      />
      <ProSheet {...proSheet.sheetProps} />
      <ShopSheet {...shopSheet.sheetProps} />
      <PurchaseConfirmSheet {...shopSheet.confirmProps} />
    </>
  );
}
