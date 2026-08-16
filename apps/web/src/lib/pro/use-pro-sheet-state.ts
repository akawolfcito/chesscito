"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { usePathname } from "@/i18n/navigation";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { useTranslations } from "next-intl";
import { getConfiguredChainId } from "@/lib/contracts/chains";
import { getProPack } from "@/lib/payments/rail-config";
import {
  tokenReadProps,
  useStablecoinTokenSelection,
} from "@/lib/payments/use-get-peones-token-selection";
import { hapticSuccess } from "@/lib/haptics";
import { classifyProRailError } from "@/lib/pro/pro-rail-error";
import { useProRail, type ProRailResult } from "@/lib/pro/use-pro-rail";
import {
  useProStatus,
  type ProRemoteState,
  type ProStatus,
} from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";

import type { ProSheetProps } from "@/components/pro/pro-sheet";

const PRO_RAIL_SKU = "chesscito_pro_30" as const;
const FALLBACK_TOKEN_SYMBOL = "USDC";

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
  /** Fires AFTER the on-chain payment verifies — NOT on user-initiated
   *  close. Deferred via `requestAnimationFrame` so the dispatch lands
   *  after the sheet's exit transition starts (design-lock §6.4 race 1).
   *  The host can synchronously trigger atmosphere shift / shields
   *  refresh / etc. */
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
  proState: ProRemoteState;
};

/** PRO sheet orchestration extracted from `<ExercisesScreen>` so the redesigned
 *  `<HubScaffoldClient>` can render `<ProSheet>` in-place instead of
 *  bouncing through `/hub?legacy=1&action=pro`. The bounce is what created
 *  the B2 "Play in Arena" race (audit 2026-05-07) and what hid the bottom
 *  CTA behind the legacy persistent dock.
 *
 *  Buys via the no-approve stablecoin direct-transfer rail (`useProRail`,
 *  same rail as Season Pass / Get Peones) — single tx, no approve. The
 *  Shop's approve + `buyItem` PRO path (itemId 6) is a separate, untouched
 *  way to buy the identical entitlement (see `use-shop-sheet-state.ts`).
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
  const { switchChain } = useSwitchChain();
  const { connectWallet } = useConnectWallet();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain =
    configuredChainId != null && chainId === configuredChainId;

  const proQuery = useProStatus(address);
  const {
    status: proStatus,
    state: proState,
    staleStatus,
    refetch: refetchProStatus,
  } = proQuery;
  const pack = useMemo(() => getProPack(PRO_RAIL_SKU), []);

  // Capture the success callback in a ref so onVerified's identity stays
  // stable across host renders (the host doesn't have to memoize it). The
  // ref is refreshed on every render synchronously via a layout-style effect.
  const onPurchaseSuccessRef = useRef(options?.onPurchaseSuccess);
  useEffect(() => {
    onPurchaseSuccessRef.current = options?.onPurchaseSuccess;
  });

  const fireOnPurchaseSuccess = useCallback(
    (txHash: string) => {
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
          daysGranted: pack.durationDays,
          buyer: buyer as `0x${string}`,
        });
      });
    },
    [address, pack],
  );

  const [open, setOpen] = useState(false);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [isRetryingVerify, setIsRetryingVerify] = useState(false);
  // Read synchronously inside the rail's error effect so a manual retry's
  // failure is attributed correctly regardless of render timing (same
  // pattern as onPurchaseSuccessRef above).
  const retryInFlightRef = useRef(false);
  // Bumped at the START of every pay()/verifyAgain() call. A retry that
  // fails with the exact same errorReason/txHash as the attempt before it
  // would otherwise leave the error-effect's dependency array unchanged
  // between commits (mocked I/O resolves fully within one microtask
  // flush, so React batches the whole retry into one render) — the effect
  // would then never re-fire and `isRetryingVerify` would stick forever.
  // Including this token in the deps guarantees a fresh value every
  // attempt regardless of what the outcome looks like.
  const [attemptToken, setAttemptToken] = useState(0);

  const selection = useStablecoinTokenSelection(pack.priceUsd6);
  const tokenSymbol = selection.selectedSymbol ?? FALLBACK_TOKEN_SYMBOL;

  const handleVerified = useCallback(
    (result: ProRailResult) => {
      track("pro_purchase_confirmed", {
        item_id: 6,
        price_usd6: Number(pack.priceUsd6),
        days_granted: pack.durationDays,
        tx_hash_prefix: result.txHash.slice(0, 10),
        source: sourceRef.current,
      });
      refetchProStatus();
      hapticSuccess();
      retryInFlightRef.current = false;
      setIsRetryingVerify(false);
      setOpen(false);
      fireOnPurchaseSuccess(result.txHash);
    },
    [pack, refetchProStatus, fireOnPurchaseSuccess],
  );

  const rail = useProRail({ sku: PRO_RAIL_SKU, tokenSymbol, onVerified: handleVerified });

  const errorKind = useMemo(
    () =>
      rail.phase === "error"
        ? classifyProRailError(rail.errorReason, Boolean(rail.txHash))
        : null,
    [rail.phase, rail.errorReason, rail.txHash],
  );

  // Fires telemetry exactly once per attempt that ends in "error" —
  // `attemptToken` in the deps guarantees this runs even when a retry's
  // outcome is byte-identical to the attempt before it.
  useEffect(() => {
    if (rail.phase !== "error" || errorKind === null) return;
    if (errorKind === "silent") {
      retryInFlightRef.current = false;
      setIsRetryingVerify(false);
      return;
    }
    if (retryInFlightRef.current) {
      track("pro_verify_retry_failed", {
        tx_hash_prefix: rail.txHash ? rail.txHash.slice(0, 10) : null,
        reason: rail.errorReason,
      });
    } else {
      track("pro_purchase_failed", {
        kind:
          errorKind === "verifyFailed"
            ? "verify-failed"
            : errorKind === "notConfigured"
              ? "unavailable"
              : "error",
      });
    }
    retryInFlightRef.current = false;
    setIsRetryingVerify(false);
  }, [rail.phase, rail.errorReason, rail.txHash, errorKind, attemptToken]);

  const purchaseState: "idle" | "purchasing" | "verifying" =
    rail.phase === "preparing" ||
    rail.phase === "awaiting_signature" ||
    rail.phase === "pending_tx"
      ? "purchasing"
      : rail.phase === "verifying" && !isRetryingVerify
        ? "verifying"
        : "idle";

  const railErrorMessage =
    errorKind === null || errorKind === "silent"
      ? null
      : errorKind === "notConfigured"
        ? t("errors.notConfigured")
        : errorKind === "verifyFailed"
          ? t("errors.verifyFailedTitle")
          : t("errors.purchaseFailed");

  const errorMessage = previewErrorMessage ?? railErrorMessage;
  const verifyFailedTxHash = errorKind === "verifyFailed" ? rail.txHash : null;

  // Which SURFACE sold the pass. Frozen at open, not read at purchase: the
  // player can navigate while the sheet is up, and crediting the sale to
  // wherever they drifted would answer the wrong question. This is what makes
  // "the Coach opens the Journal" a falsifiable bet — entries into the journal
  // are not purchases attributable to it, so without this a dip in PRO would be
  // unreadable: cause or cure, we couldn't tell.
  //
  // Attribution is by surface, not by CTA within a surface: the PRO chip and
  // the Coach tile both live at "/". If CTA-level attribution is ever needed,
  // that's when openSheet grows a parameter — not before.
  const livePathname = usePathname();
  const sourceRef = useRef<string>("/");

  const openSheet = useCallback(() => {
    sourceRef.current = livePathname ?? "/";
    setOpen(true);
  }, [livePathname]);

  const closeSheet = useCallback(() => {
    if (purchaseState !== "idle" || isRetryingVerify) return;
    setOpen(false);
    setPreviewErrorMessage(null);
    rail.reset();
  }, [purchaseState, isRetryingVerify, rail]);

  // Async (not `void`-wrapped) so a caller holding a direct reference —
  // notably this file's own tests — can `await` full settlement. Still
  // assignable to `ProSheetProps.onPurchase: () => void` (TS treats a
  // `Promise<void>`-returning function as compatible with a `void`-typed
  // callback).
  const handlePurchase = useCallback(async () => {
    setPreviewErrorMessage(null);
    if (!selection.selected) {
      // Carry WHY. Without the reads, this event cannot tell an empty wallet
      // from a failed `balanceOf`, and that difference decides whether the
      // answer is a transport fix or a price. Emitted here — once per tap —
      // and not from an effect, because `useReadContracts` re-renders.
      track("pro_purchase_failed", {
        kind: "no-token",
        ...tokenReadProps(selection.reads),
      });
      setPreviewErrorMessage(t("insufficientBalance"));
      return;
    }
    // Emitted from INSIDE the rail's mutex, not from here. Two taps in the
    // same tick both reach this line — React has not re-rendered, so the CTA
    // is still live — but only one claims the mutex and only one becomes a
    // transfer. Emitting here counted taps and inflated the denominator of PRO
    // conversion; `onAccepted` counts attempts the rail actually took. Same
    // fix covers `pro-extend-link`, which calls onPurchase() without passing
    // through `resolveCta`.
    await rail.pay({
      onAccepted: () => {
        track("pro_purchase_started", {
          item_id: 6,
          price_usd6: Number(pack.priceUsd6),
          source: sourceRef.current,
        });
        setAttemptToken((n) => n + 1);
      },
    });
  }, [selection, pack, rail, t]);

  const handleRetryVerify = useCallback(() => {
    if (!rail.txHash || isRetryingVerify) return;
    retryInFlightRef.current = true;
    setIsRetryingVerify(true);
    setAttemptToken((n) => n + 1);
    void rail.verifyAgain();
  }, [rail, isRetryingVerify]);

  const sheetProps: SheetProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (next) openSheet();
      else closeSheet();
    },
    status: proStatus,
    statusState: proState,
    staleStatus,
    isConnected,
    isCorrectChain,
    isPurchasing: purchaseState === "purchasing",
    isVerifying: purchaseState === "verifying",
    errorMessage,
    verifyFailedTxHash,
    isRetryingVerify,
    onRetryVerify: handleRetryVerify,
    onConnectWallet: () => connectWallet(),
    onSwitchNetwork: () =>
      configuredChainId != null && switchChain({ chainId: configuredChainId }),
    onPurchase: handlePurchase,
  };

  return { open, openSheet, closeSheet, sheetProps, proStatus, proState };
}
