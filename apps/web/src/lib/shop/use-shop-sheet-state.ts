"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { useMiniPay } from "@/hooks/use-minipay";
import {
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getShopAddress,
} from "@/lib/contracts/chains";
import { shopAbi } from "@/lib/contracts/shop";
import {
  COACH_PACK_ITEMS,
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  PRO_ITEM_ID,
  SHIELD_ITEM_ID,
  SHOP_ITEMS,
  SHOP_TILE_ASSETS,
} from "@/lib/contracts/shop-catalog";
import {
  ACCEPTED_TOKENS,
  CELO_TOKEN,
  erc20Abi,
  normalizePrice,
} from "@/lib/contracts/tokens";
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";
import { classifyTxErrorKind, isTransactionTimeout, isUserCancellation } from "@/lib/errors";
import { hapticSuccess } from "@/lib/haptics";
import { dispatchShieldChange } from "@/lib/shop/shield-events";
import {
  dequeuePendingTx,
  enqueuePendingTx,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import {
  useWelcomePackClaim,
  type UseWelcomePackClaimReturn,
} from "@/lib/shop/use-welcome-pack-claim";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { track } from "@/lib/telemetry";

const SUCCESS_BANNER_TTL_MS = 6_000;

type PaymentToken = (typeof ACCEPTED_TOKENS)[number] | typeof CELO_TOKEN;

type CatalogItem = {
  itemId: bigint;
  label: string;
  subtitle: string;
  icon: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
  celoSibling?: { itemId: bigint } | null;
};

type SuccessBanner = {
  itemLabel: string;
  txHashShort: string;
} | null;

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogItem[];
  onSelectItem: (itemId: bigint) => void;
  successBanner: SuccessBanner;
  showTrigger: false;
  /** Welcome Pack tile state + handlers (forcing-function pinned
   *  tile at the top of the catalog). Propagated from
   *  useWelcomePackClaim so all four ShopSheet callers inherit the
   *  wiring through `{...sheetProps}` without bespoke setup. */
  welcomePack: UseWelcomePackClaimReturn;
};

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: CatalogItem | null;
  chainId: number | undefined;
  shopAddress: string | null;
  paymentTokenSymbol: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isWriting: boolean;
  purchasePhase: "idle" | "approving" | "buying";
  onConfirm: () => void;
};

export type UseShopSheetStateReturn = {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  sheetProps: SheetProps;
  confirmProps: ConfirmProps;
  /** Surfaced so the scaffold can also reflect wrong-chain or wallet
   *  state separately from the sheet. */
  isCorrectChain: boolean;
  isConnected: boolean;
  /** Surfaced so the scaffold can prompt to switch / connect. Not used
   *  by the sheet props directly today. */
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
};

/** Receipt payload emitted by `useShopSheetState` to its host on a confirmed
 *  shop purchase. The hub uses this to (a) refresh the shields-count chip,
 *  (b) emit any host-level analytics. Contract sourced from design-lock
 *  §6.4 (2026-05-09). */
export type ShopPurchaseReceipt = {
  txHash: `0x${string}`;
  itemId: bigint;
  /** Units bought in the on-chain `buyItem(itemId, quantity, ...)` call.
   *  v1 always passes 1; the field is present so downstream consumers
   *  don't have to assume the contract semantics. */
  quantity: number;
  /** Wallet that paid for the item. The host validates this against the
   *  active `useAccount().address` before mutating state (defense against
   *  multi-tab session drift — design-lock §6.4 race 3). */
  buyer: `0x${string}`;
};

export type UseShopSheetStateOptions = {
  /** Fires AFTER the wagmi receipt confirms — NOT on user-initiated close.
   *  Deferred via `requestAnimationFrame` so the dispatch lands after the
   *  sheet's exit transition starts (design-lock §6.4 race 1). The host
   *  can synchronously trigger shields-count refresh / atmosphere shift. */
  onPurchaseSuccess?: (receipt: ShopPurchaseReceipt) => void;
};

/** Shop sheet orchestration extracted from `<ExercisesScreen>` so the
 *  `<HubScaffoldClient>` can render `<ShopSheet>` + `<PurchaseConfirmSheet>`
 *  in-place instead of bouncing through `/hub?legacy=1&action=shop`.
 *
 *  Red-team fixes baked in (see `docs/reviews/2026-05-08-shop-sheet-port-redteam.md`):
 *  - P1-1: `closeSheet` blocks while `purchasePhase !== "idle"`.
 *  - P1-2: `isMountedRef` gate on every async setState after `await`.
 *  - P1-3: `balancesReady` reflected in `selectPaymentToken` consumers.
 *  - P1-4: wrong-chain on confirm sets a clear error path (not silent).
 *  - P0-2: dispatches `shield-events` after localStorage write so the
 *    scaffold's chip refreshes without reload. */
export function useShopSheetState(
  options?: UseShopSheetStateOptions,
): UseShopSheetStateReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { isMiniPay } = useMiniPay();
  // Welcome Pack hook accepts an `onClaimedFresh` callback to stage
  // the post-claim auto-close (600ms celebration window: HUD chip
  // pulses with +3, tile collapses to "Claimed", then the sheet
  // closes so the player returns to the prior surface — typically
  // the rescue-modal deep-link source). See user feedback
  // 2026-05-31 on the rescue → shop → claim → return loop.
  //
  // closeSheet is defined further down via useCallback so we cannot
  // reference it directly here (TDZ). Forward via a ref that the
  // useEffect below populates each render.
  const closeSheetRef = useRef<(() => void) | null>(null);
  const welcomePack = useWelcomePackClaim({
    onClaimedFresh: () => {
      window.setTimeout(() => closeSheetRef.current?.(), 600);
    },
  });

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain =
    configuredChainId != null && chainId === configuredChainId;
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);

  const { writeContractAsync: writeShopAsync, isPending: isShopWriting } =
    useWriteContract();

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Capture the success callback in a ref so handleConfirm's deps stay
  // stable across host renders (the host doesn't have to memoize). The
  // ref is refreshed every render via the synchronous effect below.
  const onPurchaseSuccessRef = useRef(options?.onPurchaseSuccess);
  useEffect(() => {
    onPurchaseSuccessRef.current = options?.onPurchaseSuccess;
  });

  const fireOnPurchaseSuccess = useCallback(
    (txHash: string, itemId: bigint, quantity: number) => {
      const cb = onPurchaseSuccessRef.current;
      if (!cb) return;
      const buyer = address;
      if (!buyer) return;
      // rAF defer — landing after the sheet's exit transition starts so
      // shields refresh feels sequenced rather than racing with close
      // animation (design-lock §6.4 race 1).
      requestAnimationFrame(() => {
        cb({
          txHash: txHash as `0x${string}`,
          itemId,
          quantity,
          buyer: buyer as `0x${string}`,
        });
      });
    },
    [address],
  );

  const [open, setOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<bigint | null>(null);
  const [paymentToken, setPaymentToken] = useState<PaymentToken | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasePhase, setPurchasePhase] = useState<
    "idle" | "approving" | "buying"
  >("idle");
  const [successBanner, setSuccessBanner] = useState<SuccessBanner>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tShopItem = useTranslations("SHOP_ITEM_COPY");

  // Catalog read — same shape as legacy.
  const { data: onChainItems } = useReadContracts({
    contracts: SHOP_ITEMS.map((item) => ({
      address: shopAddress ?? undefined,
      abi: shopAbi,
      functionName: "getItem",
      args: [item.itemId] as const,
      chainId,
    })),
    allowFailure: true,
    query: {
      enabled: Boolean(shopAddress),
      staleTime: 5 * 60_000,
    },
  });

  const shopCatalog = useMemo<CatalogItem[]>(
    () =>
      SHOP_ITEMS.map((item, index) => {
        const label = tShopItem(`${item.copyKey}.label` as const);
        const subtitle = tShopItem(`${item.copyKey}.subtitle` as const);
        const icon = SHOP_TILE_ASSETS[item.copyKey].icon;
        const onChain = onChainItems?.[index];
        if (onChain?.status === "success" && Array.isArray(onChain.result)) {
          const price = onChain.result[0] as bigint;
          const enabled = onChain.result[1] as boolean;
          return {
            itemId: item.itemId,
            label,
            subtitle,
            icon,
            configured: price > 0n,
            enabled: price > 0n && enabled,
            onChainPrice: price,
          };
        }
        return {
          itemId: item.itemId,
          label,
          subtitle,
          icon,
          configured: false,
          enabled: false,
          onChainPrice: 0n,
        };
      }),
    [onChainItems, tShopItem],
  );

  const displayShopCatalog = useMemo<CatalogItem[]>(() => {
    const celoSibling = shopCatalog.find(
      (item) =>
        item.itemId === FOUNDER_BADGE_CELO_ITEM_ID &&
        item.configured &&
        item.enabled,
    );
    const showCeloOnFounder = !isMiniPay && celoSibling != null;
    return shopCatalog
      .filter((item) => item.itemId !== FOUNDER_BADGE_CELO_ITEM_ID)
      .map((item) =>
        item.itemId === FOUNDER_BADGE_ITEM_ID && showCeloOnFounder
          ? { ...item, celoSibling: { itemId: FOUNDER_BADGE_CELO_ITEM_ID } }
          : item,
      );
  }, [shopCatalog, isMiniPay]);

  const selectedItem = useMemo(
    () => shopCatalog.find((item) => item.itemId === selectedItemId) ?? null,
    [selectedItemId, shopCatalog],
  );

  const BALANCE_READ_TOKENS = useMemo(
    () => [...ACCEPTED_TOKENS, CELO_TOKEN],
    [],
  );
  const CELO_BALANCE_INDEX = ACCEPTED_TOKENS.length;
  const { data: tokenBalances } = useReadContracts({
    contracts: BALANCE_READ_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: Boolean(address), staleTime: 15_000 },
  });

  const { data: paymentAllowance } = useReadContract({
    address: paymentToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && shopAddress ? [address, shopAddress] : undefined,
    chainId,
    query: { enabled: Boolean(address && shopAddress && paymentToken) },
  });

  const selectPaymentToken = useCallback(
    (priceUsd6: bigint, itemId?: bigint): PaymentToken | null => {
      if (!tokenBalances) return null;
      if (itemId === FOUNDER_BADGE_CELO_ITEM_ID) {
        return selectMaxBalanceToken(
          [CELO_TOKEN],
          [tokenBalances[CELO_BALANCE_INDEX]],
          priceUsd6,
        );
      }
      return selectMaxBalanceToken(
        ACCEPTED_TOKENS,
        tokenBalances.slice(0, ACCEPTED_TOKENS.length),
        priceUsd6,
      );
    },
    [tokenBalances, CELO_BALANCE_INDEX],
  );

  // Server-side credit fire-and-forget. Banner truthfulness is "tx
  // submitted", not "credit written" — the fetch resolves async and
  // the chip refreshes when (a) writeCreditedCache lands here, or (b)
  // useShieldSync runs on next boot. See spec §"Behavior 1".
  const creditShieldServerSide = useCallback(
    (txHash: `0x${string}`, walletAddress: `0x${string}`) => {
      enqueuePendingTx(txHash);
      void (async () => {
        try {
          const res = await fetch("/api/credit-shield", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ txHash, walletAddress }),
          });
          if (!res.ok) return; // 4xx/5xx → leave queued, useShieldSync retries
          const data = (await res.json()) as {
            ok: true;
            credited: number;
            delta: number;
            txHash: string;
          };
          if (!isMountedRef.current) return;
          dequeuePendingTx(txHash);
          writeCreditedCache(data.credited);
          dispatchShieldChange();
        } catch {
          // Network failure → leave queued.
        }
      })();
    },
    [],
  );

  const openSheet = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (purchasePhase !== "idle") return;
    setOpen(false);
    setErrorMessage(null);
  }, [purchasePhase]);

  // Forward `closeSheet` to the ref consumed by the Welcome-Pack
  // onClaimedFresh callback above. Refreshed each render so the
  // latest closure (with current purchasePhase dep) is what fires.
  useEffect(() => {
    closeSheetRef.current = closeSheet;
  });

  const handleSelectItem = useCallback(
    (itemId: bigint) => {
      setSelectedItemId(itemId);
      const item = shopCatalog.find((i) => i.itemId === itemId);
      if (item) {
        setPaymentToken(selectPaymentToken(item.onChainPrice, itemId));
      }
      setOpen(false);
      setConfirmOpen(true);
    },
    [shopCatalog, selectPaymentToken],
  );

  const writeWithOptionalFeeCurrency = useCallback(
    async (request: Parameters<typeof writeShopAsync>[0]) => {
      try {
        const feeManagedRequest = feeCurrency
          ? ({
              ...request,
              feeCurrency,
            } as unknown as Parameters<typeof writeShopAsync>[0])
          : request;
        return await writeShopAsync(feeManagedRequest);
      } catch (error) {
        if (!feeCurrency) throw error;
        return writeShopAsync(request);
      }
    },
    [writeShopAsync, feeCurrency],
  );

  const handleConfirmPurchase = useCallback(async () => {
    if (!selectedItem || !address || !shopAddress) return;
    if (!isCorrectChain) {
      setErrorMessage("Wrong network — switch to continue.");
      return;
    }
    if (!selectedItem.configured || !selectedItem.enabled) return;
    if (!paymentToken) {
      setErrorMessage("Not enough funds to complete this purchase.");
      return;
    }

    const unitPrice = selectedItem.onChainPrice;
    const normalizedTotal = normalizePrice(unitPrice, paymentToken.decimals);
    const txSource =
      selectedItem.itemId === SHIELD_ITEM_ID
        ? "shop_retry_shield"
        : selectedItem.itemId === PRO_ITEM_ID
          ? "shop_pro"
          : selectedItem.itemId === COACH_PACK_ITEMS[5].itemId
            ? "shop_coach_5"
            : selectedItem.itemId === COACH_PACK_ITEMS[20].itemId
              ? "shop_coach_20"
              : "shop_founder_badge";
    const itemIdNum = Number(selectedItem.itemId);

    setErrorMessage(null);
    track("shop_buy_tx", { stage: "start", source: txSource, item_id: itemIdNum });

    try {
      const freshAllowance = publicClient
        ? ((await publicClient.readContract({
            address: paymentToken.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, shopAddress],
          })) as bigint)
        : 0n;

      if (freshAllowance < normalizedTotal) {
        if (!isMountedRef.current) return;
        setPurchasePhase("approving");
        const approveHash = await writeWithOptionalFeeCurrency({
          address: paymentToken.address,
          abi: erc20Abi,
          functionName: "approve" as const,
          args: [shopAddress, normalizedTotal] as const,
          chainId,
          account: address,
        });
        if (!publicClient) {
          throw new Error("Missing public client for approval confirmation");
        }
        await waitForReceiptWithTimeout(publicClient, approveHash);
      }

      if (!isMountedRef.current) return;
      setPurchasePhase("buying");
      const buyHash = await writeWithOptionalFeeCurrency({
        address: shopAddress,
        abi: shopAbi,
        functionName: "buyItem" as const,
        args: [selectedItem.itemId, 1n, paymentToken.address] as const,
        chainId,
        account: address,
      });

      if (!isMountedRef.current) return;
      track("shop_buy_tx", { stage: "success", source: txSource, item_id: itemIdNum });
      if (selectedItem.itemId === SHIELD_ITEM_ID) {
        creditShieldServerSide(buyHash as `0x${string}`, address);
      } else if (
        selectedItem.itemId === COACH_PACK_ITEMS[5].itemId ||
        selectedItem.itemId === COACH_PACK_ITEMS[20].itemId
      ) {
        // Coach packs (itemId 3 + 4) mirror the PRO path: without the
        // server-side credit grant the user paid on-chain but the
        // coach:credits:<wallet> Redis key never increments. The
        // /api/coach/verify-purchase route is idempotent (txHash guard),
        // so retries from the Coach paywall recover gracefully.
        if (publicClient) {
          try {
            await waitForReceiptWithTimeout(publicClient, buyHash as `0x${string}`);
            const res = await fetch("/api/coach/verify-purchase", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
            });
            if (!res.ok) {
              setErrorMessage(
                "Pack purchased on-chain — credits pending. Open the Coach paywall to retry.",
              );
            }
          } catch {
            setErrorMessage(
              "Pack purchased on-chain — credits pending. Open the Coach paywall to retry.",
            );
          }
        }
      } else if (selectedItem.itemId === PRO_ITEM_ID) {
        // verify-pro is the activation contract — without it the user
        // paid on-chain but coach:pro:<wallet> never lands in Redis.
        // Await the receipt + POST inline so an HTTP failure surfaces
        // in `errorMessage` and the user knows to retry from the PRO
        // sheet. The route is idempotent (proProcessedTx guard), so a
        // retry with the same txHash returns the same expiresAt.
        if (publicClient) {
          try {
            await waitForReceiptWithTimeout(publicClient, buyHash as `0x${string}`);
            const res = await fetch("/api/verify-pro", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
            });
            if (!res.ok) {
              setErrorMessage(
                "PRO purchased on-chain — activation pending. Open the PRO menu to retry verification.",
              );
            }
          } catch {
            setErrorMessage(
              "PRO purchased on-chain — activation pending. Open the PRO menu to retry verification.",
            );
          }
        }
      }
      setConfirmOpen(false);
      setSelectedItemId(null);
      setSuccessBanner({
        itemLabel: selectedItem.label,
        txHashShort: `${buyHash.slice(0, 6)}…${buyHash.slice(-4)}`,
      });
      hapticSuccess();
      fireOnPurchaseSuccess(buyHash, selectedItem.itemId, 1);
      // Auto-dismiss banner so the catalog returns to its idle state
      // without forcing the user to tap. Keep sheet open for the same
      // window so they see the confirmation.
      window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setSuccessBanner(null);
      }, SUCCESS_BANNER_TTL_MS);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (isUserCancellation(error)) {
        track("shop_buy_tx", {
          stage: "cancelled",
          source: txSource,
          item_id: itemIdNum,
        });
        setConfirmOpen(false);
        setErrorMessage(null);
        return;
      }
      if (isTransactionTimeout(error)) {
        track("shop_buy_tx", {
          stage: "error",
          source: txSource,
          item_id: itemIdNum,
          error_kind: "timeout",
        });
        setConfirmOpen(false);
        setErrorMessage("Transaction timed out. Please try again.");
        return;
      }
      track("shop_buy_tx", {
        stage: "error",
        source: txSource,
        item_id: itemIdNum,
        error_kind: classifyTxErrorKind(error),
      });
      setConfirmOpen(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Purchase failed.",
      );
    } finally {
      if (isMountedRef.current) setPurchasePhase("idle");
    }
  }, [
    selectedItem,
    address,
    shopAddress,
    isCorrectChain,
    paymentToken,
    publicClient,
    chainId,
    writeWithOptionalFeeCurrency,
    creditShieldServerSide,
    fireOnPurchaseSuccess,
  ]);

  // Suppress unused-var for `paymentAllowance`: read is kept to keep the
  // wagmi cache primed (matches legacy parity), but the actual gate uses
  // a fresh `publicClient.readContract` allowance read inside confirm.
  void paymentAllowance;

  const sheetProps: SheetProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (next) openSheet();
      else closeSheet();
    },
    items: displayShopCatalog,
    onSelectItem: handleSelectItem,
    successBanner,
    showTrigger: false,
    welcomePack,
  };

  const confirmProps: ConfirmProps = {
    open: confirmOpen,
    onOpenChange: (next: boolean) => {
      // Mid-tx close guard (P1-1) — never let the user dismiss while
      // approve/buy is in flight; state would desync from chain.
      if (!next && purchasePhase !== "idle") return;
      setConfirmOpen(next);
      if (!next) {
        setSelectedItemId(null);
        setErrorMessage(null);
      }
    },
    selectedItem,
    chainId,
    shopAddress: shopAddress ?? null,
    paymentTokenSymbol: paymentToken?.symbol ?? null,
    isConnected,
    isCorrectChain,
    isWriting: isShopWriting,
    purchasePhase,
    onConfirm: () => void handleConfirmPurchase(),
  };

  void errorMessage;

  return {
    open,
    openSheet,
    closeSheet,
    sheetProps,
    confirmProps,
    isCorrectChain,
    isConnected,
    onConnectWallet: () => openConnectModal?.(),
    onSwitchNetwork: () =>
      configuredChainId != null && switchChain({ chainId: configuredChainId }),
  };
}
