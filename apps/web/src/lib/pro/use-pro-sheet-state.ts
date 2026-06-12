"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { useTranslations } from "next-intl";
import {
  getConfiguredChainId,
  getShopAddress,
} from "@/lib/contracts/chains";
import { PRO_PRICE_USD6 } from "@/lib/contracts/shop-catalog";
import {
  ACCEPTED_TOKENS,
  CELO_TOKEN,
  erc20Abi,
} from "@/lib/contracts/tokens";
import { selectMaxBalanceToken } from "@/lib/contracts/select-payment-token";
import { hapticSuccess } from "@/lib/haptics";
import { executeProPurchase } from "@/lib/pro/purchase";
import { useProStatus, type ProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

import type { ProSheetProps } from "@/components/pro/pro-sheet";

type SheetProps = Omit<ProSheetProps, "open" | "onOpenChange"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Receipt payload emitted by `useProSheetState` to its host on a confirmed
 *  PRO purchase. The hub uses this to (a) trigger atmosphere shift,
 *  (b) emit `hub_atmosphere_shift` telemetry with `trigger: "purchase"`.
 *  Contract sourced from design-lock §6.4 (2026-05-09). */
export type ProPurchaseReceipt = {
  txHash: `0x${string}`;
  daysGranted: number;
  /** Wallet that paid for the subscription. The host validates this
   *  against the active `useAccount().address` before mutating state
   *  (defense against multi-tab session drift — design-lock §6.4 race 3). */
  buyer: `0x${string}`;
};

export type UseProSheetStateOptions = {
  /** Fires AFTER the wagmi receipt confirms — NOT on user-initiated close.
   *  Deferred via `requestAnimationFrame` so the dispatch lands after the
   *  sheet's exit transition starts (design-lock §6.4 race 1). The host
   *  can synchronously trigger atmosphere shift / shields refresh / etc. */
  onPurchaseSuccess?: (receipt: ProPurchaseReceipt) => void;
};

export type UseProSheetStateReturn = {
  /** Live sheet open state. Surfaced separately so the host component
   *  can branch on "is the sheet up?" without unpacking sheetProps. */
  open: boolean;
  /** Open the sheet from a CTA tap. Idempotent — already-open is a no-op. */
  openSheet: () => void;
  /** Mid-tx + mid-retry guards live here so callers can't desync the UI
   *  by hard-closing during a write. Equivalent to ProSheet's own
   *  onOpenChange(false) branch. */
  closeSheet: () => void;
  /** Spread directly onto `<ProSheet />`. */
  sheetProps: SheetProps;
  /** Surfaced for the parent's PRO chip rendering so the page never
   *  fires a second `useProStatus(address)` fetch in parallel. */
  proStatus: ProStatus | null;
};

/** PRO sheet orchestration extracted from `<ExercisesScreen>` so the redesigned
 *  `<HubScaffoldClient>` can render `<ProSheet>` in-place instead of
 *  bouncing through `/hub?legacy=1&action=pro`. The bounce is what created
 *  the B2 "Play in Arena" race (audit 2026-05-07) and what hid the bottom
 *  CTA behind the legacy persistent dock.
 *
 *  Self-contained — pulls every wagmi/RainbowKit dependency it needs.
 *  Returns `sheetProps` already shaped for `<ProSheet>` so the host
 *  component is just `<ProSheet {...proSheet.sheetProps} />`. */
export function useProSheetState(
  options?: UseProSheetStateOptions,
): UseProSheetStateReturn {
  const t = useTranslations("PRO_COPY");
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { switchChain } = useSwitchChain();
  const { connectWallet } = useConnectWallet();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain =
    configuredChainId != null && chainId === configuredChainId;
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);

  const { writeContractAsync: writeShopAsync } = useWriteContract();
  const { status: proStatus, refetch: refetchProStatus } = useProStatus(address);

  // Capture the success callback in a ref so handlePurchase's deps array
  // stays stable across host renders (the host doesn't have to memoize
  // the callback). The ref is refreshed on every render synchronously
  // via the layout-style effect below.
  const onPurchaseSuccessRef = useRef(options?.onPurchaseSuccess);
  useEffect(() => {
    onPurchaseSuccessRef.current = options?.onPurchaseSuccess;
  });

  const fireOnPurchaseSuccess = useCallback((txHash: string) => {
    const cb = onPurchaseSuccessRef.current;
    if (!cb) return;
    const buyer = address;
    if (!buyer) return;
    // rAF defer — landing the dispatch after the sheet's exit transition
    // starts so atmosphere shift / shields refresh feels sequenced rather
    // than racing with the close animation (design-lock §6.4 race 1).
    requestAnimationFrame(() => {
      cb({
        txHash: txHash as `0x${string}`,
        daysGranted: 30,
        buyer: buyer as `0x${string}`,
      });
    });
  }, [address]);

  const [open, setOpen] = useState(false);
  const [purchaseState, setPurchaseState] = useState<
    "idle" | "purchasing" | "verifying"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyFailedTxHash, setVerifyFailedTxHash] = useState<string | null>(
    null,
  );
  const [isRetryingVerify, setIsRetryingVerify] = useState(false);

  // Token balances drive `selectPaymentToken` — same shape ExercisesScreen
  // uses. CELO sits at the tail purely to share the read; PRO never
  // settles in CELO, only stablecoins.
  const BALANCE_READ_TOKENS = useMemo(() => [...ACCEPTED_TOKENS, CELO_TOKEN], []);
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

  const selectPaymentToken = useCallback(
    (priceUsd6: bigint) =>
      selectMaxBalanceToken(
        ACCEPTED_TOKENS,
        tokenBalances?.slice(0, ACCEPTED_TOKENS.length),
        priceUsd6,
      ),
    [tokenBalances],
  );

  const openSheet = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (purchaseState !== "idle" || isRetryingVerify) return;
    setOpen(false);
    setErrorMessage(null);
    setVerifyFailedTxHash(null);
  }, [purchaseState, isRetryingVerify]);

  const handlePurchase = useCallback(async () => {
    if (!address || !shopAddress || !publicClient || !isCorrectChain) return;
    setErrorMessage(null);
    setVerifyFailedTxHash(null);

    const previewToken = selectPaymentToken(PRO_PRICE_USD6);
    if (!previewToken) {
      track("pro_purchase_failed", { kind: "no-token" });
      setErrorMessage(t("insufficientBalance"));
      return;
    }

    track("pro_purchase_started", {
      item_id: 6,
      price_usd6: 1_990_000,
    });

    const result = await executeProPurchase({
      address,
      shopAddress,
      publicClient,
      chainId,
      writeContractAsync: writeShopAsync,
      selectPaymentToken: (price) => selectPaymentToken(price),
      onPhaseChange: (phase) => setPurchaseState(phase),
    });
    setPurchaseState("idle");

    if (result.kind === "success") {
      track("pro_purchase_confirmed", {
        item_id: 6,
        price_usd6: 1_990_000,
        days_granted: 30,
        tx_hash_prefix: result.txHash.slice(0, 10),
      });
      refetchProStatus();
      hapticSuccess();
      setOpen(false);
      fireOnPurchaseSuccess(result.txHash);
      return;
    }
    if (result.kind === "cancelled") return;
    if (result.kind === "verify-failed") {
      track("pro_purchase_failed", {
        kind: "verify-failed",
        tx_hash_prefix: result.txHash ? result.txHash.slice(0, 10) : null,
      });
      setVerifyFailedTxHash(result.txHash ?? null);
    } else {
      track("pro_purchase_failed", { kind: result.kind });
    }
    setErrorMessage(
      result.kind === "no-token"
        ? t("insufficientBalance")
        : result.kind === "timeout"
          ? t("txTimeout")
          : result.kind === "verify-failed"
            ? t("errors.verifyFailedTitle")
            : t("errors.purchaseFailed"),
    );
  }, [
    address,
    shopAddress,
    publicClient,
    isCorrectChain,
    chainId,
    writeShopAsync,
    selectPaymentToken,
    refetchProStatus,
    fireOnPurchaseSuccess,
    t,
  ]);

  const handleRetryVerify = useCallback(async () => {
    if (!verifyFailedTxHash || !address || isRetryingVerify) return;
    setIsRetryingVerify(true);
    try {
      const res = await fetch("/api/verify-pro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          txHash: verifyFailedTxHash,
          walletAddress: address,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { active?: boolean }
        | null;
      if (res.ok && json?.active) {
        track("pro_purchase_confirmed", {
          item_id: 6,
          price_usd6: 1_990_000,
          days_granted: 30,
          tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        });
        setErrorMessage(null);
        setVerifyFailedTxHash(null);
        refetchProStatus();
        hapticSuccess();
        setOpen(false);
        fireOnPurchaseSuccess(verifyFailedTxHash);
        return;
      }
      track("pro_verify_retry_failed", {
        tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        status: res.status,
      });
    } catch {
      track("pro_verify_retry_failed", {
        tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        status: 0,
      });
    } finally {
      setIsRetryingVerify(false);
    }
  }, [
    verifyFailedTxHash,
    address,
    isRetryingVerify,
    refetchProStatus,
    fireOnPurchaseSuccess,
  ]);

  const sheetProps: SheetProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (next) openSheet();
      else closeSheet();
    },
    status: proStatus,
    isConnected,
    isCorrectChain,
    isPurchasing: purchaseState === "purchasing",
    isVerifying: purchaseState === "verifying",
    errorMessage,
    verifyFailedTxHash,
    isRetryingVerify,
    onRetryVerify: () => void handleRetryVerify(),
    onConnectWallet: () => connectWallet(),
    onSwitchNetwork: () =>
      configuredChainId != null && switchChain({ chainId: configuredChainId }),
    onPurchase: () => void handlePurchase(),
  };

  return { open, openSheet, closeSheet, sheetProps, proStatus };
}
