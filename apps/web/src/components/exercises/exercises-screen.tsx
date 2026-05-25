"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useChainId,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { Board } from "@/components/board";
import { ExerciseDrawer } from "@/components/exercises/exercise-drawer";
import { LeaderboardSheet } from "@/components/exercises/leaderboard-sheet";
import { MissionBriefing } from "@/components/exercises/mission-briefing";
import { MissionPanelCandy } from "@/components/exercises/mission-panel-candy";
import { DailyTacticSlot } from "@/components/daily/daily-tactic-slot";
import { MiniArenaBridgeSlot } from "@/components/mini-arena/mini-arena-bridge-slot";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";
import { ContextualActionSlot } from "@/components/exercises/contextual-action-slot";
import { PersistentDock } from "@/components/exercises/persistent-dock";
import { TrophiesSheet } from "@/components/exercises/trophies-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import {
  consumeOneShield,
  dequeuePendingTx,
  enqueuePendingTx,
  readDisplayedShields,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import {
  dispatchShieldChange,
  subscribeToShieldChanges,
} from "@/lib/shop/shield-events";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { useSaveScoreState } from "@/hooks/use-save-score-state";
import { SavedChip } from "@/components/exercises/saved-chip";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { useConnectPrompt } from "@/lib/connect-prompt/use-connect-prompt";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { deriveTxToastState } from "@/lib/exercises/tx-toast-state";
import { useMiniPay } from "@/hooks/use-minipay";
import { useSplashLoader } from "@/hooks/use-splash-loader";
import { useAutoResetTimer } from "@/hooks/use-auto-reset-timer";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getScoreboardAddress,
  getShopAddress,
} from "@/lib/contracts/chains";
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";
import { shopAbi } from "@/lib/contracts/shop";
import {
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  PRO_PRICE_USD6,
  SHIELD_ITEM_ID,
  SHOP_ITEMS,
} from "@/lib/contracts/shop-catalog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ProSheet } from "@/components/pro/pro-sheet";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { formatWalletShort } from "@/lib/wallet/format";
import { executeProPurchase } from "@/lib/pro/purchase";
import { ACCEPTED_TOKENS, CELO_TOKEN, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { PIECE_IMAGES } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { getPositionLabel, getValidTargets } from "@/lib/game/board";
import type { BoardPosition } from "@/lib/game/types";
import { BadgeEarnedPrompt, PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/telemetry";
import { classifyTxError, classifyTxErrorKind, isTransactionTimeout, isUserCancellation } from "@/lib/errors";
import { getContextAction } from "@/lib/game/context-action";
import { BADGE_THRESHOLD, EXERCISES, LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { getLabyrinthBest, recordLabyrinthBest } from "@/lib/game/labyrinth-progress";
import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { computeStars } from "@/lib/game/scoring";
import { hapticReject, hapticSuccess } from "@/lib/haptics";
import {
  registerDockSheetCloser,
  registerDockSheetOpener,
  setDockSheet,
} from "@/lib/ui/dock-sheet-store";

// SHOP_ITEMS, SHIELD_ITEM_ID, SHIELDS_PER_PURCHASE now live in
// lib/contracts/shop-catalog.ts so they're testable in isolation. The
// import is below with the other contract helpers.


type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
const POINTS_PER_STAR = 100n;

/**
 * Hold the `<TxProgressSteps current="done">` toast for this many ms after
 * `useWaitForTransactionReceipt` resolves with success. Aligned with the
 * motion scale: `--duration-ceremony = 500ms` × 3, so the celebratory
 * confirmation reads at the same cadence as other success affordances
 * (Victory NFT mint, badge claim, etc.).
 */
const SAVE_DONE_HOLD_MS = 1500;
type CatalogItem = {
  itemId: bigint;
  /** Translator-resolved at memo time from SHOP_ITEM_COPY via the
   *  catalog entry's `copyKey`. Kept on the item so downstream
   *  consumers (ShopSheet, PurchaseConfirmSheet, success banners,
   *  telemetry logs) don't each need to thread the translator. */
  label: string;
  subtitle: string;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
  /** Set on the Founder Badge entry by displayShopCatalog when the
   *  CELO route is available — drives the second "Buy with 1 CELO"
   *  button on the shop card. Always undefined on the underlying
   *  shopCatalog used for selection lookups. */
  celoSibling?: { itemId: bigint } | null;
};

function networkName(chainId: number | undefined, unknownLabel: string) {
  if (chainId === 42220) return "Celo";
  if (chainId === 44787) return "Alfajores";
  if (chainId === 11142220) return "Celo Sepolia";
  return unknownLabel;
}

function AccountSheet({
  open,
  onOpenChange,
  walletAddress,
  walletShort,
  chainId,
  proActive,
  onManagePro,
  onDisconnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  walletShort: string;
  chainId: number | undefined;
  proActive: boolean;
  onManagePro: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations("ACCOUNT_SHEET_COPY");
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={t("description")}
        className="sheet-bg-hub rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]"
      >
        <div className="-mx-6 -mt-6 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/screen-mission/account-icon" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        <div className="mt-4 space-y-3">
          <div className="candy-tray">
            <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {t("walletLabel")}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-semibold tabular-nums" style={{ color: "rgba(63, 34, 8, 0.95)" }}>
                {walletShort}
              </span>
              <button
                type="button"
                onClick={() => void copyAddress()}
                aria-label={copied ? t("copiedAddress") : t("copyAddress")}
                className="inline-flex items-center justify-center bg-transparent border-0 p-0 transition active:scale-90"
                style={{ color: "rgba(63, 34, 8, 0.95)" }}
              >
                <CandyIcon name={copied ? "check" : "copy"} className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="candy-tray">
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
                {t("networkLabel")}
              </p>
              <span className="account-status-pill mt-1" data-tone="celo">
                <CandyIcon name="check" className="h-3 w-3" />
                {networkName(chainId, t("unknownNetwork"))}
              </span>
            </div>
            <div className="candy-tray">
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
                {t("proLabel")}
              </p>
              <span
                className="account-status-pill mt-1"
                data-tone={proActive ? "active" : "inactive"}
              >
                <span aria-hidden="true">★</span>
                {proActive ? t("activePro") : t("inactivePro")}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onManagePro}
            className="account-manage-pro-cta w-full"
          >
            <img
              src="/art/screen-mission/corona-pro.png"
              alt=""
              aria-hidden="true"
              className="account-manage-pro-cta-icon"
              draggable={false}
            />
            <span>{proActive ? t("managePro") : t("viewPro")}</span>
          </button>
          <LocaleSwitcher />
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            className="mt-3 w-full"
            onClick={onDisconnect}
          >
            {t("disconnect")}
          </Button>
          <p className="text-center text-xs" style={{ color: "rgba(110, 65, 15, 0.62)" }}>
            {t("minipayDisconnectHint")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

async function requestSignature(endpoint: "/api/sign-badge" | "/api/sign-score", body: object) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as SignatureResponse;

  if (!response.ok || "error" in payload) {
    throw new Error(payload.error ?? "Could not fetch signature");
  }

  return payload;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function txLink(chainId: number | undefined, txHash: string) {
  const subdomain = chainId === 44787 ? "alfajores." : chainId === 11142220 ? "sepolia." : "";
  return `https://${subdomain}celoscan.io/tx/${txHash}`;
}

/** Hub-action seed accepted from URL search params. The new Game Home
 *  scaffold (`<HubScaffoldClient>`) routes monetization-touching taps to
 *  `/hub?legacy=1&action=…` so the legacy player keeps owning the heavy
 *  on-chain mutation flows during the migration. */
export type ExercisesInitialAction = "shop" | "pro" | "badges" | "trophies";

/** In-place sheet keys forwarded by the persistent dock via
 *  `/exercises?sheet=<key>`. Distinct from `initialAction` because the
 *  dock-driven flow must NOT bounce back to /hub on close — the user
 *  came from the dock to stay on /exercises. */
export type ExercisesInitialSheet =
  | "shop"
  | "badges"
  | "trophies"
  | "leaderboard"
  | "pro";

export type ExercisesScreenProps = {
  /** Pre-selected piece (e.g. when the scaffold reward tile is tapped).
   *  Falls back to "rook" — same default as before. */
  initialPiece?: PieceKey;
  /** Pre-opened sheet on first render. The scaffold uses this to drive
   *  the user straight into the shop / PRO / badge flow without an extra
   *  tap inside legacy. */
  initialAction?: ExercisesInitialAction;
  /** Dock-driven in-place sheet open. Single-shot — applied via useEffect
   *  on mount so it does not trigger the `initialAction` bounce-to-hub
   *  behavior. */
  initialSheet?: ExercisesInitialSheet;
};

/**
 * ExercisesScreen — the entire play-hub experience as a self-contained
 * client component. Both `/` (legacy) and `/hub?legacy=1` render this.
 * Lifting it out of app/page.tsx lets the public landing live at `/`
 * while MiniPay players keep their bookmarked play-hub flow at `/hub`.
 *
 * Accepts initialPiece + initialAction so the scaffold can deep-link
 * users straight into the matching legacy flow.
 */
export function ExercisesScreen({
  initialPiece = "rook",
  initialAction,
  initialSheet,
}: ExercisesScreenProps = {}) {
  const tShopItem = useTranslations("SHOP_ITEM_COPY");
  const tCapture = useTranslations("CAPTURE_COPY");
  const tLab = useTranslations("LABYRINTH_COPY");
  const tMission = useTranslations("MISSION_BRIEFING_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tPro = useTranslations("PRO_COPY");
  const tSplash = useTranslations("SPLASH_COPY");
  const tTutorial = useTranslations("TUTORIAL_COPY");
  const tUnlock = useTranslations("UNLOCK_COPY");
  const tDrawer = useTranslations("EXERCISE_DRAWER_COPY");
  const tStatus = useTranslations("GLOBAL_STATUS_BAR_COPY");
  const tHud = useTranslations("HUD_COPY");
  const tFooter = useTranslations("FOOTER_CTA_COPY");
  const tResult = useTranslations("RESULT_OVERLAY_COPY");
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const starsConnectPrompt = useConnectPrompt("stars");
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { isMiniPay } = useMiniPay();
  const { writeContractAsync: writeScoreAsync, isPending: isScoreWriting } = useWriteContract();
  const { writeContractAsync: writeBadgeAsync, isPending: isBadgeWriting } = useWriteContract();
  const { writeContractAsync: writeShopAsync, isPending: isShopWriting } = useWriteContract();
  const [selectedPiece, setSelectedPiece] = useState<PieceKey>(initialPiece);
  const [phase, setPhase] = useState<"ready" | "success" | "failure">("ready");
  const [boardKey, setBoardKey] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  // One exclusive dock tab at a time. Persistent-dock game UX: tapping
  // a different tab auto-closes the current one rather than stacking.
  // Per-sheet `open` + `onOpenChange` are derived below so the sheet
  // components don't need to know about this refactor.
  const [activeDockTab, setActiveDockTab] = useState<"badge" | "shop" | "trophies" | "leaderboard" | "arena" | null>(
    initialAction === "shop"
      ? "shop"
      : initialAction === "badges"
        ? "badge"
        : initialAction === "trophies"
          ? "trophies"
          : null,
  );
  const storeOpen = activeDockTab === "shop";
  // Guarded setter — Radix Sheet emits onOpenChange(false) when the
  // user taps outside (e.g. on the dock to switch to a sibling sheet).
  // Without the functional guard, that "false" would clobber the new
  // sheet's "shop" / "trophies" / etc. set milliseconds earlier by the
  // dock's deep-link push, leaving the user with no sheet at all.
  const setStoreOpen = (v: boolean) => {
    if (v) setActiveDockTab("shop");
    else setActiveDockTab((prev) => (prev === "shop" ? null : prev));
  };
  const leaderboardOpen = activeDockTab === "leaderboard";
  const setLeaderboardOpen = (v: boolean) => {
    if (v) setActiveDockTab("leaderboard");
    else setActiveDockTab((prev) => (prev === "leaderboard" ? null : prev));
  };
  const [selectedItemId, setSelectedItemId] = useState<bigint | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shopTxHash, setShopTxHash] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [submitTxHash, setSubmitTxHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<"idle" | "approving" | "buying">("idle");
  const {
    status: proStatus,
    isLoading: proLoading,
    refetch: refetchProStatus,
  } = useProStatus(address);
  const [proSheetOpen, setProSheetOpen] = useState(initialAction === "pro");
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  // When the user landed on legacy via a scaffold deep link
  // (`?legacy=1&action=…`), bouncing back to `/hub` (scaffold) on the
  // first sheet close removes the otherwise-required two interactions
  // (close sheet + browser back). Single-shot — guarded by a ref so we
  // never auto-navigate on subsequent dock-driven sheet opens.
  const deepLinkBounceConsumed = useRef(initialAction === undefined);
  useEffect(() => {
    if (deepLinkBounceConsumed.current) return;
    const deepLinkSheetOpen =
      initialAction === "shop"
        ? activeDockTab === "shop"
        : initialAction === "badges"
          ? activeDockTab === "badge"
          : initialAction === "trophies"
            ? activeDockTab === "trophies"
            : initialAction === "pro"
              ? proSheetOpen
              : false;
    if (!deepLinkSheetOpen) {
      deepLinkBounceConsumed.current = true;
      router.push("/hub");
    }
  }, [initialAction, activeDockTab, proSheetOpen, router]);

  // Dock-driven in-place sheet open. Runs once on mount based on the
  // `?sheet=<key>` searchParam forwarded from the persistent dock.
  // Distinct from `initialAction` — does NOT enable the bounce-to-hub
  // ref, so closing the sheet leaves the user on /exercises.
  //
  // Per-value lock (mirrors /arena/page.tsx): tracks the last applied
  // sheet rather than a single-shot boolean. After closing one sheet,
  // tapping a different dock entry pushes a new `?sheet=…` value and
  // re-opens the matching sheet. Tapping the same dock entry again is
  // a no-op (URL unchanged → prop unchanged), which is the desired
  // idempotent behavior.
  // One-shot deep-link consumption from the URL `?sheet=` param.
  // Runs once on mount, then history.replaceState's the param away
  // so the URL matches the visible state. Subsequent dock taps go
  // through the store action — they never touch the URL.
  //
  // Reads window.location.search directly instead of useSearchParams
  // so the surrounding tree doesn't need a <Suspense> boundary and
  // SPA navigations cannot re-trigger this effect mid-session.
  const deepLinkConsumedRef = useRef(false);
  useEffect(() => {
    if (deepLinkConsumedRef.current) return;
    deepLinkConsumedRef.current = true;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("sheet");
    if (slug === "shop") setActiveDockTab("shop");
    else if (slug === "badges") setActiveDockTab("badge");
    else if (slug === "trophies") setActiveDockTab("trophies");
    else if (slug === "leaderboard") setActiveDockTab("leaderboard");
    else if (slug === "pro") setProSheetOpen(true);
    if (slug) {
      sp.delete("sheet");
      const qs = sp.toString();
      const path = window.location.pathname;
      window.history.replaceState(window.history.state, "", qs ? `${path}?${qs}` : path);
    }
  }, []);
  const [proPurchaseState, setProPurchaseState] = useState<"idle" | "purchasing" | "verifying">("idle");
  const [proPurchaseError, setProPurchaseError] = useState<string | null>(null);
  /** Set iff the last failure was verify-failed. Carries the on-chain
   *  txHash so the user can retry verification idempotently — no double
   *  charge — instead of treating the receipt as "money lost". */
  const [verifyFailedTxHash, setVerifyFailedTxHash] = useState<string | null>(null);
  const [isRetryingVerify, setIsRetryingVerify] = useState(false);
  const [resultOverlay, setResultOverlay] = useState<{
    variant: "badge" | "score" | "shop" | "error";
    txHash?: string;
    errorMessage?: string;
    /** When variant === "error" and errorKind is set, the overlay reads
     *  per-kind copy (cancelled / timeout / error) from
     *  RESULT_OVERLAY_COPY.error.purchaseKindCopy. Used by the shop /
     *  coach buy flows to mirror the F1 mint pattern. */
    errorKind?: "error" | "cancelled" | "timeout";
    retryAction?: () => void;
  } | null>(null);

  // Pointer-events lock release: as soon as a result overlay appears,
  // any open dock sheet must be closed or its Radix modal portal
  // continues to intercept clicks on our overlay's scrim/X/CTAs.
  useEffect(() => {
    if (resultOverlay !== null) {
      setActiveDockTab(null);
    }
  }, [resultOverlay]);
  const [showBadgeEarned, setShowBadgeEarned] = useState(false);
  const [showPieceComplete, setShowPieceComplete] = useState(false);
  const badgeSheetOpen = activeDockTab === "badge";
  const setBadgeSheetOpen = (v: boolean) => {
    if (v) setActiveDockTab("badge");
    else setActiveDockTab((prev) => (prev === "badge" ? null : prev));
  };
  const trophiesSheetOpen = activeDockTab === "trophies";
  const setTrophiesSheetOpen = (v: boolean) => {
    if (v) setActiveDockTab("trophies");
    else setActiveDockTab((prev) => (prev === "trophies" ? null : prev));
  };

  // Publish the dock-driven sheet state to the shared store so the
  // <PersistentDock>'s center button can swap into "close overlay"
  // mode whenever ANY aux sheet is open — dock-side (badge/shop/
  // trophies/leaderboard) OR a non-dock overlay (account / pro /
  // exercise drawer). The sentinel `"overlay"` covers the non-dock
  // case so the center button still flips to close mode without
  // lighting any side-item glow.
  const hasNonDockOverlay = proSheetOpen || accountSheetOpen;
  useEffect(() => {
    if (activeDockTab) {
      setDockSheet(activeDockTab);
    } else if (hasNonDockOverlay) {
      setDockSheet("overlay");
    } else {
      setDockSheet(null);
    }
    return () => setDockSheet(null);
  }, [activeDockTab, hasNonDockOverlay]);

  // Register the dock store's open + close handlers. Same-route dock
  // taps now dispatch through the store (no URL push), so we open
  // the matching sheet here directly. The closer returns the user to
  // the visible base route via the center button — closes the
  // currently-open sheet, whether dock-driven or non-dock.
  useEffect(() => {
    const unregisterOpener = registerDockSheetOpener((slug) => {
      if (slug === "badge" || slug === "shop" || slug === "trophies" || slug === "leaderboard") {
        setActiveDockTab(slug);
      }
      // "arena" / "overlay" slugs aren't openable side-items — the
      // center button handles the route swap / overlay close directly.
    });
    const unregisterCloser = registerDockSheetCloser(() => {
      // Close the dock-driven tab first (if any), then close non-dock
      // overlays. Order matters when both are somehow open: closing
      // the dock sheet shouldn't leave a non-dock overlay floating.
      setActiveDockTab(null);
      if (proSheetOpen) setProSheetOpen(false);
      if (accountSheetOpen) setAccountSheetOpen(false);
    });
    return () => {
      unregisterOpener();
      unregisterCloser();
    };
  }, [proSheetOpen, accountSheetOpen]);
  const [shieldCount, setShieldCount] = useState(0);
  const [claimingPiece, setClaimingPiece] = useState<PieceKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const displayedToast = useRef<string>("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const toastFadeTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(msg: string, durationMs = 2000) {
    clearTimeout(toastTimer.current);
    clearTimeout(toastFadeTimer.current);
    displayedToast.current = msg;
    setToast(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => {
      setToastVisible(false);
      toastFadeTimer.current = setTimeout(() => setToast(null), 200);
    }, durationMs);
  }
  const { showSplash, showBriefing, markOnboarded } = useSplashLoader();
  const [exerciseDrawerOpen, setExerciseDrawerOpen] = useState(false);
  const [justClaimed, setJustClaimed] = useState<Record<PieceKey, boolean>>({
    rook: false, bishop: false, knight: false, pawn: false, queen: false, king: false,
  });
  const [unlockedPiece, setUnlockedPiece] = useState<PieceKey | null>(null);

  /** L2 layer toggle. When true, the board renders the active piece's
   *  labyrinth instead of the L1 exercise. Resets to false on piece
   *  switch — labyrinth state does not survive across pieces. */
  const [labyrinthMode, setLabyrinthMode] = useState(false);

  /** Modal trap fix: when the global ResultOverlay opens (success OR
   *  error) while a Radix dock sheet is still mounted, Radix's modal
   *  mode sets pointer-events: none on its siblings, blocking every
   *  click on the result overlay's scrim, X, and CTAs. We close the
   *  active dock tab whenever a result overlay appears so the result
   *  modal becomes the sole foreground and stays dismissable. */
  useEffect(() => {
    setLabyrinthMode(false);
    setLabyrinthCompleted(null);
    setLabyrinthMoves(0);
  }, [selectedPiece]);

  /** Completion snapshot for the L2 overlay. Set when the player
   *  reaches the labyrinth target; cleared on retry or back. */
  const [labyrinthCompleted, setLabyrinthCompleted] = useState<{
    moves: number;
    optimal: number;
    stars: number;
    /** Previous best move count (if any) before this attempt — used
     *  by the overlay to render "New best!" or the historical record. */
    previousBest: number | null;
    /** True when this attempt set a new personal record. */
    isNewBest: boolean;
  } | null>(null);
  /** Bumps the labyrinth board key on retry so internal Board state
   *  (piece position, selection, internal move counter) resets. */
  const [labyrinthKey, setLabyrinthKey] = useState(0);
  /** Live move counter mirrored from the Board's onMove callback.
   *  Drives the labyrinth HUD chip ("X / Y moves") so the player
   *  can pace themselves against the optimal target in real time. */
  const [labyrinthMoves, setLabyrinthMoves] = useState(0);

  const {
    progress,
    currentExercise,
    isLastExercise,
    totalStars,
    badgeEarned,
    isReplay,
    completeExercise,
    advanceExercise,
    goToExercise,
  } = useExerciseProgress(selectedPiece);

  const timerStart = useRef<number>(0);
  /** Synchronous concurrency guard for handleSubmitScore. The async
   *  signature fetch opens a window where wagmi's isPending is still
   *  false; without this ref a rapid double-tap would fire two
   *  parallel sign requests and two writeContractAsync calls before
   *  React could flip the disabled state. Cleared in the finally
   *  branch so retries after failure/timeout still work. */
  const submittingScoreRef = useRef(false);
  // Single source of truth for the board's auto-reset timer. The hook
  // handles the pending-timer-replacement, generation-based stale
  // callback protection, and unmount cleanup that used to be spread
  // across ~8 sites with autoResetTimer.current + boardGeneration.
  const autoReset = useAutoResetTimer();

  const PIECE_ORDER: PieceKey[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];
  const currentPieceIndex = PIECE_ORDER.indexOf(selectedPiece);
  const nextPiece = currentPieceIndex < PIECE_ORDER.length - 1
    ? PIECE_ORDER[currentPieceIndex + 1]
    : null;

  // Dock handoff from /arena: if the arena dock wrote a sheet key before
  // navigating here, open that sheet so the user lands on the surface they
  // tapped. Whitelist-validated so a poisoned storage value can't set an
  // unexpected tab.
  useEffect(() => {
    try {
      const key = sessionStorage.getItem("chesscito:open-sheet");
      if (key === "badge" || key === "shop" || key === "leaderboard" || key === "trophies") {
        setActiveDockTab(key);
      }
      sessionStorage.removeItem("chesscito:open-sheet");
    } catch { /* storage unavailable */ }
  }, []);

  // (Timer cleanup now lives inside useAutoResetTimer.)

  // Display is now derived from server-tracked credited - locally-
  // tracked consumed (clamped to MAX_SHIELDS). Read on mount + on
  // every shield-events dispatch (server credit landed, retry consumed
  // a shield, useShieldSync resolved).
  useEffect(() => {
    const sync = () => setShieldCount(readDisplayedShields());
    sync();
    return subscribeToShieldChanges(sync);
  }, []);


  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain = configuredChainId != null && chainId === configuredChainId;
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const scoreboardAddress = useMemo(() => getScoreboardAddress(chainId), [chainId]);
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  type PaymentToken = (typeof ACCEPTED_TOKENS)[number] | typeof CELO_TOKEN;
  const [paymentToken, setPaymentToken] = useState<PaymentToken | null>(null);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
  const score = useMemo(() => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR, [totalStars]);

  // v1: tracks last-exercise time only. 1000n fallback after board reset
  // is safe — on-chain time is informational, not used for scoring.
  const timeMs = useMemo(() => {
    if (phase !== "success") {
      return 1000n;
    }

    return BigInt(Math.max(1, elapsedMs));
  }, [elapsedMs, phase]);

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
      staleTime: 5 * 60_000, // shop items rarely change
    },
  });

  const shopCatalog = useMemo<CatalogItem[]>(
    () =>
      SHOP_ITEMS.map((item, index) => {
        const label = tShopItem(`${item.copyKey}.label` as const);
        const subtitle = tShopItem(`${item.copyKey}.subtitle` as const);
        const onChain = onChainItems?.[index];
        if (onChain?.status === "success" && Array.isArray(onChain.result)) {
          const price = onChain.result[0] as bigint;
          const enabled = onChain.result[1] as boolean;
          return {
            itemId: item.itemId,
            label,
            subtitle,
            configured: price > 0n,
            enabled: price > 0n && enabled,
            onChainPrice: price,
          };
        }

        return {
          itemId: item.itemId,
          label,
          subtitle,
          configured: false,
          enabled: false,
          onChainPrice: 0n,
        };
      }),
    [onChainItems, tShopItem]
  );

  /** What the shop sheet actually renders. The CELO sibling itemId is
   *  hidden from the card grid and surfaced as an extra "Buy with 1
   *  CELO" button on the parent Founder Badge card, only when running
   *  outside MiniPay (which never offers CELO) and only when the
   *  sibling is configured + enabled on-chain. */
  const displayShopCatalog = useMemo<CatalogItem[]>(() => {
    const celoSibling = shopCatalog.find(
      (item) => item.itemId === FOUNDER_BADGE_CELO_ITEM_ID && item.configured && item.enabled,
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
    [selectedItemId, shopCatalog]
  );

  // Balances are read for both stablecoins (default payment for every
  // shop item) and CELO (only routed to the Founder Badge sibling
  // itemId 5 outside MiniPay). The CELO entry sits at the tail of the
  // array so the index math against ACCEPTED_TOKENS stays untouched.
  const BALANCE_READ_TOKENS = useMemo(() => [...ACCEPTED_TOKENS, CELO_TOKEN], []);
  const CELO_BALANCE_INDEX = ACCEPTED_TOKENS.length;
  const { data: tokenBalances } = useReadContracts({
    contracts: BALANCE_READ_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] as const : undefined,
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
    (priceUsd6: bigint, itemId?: bigint) => {
      if (!tokenBalances) return null;
      // The CELO sibling never auto-falls back to a stablecoin — if the
      // user clicked "Buy with CELO" and they don't have CELO, we want
      // the flow to surface that explicitly rather than silently route
      // the purchase elsewhere.
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
    [tokenBalances, CELO_BALANCE_INDEX]
  );

  // Read hasClaimedBadge for all 6 pieces (batched)
  const BADGE_LEVEL_IDS = [1n, 2n, 3n, 4n, 5n, 6n] as const;
  const { data: allBadgesData, refetch: refetchAllBadges } = useReadContracts({
    contracts: BADGE_LEVEL_IDS.map((lid) => ({
      address: badgesAddress ?? undefined,
      abi: badgesAbi,
      functionName: "hasClaimedBadge" as const,
      args: address ? [address, lid] as const : undefined,
      chainId,
    })),
    query: {
      enabled: Boolean(address && badgesAddress),
      staleTime: 2 * 60_000, // badges change only after mint
    },
  });

  const badgesClaimed: Record<PieceKey, boolean | undefined> = {
    rook: allBadgesData?.[0]?.result as boolean | undefined,
    bishop: allBadgesData?.[1]?.result as boolean | undefined,
    knight: allBadgesData?.[2]?.result as boolean | undefined,
    pawn: allBadgesData?.[3]?.result as boolean | undefined,
    queen: allBadgesData?.[4]?.result as boolean | undefined,
    king: allBadgesData?.[5]?.result as boolean | undefined,
  };
  const hasClaimedBadge = badgesClaimed[selectedPiece];

  const { isLoading: isShopConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(shopTxHash),
    },
  });
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: claimTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(claimTxHash),
    },
  });
  const {
    isLoading: isSubmitConfirming,
    isSuccess: isSubmitSuccess,
    isError: isSubmitError,
  } = useWaitForTransactionReceipt({
    chainId,
    hash: submitTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(submitTxHash),
    },
  });

  // `canSendOnChain` keeps its old shape for the claim-badge path (which
  // still requires the badge to have been earned). For the score-save
  // path Cluster C introduces `canSaveScore` — same wallet preconditions
  // WITHOUT the `badgeEarned` requirement, so SAVE activates from the
  // first star (addendum §2.2).
  const canSendOnChain =
    Boolean(address) &&
    isConnected &&
    isCorrectChain &&
    levelId > 0n &&
    badgeEarned;
  const canSaveScore =
    Boolean(address) && isConnected && isCorrectChain && levelId > 0n;
  const isClaimBusy = isBadgeWriting || isClaimConfirming;
  const isSubmitBusy = isScoreWriting || isSubmitConfirming;
  const isShopBusy = isShopWriting || isShopConfirming;

  // Cluster C — local-first save state. `lastSavedScore` is the last
  // score this device has confirmed on chain (read from localStorage).
  // The score-pending gate is now `localScore > lastSavedScore` instead
  // of the old `allExercisesAttempted` heuristic.
  const { lastSavedScore, lastSavedTxHash, recordSaveFor } =
    useSaveScoreState(selectedPiece);
  const savedReceiptUrl =
    lastSavedTxHash && chainId ? txLink(chainId, lastSavedTxHash) : undefined;
  const localScoreNum = Number(score);
  const scorePendingNew =
    canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore;
  const isSavedAtParity =
    lastSavedScore > 0 && localScoreNum === lastSavedScore;

  // Tx phase tracking for the TxProgressSteps toast. The toast remains
  // mounted while the tx is in flight AND for `SAVE_DONE_HOLD_MS` after
  // confirmation (matches the B1 primitive's own done-hold; tokenized as
  // 3 × `--duration-ceremony` for motion-scale alignment). The surface
  // owns the unmount boundary so the primitive's internal timer doesn't
  // conflict with React's re-render cycle.
  //
  // The two effects below split cleanly so the done-hold timer is NOT
  // cleaned up by React's effect-rerun semantics (Cluster C review
  // patch — premature clear bug fix). One latch ref guarantees the
  // hold fires once per (txHash, success) pair.
  const [txDoneAt, setTxDoneAt] = useState<number | null>(null);
  const pendingSubmitRef = useRef<{
    piece: typeof selectedPiece;
    score: number;
    txHash: string;
  } | null>(null);
  const doneHoldStartedForTxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSubmitSuccess || !submitTxHash) return;
    if (doneHoldStartedForTxRef.current === submitTxHash) return;
    doneHoldStartedForTxRef.current = submitTxHash;

    // Persist the save to the ORIGINAL piece (piece-switch corruption
    // fix). recordSaveFor writes localStorage under pending.piece even
    // if the user has since switched to a different piece selector.
    const pending = pendingSubmitRef.current;
    if (pending && pending.txHash === submitTxHash) {
      recordSaveFor(pending.piece, pending.score, pending.txHash);
      pendingSubmitRef.current = null;
    }

    // Start the 1500ms done-hold. txDoneAt is intentionally NOT in this
    // effect's deps — setting it inside would re-trigger the effect and
    // React would clear the timer prematurely.
    setTxDoneAt(Date.now());
    const timer = window.setTimeout(() => setTxDoneAt(null), SAVE_DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isSubmitSuccess, submitTxHash, recordSaveFor]);

  // Reset the done-hold + tx-success latch the moment a NEW submit
  // starts so subsequent submissions get their own hold window.
  useEffect(() => {
    if (isScoreWriting && !submitTxHash) {
      setTxDoneAt(null);
      doneHoldStartedForTxRef.current = null;
    }
  }, [isScoreWriting, submitTxHash]);

  // 4-phase precedence (failed > done > wait > sign) extracted to
  // `lib/exercises/tx-toast-state` for unit-test coverage. The `failed`
  // branch closes Cluster C SAVE residue defer #1 — chain revert now
  // surfaces as a sticky failed toast instead of stranding the user on
  // a stale "Waiting…" state until the next submit clears it.
  const txToast = deriveTxToastState({
    isWriting: isScoreWriting,
    isConfirming: isSubmitConfirming,
    isError: isSubmitError,
    txHash: submitTxHash,
    doneAt: txDoneAt,
  });
  const showTxToast = txToast.show;
  const txCurrent = txToast.show ? txToast.current : "sign";

  const allExercisesAttempted = progress.stars.every(s => s > 0);

  const contextAction = getContextAction({
    phase,
    shieldsAvailable: shieldCount,
    scorePending: scorePendingNew,
    badgeClaimable: badgeEarned && !hasClaimedBadge && !justClaimed[selectedPiece],
    isConnected,
    isCorrectChain,
  });

  // Suppress unused-var lint for the legacy heuristic — preserved so
  // any downstream consumer that still references it doesn't break.
  void allExercisesAttempted;

  async function writeWithOptionalFeeCurrency(
    writer: typeof writeScoreAsync,
    request: Parameters<typeof writeScoreAsync>[0],
  ) {
    try {
      const feeManagedRequest = feeCurrency
        ? ({
            ...request,
            feeCurrency,
          } as unknown as Parameters<typeof writeScoreAsync>[0])
        : request;
      return await writer(feeManagedRequest);
    } catch (error) {
      if (!feeCurrency) {
        throw error;
      }

      return writer(request);
    }
  }

  function resetBoard() {
    autoReset.clear();
    setBoardKey((previous) => previous + 1);
    setPhase("ready");
    setMoves(0);
    setElapsedMs(0);
    timerStart.current = 0;
  }

  function handleMove(position: BoardPosition, movesCount: number) {
    const isTarget =
      position.file === currentExercise.targetPos.file &&
      position.rank === currentExercise.targetPos.rank;

    setMoves(movesCount);
    if (movesCount === 1) timerStart.current = Date.now();

    if (isTarget) {
      hapticSuccess();
      setPhase("success");
      const elapsed = timerStart.current > 0 ? Date.now() - timerStart.current : 1000;
      setElapsedMs(elapsed);
      completeExercise(movesCount);

      // Phase 2 nudge: first ★★★ on any exercise while disconnected
      // triggers the one-shot "Connect to save" prompt. Hook is idempotent —
      // calling show() after the flag is set is a no-op, so this branch
      // runs cheaply on every perfect.
      if (
        !isConnected &&
        computeStars(movesCount, currentExercise.optimalMoves) === 3
      ) {
        starsConnectPrompt.show();
      }

      track("exercise_complete", {
        piece: selectedPiece,
        exercise_id: currentExercise.id,
        moves: movesCount,
        optimal_moves: currentExercise.optimalMoves,
        elapsed_ms: elapsed,
        is_capture: Boolean(currentExercise.isCapture),
        is_replay: isReplay,
      });

      // On last exercise: check if badge is earned (including this completion)
      if (isLastExercise && !isReplay) {
        const exercise = EXERCISES[selectedPiece][progress.exerciseIndex];
        const newStars = computeStars(movesCount, exercise.optimalMoves);
        const prevStarValue = progress.stars[progress.exerciseIndex];
        const starDelta = Math.max(0, newStars - prevStarValue);
        const newTotal = totalStars + starDelta;

        if (newTotal >= BADGE_THRESHOLD && !hasClaimedBadge) {
          setShowBadgeEarned(true);
          // Safety-net: auto-dismiss badge prompt and reset board if user
          // doesn't interact within 15 seconds (prevents phase stuck forever)
          autoReset.schedule(() => {
            setShowBadgeEarned(false);
            setShowPieceComplete(true);
          }, 15_000);
          return;
        }
      }

      autoReset.schedule(() => {
        if (!isLastExercise) {
          advanceExercise();
          resetBoard();
        } else {
          // Last exercise — show completion guide instead of silent reset
          setShowPieceComplete(true);
        }
      }, 1500);
      return;
    }

    // Solo ejercicios de 1 movimiento: el primer click incorrecto = auto-reset
    // Ejercicios multi-movimiento: el jugador sigue navegando libremente
    if (currentExercise.optimalMoves === 1) {
      hapticReject();
      setPhase("failure");
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: currentExercise.id,
        moves: movesCount,
        is_capture: Boolean(currentExercise.isCapture),
      });
      // When shields are available, give the user a real window to
      // decide. 1.5s is too short to read the chip + tap the button —
      // the feature is paid ($0.025) so it must be reachable. 6s if
      // shields, 1.5s otherwise (preserves prior fast-flow when there
      // is nothing to decide).
      autoReset.schedule(() => resetBoard(), shieldCount > 0 ? 6_000 : 1_500);
    }
  }

  function handleUseShield() {
    if (phase !== "failure" || shieldCount <= 0) return;
    autoReset.invalidate();
    consumeOneShield();
    resetBoard();
  }

  function handleExerciseNavigate(index: number) {
    autoReset.invalidate();
    // Mirror the piece-rail handler: dismiss end-of-piece overlays so a
    // mid-overlay exercise jump can't leave them stuck on stale data.
    // resultOverlay / tx hashes are intentionally left alone — those
    // belong to the player to dismiss explicitly.
    setShowBadgeEarned(false);
    setShowPieceComplete(false);
    goToExercise(index);
    resetBoard();
  }

  function handleBadgeEarnedDismiss() {
    autoReset.clear();
    setShowBadgeEarned(false);
    setShowPieceComplete(true);
  }

  async function handleClaimBadge(piece?: PieceKey) {
    const claimLevelId = piece ? getLevelId(piece) : levelId;
    if (!address || !badgesAddress || !isConnected || !isCorrectChain || claimLevelId <= 0n) {
      return;
    }
    // Prevent double-claim (stale cache or rapid taps)
    const targetPiece = piece ?? selectedPiece;
    if (badgesClaimed[targetPiece] || isClaimBusy) return;

    setLastError(null);
    setClaimingPiece(targetPiece);
    track("badge_claim_tx", { stage: "start", piece: targetPiece });

    try {
      const signed = await requestSignature("/api/sign-badge", {
        player: address,
        levelId: Number(claimLevelId),
      });

      const txHash = await writeWithOptionalFeeCurrency(writeBadgeAsync, {
        address: badgesAddress,
        abi: badgesAbi,
        functionName: "claimBadgeSigned" as const,
        args: [claimLevelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      hapticSuccess();
      setClaimTxHash(txHash);
      track("badge_claim_tx", { stage: "success", piece: targetPiece });
      setJustClaimed(prev => ({ ...prev, [targetPiece]: true }));
      void refetchAllBadges();
      // Queue unlock celebration for the next piece
      const claimedIndex = PIECE_ORDER.indexOf(targetPiece);
      const nextUnlock = claimedIndex < PIECE_ORDER.length - 1 ? PIECE_ORDER[claimedIndex + 1] : null;
      if (nextUnlock) {
        setUnlockedPiece(nextUnlock);
        track("modal_open", { id: "piece-unlocked", piece: nextUnlock });
      }
      setResultOverlay({
        variant: "badge",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "claim-badge", txHash, levelId: Number(claimLevelId) });
    } catch (error) {
      if (isUserCancellation(error)) {
        track("badge_claim_tx", { stage: "cancelled", piece: targetPiece });
        return;
      }
      const message = toErrorMessage(error);
      setLastError(message);
      track("badge_claim_tx", { stage: "error", piece: targetPiece, error_kind: classifyTxErrorKind(error) });
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error, tResult),
        retryAction: () => void handleClaimBadge(piece),
      });
      console.warn("[MiniPayTx] error", { label: "claim-badge", levelId: Number(claimLevelId), error: message });
    } finally {
      setClaimingPiece(null);
    }
  }

  async function handleSubmitScore() {
    // Cluster C patch (post-review): score path uses `canSaveScore` (no
    // badgeEarned requirement), per addendum AC-2.2.1. The legacy
    // `canSendOnChain` guard still applies to the claim-badge path.
    if (!canSaveScore || !address || !scoreboardAddress || isSubmitBusy) {
      return;
    }
    // Sync guard closes the await-the-signature-fetch race window the
    // wagmi-derived isSubmitBusy flag can't cover.
    if (submittingScoreRef.current) {
      return;
    }
    submittingScoreRef.current = true;

    setLastError(null);
    // Cluster C SAVE residue defer #1 — clear the previous tx's hash so a
    // retry after revert shows "Signing…" immediately instead of lingering
    // on "Failed" until the new hash lands. Safe because the receipt
    // watcher is gated on `enabled: Boolean(submitTxHash)`.
    setSubmitTxHash(null);
    track("score_submit_tx", { stage: "start", piece: selectedPiece });

    try {
      const signed = await requestSignature("/api/sign-score", {
        player: address,
        levelId: Number(levelId),
        score: Number(score),
        timeMs: Number(timeMs),
      });

      const txHash = await writeWithOptionalFeeCurrency(writeScoreAsync, {
        address: scoreboardAddress,
        abi: scoreboardAbi,
        functionName: "submitScoreSigned" as const,
        args: [levelId, score, timeMs, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
        chainId,
        account: address,
      });

      hapticSuccess();
      setSubmitTxHash(txHash);
      // Cluster C — capture (piece, score, txHash) at broadcast time so
      // the receipt-success effect persists the SUBMITTED score under
      // the CORRECT piece (the user may switch pieces before the
      // receipt arrives — the saved score still belongs to the original
      // piece, not the new selection).
      pendingSubmitRef.current = {
        piece: selectedPiece,
        score: Number(score),
        txHash,
      };
      track("score_submit_tx", { stage: "success", piece: selectedPiece });
      setResultOverlay({
        variant: "score",
        txHash,
      });
      console.info("[MiniPayTx] result", { label: "submit-score", txHash, levelId: Number(levelId) });

      // Write-through to Supabase (fire-and-forget)
      void fetch("/api/cache-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player: address,
          levelId: Number(levelId),
          score: Number(score),
          timeMs: Number(timeMs),
          txHash: txHash,
        }),
      }).catch(() => {});

      // Optimistic entry for leaderboard
      try {
        sessionStorage.setItem(
          "chesscito:optimistic-score",
          JSON.stringify({
            player: address.toLowerCase(),
            score: Number(score),
            levelId: Number(levelId),
            ts: Date.now(),
          }),
        );
      } catch { /* storage unavailable */ }
    } catch (error) {
      if (isUserCancellation(error)) {
        track("score_submit_tx", { stage: "cancelled", piece: selectedPiece });
        showToast(tFooter("submitCanceled"), 2000);
        return;
      }
      const message = toErrorMessage(error);
      setLastError(message);
      track("score_submit_tx", { stage: "error", piece: selectedPiece, error_kind: classifyTxErrorKind(error) });
      setResultOverlay({
        variant: "error",
        errorMessage: classifyTxError(error, tResult),
        retryAction: () => void handleSubmitScore(),
      });
      showToast(tFooter("submitFailed"), 3000);
      console.warn("[MiniPayTx] error", { label: "submit-score", levelId: Number(levelId), error: message });
    } finally {
      submittingScoreRef.current = false;
    }
  }

  async function handleProPurchase() {
    if (!address || !shopAddress || !publicClient || !isCorrectChain) return;
    setProPurchaseError(null);
    setVerifyFailedTxHash(null);

    // Lookahead so pro_purchase_started fires only when the buy has a
    // real chance of completing. selectPaymentToken reads from already-
    // loaded balances; the helper re-checks on its own as the source
    // of truth for the actual decision.
    const previewToken = selectPaymentToken(PRO_PRICE_USD6);
    if (!previewToken) {
      track("pro_purchase_failed", { kind: "no-token" });
      setProPurchaseError("Insufficient stablecoin balance.");
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
      onPhaseChange: (phase) => setProPurchaseState(phase),
    });
    setProPurchaseState("idle");

    if (result.kind === "success") {
      track("pro_purchase_confirmed", {
        item_id: 6,
        price_usd6: 1_990_000,
        days_granted: 30,
        tx_hash_prefix: result.txHash.slice(0, 10),
      });
      refetchProStatus();
      hapticSuccess();
      setProSheetOpen(false);
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
    setProPurchaseError(
      result.kind === "no-token"
        ? "Insufficient stablecoin balance."
        : result.kind === "timeout"
          ? "Transaction timed out. Please try again."
          : result.kind === "verify-failed"
            ? tPro("errors.verifyFailedTitle")
            : tPro("errors.purchaseFailed"),
    );
  }

  async function handleRetryVerify() {
    if (!verifyFailedTxHash || !address || isRetryingVerify) return;
    setIsRetryingVerify(true);
    try {
      const res = await fetch("/api/verify-pro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: verifyFailedTxHash, walletAddress: address }),
      });
      const json = (await res.json().catch(() => null)) as { active?: boolean } | null;
      if (res.ok && json?.active) {
        track("pro_purchase_confirmed", {
          item_id: 6,
          price_usd6: 1_990_000,
          days_granted: 30,
          tx_hash_prefix: verifyFailedTxHash.slice(0, 10),
        });
        setProPurchaseError(null);
        setVerifyFailedTxHash(null);
        refetchProStatus();
        hapticSuccess();
        setProSheetOpen(false);
        return;
      }
      // Same idempotent retry surface — keep the error visible and the
      // hash intact so the user can try again later.
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
  }

  async function handleConfirmPurchase() {
    if (!selectedItem || !address || !shopAddress || !isCorrectChain) {
      return;
    }
    if (!selectedItem.configured) {
      setLastError("This item is not available yet");
      return;
    }
    if (!selectedItem.enabled) {
      setLastError("This item is currently unavailable");
      return;
    }
    if (!paymentToken) {
      setLastError("Not enough funds to complete this purchase");
      return;
    }

    const unitPrice = selectedItem.onChainPrice;
    const normalizedTotal = normalizePrice(unitPrice, paymentToken.decimals);
    const txSource = selectedItem.itemId === SHIELD_ITEM_ID ? "shop_retry_shield" : "shop_founder_badge";
    const itemIdNum = Number(selectedItem.itemId);

    setLastError(null);
    track("shop_buy_tx", { stage: "start", source: txSource, item_id: itemIdNum });
    console.info("[MiniPayTx] request", {
      label: selectedItem.label,
      itemId: selectedItem.itemId.toString(),
      total: normalizedTotal.toString(),
      currency: paymentToken.symbol,
      chainId,
      shopAddress,
    });

    try {
      // Read allowance fresh (not from hook cache) to avoid duplicate approvals on retry
      const freshAllowance = publicClient
        ? ((await publicClient.readContract({
            address: paymentToken.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, shopAddress],
          })) as bigint)
        : 0n;
      if (freshAllowance < normalizedTotal) {
        setPurchasePhase("approving");
        const approveHash = await writeWithOptionalFeeCurrency(writeShopAsync, {
          address: paymentToken.address,
          abi: erc20Abi,
          functionName: "approve" as const,
          args: [shopAddress, normalizedTotal] as const,
          chainId,
          account: address,
        });
        console.info("[MiniPayTx] result", {
          label: `${selectedItem.label} approve (${paymentToken.symbol})`,
          txHash: approveHash,
        });

        if (!publicClient) {
          throw new Error("Missing public client for approval confirmation");
        }

        await waitForReceiptWithTimeout(publicClient, approveHash);
      }

      setPurchasePhase("buying");
      const buyHash = await writeWithOptionalFeeCurrency(writeShopAsync, {
        address: shopAddress,
        abi: shopAbi,
        functionName: "buyItem" as const,
        args: [selectedItem.itemId, 1n, paymentToken.address] as const,
        chainId,
        account: address,
      });

      setShopTxHash(buyHash);
      track("shop_buy_tx", { stage: "success", source: txSource, item_id: itemIdNum });
      // Server-side shield credit (fire-and-forget). Spec §"Behavior 1":
      // banner truthfulness = "tx submitted", credit resolves async.
      if (selectedItem.itemId === SHIELD_ITEM_ID && address) {
        const buyerAddress = address;
        enqueuePendingTx(buyHash as `0x${string}`);
        void (async () => {
          try {
            const res = await fetch("/api/credit-shield", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                txHash: buyHash,
                walletAddress: buyerAddress,
              }),
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
              ok: true;
              credited: number;
              delta: number;
              txHash: string;
            };
            dequeuePendingTx(buyHash as `0x${string}`);
            writeCreditedCache(data.credited);
            dispatchShieldChange();
          } catch {
            // network failure → leave queued, useShieldSync retries
          }
        })();
      }
      setConfirmOpen(false);
      setStoreOpen(false);
      setSelectedItemId(null);
      setResultOverlay({
        variant: "shop",
        txHash: buyHash,
      });
      console.info("[MiniPayTx] result", {
        label: selectedItem.label,
        txHash: buyHash,
      });
    } catch (error) {
      // Three discrete kinds with their own copy + telemetry — same
      // pattern handleClaimVictory uses for F1 Mint Victory. The
      // overlay reads RESULT_OVERLAY_COPY.error.purchaseKindCopy[kind]
      // so each path lands on calm, non-technical wording instead of
      // the generic error string.
      if (isUserCancellation(error)) {
        track("shop_buy_tx", { stage: "cancelled", source: txSource, item_id: itemIdNum });
        setConfirmOpen(false);
        setResultOverlay({ variant: "error", errorKind: "cancelled" });
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
        setResultOverlay({ variant: "error", errorKind: "timeout" });
        return;
      }
      setConfirmOpen(false);
      const message = toErrorMessage(error);
      setLastError(message);
      setResultOverlay({
        variant: "error",
        errorKind: "error",
        errorMessage: classifyTxError(error, tResult),
      });
      track("shop_buy_tx", {
        stage: "error",
        source: txSource,
        item_id: itemIdNum,
        error_kind: classifyTxErrorKind(error),
      });
      console.warn("[MiniPayTx] error", {
        label: selectedItem.label,
        error: message,
      });
    } finally {
      setPurchasePhase("idle");
    }
  }

  /** Active exercise — switches to the labyrinth when L2 layer is on
   *  and the piece has at least one labyrinth defined. Falls back to
   *  the L1 currentExercise otherwise. */
  const labyrinthList = LABYRINTHS[selectedPiece] ?? [];
  const labyrinthAvailable = labyrinthList.length > 0 && (badgeEarned || totalStars >= BADGE_THRESHOLD);
  const effectiveLabyrinthMode = labyrinthMode && labyrinthAvailable;
  const activeLabyrinth = effectiveLabyrinthMode ? labyrinthList[0] : null;
  const activeExercise = activeLabyrinth ?? currentExercise;

  /** Labyrinth move handler — fires the completion overlay when the
   *  player reaches the target. The Board's internal counter is the
   *  source of truth for move count. */
  const handleLabyrinthMove = useCallback(
    (position: BoardPosition, movesCount: number) => {
      if (!activeLabyrinth) return;
      // Mirror the Board's internal counter to drive the live HUD
      // chip. Fires on every move; the completion check below only
      // runs when the player lands on the target square.
      setLabyrinthMoves(movesCount);
      const reached =
        position.file === activeLabyrinth.targetPos.file &&
        position.rank === activeLabyrinth.targetPos.rank;
      if (!reached) return;
      const stars = labyrinthStars(movesCount, activeLabyrinth.optimalMoves);
      // Read previous best BEFORE recording so the overlay can
      // contextualize the new score against the player's history.
      const previousBest = getLabyrinthBest(selectedPiece, activeLabyrinth.id);
      const isNewBest = recordLabyrinthBest(
        selectedPiece,
        activeLabyrinth.id,
        movesCount,
      );
      setLabyrinthCompleted({
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        previousBest,
        isNewBest,
      });
      track("labyrinth_complete", {
        labyrinth_id: activeLabyrinth.id,
        piece: selectedPiece,
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        is_new_best: isNewBest,
        previous_best: previousBest ?? null,
      });
    },
    [activeLabyrinth, selectedPiece],
  );

  const targetLabel = activeLabyrinth
    ? // Labyrinth chip becomes a live counter: "0 / 4 · optimal" (no
      //  moves yet) → "3 / 4 · optimal" (live) → "5 / 4 · over" past
      //  optimal so the player can pace themselves in real time.
      `${labyrinthMoves} / ${activeLabyrinth.optimalMoves} moves`
    : activeExercise.isCapture
      ? tCapture("statsLabel")
      : `${String.fromCharCode(97 + activeExercise.targetPos.file)}${activeExercise.targetPos.rank + 1}`;

  const pieceHint = activeLabyrinth
    ? `${tLab("missionTitle")} · ${tLab("missionHint", { optimal: activeLabyrinth.optimalMoves })}`
    : currentExercise.isCapture
      ? tMission("captureHintCompact")
      : tMission(`pieceHint.${selectedPiece}` as const);

  // Show movement lane hints on the first exercise of each piece (until the player earns stars)
  const tutorialHints = useMemo(() => {
    if (progress.exerciseIndex !== 0 || progress.stars[0] > 0) return undefined;
    const targets = getValidTargets(selectedPiece, currentExercise.startPos);
    return new Set(targets.map(getPositionLabel));
  }, [selectedPiece, progress.exerciseIndex, progress.stars, currentExercise.startPos]);

  return (
    <div className="relative w-full overflow-x-hidden">
      {showSplash && (
        <div className="playhub-intro-overlay is-active" role="status" aria-live="polite" aria-busy="true">
          {/* Splash art carries the visual; copy below provides status. */}
          <p className="text-sm font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] animate-pulse">{tSplash("loading")}</p>
          <p className="text-xs text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{tSplash("subtitle")}</p>
        </div>
      )}
      <main className="mission-shell relative mx-auto flex h-[100dvh] w-full max-w-[var(--app-max-width)] flex-col px-0 py-0 sm:px-0">
        {/* Header — canonical <ContextualHeader back-control> envelope
         *  (52–64 px). Title = "Exercises"; PRO chip in the trailing
         *  slot.
         *  Divider DROPPED on purpose (Sally pass 8, 2026-05-20):
         *  /exercises is a diegetic gameplay surface. Per the canonical
         *  rule, divider presence signals "meta navigation" and absence
         *  signals "you're playing". The quest tray + board below speak
         *  for themselves; the divider would over-articulate chrome
         *  during gameplay. */}
        <div>
          <ContextualHeader
            variant="back-control"
            title={tDrawer("title")}
            back={{
              onClick: () => router.push("/hub"),
              label: tStatus("backLabel"),
            }}
            trailingControl={
              !address ? (
                <button
                  type="button"
                  onClick={() => openConnectModal?.()}
                  aria-label={tHud("connectAriaLabel")}
                  className="candy-tray-pill hub-hud-pill"
                >
                  <CandyIcon
                    name="wallet"
                    className="candy-tray-pill-icon candy-tray-pill-icon--floating"
                  />
                  <span>{tHud("connectLabel")}</span>
                </button>
              ) : !proLoading ? (
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(true)}
                  aria-label={
                    proStatus?.active
                      ? tStatus("proManageLabel")
                      : tStatus("accountLabel")
                  }
                  className={`candy-tray-pill hub-hud-pill${
                    proStatus?.active ? " hub-hud-pill--pro" : ""
                  }`}
                >
                  <picture>
                    <source srcSet="/art/screen-mission/account-icon.avif" type="image/avif" />
                    <source srcSet="/art/screen-mission/account-icon.webp" type="image/webp" />
                    <img
                      src="/art/screen-mission/account-icon.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="candy-tray-pill-icon candy-tray-pill-icon--floating"
                    />
                  </picture>
                  <span>{tStatus("accountChipLabel")}</span>
                </button>
              ) : (
                <span aria-hidden="true" className="block h-6 w-6" />
              )
            }
          />
        </div>
        <MissionPanelCandy
          selectedPiece={selectedPiece}
          onSelectPiece={(piece) => {
            autoReset.invalidate();
            setSelectedPiece(piece);
            setResultOverlay(null);
            setClaimTxHash(null);
            setSubmitTxHash(null);
            setShowBadgeEarned(false);
            setShowPieceComplete(false);
            resetBoard();
          }}
          pieces={[
            { key: "rook", label: tPiece("rook"), enabled: true },
            { key: "bishop", label: tPiece("bishop"), enabled: true },
            { key: "knight", label: tPiece("knight"), enabled: true },
            { key: "pawn", label: tPiece("pawn"), enabled: true },
            { key: "queen", label: tPiece("queen"), enabled: true },
            { key: "king", label: tPiece("king"), enabled: false },
          ]}
          phase={phase}
          targetLabel={targetLabel}
          pieceHint={pieceHint}
          isCapture={Boolean(currentExercise.isCapture)}
          isDockSheetOpen={activeDockTab !== null}
          labyrinthAvailable={labyrinthAvailable}
          labyrinthMode={effectiveLabyrinthMode}
          labyrinthOptimalMoves={activeLabyrinth?.optimalMoves}
          onToggleLabyrinth={(next) => {
            if (next && !labyrinthAvailable) return;
            setLabyrinthMode(next);
            setLabyrinthMoves(0);
          }}
          score={score.toString()}
          timeMs={timeMs.toString()}
          currentStars={totalStars}
          claimedBadges={badgesClaimed}
          shieldCount={shieldCount}
          actionRowLeft={<DailyTacticSlot />}
          actionRowRight={
            <MiniArenaBridgeSlot
              setup={MINI_ARENA_SETUPS[0]}
              unlocked={selectedPiece === "rook" && totalStars >= 12}
            />
          }
          contextualAction={
            // Cluster C — three-way render in the contextual slot:
            //   (1) Tx in flight (or held post-confirm)  → TxProgressSteps toast
            //   (2) Local matches last-saved on chain    → SavedChip
            //   (3) Otherwise (incl. claimBadge etc.)    → ContextualActionSlot
            // The slot only ever renders one of these per frame so the
            // mission-panel-candy centering stays predictable.
            showTxToast ? (
              <TxProgressSteps
                variant="toast"
                flow="save-score"
                steps={[{ code: "sign" }, { code: "wait" }]}
                current={txCurrent}
              />
            ) : isSavedAtParity && contextAction === null ? (
              <SavedChip
                stars={Math.floor(lastSavedScore / Number(POINTS_PER_STAR))}
                total={BADGE_THRESHOLD}
                receiptUrl={savedReceiptUrl}
              />
            ) : starsConnectPrompt.isVisible ? (
              <ConnectPromptToast
                milestone="stars"
                onConnect={() => {
                  starsConnectPrompt.dismiss();
                  openConnectModal?.();
                }}
                onDismiss={starsConnectPrompt.dismiss}
              />
            ) : (
              <ContextualActionSlot
                action={contextAction}
                shieldsAvailable={shieldCount}
                isBusy={isScoreWriting || isBadgeWriting || isSubmitConfirming || isClaimConfirming}
                onSubmitScore={() => void handleSubmitScore()}
                onUseShield={handleUseShield}
                onClaimBadge={() => void handleClaimBadge()}
                onRetry={() => resetBoard()}
                onConnectWallet={() => openConnectModal?.()}
                onSwitchNetwork={() => configuredChainId != null && switchChain({ chainId: configuredChainId })}
                compact
              />
            )
          }
          persistentDock={<PersistentDock />}
          board={
            <Board
              key={`${boardKey}-${labyrinthMode ? `lab-${labyrinthKey}` : "ex"}`}
              pieceType={selectedPiece}
              startPosition={activeExercise.startPos}
              mode={activeLabyrinth ? "labyrinth" : "practice"}
              targetPosition={activeExercise.targetPos}
              obstacles={activeLabyrinth?.obstacles}
              captureTargets={activeExercise.captureTargets}
              isLocked={!activeLabyrinth ? (phase === "failure" || phase === "success") : labyrinthCompleted !== null}
              onMove={activeLabyrinth ? handleLabyrinthMove : handleMove}
              isCapture={activeExercise.isCapture ?? false}
              tutorialHints={activeLabyrinth ? undefined : tutorialHints}
            />
          }
          exerciseDrawer={
            <ExerciseDrawer
              open={exerciseDrawerOpen}
              onOpenChange={setExerciseDrawerOpen}
              piece={selectedPiece}
              exercises={EXERCISES[selectedPiece]}
              stars={progress.stars}
              activeIndex={progress.exerciseIndex}
              totalStars={totalStars}
              onNavigate={handleExerciseNavigate}
            />
          }
          isReplay={isReplay}
        />

        <PurchaseConfirmSheet
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!open && purchasePhase !== "idle") return;
            setConfirmOpen(open);
            if (!open) {
              setSelectedItemId(null);
            }
          }}
          selectedItem={selectedItem}
          chainId={chainId}
          shopAddress={shopAddress}
          paymentTokenSymbol={paymentToken?.symbol ?? null}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          isWriting={isShopWriting}
          purchasePhase={purchasePhase}
          onConfirm={() => void handleConfirmPurchase()}
        />

        <ProSheet
          open={proSheetOpen}
          onOpenChange={(open) => {
            // Block close while a tx is in-flight to prevent the user
            // from losing the in-progress state mid-purchase. Also block
            // close mid-retry so the spinner state stays coherent.
            if (!open && (proPurchaseState !== "idle" || isRetryingVerify)) return;
            setProSheetOpen(open);
            if (!open) {
              setProPurchaseError(null);
              setVerifyFailedTxHash(null);
            }
          }}
          status={proStatus}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          isPurchasing={proPurchaseState === "purchasing"}
          isVerifying={proPurchaseState === "verifying"}
          errorMessage={proPurchaseError}
          verifyFailedTxHash={verifyFailedTxHash}
          isRetryingVerify={isRetryingVerify}
          onRetryVerify={() => void handleRetryVerify()}
          onConnectWallet={() => openConnectModal?.()}
          onSwitchNetwork={() =>
            configuredChainId != null && switchChain({ chainId: configuredChainId })
          }
          onPurchase={() => void handleProPurchase()}
        />
        {address ? (
          <AccountSheet
            open={accountSheetOpen}
            onOpenChange={setAccountSheetOpen}
            walletAddress={address}
            walletShort={formatWalletShort(address)}
            chainId={chainId}
            proActive={proStatus?.active === true}
            onManagePro={() => {
              setAccountSheetOpen(false);
              setProSheetOpen(true);
            }}
            onDisconnect={() => {
              setAccountSheetOpen(false);
              disconnect();
            }}
          />
        ) : null}

        {/* First-visit briefing must never mount on top of a dock
         *  sheet (shop, badges, trophies, leaderboard, arena) or the
         *  PRO sheet. If a sheet is already open when the splash
         *  finishes, defer the briefing until the user closes it —
         *  showBriefing stays true until markOnboarded() fires, so
         *  the dialog will appear naturally once the user is back at
         *  the root view. Prevents the visual stack collapse flagged
         *  by visual-qa-2026-04-30 (Issue #1). */}
        {showBriefing && activeDockTab === null && !proSheetOpen && !accountSheetOpen ? (
          <MissionBriefing
            pieceType={selectedPiece}
            targetLabel={targetLabel}
            isCapture={Boolean(currentExercise.isCapture)}
            onPlay={markOnboarded}
          />
        ) : null}

        {showPieceComplete && !showBadgeEarned ? (
          <PieceCompletePrompt
            pieceType={selectedPiece}
            nextPiece={nextPiece ?? null}
            hasClaimedBadge={!!hasClaimedBadge}
            totalStars={totalStars}
            onNextPiece={() => {
              setShowPieceComplete(false);
              if (nextPiece) setSelectedPiece(nextPiece);
              resetBoard();
            }}
            onArena={() => {
              setShowPieceComplete(false);
              window.location.href = "/arena?fresh=1";
            }}
            onPracticeAgain={() => {
              setShowPieceComplete(false);
              resetBoard();
            }}
            onTryLabyrinth={
              labyrinthList.length > 0
                ? () => {
                    setShowPieceComplete(false);
                    setLabyrinthMode(true);
                    resetBoard();
                  }
                : undefined
            }
            onSubmitScore={
              canSaveScore
                ? () => {
                    setShowPieceComplete(false);
                    // Submit-and-close used to drop the user back on
                    // the final exercise of the just-completed piece
                    // while the score POST flew off; align it with
                    // the dismiss/next-piece path so the surface
                    // advances even when the user picks the on-chain
                    // save route.
                    void handleSubmitScore();
                    if (nextPiece) {
                      setSelectedPiece(nextPiece);
                      resetBoard();
                    }
                  }
                : undefined
            }
          />
        ) : null}

        {labyrinthCompleted ? (
          <LabyrinthCompleteOverlay
            moves={labyrinthCompleted.moves}
            optimalMoves={labyrinthCompleted.optimal}
            stars={labyrinthCompleted.stars}
            previousBest={labyrinthCompleted.previousBest}
            isNewBest={labyrinthCompleted.isNewBest}
            onRetry={() => {
              setLabyrinthCompleted(null);
              setLabyrinthKey((k) => k + 1);
              setLabyrinthMoves(0);
            }}
            onBack={() => {
              setLabyrinthCompleted(null);
              setLabyrinthMode(false);
              setLabyrinthMoves(0);
            }}
          />
        ) : null}

        {showBadgeEarned ? (
          <BadgeEarnedPrompt
            pieceType={selectedPiece}
            totalStars={totalStars}
            onSubmitScore={() => {
              autoReset.clear();
              setShowBadgeEarned(false);
              void handleSubmitScore();
            }}
            onLater={handleBadgeEarnedDismiss}
          />
        ) : null}

        {resultOverlay ? (
          <ResultOverlay
            variant={resultOverlay.variant}
            pieceType={selectedPiece}
            itemLabel={selectedItem?.label}
            txHash={resultOverlay.txHash}
            celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
            errorMessage={resultOverlay.errorMessage}
            errorKind={resultOverlay.errorKind}
            totalStars={totalStars}
            onDismiss={() => setResultOverlay(null)}
            onRetry={resultOverlay.retryAction}
          />
        ) : null}

        {unlockedPiece && !resultOverlay && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim animate-in fade-in duration-250"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
              <CandyGlassShell
                title={tUnlock("title", { piece: tPiece(unlockedPiece) })}
                onClose={() => setUnlockedPiece(null)}
                closeLabel={tMission("closeLabel")}
                cta={
                  <Button
                    type="button"
                    variant="game-primary"
                    size="game"
                    autoFocus
                    onClick={() => {
                      setUnlockedPiece(null);
                      setSelectedPiece(unlockedPiece);
                      resetBoard();
                    }}
                    className="w-full"
                  >
                    {tUnlock("cta", { piece: tPiece(unlockedPiece) })}
                  </Button>
                }
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="pointer-events-none absolute h-36 w-36">
                      <LottieAnimation src="/animations/sparkle-burst.lottie" loop={false} className="h-full w-full" />
                    </div>
                    <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_75%)]" />
                    <picture className="relative z-10 h-20 w-20">
                      {THEME_CONFIG.hasOptimizedFormats && (
                        <>
                          <source srcSet={`${PIECE_IMAGES[unlockedPiece]}.avif`} type="image/avif" />
                          <source srcSet={`${PIECE_IMAGES[unlockedPiece]}.webp`} type="image/webp" />
                        </>
                      )}
                      <img src={`${PIECE_IMAGES[unlockedPiece]}.png`} alt={tPiece(unlockedPiece)} className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(120,65,5,0.35)]" />
                    </picture>
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: "rgba(110, 65, 15, 0.85)",
                      textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                    }}
                  >
                    {tTutorial(unlockedPiece)}
                  </p>
                </div>
              </CandyGlassShell>
            </div>
          </div>
        )}

        <div
          className={`fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.45)",
            color: "rgba(110, 65, 15, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 4px 14px rgba(120, 65, 5, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          {toast ?? displayedToast.current}
        </div>

        {/* Dock-driven in-place sheets. Mounted at the root so the
         *  PersistentDock can open them via `setActiveDockTab(...)`
         *  regardless of where the dock itself lives in the tree. */}
        <BadgeSheet
          open={badgeSheetOpen}
          onOpenChange={(v) => { if (!v && isClaimBusy) return; setBadgeSheetOpen(v); }}
          badgesClaimed={badgesClaimed}
          onClaim={(piece) => void handleClaimBadge(piece)}
          isClaimBusy={isClaimBusy}
          claimingPiece={claimingPiece}
          showNotification={canSendOnChain && !Boolean(hasClaimedBadge)}
          onNavigateToTrophies={() => setActiveDockTab("trophies")}
          showTrigger={false}
        />
        <ShopSheet
          open={storeOpen}
          onOpenChange={setStoreOpen}
          items={displayShopCatalog}
          onSelectItem={(itemId) => {
            setSelectedItemId(itemId);
            const item = shopCatalog.find((i) => i.itemId === itemId);
            if (item) setPaymentToken(selectPaymentToken(item.onChainPrice, itemId));
            setStoreOpen(false);
            setConfirmOpen(true);
          }}
          showTrigger={false}
        />
        <TrophiesSheet
          open={trophiesSheetOpen}
          onOpenChange={setTrophiesSheetOpen}
          showTrigger={false}
        />
        <LeaderboardSheet
          open={leaderboardOpen}
          onOpenChange={setLeaderboardOpen}
          showTrigger={false}
        />
      </main>
    </div>
  );
}
