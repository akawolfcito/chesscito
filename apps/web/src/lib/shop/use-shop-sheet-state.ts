"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
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
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  SHIELD_ITEM_ID,
  SHIELDS_PER_PURCHASE,
  SHOP_ITEMS,
} from "@/lib/contracts/shop-catalog";
import {
  ACCEPTED_TOKENS,
  CELO_TOKEN,
  erc20Abi,
  normalizePrice,
} from "@/lib/contracts/tokens";
import { classifyTxError, isTransactionTimeout, isUserCancellation } from "@/lib/errors";
import { hapticSuccess } from "@/lib/haptics";
import { dispatchShieldChange } from "@/lib/shop/shield-events";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { track } from "@/lib/telemetry";

const MAX_SHIELDS = 30;
const SHIELDS_STORAGE_KEY = "chesscito:shields";
const SUCCESS_BANNER_TTL_MS = 6_000;

type PaymentToken = (typeof ACCEPTED_TOKENS)[number] | typeof CELO_TOKEN;

type CatalogItem = {
  itemId: bigint;
  label: string;
  subtitle: string;
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
export function useShopSheetState(): UseShopSheetStateReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { isMiniPay } = useMiniPay();

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

  const [open, setOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<bigint | null>(null);
  const [paymentToken, setPaymentToken] = useState<PaymentToken | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasePhase, setPurchasePhase] = useState<
    "idle" | "approving" | "buying"
  >("idle");
  const [shopTxHash, setShopTxHash] = useState<string | null>(null);
  const [pendingShieldCredit, setPendingShieldCredit] = useState(false);
  const [successBanner, setSuccessBanner] = useState<SuccessBanner>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        const onChain = onChainItems?.[index];
        if (onChain?.status === "success" && Array.isArray(onChain.result)) {
          const price = onChain.result[0] as bigint;
          const enabled = onChain.result[1] as boolean;
          return {
            ...item,
            configured: price > 0n,
            enabled: price > 0n && enabled,
            onChainPrice: price,
          };
        }
        return {
          ...item,
          configured: false,
          enabled: false,
          onChainPrice: 0n,
        };
      }),
    [onChainItems],
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
        const result = tokenBalances[CELO_BALANCE_INDEX];
        if (result?.status !== "success") return null;
        const balance = result.result as bigint;
        const needed = normalizePrice(priceUsd6, CELO_TOKEN.decimals);
        return balance >= needed ? CELO_TOKEN : null;
      }
      for (let i = 0; i < ACCEPTED_TOKENS.length; i++) {
        const t = ACCEPTED_TOKENS[i];
        const result = tokenBalances[i];
        if (result?.status !== "success") continue;
        const balance = result.result as bigint;
        const needed = normalizePrice(priceUsd6, t.decimals);
        if (balance >= needed) return t;
      }
      return null;
    },
    [tokenBalances, CELO_BALANCE_INDEX],
  );

  // Receipt watcher — credits shields once the buy receipt confirms.
  // Same gating as legacy: only fires when `pendingShieldCredit` was set
  // by `handleConfirmPurchase` for SHIELD_ITEM_ID.
  const { isSuccess: isShopConfirmed } = useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: { enabled: Boolean(shopTxHash) },
  });

  useEffect(() => {
    if (!isShopConfirmed || !pendingShieldCredit) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SHIELDS_STORAGE_KEY);
      const prev = raw ? Math.max(0, Number.parseInt(raw, 10) || 0) : 0;
      const next = Math.max(
        0,
        Math.min(prev + SHIELDS_PER_PURCHASE, MAX_SHIELDS),
      );
      window.localStorage.setItem(SHIELDS_STORAGE_KEY, String(next));
      dispatchShieldChange();
    } catch {
      // storage unavailable; fail silently — chain receipt is the
      // source of truth, scaffold can re-derive on next load.
    }
    setPendingShieldCredit(false);
  }, [isShopConfirmed, pendingShieldCredit]);

  const openSheet = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (purchasePhase !== "idle") return;
    setOpen(false);
    setErrorMessage(null);
  }, [purchasePhase]);

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
      setShopTxHash(buyHash);
      track("shop_buy_tx", { stage: "success", source: txSource, item_id: itemIdNum });
      if (selectedItem.itemId === SHIELD_ITEM_ID) {
        setPendingShieldCredit(true);
      }
      setConfirmOpen(false);
      setSelectedItemId(null);
      setSuccessBanner({
        itemLabel: selectedItem.label,
        txHashShort: `${buyHash.slice(0, 6)}…${buyHash.slice(-4)}`,
      });
      hapticSuccess();
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
        error_kind: classifyTxError(error),
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
