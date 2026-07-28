"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { useWalletSignOut } from "@/lib/wallet/wallet-session";
import { useSeasonPassStatus } from "@/lib/season-pass/use-season-pass-status";

import { Board } from "@/components/board";
import { DiagonalRunBoard } from "@/components/exercises/diagonal-run-board";
import { KnightTourBoard } from "@/components/exercises/knight-tour-board";
import { TrainingContentGate } from "@/components/exercises/training-content-gate";
import { QueensBoard } from "@/components/exercises/queens-board";
import { SafePathBoard } from "@/components/exercises/safe-path-board";
import { PromotionRunBoard } from "@/components/exercises/promotion-run-board";
import { PromotionPicker } from "@/components/exercises/promotion-picker";
import { useCoachCredits } from "@/lib/coach/use-coach-credits";
import { ExerciseDrawer } from "@/components/exercises/exercise-drawer";
import { LeaderboardSheet } from "@/components/exercises/leaderboard-sheet";
import {
  MissionBriefing,
  shouldShowMissionBriefing,
} from "@/components/exercises/mission-briefing";
import { MissionPanelCandy } from "@/components/exercises/mission-panel-candy";
import { FailRescueModal } from "@/components/exercises/fail-rescue-modal";
import { useFailRescue } from "@/lib/exercises/use-fail-rescue";
import { bumpStreak, resetStreak, useStreak } from "@/lib/exercises/use-streak";
import { useWelcomePackClaim } from "@/lib/shop/use-welcome-pack-claim";
import { DailyTacticSlot } from "@/components/daily/daily-tactic-slot";
import { PeonesHintButton } from "@/components/peones/peones-hint-button";
import { PeonesBalanceChip } from "@/components/peones/peones-balance-chip";
// PeonesRetryButton intentionally NOT imported — Sprint 5 commit G
// unmounted the paid Retry chip pending differential-value
// calibration. The component + tests + spend endpoint support stay
// as dormant infrastructure (see Sprint 5 handoff §1).
import { canReachFrom, computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { useRetryGuard } from "@/lib/exercises/use-retry-guard";
import { ENABLE_EXERCISE_ROTATION } from "@/lib/exercises/rotation-flag";
import { MiniArenaBridgeSlot } from "@/components/mini-arena/mini-arena-bridge-slot";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { ASSET_THEME } from "@/lib/theme";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { pieceThemeSlot } from "@/lib/themes/piece-theme-assets";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { ContextualActionSlot } from "@/components/exercises/contextual-action-slot";
import {
  buildProgressByPiece,
  claimWelcomePackageGift,
  hasEarnedMilestone,
  shouldFireStarsConnectPrompt,
  shouldFireLocalSavedToast,
  shouldShowWPCtaInSlot,
  unlockWelcomePackageGift,
  withBestStars,
} from "@/components/exercises/exercises-save-flow-logic";
import { UnlockOverlay } from "@/components/progression/unlock-overlay";
import { useCelebrationQueue } from "@/lib/progression/use-celebration-queue";
import {
  isMilestoneSeedReady,
  useMilestoneSeeding,
} from "@/lib/progression/use-milestone-seeding";
import type { CelebrationStep } from "@/lib/progression/celebration-queue";
import { addNetStars, getDailyStars } from "@/lib/progression/stars";
import { WelcomePackageModal } from "@/components/welcome-package/welcome-package-modal";
import { useLiteWelcomeGiftClaim } from "@/lib/welcome-package/use-lite-welcome-gift-claim";
import { PersistentDock } from "@/components/exercises/persistent-dock";
import { TrophiesSheet } from "@/components/exercises/trophies-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import {
  readConsumedCount,
  readDisplayedShields,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import {
  dispatchShieldChange,
  subscribeToShieldChanges,
} from "@/lib/shop/shield-events";
import { readPieceStars } from "@/lib/game/exercise-progress";
import { hasSeededMilestones } from "@/lib/progression/seed-milestones";
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { useExerciseCatalog, useLabyrinthCatalog, useDiagonalRunCatalog, useKnightTourCatalog, useQueensCatalog, useSafePathCatalog, usePromotionRunCatalog } from "@/lib/content/catalog-context";
import { resolveSpecialTrainingLabels } from "@/lib/content/special-training-labels";
import { useRotationSteering } from "@/hooks/use-rotation-steering";
import { useSaveScoreState } from "@/hooks/use-save-score-state";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { useConnectPrompt } from "@/lib/connect-prompt/use-connect-prompt";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";
import { canSaveOnChain as deriveCanSaveOnChain } from "@/lib/exercises/save-proof-state";
import { setSaveOnChainPending } from "@/lib/ui/save-onchain-hint-store";
import { deriveTxToastState } from "@/lib/exercises/tx-toast-state";
import { useMiniPay } from "@/hooks/use-minipay";
import { useSplashLoader } from "@/hooks/use-splash-loader";
import { useAutoResetTimer } from "@/hooks/use-auto-reset-timer";
import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
  getShopAddress,
} from "@/lib/contracts/chains";
// SaveScore off-chain (Slice 5): the base save path no longer touches the
// Scoreboard contract. `getLevelId` stays (it maps piece -> level id used
// by the off-chain save + leaderboard); `scoreboardAbi` /
// `getScoreboardAddress` are gone from this surface. The on-chain helpers
// remain in @/lib/contracts/scoreboard for the future Leaderboard Proof lane.
import { getLevelId, scoreboardAbi } from "@/lib/contracts/scoreboard";
import { getScoreboardAddress } from "@/lib/contracts/chains";
import { shopAbi } from "@/lib/contracts/shop";
import { postScoreSave } from "@/lib/scores/save-client";
import { clearScoreSession } from "@/lib/scores/session-client";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import { deriveScoreSaveId } from "@/lib/scores/save-service";
import { emitScoreSaveTelemetry } from "@/lib/scores/save-telemetry";
import {
  FOUNDER_BADGE_CELO_ITEM_ID,
  FOUNDER_BADGE_ITEM_ID,
  PRO_ITEM_ID,
  SHOP_ITEMS,
  SHOP_TILE_ASSETS,
} from "@/lib/contracts/shop-catalog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { AccountSheet } from "@/components/account/account-sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { ProSheet } from "@/components/pro/pro-sheet";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { formatWalletShort } from "@/lib/wallet/format";
import { ACCEPTED_TOKENS, CELO_TOKEN, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { useOnChainWrite } from "@/lib/exercises/use-onchain-write";
import { useDoneHold } from "@/lib/exercises/use-done-hold";
import { applyScoreSaveSuccess } from "@/lib/exercises/apply-score-save-success";
import { applyBadgeClaimSuccess } from "@/lib/exercises/apply-badge-claim-success";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { getPositionLabel, getValidTargets } from "@/lib/game/board";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { BadgeEarnedPrompt, PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";
import { GetPeonesSheet } from "@/components/payments/get-peones-sheet";
import { LearnShopSheet } from "@/components/learn/learn-shop-sheet";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/telemetry";
import { classifyTxError, classifyTxErrorKind, isTransactionTimeout, isUserCancellation, type TxErrorKind } from "@/lib/errors";
import { getContextAction, getRewardActions } from "@/lib/game/context-action";
import {
  badgeRequiredCount,
  completedExerciseCount,
  isBadgeEarned,
  labyrinthStars,
} from "@/lib/game/exercises";
import { promotionRunStars } from "@/lib/game/promotion-run";
import { getMaxPossibleStars } from "@/lib/game/progress-adapter";
import { POINTS_PER_STAR } from "@/lib/game/score";
import {
  areAllLabyrinthsSolved,
  getLabyrinthBest,
  recordLabyrinthBest,
  recordTourBest,
} from "@/lib/game/labyrinth-progress";
import {
  buildTrainingPath,
  getLabyrinthForAutoAdvance,
  getNextChallenge,
  resolvePostLabContinue,
} from "@/lib/training/path";
import { attemptShieldSpendWithPeones } from "@/lib/peones/shield-spend-fallback";
import { ActionPin } from "@/components/redesign/action-pin";
import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { computeStars } from "@/lib/game/scoring";
import { hapticReject, hapticSuccess } from "@/lib/haptics";
import {
  registerDockSheetCloser,
  registerDockSheetOpener,
  setDockSheet,
} from "@/lib/ui/dock-sheet-store";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import {
  buildContentId,
  recordExtraConsumed,
  getDailySession,
  getUsedCount,
  isAtFreeLimit,
  isAtHardMax,
  isSessionOver,
  shouldFreezeScoring,
} from "@/lib/daily/session-quota";
import { isCompletedToday, todayUtc } from "@/lib/daily/progress";
import { useStreakNudge } from "@/lib/daily/use-streak-nudge";
import { StreakNudgeScreen } from "@/components/daily/streak-nudge-screen";
import { subscribeToDailySessionChanges } from "@/lib/daily/session-events";
import { DailyLimitBanner } from "@/components/daily/daily-limit-banner";
import {
  canMountTrainingContent,
  isContentAccessPending,
  readLastTrainingContentId,
  resolveContentAccess,
  resolveTrainingContentRequest,
  writeLastTrainingContentId,
  type ContentAccessState,
  type EffectiveTrainingPassSnapshot,
  type TrainingContentRequestSource,
} from "@/lib/training/content-access";
import { resolveCoverageStars } from "@/lib/training/content-stars";

// SHOP_ITEMS lives in lib/contracts/shop-catalog.ts so it's testable
// in isolation. The import is below with the other contract helpers.


/** How long the Safe Path attack beat gets before the failure modal covers the
 *  board (founder, 2026-07-16). The laser is a 460ms CSS animation
 *  (`.playhub-board-laser`); this leaves it room to land and register rather
 *  than flashing under a modal that was already opening. Keep it ABOVE that
 *  460ms — if the animation is ever retimed, retime this with it. */
const SAFE_PATH_ATTACK_BEAT_MS = 850;

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
const POINTS_PER_STAR_BIG = BigInt(POINTS_PER_STAR);

/**
 * Hold the `<TxProgressSteps current="done">` toast for this many ms after
 * `useWaitForTransactionReceipt` resolves with success. Aligned with the
 * motion scale: `--duration-ceremony = 500ms` × 3, so the celebratory
 * confirmation reads at the same cadence as other success affordances
 * (Victory NFT mint, badge claim, etc.).
 */
// SAVE_DONE_HOLD_MS moved to `lib/exercises/use-done-hold` with the timer it governs.
type CatalogItem = {
  itemId: bigint;
  /** Translator-resolved at memo time from SHOP_ITEM_COPY via the
   *  catalog entry's `copyKey`. Kept on the item so downstream
   *  consumers (ShopSheet, PurchaseConfirmSheet, success banners,
   *  telemetry logs) don't each need to thread the translator. */
  label: string;
  subtitle: string;
  /** Asset basename from SHOP_TILE_ASSETS (e.g. "/art/shop/coach-pack-20").
   *  PurchaseConfirmSheet renders the AVIF/WebP/PNG triplet from this
   *  base so the modal header carries the same per-SKU icon the
   *  shop tile already shows. */
  icon?: string;
  iconSlot?: ThemeAssetKey;
  configured: boolean;
  enabled: boolean;
  onChainPrice: bigint;
  /** Set on the Founder Badge entry by displayShopCatalog when the
   *  CELO route is available — drives the second "Buy with 1 CELO"
   *  button on the shop card. Always undefined on the underlying
   *  shopCatalog used for selection lookups. */
  celoSibling?: { itemId: bigint } | null;
};


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
  /** B2.3b: content slot discriminator. "daily" and "challenge" bypass
   *  the Lite daily quota banner. Absent/other values → gated in Lite mode. */
  slot?: string;
  /** Known Special Training id from `?content=`. The client gate still owns
   *  authorization because the effective pass is wallet-bound. */
  initialContentId?: string;
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
  slot,
  initialContentId,
}: ExercisesScreenProps = {}) {
  const isFreeSlot = slot === "daily" || slot === "challenge";
  const tShopItem = useTranslations("SHOP_ITEM_COPY");
  const tCapture = useTranslations("CAPTURE_COPY");
  const tLab = useTranslations("LABYRINTH_COPY");
  // Pivot Challenge copy (title + prompt), keyed by id for COPY only — mode is
  // still derived from the runtime catalog, never from the id (B4.2.1).
  const tRun = useTranslations("DIAGONAL_RUN_COPY");
  const tTour = useTranslations("KNIGHT_TOUR_COPY");
  const tQueens = useTranslations("QUEENS_COPY");
  const tSafePath = useTranslations("SAFE_PATH_COPY");
  const tPromotionRun = useTranslations("PROMOTION_RUN_COPY");
  const tPath = useTranslations("TRAINING_PATH_COPY");
  const tMission = useTranslations("MISSION_BRIEFING_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const tSplash = useTranslations("SPLASH_COPY");
  const tTutorial = useTranslations("TUTORIAL_COPY");
  const tUnlock = useTranslations("UNLOCK_COPY");
  const tDrawer = useTranslations("EXERCISE_DRAWER_COPY");
  const tStatus = useTranslations("GLOBAL_STATUS_BAR_COPY");
  const tHud = useTranslations("HUD_COPY");
  const tFooter = useTranslations("FOOTER_CTA_COPY");
  const tResult = useTranslations("RESULT_OVERLAY_COPY");
  const router = useRouter();
  const { address, isConnected, status: accountStatus } = useAccount();
  // Slice 0.1: the off-chain save is authored by a write SESSION bought with
  // one EIP-191 signature. Works on MiniPay injected and Privy embedded alike
  // — see lib/scores/session-authorization.
  const { signMessageAsync } = useSignMessage();

  // Drop the cached write session whenever the identity behind it changes.
  // The cache is keyed by (wallet, surface) so a stale token could never be
  // USED for the wrong wallet; this is about not keeping a live bearer
  // credential in memory after the player disconnects or switches accounts.
  useEffect(() => {
    return () => clearScoreSession();
  }, [address]);
  const trainingPassStatus = useSeasonPassStatus(address);
  const trainingPass: EffectiveTrainingPassSnapshot = useMemo(
    () => ({
      // Full/internal keeps its historical catalog access. LEARN consumes the
      // effective wallet entitlement; PLAY never mounts this surface.
      active: CHESSCITO_LITE_MODE ? trainingPassStatus.active : true,
      source: trainingPassStatus.source,
      loading: CHESSCITO_LITE_MODE
        ? trainingPassStatus.loading ||
          accountStatus === "connecting" ||
          accountStatus === "reconnecting"
        : false,
    }),
    [
      accountStatus,
      trainingPassStatus.active,
      trainingPassStatus.source,
      trainingPassStatus.loading,
    ],
  );
  const trainingPassRef = useRef(trainingPass);
  trainingPassRef.current = trainingPass;
  const starsConnectPrompt = useConnectPrompt("stars");
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { connectWallet } = useConnectWallet();
  // Branch-aware: wagmi disconnect on the injected tree, Privy `logout()` on
  // the web tree. Ending only the wagmi connection would leave a Privy session
  // (and its `.chesscito.com` cookie) alive — see `lib/wallet/wallet-session`.
  const signOut = useWalletSignOut();
  const { switchChain } = useSwitchChain();
  const { isMiniPay } = useMiniPay();
  // `isPending` is no longer read: `useOnChainWrite` owns the busy state for
  // both writes, and it stays busy through confirmation, not just signing.
  const { writeContractAsync: writeScoreAsync } = useWriteContract();
  const { writeContractAsync: writeBadgeAsync } = useWriteContract();
  const { writeContractAsync: writeShopAsync, isPending: isShopWriting } = useWriteContract();
  const [selectedPiece, setSelectedPiece] = useState<PieceKey>(initialPiece);
  // Lets the Special Training celebration open the bridge sheet directly. The
  // pedestal still manages itself on a normal tap; this only adds an outside
  // opener. See `handleMilestoneNavigate`.
  const [miniArenaOpen, setMiniArenaOpen] = useState(false);
  const [phase, setPhase] = useState<"ready" | "success" | "failure">("ready");
  const [boardKey, setBoardKey] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  // One exclusive dock tab at a time. Persistent-dock game UX: tapping
  // a different tab auto-closes the current one rather than stacking.
  // Per-sheet `open` + `onOpenChange` are derived below so the sheet
  // components don't need to know about this refactor.
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0);
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
  // claimTxHash / submitTxHash removed: `useOnChainWrite` owns each write's hash
  // and settles it against a verified receipt.
  const [lastError, setLastError] = useState<string | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<"idle" | "approving" | "buying">("idle");
  // PRO sheet orchestration — owns its own status fetch internally so this
  // surface doesn't double-fetch /api/pro/status (same pattern as
  // HubScaffoldClient). Was a local, duplicated approve+buyItem flow;
  // unified onto the shared hook (rail-backed) 2026-07-01.
  const proSheet = useProSheetState();
  const proStatus = proSheet.proStatus;
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const { credits: coachCredits } = useCoachCredits();

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
            : // `initialAction === "pro"` always ends up opening the sheet (see
              // the effect below) — checked as a synchronous fact rather than
              // reading back `proSheet.open`, which only updates a render later.
              initialAction === "pro";
    if (!deepLinkSheetOpen) {
      deepLinkBounceConsumed.current = true;
      router.push("/");
    }
  }, [initialAction, activeDockTab, router]);

  // Opens the PRO sheet for the `?legacy=1&action=pro` deep link. Was a
  // synchronous `useState(initialAction === "pro")` seed before the
  // unification onto `useProSheetState` (which always starts closed) —
  // moved to a one-shot effect, same pattern as HubScaffoldClient's
  // `initialSheet` handling.
  const proDeepLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (proDeepLinkOpenedRef.current) return;
    proDeepLinkOpenedRef.current = true;
    if (initialAction === "pro") proSheet.openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

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
    else if (slug === "account") setAccountSheetOpen(true);
    else if (slug === "pro" && !CHESSCITO_LITE_MODE) proSheet.openSheet();
    if (slug) {
      sp.delete("sheet");
      const qs = sp.toString();
      const path = window.location.pathname;
      window.history.replaceState(window.history.state, "", qs ? `${path}?${qs}` : path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [resultOverlay, setResultOverlay] = useState<{
    variant: "badge" | "score" | "shop" | "error";
    txHash?: string;
    errorMessage?: string;
    /** When variant === "error" and errorKind is set, the overlay reads
     *  per-kind copy (cancelled / timeout / error) from
     *  RESULT_OVERLAY_COPY.error.purchaseKindCopy. Used by the shop /
     *  coach buy flows to mirror the F1 mint pattern. */
    errorKind?: "error" | "cancelled" | "timeout";
    /** Locale-agnostic tx classification, threaded through to
     *  ResultOverlay so the shop-buy path can surface AddCashCta on
     *  insufficient-funds errors. Only the shop-buy caller sets this. */
    txErrorKind?: TxErrorKind | null;
    retryAction?: () => void;
    /** Recovery CTA (insufficient Peones → Get Peones). */
    recoveryCta?: { label: string; onPress: () => void };
  } | null>(null);

  // SaveScore off-chain (Slice 5): in-flight flag for the /api/scores/save
  // request. Replaces the wagmi `isScoreWriting`/`isSubmitConfirming` busy
  // signal for the base save path (now off-chain, no tx to confirm).
  const [isSavingScore, setIsSavingScore] = useState(false);
  // MiniPay Lote 2 (B2): the off-chain save auto-runs on completion and is
  // silent (no celebration overlay). If that auto-save fails, this flips true
  // so the mission sheet surfaces a free manual "Retry save" fallback instead
  // of leaving the player stuck. Reset when a fresh pending score appears.
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  // Get Peones recovery sheet — opened from the insufficient-save overlay.
  const [getPeonesOpen, setGetPeonesOpen] = useState(false);

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
  const hasNonDockOverlay = proSheet.open || accountSheetOpen;
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
      if (proSheet.open) proSheet.closeSheet();
      if (accountSheetOpen) setAccountSheetOpen(false);
    });
    return () => {
      unregisterOpener();
      unregisterCloser();
    };
  }, [proSheet, accountSheetOpen]);
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
  const [wpMounted, setWpMounted] = useState(false);

  /** L2 layer state. When true, the board renders the SELECTED
   *  labyrinth instead of the L1 exercise. Entry happens via training
   *  path node taps (Slice 3C); resets on piece switch — labyrinth
   *  state does not survive across pieces. */
  const [labyrinthMode, setLabyrinthMode] = useState(false);
  const [selectedLabyrinthId, setSelectedLabyrinthId] = useState<string | null>(null);
  const [trainingAttemptGrantId, setTrainingAttemptGrantId] = useState<string | null>(null);

  // SSR hydration guard for WP CTA (spec P0-4)
  useEffect(() => { setWpMounted(true); }, []);

  type QuotaDisplayState = {
    isAtLimit: boolean;
    isHardMax: boolean;
    consumedContentIds: string[];
  } | null;
  const [quotaDisplayState, setQuotaDisplayState] = useState<QuotaDisplayState>(null);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE || isFreeSlot) return;
    function read() {
      const s = getDailySession();
      const atFreeLimit = isAtFreeLimit(s);
      const atHardMax = isAtHardMax(s);
      setQuotaDisplayState(
        atFreeLimit || atHardMax
          ? { isAtLimit: true, isHardMax: atHardMax, consumedContentIds: s.consumedContentIds }
          : null,
      );
    }
    read();
    return subscribeToDailySessionChanges(read);
  }, [isFreeSlot]);

  /** Modal trap fix: when the global ResultOverlay opens (success OR
   *  error) while a Radix dock sheet is still mounted, Radix's modal
   *  mode sets pointer-events: none on its siblings, blocking every
   *  click on the result overlay's scrim, X, and CTAs. We close the
   *  active dock tab whenever a result overlay appears so the result
   *  modal becomes the sole foreground and stays dismissable. */
  useEffect(() => {
    setLabyrinthMode(false);
    setSelectedLabyrinthId(null);
    setTrainingAttemptGrantId(null);
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
    awardsStars: boolean;
  } | null>(null);
  /** Bumps the labyrinth board key on retry so internal Board state
   *  (piece position, selection, internal move counter) resets. */
  const [labyrinthKey, setLabyrinthKey] = useState(0);
  /** Live move counter mirrored from the Board's onMove callback.
   *  Drives the labyrinth HUD chip ("X / Y moves") so the player
   *  can pace themselves against the optimal target in real time. */
  const [labyrinthMoves, setLabyrinthMoves] = useState(0);

  // Rotation Engine (slice E) — flag-gated. UTC date is memoized once per
  // mount so the daily seed is stable for the session (rolls over on
  // reload after the UTC day changes). Caller-provided so the hook stays
  // clock-free + testable.
  const rotationDateUtc = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const rotationOptions = useMemo(
    () => ({ enabled: ENABLE_EXERCISE_ROTATION, dateUtc: rotationDateUtc }),
    [rotationDateUtc],
  );
  const {
    progress,
    currentExercise,
    isLastExercise,
    totalStars,
    badgeEarned,
    isReplay,
    visibleExerciseIds,
    completeExercise,
    advanceExercise,
    goToExercise,
    attemptSeq,
    incrementAttemptSeq,
  } = useExerciseProgress(selectedPiece, rotationOptions);

  /** The progression milestone machine. Drained BEFORE the daily-limit guard
   *  is ever consulted: the player who burns the quota while struggling gets
   *  the celebration, not the paywall. */
  const celebration = useCelebrationQueue();

  /** The Welcome Package GIFT — the thing `first-reward` actually unlocks.
   *  NOT `useWelcomePackClaim` (the server shield Welcome Pack): a different
   *  product, a different endpoint. The gift is claimed exactly the way
   *  `<DailyTacticSlot>` claims it: `<WelcomePackageModal>` driven by
   *  `useLiteWelcomeGiftClaim`, writing `claimed` on success. */
  const [welcomeGiftOpen, setWelcomeGiftOpen] = useState(false);
  const welcomeGiftClaim = useLiteWelcomeGiftClaim();

  // Phase 2b-2: read the active pools from the catalog context (baseline
  // EXERCISES when no provider is mounted → byte-identical flag-off), so
  // this screen's pool reads agree with the hook's. Phase 2c mounts the
  // provider with merged pools at the /exercises server boundary.
  const catalog = useExerciseCatalog();
  // Labyrinth pools from the same provider, so the screen's labyrinth reads
  // (list, king-gate, training path) agree with the merged catalog under the
  // flag — and stay baseline (byte-identical) when no provider is mounted.
  const labyrinthCatalog = useLabyrinthCatalog();
  const diagonalRunCatalog = useDiagonalRunCatalog();
  const knightTourCatalog = useKnightTourCatalog();
  const queensCatalog = useQueensCatalog();
  const safePathCatalog = useSafePathCatalog();
  const promotionRunCatalog = usePromotionRunCatalog();
  // Special Training navigation pool. A piece that has Pivot Challenges surfaces
  // THOSE (projected as labyrinth-kind nodes downstream) and hides its raw
  // labyrinths this phase — bishop-lab-3/-4 stay in content, just unselected.
  // Pieces without pivots keep their labyrinths byte-identically. This is the
  // adapter that lets the whole labyrinth nav/unlock/completion machinery serve
  // pivots without adding a TrainingNodeKind (design: docs/audits/…-b4_1-*).
  // ⚠️ A signature game REPLACES the piece's raw labyrinths here (that is what
  // the bishop's pivots did to bishop-lab-3/-4: still in content, unselected).
  // So the knight's five labyrinths give way to its three tours. Same rule, one
  // more piece — but it is a product call, not a mechanical one: flip the branch
  // to a concat if both lanes should ship.
  const specialTrainingCatalog: typeof labyrinthCatalog = useMemo(() => {
    const out = { ...labyrinthCatalog };
    for (const piece of Object.keys(out) as (keyof typeof out)[]) {
      if (diagonalRunCatalog[piece]?.length) out[piece] = diagonalRunCatalog[piece];
      else if (knightTourCatalog[piece]?.length) out[piece] = knightTourCatalog[piece];
      else if (queensCatalog[piece]?.length) out[piece] = queensCatalog[piece];
      else if (safePathCatalog[piece]?.length) out[piece] = safePathCatalog[piece];
      // The last piece to get one. This retires the pawn's four untitled filler
      // labyrinths — the lane is 6/6 signature games now.
      else if (promotionRunCatalog[piece]?.length) out[piece] = promotionRunCatalog[piece];
    }
    return out;
  }, [labyrinthCatalog, diagonalRunCatalog, knightTourCatalog, queensCatalog, safePathCatalog, promotionRunCatalog]);

  /** The ids in the Special Training lane that grade by COVERAGE, not by moves.
   *  Passed to buildTrainingPath so the drawer picks tourStars. Both signature
   *  games that score this way live here — the tour and queens. */
  const coverageIds = useMemo(
    () =>
      new Set([
        ...(knightTourCatalog[selectedPiece] ?? []).map((t) => t.id),
        ...(queensCatalog[selectedPiece] ?? []).map((q) => q.id),
      ]),
    [knightTourCatalog, queensCatalog, selectedPiece],
  );
  const starlessIds = useMemo(
    () => new Set((knightTourCatalog[selectedPiece] ?? []).map((tour) => tour.id)),
    [knightTourCatalog, selectedPiece],
  );

  // Progress is keyed by exerciseId (currentId). Derive the pool index for
  // the index-based affordances (drawer activeIndex, tutorial-hint gate,
  // badge-on-last-exercise math). A null/stale id falls back to the first
  // pool exercise (index 0), mirroring the hook's own derivation.
  const currentExerciseIndex = Math.max(
    0,
    catalog[selectedPiece].findIndex((ex) => ex.id === currentExercise.id),
  );

  // Rotation steering, extracted to a unit-tested hook in Slice 3B.
  // Suspended while the labyrinth layer is on (spec B8 / red-team
  // P0-2): steering must never yank the player back to an exercise
  // mid-labyrinth. `labyrinthMode` (raw state, not the derived
  // effectiveLabyrinthMode) is deliberate — it is a superset, so
  // suspension can only be MORE conservative, and it is in scope
  // before the labyrinth list derivations below.
  useRotationSteering({
    enabled: ENABLE_EXERCISE_ROTATION,
    visibleExerciseIds,
    currentExerciseId: currentExercise.id,
    piece: selectedPiece,
    stars: progress.stars,
    goToExercise,
    suspended: labyrinthMode,
  });

  /** Sprint 5 commits D / F — Retry guard. Owns the dedup + reset +
   *  attemptSeq-advance chain so duplicate retry triggers (double-
   *  taps, repeated callbacks) collapse to a single deterministic
   *  transition. Emits `training_retry_completed` INSIDE the gate so
   *  the event count matches real attempt resets.
   *
   *  Sprint 5 commit G (2026-06-08) — repurposed from the paid
   *  Peones-retry surface (which is now unmounted, see below) to the
   *  LEGACY free Retry triggered via ContextualActionSlot. Cost: 0.
   *  The component, telemetry shape, and guard contract stay
   *  identical; only the trigger source changed. The PeonesRetry
   *  surface is dormant infrastructure for a future calibration
   *  where it adds differential value (Streak Shield, Deep Hint
   *  tier, etc.). */
  const handleRetryApplied = useRetryGuard({
    attemptSeq,
    resetBoard: () => resetBoard(),
    incrementAttemptSeq,
    onApplied: (closedAttemptSeq, source) => {
      // Sprint 6 commit C (2026-06-08) — `source` arrives from the
      // trigger callsite so dashboards can distinguish the legacy
      // RETRY tap ("contextual_action_slot") from the failure-phase
      // auto-reset firing on its own ("auto_reset"). The dedup ref
      // inside the guard is SHARED across both paths, so if both
      // happen for the same attemptSeq (race or rapid tap before
      // the 1.5s auto-reset fires) only ONE training_retry_completed
      // event lands — whichever trigger crossed the gate first wins.
      track("training_retry_completed", {
        piece: selectedPiece,
        exerciseId: currentExercise.id,
        attemptSeq: closedAttemptSeq,
        source,
      });
    },
  });

  /** Sprint 4 commit I — Peones Hint visual reveal. Parent owns the
   *  highlighted square so the Board can render the glow without the
   *  button needing to know about the board's geometry. Cleared by
   *  the button after a ~4s TTL or by switching exercise. */
  const [peonesHintSquare, setPeonesHintSquare] = useState<BoardPosition | null>(null);
  /** First step of the optimal path for the current exercise. Computed
   *  once per exercise via the same BFS protocol used by the verifier
   *  test (`computeExerciseBfs`). */
  const peonesHintFirstStep = useMemo(() => {
    const result = computeExerciseBfs(selectedPiece, currentExercise);
    return result?.firstStep ?? null;
  }, [selectedPiece, currentExercise]);
  /** Clear any stale glow when the user navigates to a new exercise,
   *  changes piece, or enters labyrinth mode. */
  useEffect(() => {
    setPeonesHintSquare(null);
  }, [selectedPiece, currentExercise.id]);

  const timerStart = useRef<number>(0);
  /** Synchronous concurrency guard for handleSubmitScore. The async
   *  signature fetch opens a window where wagmi's isPending is still
   *  false; without this ref a rapid double-tap would fire two
   *  parallel sign requests and two writeContractAsync calls before
   *  React could flip the disabled state. Cleared in the finally
   *  branch so retries after failure/timeout still work. */
  const submittingScoreRef = useRef(false);
  /** MiniPay Lote 2 (B2): the local score the silent auto-save has already
   *  attempted, so the auto-save effect fires exactly once per distinct score
   *  (no loop on failure — the manual fallback handles retry). */
  const autoSavedScoreRef = useRef<number | null>(null);
  /** Same concurrency guard as `submittingScoreRef`, for
   *  `handleUseShield`'s async server call — prevents a rapid
   *  double-tap on the ContextualActionSlot shield action from firing
   *  two parallel /api/shields/spend requests. */
  const shieldSpendingRef = useRef(false);
  /** Monotonic, per-session counter dedicated to Shield-rescue Peones
   *  idempotency. Deliberately separate from useExerciseProgress's
   *  attemptSeq (which resets to 1 on every exercise change and is
   *  shared with other systems like PeonesHintButton) — a fresh
   *  failure on ANY exercise must get a fresh idempotency identity,
   *  never colliding with a key already consumed on a prior exercise.
   *  Started at Date.now() for cross-session entropy (a page reload
   *  starting back at 1 would otherwise reintroduce the exact
   *  collision this counter exists to prevent). Advances once per
   *  NEW failure occurrence (see the setPhase("failure") call site),
   *  not per render and not per retry-of-the-same-failure — a
   *  double-tap on the SAME failure's rescue button must still
   *  collapse onto the same key. */
  const shieldRescueAttemptIdRef = useRef(Date.now());
  // Single source of truth for the board's auto-reset timer. The hook
  // handles the pending-timer-replacement, generation-based stale
  // callback protection, and unmount cleanup that used to be spread
  // across ~8 sites with autoResetTimer.current + boardGeneration.
  const autoReset = useAutoResetTimer();

  // Tap-to-continue (founder 2026-07-17): the WELL DONE / TRY AGAIN flash no
  // longer auto-advances on a 1.5s timer. Instead the continuation (advance to
  // the next exercise, or restart the failed one) is HELD here until the player
  // taps the overlay — so the celebration and its lesson are never missed.
  // `resetBoard`/navigation clears it, mirroring the generation guard that
  // protected the old timer.
  const flashContinueRef = useRef<(() => void) | null>(null);
  const [awaitFlashTap, setAwaitFlashTap] = useState(false);
  function holdForTap(continuation: () => void) {
    flashContinueRef.current = continuation;
    setAwaitFlashTap(true);
  }
  function handleFlashContinue() {
    if (!flashContinueRef.current) return;
    const run = flashContinueRef.current;
    flashContinueRef.current = null;
    setAwaitFlashTap(false);
    run();
  }

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
  const shopAddress = useMemo(() => getShopAddress(chainId), [chainId]);
  type PaymentToken = (typeof ACCEPTED_TOKENS)[number] | typeof CELO_TOKEN;
  const [paymentToken, setPaymentToken] = useState<PaymentToken | null>(null);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);
  const levelId = useMemo(() => getLevelId(selectedPiece), [selectedPiece]);
  const score = useMemo(() => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR_BIG, [totalStars]);
  // Must read the SAME catalog `totalStars` is normalized against (the merged
  // one), or an overlay-added exercise shows the player "33/30".
  const maxPossibleStars = useMemo(
    () => getMaxPossibleStars(selectedPiece, catalog),
    [selectedPiece, catalog],
  );

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
        const { iconSlot } = SHOP_TILE_ASSETS[item.copyKey];
        const onChain = onChainItems?.[index];
        if (onChain?.status === "success" && Array.isArray(onChain.result)) {
          const price = onChain.result[0] as bigint;
          const enabled = onChain.result[1] as boolean;
          return {
            itemId: item.itemId,
            label,
            subtitle,
            iconSlot,
            configured: price > 0n,
            enabled: price > 0n && enabled,
            onChainPrice: price,
          };
        }

        return {
          itemId: item.itemId,
          label,
          subtitle,
          iconSlot,
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
  const {
    data: allBadgesData,
    refetch: refetchAllBadges,
  } = useReadContracts({
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

  /**
   * The one-time milestone migration (Task 15). THIS is the load-bearing mount:
   * `resolve()` lives on this screen, and a player can deep-link straight to
   * `/exercises` without ever passing through the hub — so seeding on the hub
   * alone would hand that player a parade of retroactive overlays on their very
   * first solve. It runs in a mount effect, which React flushes long before any
   * click can reach `resolveMilestones`, so the seed is COMMITTED TO DISK
   * before the queue is ever built. `seedMilestonesOnce` is guarded by a
   * persistent marker, so the hub's mount and this one are the same no-op after
   * the first — neither is the single writer of anything.
   *
   * Gated on the badge read: seeding a half-known profile would mark it
   * migrated with `piece-badge-claimed` / `mastery` unseeded, and a badge minted
   * months ago would still pop an overlay. A disconnected wallet is ready —
   * `resolve()` would read the same `badgeClaimed: false`.
   */
  const labyrinthIdsByPiece = useMemo(() => {
    const out: Partial<Record<PieceKey, string[]>> = {};
    for (const [piece, labs] of Object.entries(specialTrainingCatalog)) {
      out[piece as PieceKey] = labs.map((lab) => lab.id);
    }
    return out;
  }, [specialTrainingCatalog]);

  useMilestoneSeeding({
    // ONE gate, shared with the hub (`learn-hub-client.tsx`) — see
    // `isMilestoneSeedReady` for why a disabled read is not "no badges" and
    // why an unsupported chain never becomes ready. `resolveMilestones`
    // carries the other half of that contract: it refuses to run while the
    // profile is unseeded.
    ready: isMilestoneSeedReady({
      accountStatus,
      badgeStateKnown: allBadgesData !== undefined,
    }),
    badgeClaimedByPiece: badgesClaimed,
    labyrinthIdsByPiece,
    giftAvailable: CHESSCITO_LITE_MODE,
  });

  const { isLoading: isShopConfirming } = useWaitForTransactionReceipt({
    chainId,
    hash: shopTxHash as `0x${string}` | undefined,
    query: {
      enabled: Boolean(shopTxHash),
    },
  });
  // Badge claim and score save no longer watch the receipt through wagmi:
  // `useWaitForTransactionReceipt().isSuccess` means "the query resolved", and
  // viem resolves it for reverted transactions too. Both writes now settle on a
  // verified receipt via `useOnChainWrite`. The shop watcher above is untouched.
  const claimWrite = useOnChainWrite();
  const saveWrite = useOnChainWrite();
  const doneHold = useDoneHold();

  /** Fails closed: an unverifiable success is not a success. */
  const confirmReceipt = useCallback(
    async (hash: `0x${string}`) => {
      if (!publicClient) {
        throw new Error("No client available to verify this transaction.");
      }
      return waitForReceiptWithTimeout(publicClient, hash);
    },
    [publicClient],
  );

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
  // QA round 2 (2026-06-11): the on-chain SAVE is back (gas-only
  // submitScoreSigned). Address resolution is chain-specific; null →
  // the surface never renders the button (fail-closed, no dead CTA).
  const scoreboardAddress = useMemo(
    () => getScoreboardAddress(chainId),
    [chainId],
  );
  const isClaimBusy = claimWrite.isBusy;
  const isSubmitBusy = saveWrite.isBusy || isSavingScore;
  const isShopBusy = isShopWriting || isShopConfirming;

  // Cluster C — local-first save state. `lastSavedScore` is the last
  // score this device has confirmed on chain (read from localStorage).
  // The score-pending gate is now `localScore > lastSavedScore` instead
  // of the old `allExercisesAttempted` heuristic.
  const { lastSavedScore, lastSavedTxHash, recordSaveFor } =
    useSaveScoreState(selectedPiece);
  // savedReceiptUrl removed with the retired SavedChip (Sally pass
  // 2026-06-11); legacy on-chain receipts remain reachable from the
  // leaderboard surfaces.
  const localScoreNum = Number(score);
  const scorePendingNew =
    canSaveScore && totalStars >= 1 && localScoreNum > lastSavedScore;
  const isSavedAtParity =
    lastSavedScore > 0 && localScoreNum === lastSavedScore;
  // The on-chain proof CTA must NOT share `scorePendingNew` with the B2
  // auto-save, which closes that gate the moment its POST resolves. It is
  // gated on the absence of a real receipt instead — see
  // `lib/exercises/save-proof-state`.
  const canSaveOnChain = deriveCanSaveOnChain({
    canSaveScore,
    hasScoreboard: scoreboardAddress != null,
    totalStars,
    localScore: localScoreNum,
    lastSavedScore,
    lastSavedTxHash,
  });

  // Publish the "score worth saving on-chain" hint so the PersistentDock
  // (a sibling with no access to this state) can light the LEADERS dot.
  // Cleared on unmount so a stale dot never survives leaving the screen.
  useEffect(() => {
    setSaveOnChainPending(canSaveOnChain);
    return () => setSaveOnChainPending(false);
  }, [canSaveOnChain]);

  // The done-hold keeps the TxProgressSteps toast mounted for a beat after a
  // save lands. It used to share an effect with `recordSaveFor` and a latch ref,
  // keyed on `useWaitForTransactionReceipt().isSuccess` — which also fired for
  // reverted transactions, persisting scores that never landed. The timer, the
  // latch, and its unmount cleanup now live in `useDoneHold`; the persistence
  // moved behind a verified receipt in `handleSaveScoreOnChain`.

  // 4-phase precedence (failed > done > wait > sign) extracted to
  // `lib/exercises/tx-toast-state` for unit-test coverage. The `failed`
  // branch closes Cluster C SAVE residue defer #1 — chain revert now
  // surfaces as a sticky failed toast instead of stranding the user on
  // a stale "Waiting…" state until the next submit clears it.
  const txToast = deriveTxToastState({
    isWriting: saveWrite.phase === "signing",
    isConfirming: saveWrite.phase === "confirming",
    hasFailed: saveWrite.outcome?.status === "failed",
    txHash: saveWrite.txHash,
    doneAt: doneHold.doneAt,
  });
  // Suppress the floating tx-progress toast while the ResultOverlay is
  // mounted. The popup owns the success/failure surface (incl. the
  // CeloScan receipt chip), so the parallel "Step 2 of 2 — Confirming
  // on-chain…" toast outside the dialog reads as "half attached, half
  // floating" (2026-06-04 audit IMG_3145). One popup = one status owner.
  const showTxToast = txToast.show && resultOverlay === null;
  const txCurrent = txToast.show ? txToast.current : "sign";

  const allExercisesAttempted = catalog[selectedPiece].every(
    (ex) => (progress.stars[ex.id] ?? 0) > 0,
  );

  const contextActionState = {
    phase,
    shieldsAvailable: shieldCount,
    scorePending: scorePendingNew,
    badgeClaimable: badgeEarned && !hasClaimedBadge && !justClaimed[selectedPiece],
    isConnected,
    isCorrectChain,
  };
  const contextAction = getContextAction(contextActionState, { liteMode: CHESSCITO_LITE_MODE });
  // SAVE and CLAIM are independent reward actions — they must not fight for
  // one slot (hiding the SaveScore Peones sink behind the badge claim lost a
  // monetization touchpoint). When both apply, render both side by side.
  // In Lite, submitScore is suppressed via liteMode flag.
  const rewardActions = getRewardActions(contextActionState, { liteMode: CHESSCITO_LITE_MODE });

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

  // Live streak counter — feeds the WELL DONE flash + the new
  // Star+Shield combined HUD pill. Reads localStorage on mount +
  // re-renders on chesscito:streak-changed events fired by
  // bumpStreak/resetStreak in the success / skip paths.
  const streakCount = useStreak();

  // The daily-streak nudge. It arms on a solve and pays on the way OUT, so
  // nothing it does competes with the celebration chain. `isOverlayOpen` is
  // belt and braces: by the time an exit is possible the queue has drained.
  const streakNudge = useStreakNudge({
    getToday: () => todayUtc(),
    isDailySolvedToday: () => isCompletedToday(),
    isOverlayOpen: celebration.current !== null || labyrinthCompleted !== null,
    onOpenDaily: () => router.push("/exercises?slot=daily"),
  });

  // Welcome Pack hook — wired so the ShopSheet on this route can
  // render the pinned tile. exercises-screen mounts <ShopSheet>
  // directly (NOT via useShopSheetState), so we duplicate the
  // wiring here. onClaimedFresh auto-closes the sheet after a 600ms
  // celebration window so the player returns to the rescue board.
  const welcomePack = useWelcomePackClaim({
    onClaimedFresh: () => {
      window.setTimeout(() => setStoreOpen(false), 600);
    },
  });

  // Stars earned on the just-completed exercise (0-3). Set
  // synchronously in the success path so the WELL DONE PhaseFlash
  // can render "+N STAR" on its very first frame. Reset to 0
  // implicitly when the next failure / next-success replaces the
  // value (no manual reset needed — pill only shows in success
  // phase).
  const [lastEarnedStars, setLastEarnedStars] = useState(0);

  // Fail-rescue host. The hook owns the modal state machine
  // (variant A/B/C/D + shield-spend + ignore counters). Handlers
  // re-use this scope's resetBoard + setStoreOpen via the lambdas
  // below — resetBoard is defined below this block so we reference
  // it via the function declaration's hoisted binding.
  const failRescue = useFailRescue({
    attemptSeq: shieldRescueAttemptIdRef.current,
    // Same welcomePack instance the Shop's claim tile uses (declared
    // above) — passing its live state in fixes a desync where a claim
    // made through the Shop never reached a second, independent
    // useWelcomePackClaim() instance previously created inside
    // useFailRescue itself (fixed 2026-07-02).
    welcomePackClaimed: welcomePack.state === "claimed",
    onRescued: () => {
      // Shield used — streak preserved (do NOT call resetStreak).
      // Post-hoc fix (final whole-branch review, C1): a successful
      // rescue is functionally a new attempt, same as a manual
      // Retry — advance attemptSeq so the NEXT Peones-fallback
      // idempotency key (spend:shield:{wallet}:{attemptSeq}) can't
      // collide with this one. Order mirrors useRetryGuard: reset
      // first, then increment, so any consumer reading the new
      // attemptSeq sees a board that's already fresh.
      autoReset.clear();
      resetBoard();
      incrementAttemptSeq();
    },
    onSkipped: () => {
      // Retry without shield (or close) — racha rota. This is the
      // moment the shield mechanic becomes psychologically real:
      // user JUST saw "STREAK ×N" on the prior success, now they
      // pay for skipping.
      autoReset.clear();
      resetStreak();
      resetBoard();
    },
    onServerError: () => {
      // Player tried to use a shield but the server failed. They
      // INTENDED to rescue — don't penalize the streak for our
      // infra glitch (red-team E11). Just reset the board so the
      // player can replay; HUD chip will re-sync on next mount.
      autoReset.clear();
      resetBoard();
    },
    // The Welcome Pack is FREE, so the rescue no longer leaves for the Shop to
    // collect it — it claims in place and the modal re-renders with the three
    // shields already in hand (useShieldsCount picks up the credit the claim
    // dispatches). `welcomePack` below is the SAME instance the ShopSheet uses,
    // which is what keeps `welcomePackClaimed` honest.
    //
    // A player with no wallet CAN reach variant C. Claiming needs a signature,
    // so onClaim() would return early and the button would do nothing at all.
    // Route them to connect instead — a dead primary CTA in a modal whose only
    // other exit forfeits the streak is a trap.
    onClaimWelcomePack: () => {
      autoReset.clear();
      if (welcomePack.state === "connect") {
        welcomePack.onConnect();
        return;
      }
      welcomePack.onClaim();
    },
  });

  function resetBoard() {
    autoReset.clear();
    // Any pending tap-to-continue is void once the board resets — navigation or
    // the continuation itself lands here, so a stale tap can never re-fire.
    flashContinueRef.current = null;
    setAwaitFlashTap(false);
    setBoardKey((previous) => previous + 1);
    setPhase("ready");
    setMoves(0);
    setElapsedMs(0);
    timerStart.current = 0;
    // Safe Path keys off its own id, not boardKey, so the bump above never
    // reaches it. Every rescue path lands here — shield, skip, server error —
    // and all three mean the same thing for the king: walk back to the start
    // (D5). Losing on step 9 of 10 costs the whole run.
    setSafePathResetKey((previous) => previous + 1);
    /* Promotion Run, same story, same reason — and the SAME meaning for both of
       its two failures (caught, and crowning the wrong piece): back to the
       start of the run.

       The founder's first instinct was for a shield to buy a re-PICK on a wrong
       crown — resume on the last rank rather than replay six moves — and then
       ruled that keeping the existing behaviour was fine if it cost much
       (2026-07-17). It does not just cost less; it is also the safer machine:
       a shield that means "back to the start" here and "just re-choose" there
       is ONE token with two meanings, and that drifts. One shield, one promise.
       The picker re-opens on its own when the pawn reaches the rank again. */
    setPromotionRunResetKey((previous) => previous + 1);
    setPromotionPick(null);
    // A beat still in flight belongs to a run that no longer exists. Left
    // pending, it would fire a failure into the fresh board it lands on.
    if (safePathBeatTimer.current) {
      clearTimeout(safePathBeatTimer.current);
      safePathBeatTimer.current = null;
    }
  }

  /**
   * Steps 2–4 of the evaluation order: evaluate every milestone condition,
   * PERSIST every fired event, then build the celebration queue. Called ONLY
   * after the activity has been recorded (stars, consumed slot) and after the
   * daily star ledger has taken the net improvement, so it sees fresh numbers.
   *
   * `starsForPiece` is the post-solve map for `selectedPiece` — the hook's
   * localStorage write happens inside a `setProgress` updater and has not
   * landed yet when this runs. Omitted by the labyrinth path, which changes
   * no exercise stars (labyrinth stars feed the daily ledger only).
   *
   * Returns the queue it just built, so the caller can tell IN THE SAME TICK
   * which moments the machine now owns (`celebration.current` is state and is
   * still the pre-resolve value inside this closure).
   */
  function resolveMilestones(
    starsForPiece?: Record<string, number>,
    /** Forces inputs the React closure cannot possibly know yet. The only
     *  caller is the badge-claim success path: `badgesClaimed` was captured at
     *  render time and `refetchAllBadges()` has not landed, so BOTH still read
     *  `false` for the piece the chain just minted. Without this, `mastery`
     *  cannot be evaluated at the moment it is actually earned.
     *
     *  `piece` travels WITH `badgeClaimed` — they are one fact about one
     *  piece. The claim is scoped to `step.piece`, which is NOT necessarily
     *  `selectedPiece`: a `piece-badge-eligible:rook` event persists PENDING
     *  across a reload, and the player can come back on bishop and claim it
     *  from the overlay. Forcing `badgeClaimed: true` onto whatever piece
     *  happened to be selected would evaluate `mastery` (badge + labyrinths,
     *  no star gate) for a piece whose badge was never minted — a false crown,
     *  stamped celebrated forever. */
    overrides?: { piece?: PieceKey; badgeClaimed?: boolean },
  ): CelebrationStep[] {
    // No seed, no resolve. An unseeded profile is one whose on-chain badge
    // state is still UNKNOWN (`useMilestoneSeeding` stays un-ready while a
    // wallet is connected to an unsupported chain — `getBadgesAddress` is
    // null there, so the read never runs and `allBadgesData` is `undefined`
    // forever). Resolving in that window hands a veteran the full retroactive
    // parade — first-reward, first-labyrinth, special-training,
    // piece-badge-eligible — for history they lived through months ago. The
    // seed is the ONLY thing that suppresses it, so nothing may fire before
    // it lands. Milestones are not lost: the seed stamps them on the next
    // mount with a known badge state, and anything genuinely new is derived
    // from persisted progress on the next solve.
    if (!hasSeededMilestones()) return [];

    const piece = overrides?.piece ?? selectedPiece;

    // Read BEFORE `resolve` records it — afterwards it is always true.
    const hadGreatSessionBefore = hasEarnedMilestone("first-great-session");

    const steps = celebration.resolve({
      piece,
      progressByPiece: buildProgressByPiece(
        piece,
        // Fresh stars exist only for the piece under play. When the caller
        // overrides the piece (the badge claim), its stars come off the disk.
        starsForPiece ??
          (piece === selectedPiece ? progress.stars : readPieceStars(piece)),
      ),
      pieceRequiredExercises: badgeRequiredCount(catalog[piece].length),
      dailyStars: getDailyStars(),
      sessionQuotaExhausted: isSessionOver(getDailySession()),
      badgeClaimed: overrides?.badgeClaimed ?? badgesClaimed[piece] === true,
      allLabyrinthsComplete: areAllLabyrinthsSolved(
        piece,
        (specialTrainingCatalog[piece] ?? []).map((lab) => lab.id),
      ),
      hadGreatSessionBefore,
      // The gift is a Lite-only product: `unlockWelcomePackageGift()` and
      // `useWelcomePackage()` are both no-ops in Full mode. Firing
      // `first-reward` there would celebrate a gift that cannot exist and
      // hand the player a CTA that opens an empty modal. Gate the MILESTONE,
      // not just its side effect.
      giftAvailable: CHESSCITO_LITE_MODE,
    });

    // The gift has no other writer. `resolve` already persisted the event, so
    // reading it back here is a read of committed state, not a guess.
    if (hasEarnedMilestone("first-reward")) unlockWelcomePackageGift();

    return steps;
  }

  /** Always-fresh mirror so `handleLabyrinthMove` (a useCallback with a
   *  narrow dep list) can resolve milestones without re-creating itself on
   *  every render. Same latest-value-ref discipline as `useCelebrationQueue`. */
  const resolveMilestonesRef = useRef(resolveMilestones);
  resolveMilestonesRef.current = resolveMilestones;

  function handleMove(position: BoardPosition, movesCount: number) {
    const isTarget =
      position.file === currentExercise.targetPos.file &&
      position.rank === currentExercise.targetPos.rank;

    setMoves(movesCount);
    if (movesCount === 1) timerStart.current = Date.now();

    if (isTarget) {
      hapticSuccess();
      // Session-over freeze: once the daily limit is reached the player can
      // keep replaying completed exercises as practice, but no stars are
      // persisted. A fresh solve always persists — see shouldFreezeScoring.
      const scoringFrozen = shouldFreezeScoring(
        CHESSCITO_LITE_MODE,
        getDailySession(),
        isReplay,
      );
      // Compute earned stars + bump streak BEFORE setPhase so the
      // WELL DONE PhaseFlash sees both on its first render.
      //
      // Streak gating (user feedback 2026-05-31): replays do NOT
      // bump the streak. Allowing replays to count produced an
      // infinite grind loophole — open the exercise drawer, tap a
      // completed exercise, finish it, +1 streak, repeat. The
      // streak is meaningful only when chained against FRESH
      // exercises. `isReplay` comes from useExerciseProgress and
      // is true when the active exercise already has stars in
      // progress.stars[index].
      setLastEarnedStars(computeStars(movesCount, currentExercise.optimalMoves));
      if (!isReplay) {
        bumpStreak();
      }
      setPhase("success");
      const elapsed = timerStart.current > 0 ? Date.now() - timerStart.current : 1000;
      setElapsedMs(elapsed);
      // Frozen replays still flash WELL DONE but do not persist stars.
      if (!scoringFrozen) {
        completeExercise(movesCount);
      }

      // B2.3a: track extra content consumption (Lite-only; idempotent).
      if (CHESSCITO_LITE_MODE) {
        const session = recordExtraConsumed(
          buildContentId("exercise", selectedPiece, currentExercise.id),
        );
        // Arm the streak nudge off the SAME ledger, which is already
        // idempotent per content id per UTC day. A replay therefore leaves
        // the count where it was and arms nothing new.
        streakNudge.armOnSolve(getUsedCount(session));
      }

      // ── Evaluation order, steps 1 → 4 ────────────────────────────────
      // The activity is now recorded (stars via completeExercise, the
      // consumed slot via recordExtraConsumed). Credit the daily star ledger
      // with the NET improvement — a replay that does not beat the previous
      // best contributes nothing — and only then evaluate the milestones, so
      // the machine sees today's real numbers. A frozen replay persists
      // nothing, so it credits nothing.
      let badgeMomentOwnedByQueue = false;
      {
        const earnedStars = computeStars(movesCount, currentExercise.optimalMoves);
        const previousBest = progress.stars[currentExercise.id] ?? 0;
        const starsAfterSolve = scoringFrozen
          ? progress.stars
          : withBestStars(progress.stars, currentExercise.id, earnedStars);
        if (!scoringFrozen) addNetStars(previousBest, earnedStars);
        const steps = resolveMilestones(starsAfterSolve);
        // The badge moment has exactly ONE owner. When this solve made the
        // machine emit `piece-badge-eligible` (as its own step, or absorbed
        // into MASTERY), `<UnlockOverlay>` owns it — it carries the claim CTA
        // the legacy `<BadgeEarnedPrompt>` never had. Priming the legacy
        // prompt anyway would leave a second celebration ready to pop the
        // instant the queue drains: the back-to-back this design forbids.
        badgeMomentOwnedByQueue = steps.some(
          (step) =>
            step.id === "piece-badge-eligible" ||
            step.absorbed.some(
              (event) => event.id === "piece-badge-eligible",
            ),
        );
      }

      // Phase 2 nudge: first ★★★ while disconnected → "Connect to save".
      // Suppressed in Lite (spec P0-1): no on-chain save path exists there.
      if (
        shouldFireStarsConnectPrompt({
          isConnected,
          liteMode: CHESSCITO_LITE_MODE,
          stars: computeStars(movesCount, currentExercise.optimalMoves),
        })
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
        isLite: CHESSCITO_LITE_MODE,
      });

      // On last exercise: check if badge is earned (including this completion).
      // Gate is COMPLETION, not stars — `!isReplay` means this exercise was not
      // completed before, so it adds exactly one to the completed count.
      if (isLastExercise && !isReplay) {
        const newCompleted =
          completedExerciseCount(selectedPiece, progress.stars, catalog) + 1;
        const badgeEarnedNow = isBadgeEarned(
          newCompleted,
          catalog[selectedPiece].length,
        );

        if (badgeEarnedNow && !hasClaimedBadge) {
          // Only the loser of the ownership contest primes its prompt. The
          // timers below run either way, so the piece-complete hand-off keeps
          // its existing 1.5s + 13.5s shape.
          if (!badgeMomentOwnedByQueue) setShowBadgeEarned(true);
          // Spec: local-save toast fires at t=1500ms (same window as normal path),
          // AFTER the WELL DONE flash. Safety-net schedules 13.5s later so the
          // total auto-dismiss delay from exercise completion stays ~15s.
          autoReset.schedule(() => {
            if (shouldFireLocalSavedToast({ labyrinthMode })) {
              showToast(tFooter("localSaved"), 1200);
            }
            autoReset.schedule(() => {
              setShowBadgeEarned(false);
              setShowPieceComplete(true);
            }, 13_500);
          }, 1500);
          return;
        }
      }

      const completedExerciseId = currentExercise.id;
      holdForTap(() => {
        // Local-save feedback (spec P0-2/P0-3): fires when the player taps to
        // continue past the WELL DONE flash, not at completeExercise time.
        if (shouldFireLocalSavedToast({ labyrinthMode })) {
          showToast(tFooter("localSaved"), 1200);
        }
        // Path sequencing: enter the next available labyrinth instead of
        // advancing to the next exercise. Handles two cases:
        //   1. Happy path — lab is the immediate next interleaved row.
        //   2. Late unlock/manual selection — an available lab can sit on
        //      either side of the completed exercise's visual position.
        // Reads the path ref so post-completion unlocks (e.g. 6★ reached on
        // this very exercise) are visible at fire time.
        const pendingLab = getLabyrinthForAutoAdvance(
          trainingPathRef.current,
          completedExerciseId,
        );
        if (pendingLab) {
          requestTrainingContent(pendingLab.id, "automatic");
          resetBoard();
          return;
        }
        if (!isLastExercise) {
          advanceExercise();
          resetBoard();
        } else {
          // Last exercise — show completion guide instead of silent reset
          setShowPieceComplete(true);
        }
      });
      return;
    }

    // Shared failure treatment — identical rescue/shield flow whether the loss
    // came from a wrong single move or from stranding the piece.
    const triggerFailure = () => {
      hapticReject();
      setPhase("failure");
      shieldRescueAttemptIdRef.current += 1;
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: currentExercise.id,
        moves: movesCount,
        is_capture: Boolean(currentExercise.isCapture),
        isLite: CHESSCITO_LITE_MODE,
      });
      // FTUX gating (user feedback 2026-06-01): the rescue modal
      // pitches "save your streak" + "claim free shields" — concepts
      // a brand-new player has never encountered. Showing it on the
      // FIRST EVER failure is over-pitching. Gate the modal by player
      // context; if none, fall back to a brief 1.5s auto-reset like
      // the pre-cluster behavior. The modal kicks in once the player
      // has any of: a streak in progress, shields owned, or has
      // already claimed the Welcome Pack.
      const hasRescueContext =
        streakCount >= 1 ||
        shieldCount >= 1 ||
        welcomePack.state === "claimed";
      if (!hasRescueContext) {
        // Sprint 6 commit C (2026-06-08) — route through the same
        // guard that the legacy manual RETRY uses. The auto-reset
        // path now advances attemptSeq + fires the
        // training_retry_completed telemetry that Sprint 5 §7.5
        // documented as a known gap. If the user beats the 1.5s
        // timer by tapping RETRY manually, the dedup ref ensures
        // the auto-reset fire is a no-op (same attemptSeq).
        holdForTap(() => handleRetryApplied("auto_reset"));
      }
      // else: modal handles the dwell; no autoReset.
    };

    // Solo ejercicios de 1 movimiento: el primer click incorrecto = auto-reset
    if (currentExercise.optimalMoves === 1) {
      triggerFailure();
      return;
    }

    // Multi-movimiento: el jugador navega libremente MIENTRAS el objetivo siga
    // siendo alcanzable. El peón nunca retrocede: si avanza recto y abandona su
    // captura, la estrella queda inalcanzable para siempre — quedarse callado le
    // enseña que "no pasa nada". `canReachFrom` corre el mismo BFS que el juego,
    // así que otras piezas (que sí retroceden) nunca dan falso positivo.
    if (!canReachFrom(selectedPiece, currentExercise, position)) {
      triggerFailure();
    }
  }

  async function handleUseShield() {
    if (phase !== "failure" || shieldSpendingRef.current) return;
    shieldSpendingRef.current = true;
    autoReset.invalidate();

    try {
      const res = await fetch("/api/shields/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        spent?: number;
        balance?: number;
      };

      if (res.ok && data.spent === 1 && typeof data.balance === "number") {
        writeCreditedCache(data.balance + readConsumedCount());
        dispatchShieldChange();
        // Post-hoc fix (final whole-branch review, C1): a successful
        // rescue is functionally a new attempt — advance attemptSeq
        // the same way a manual Retry does, so the next Peones-
        // fallback idempotency key can't collide with this attempt.
        resetBoard();
        incrementAttemptSeq();
        return;
      }

      // NOTE: unreachable in normal play today — context-action.ts
      // only offers the "useShield" action when shieldsAvailable > 0,
      // so this internal shieldCount === 0 Peones-fallback branch
      // can't fire under current gating. Kept correct (streak +
      // attemptSeq semantics mirrored from useFailRescue.onUseShield)
      // in case that gating ever changes (whole-branch review M1).
      if (!res.ok && res.status === 409 && shieldCount === 0 && address) {
        const attempt = await attemptShieldSpendWithPeones({
          wallet: address,
          attemptSeq: shieldRescueAttemptIdRef.current,
        });
        if (attempt.kind === "paid") {
          const peonesRes = await fetch("/api/shields/spend", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              peonesIdempotencyKey: attempt.peonesIdempotencyKey,
              attemptSeq: shieldRescueAttemptIdRef.current,
            }),
          });
          if (peonesRes.ok) {
            resetBoard();
            incrementAttemptSeq();
            return;
          }
          // Peones charge succeeded but the shields/spend call itself
          // failed — infra glitch, not the player's fault (mirrors
          // useFailRescue.onUseShield's onServerError). Streak
          // preserved, attemptSeq NOT advanced (no rescue actually
          // landed).
          resetBoard();
          return;
        }
        // insufficient | error — same outcome as a deliberate skip
        // (mirrors useFailRescue.onUseShield's onSkipped).
        resetStreak();
        resetBoard();
        return;
      }

      // I1 fix (final whole-branch review): mirror
      // useFailRescue.onUseShield's status-code split instead of
      // collapsing every remaining outcome into a streak-preserving
      // reset. A genuine 5xx / malformed-server-response is an infra
      // glitch (streak preserved); any other non-success outcome —
      // including a stale-cache 409 where shieldCount > 0 locally but
      // the server says 0 — is treated the same as a deliberate skip.
      if (!res.ok && res.status >= 500) {
        resetBoard();
      } else {
        resetStreak();
        resetBoard();
      }
    } catch {
      // Network failure (offline, DNS, dropped connection — realistic
      // on MiniPay mobile). Mirrors useFailRescue.onUseShield's catch:
      // the player INTENDED to use the shield, so fall through to the
      // same terminal path as the insufficient/error/5xx branch above
      // rather than leaving them stuck on the failure screen.
      resetBoard();
    } finally {
      shieldSpendingRef.current = false;
    }
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

  /** Resolves TRUE only when the badge is confirmed on-chain. The celebration
   *  queue reads this: a cancelled or failed claim must NOT consume the
   *  recognition it was opened from. */
  async function handleClaimBadge(piece?: PieceKey): Promise<boolean> {
    const claimLevelId = piece ? getLevelId(piece) : levelId;
    if (!address || !badgesAddress || !isConnected || !isCorrectChain || claimLevelId <= 0n) {
      return false;
    }
    // Prevent double-claim (stale cache or rapid taps)
    const targetPiece = piece ?? selectedPiece;
    if (badgesClaimed[targetPiece] || isClaimBusy) return false;

    setLastError(null);
    setClaimingPiece(targetPiece);
    track("badge_claim_tx", { stage: "start", piece: targetPiece });

    try {
      const outcome = await claimWrite.run({
        broadcast: async () => {
          const signed = await requestSignature("/api/sign-badge", {
            player: address,
            levelId: Number(claimLevelId),
          });

          const hash = await writeWithOptionalFeeCurrency(writeBadgeAsync, {
            address: badgesAddress,
            abi: badgesAbi,
            functionName: "claimBadgeSigned" as const,
            args: [claimLevelId, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
            chainId,
            account: address,
          });
          // The wallet accepted it. The chain has not ruled yet.
          track("badge_claim_tx", { stage: "broadcast", piece: targetPiece });
          return hash;
        },
        confirm: confirmReceipt,
      });

      if (outcome.status === "busy") return false;

      if (outcome.status === "cancelled") {
        track("badge_claim_tx", { stage: "cancelled", piece: targetPiece });
        return false;
      }

      if (outcome.status === "failed") {
        const message = toErrorMessage(outcome.error);
        setLastError(message);
        track("badge_claim_tx", { stage: "error", piece: targetPiece, error_kind: outcome.kind });
        setResultOverlay({
          variant: "error",
          errorMessage: classifyTxError(outcome.error, tResult),
          retryAction: () => void handleClaimBadge(piece),
        });
        console.warn("[MiniPayTx] error", { label: "claim-badge", levelId: Number(claimLevelId), error: message });
        return false;
      }

      // Verified on-chain from here down. `stage: "success"` now means the tx
      // was mined successfully, not that the wallet accepted the broadcast.
      track("badge_claim_tx", { stage: "success", piece: targetPiece });
      void refetchAllBadges();

      const claimedIndex = PIECE_ORDER.indexOf(targetPiece);
      const nextUnlock = claimedIndex < PIECE_ORDER.length - 1 ? PIECE_ORDER[claimedIndex + 1] : null;

      applyBadgeClaimSuccess(
        {
          haptic: hapticSuccess,
          markClaimed: (claimed) =>
            setJustClaimed((prev) => ({ ...prev, [claimed as PieceKey]: true })),
          queueNextPieceUnlock: (next) => {
            if (!next) return;
            setUnlockedPiece(next as PieceKey);
            track("modal_open", { id: "piece-unlocked", piece: next });
          },
          showOverlay: (hash) => setResultOverlay({ variant: "badge", txHash: hash }),
        },
        { piece: targetPiece, nextPiece: nextUnlock, txHash: outcome.txHash },
      );
      console.info("[MiniPayTx] result", { label: "claim-badge", txHash: outcome.txHash, levelId: Number(claimLevelId) });
      return true;
    } finally {
      setClaimingPiece(null);
    }
  }

  /**
   * The overlay's primary CTA — takes the player to what they just unlocked.
   *
   * `celebration.current` is read ONCE into a local const: every branch below
   * mutates the queue, so re-reading `celebration.current` after the first
   * call would see a DIFFERENT step (or null) from the same render closure.
   */
  function handleCelebrationPrimary() {
    const step = celebration.current;
    if (!step) return;

    if (step.id === "piece-badge-eligible") {
      // Recognition never depends on signing. On cancel/failure we call
      // `releaseAbsorbed` and NOTHING else — `dismissCurrent` would stamp
      // `celebratedAt` on the absorbed events first, `selectPending` would
      // then return nothing, and the release would silently clear the queue
      // to []: a Great Focus Session lost along with the cancelled tx.
      // The piece the CHAIN is about to mint — not the one on screen. A
      // pending `piece-badge-eligible:rook` survives a reload, and the player
      // can switch to bishop before tapping CLAIM. `handleClaimBadge` already
      // resolves the fallback the same way; naming it here keeps the claim and
      // the re-resolve below reading from ONE scope.
      const claimedPiece = (step.piece as PieceKey | undefined) ?? selectedPiece;

      // Nothing left to claim: the chain already holds this badge. The
      // recognition is real but SPENT, so consume it. `handleClaimBadge`
      // returns a silent `false` here, which the cancellation path below reads
      // as "the player backed out" — leaving the event pending forever. And
      // because the queue drains every pending event regardless of the piece on
      // screen, that one stuck event re-opened this overlay on every solve of
      // every other piece. Found on device (2026-07-12).
      if (badgesClaimed[claimedPiece]) {
        celebration.dismissCurrent();
        return;
      }

      // Every OTHER failure — cancelled, reverted, no wallet, wrong chain —
      // keeps the eligibility pending on purpose: that badge is still owed, so
      // the recognition must survive to be offered again. Only an owned badge
      // is spent, and only it is consumed above.
      void handleClaimBadge(claimedPiece)
        .then((claimed) => {
          if (claimed) {
            // A solve is otherwise the ONLY trigger of `resolve()`, but
            // `mastery` needs `badgeClaimed && allLabyrinthsComplete` — a
            // player who finished every labyrinth first earns the crown HERE,
            // on the claim, not on a solve. Without this re-resolve the crown
            // surfaces later, bolted onto an unrelated (possibly replayed)
            // exercise.
            //
            // Dismiss FIRST: `resolve()` REPLACES the queue, so re-resolving
            // before the dismiss would rebuild a queue whose head is `mastery`
            // with `piece-badge-eligible` absorbed into it — and the very next
            // `dismissCurrent()` would stamp the crown celebrated without ever
            // rendering it. Dismissing first retires the badge step, then the
            // resolve enqueues the crown alone.
            celebration.dismissCurrent();
            // `badgesClaimed` is a render-time closure and `refetchAllBadges()`
            // has not landed; both still say `false`. Force the value the chain
            // just confirmed — AND the piece it confirmed it FOR. The forced
            // field and the rest of the input must describe the same piece, or
            // `mastery` gets evaluated for `selectedPiece` with someone else's
            // badge.
            resolveMilestones(undefined, {
              piece: claimedPiece,
              badgeClaimed: true,
            });
            return;
          }
          celebration.releaseAbsorbed(step);
        })
        // `run()` never throws, but `handleClaimBadge` can still reject
        // outside it (a throwing `applyBadgeClaimSuccess`, a failing refetch).
        // An unhandled rejection would strand `celebration.current` non-null
        // FOREVER — freezing the queue and, because the daily-limit banner is
        // gated on `current === null`, permanently hiding the limit too.
        .catch(() => celebration.releaseAbsorbed(step));
      return;
    }

    celebration.openContent(step.id, step.piece);
    celebration.dismissCurrent();

    if (step.id === "first-reward") {
      // The GIFT the player just won — `welcomePackage.unlocked`, claimed
      // through `<WelcomePackageModal>`. NOT `welcomePack.onClaim()`: that is
      // `useWelcomePackClaim`, the server SHIELD Welcome Pack — a different
      // product with a `personal_sign` → `/api/welcome-pack/claim` round-trip,
      // never gated on this unlock. The overlay promised the gift; the primary
      // must open the gift.
      setWelcomeGiftOpen(true);
      return;
    }

    if (step.id === "first-labyrinth") {
      const lab = getNextChallenge(trainingPathRef.current);
      if (lab) {
        requestTrainingContent(lab.id, "automatic");
        resetBoard();
      }
      return;
    }

    if (step.id === "special-training") {
      // Open the bridge sheet HERE. The old `router.push("/hub")` aimed at
      // `HubArenaTile`, which only mounts inside the FULL `HubScaffold` — and
      // FULL is internal-only. The shipped builds are LEARN (lite) and PLAY,
      // and LEARN's hub renders `HubLiteScaffold`, which has no such tile. So
      // the CTA promised Special Training and dropped the player on a hub with
      // no door. The door that actually ships is `MiniArenaBridgeSlot`, in
      // this screen's action row.
      //
      // The slot is gated on `selectedPiece === "rook"`, and this milestone can
      // fire while the player is on another piece (it reads `rookStars`), so
      // select the rook first: the slot mounts on the next render, already open.
      setSelectedPiece("rook");
      setMiniArenaOpen(true);
      return;
    }

    // mastery / great-focus-session: recognitions, not destinations. The
    // primary is "Continue" — closing IS returning to the experience.
  }

  async function handleSubmitScore(opts?: { silent?: boolean }) {
    // SaveScore off-chain: the base save no longer signs (/api/sign-score),
    // never broadcasts `submitScoreSigned`, never prompts approve/send, and
    // never enters the signer 429 loop. It POSTs /api/scores/save (ALWAYS
    // FREE — MiniPay Lote 2 B1) and renders exactly what the server returns.
    // The retained on-chain path lives in @/lib/contracts/scoreboard for the
    // Leaderboard Proof lane.
    //
    // `silent` (B2): the auto-save on completion persists in the background
    // and never pops the celebration overlay — the inline "Score saved" state
    // is the feedback. A manual retry (fallback) runs non-silent.
    //
    // `canSaveScore` (no badgeEarned requirement) gates the surface; the
    // scoreboard address is no longer a precondition.
    const silent = opts?.silent ?? false;
    if (!canSaveScore || !address || isSubmitBusy) {
      return;
    }
    // Sync guard closes the await-the-POST race the React state flag
    // (isSavingScore) can't cover within the same tick.
    if (submittingScoreRef.current) {
      return;
    }
    submittingScoreRef.current = true;
    setIsSavingScore(true);

    setLastError(null);
    const scoreNum = Number(score);
    const levelNum = Number(levelId);
    const timeMsNum = Number(timeMs);
    const gameId = String(scoreNum);
    const saveId = deriveScoreSaveId(address, levelNum, gameId);

    try {
      const result = await postScoreSave({
        player: address,
        levelId: levelNum,
        score: scoreNum,
        timeMs: timeMsNum,
        // The SAME resolver the route uses to decide what it expects. Sharing
        // one function is what makes a client/server surface mismatch
        // impossible by construction rather than by convention (audit R12).
        surface: resolveDeploymentSurface(),
        // Slice 0.1: this prompts ONCE per write session (2h / 25 saves), not
        // once per save. Subsequent saves ride the cached bearer token.
        signMessage: ({ message }) => signMessageAsync({ message }),
      });

      // Slice 6: exactly one telemetry event per response, fired only
      // after the result is known. The pure mapper picks
      // score_save_{free,paid,duplicate,insufficient,failed}.
      emitScoreSaveTelemetry(result, {
        piece: selectedPiece,
        levelId: levelNum,
        score: scoreNum,
        timeMs: timeMsNum,
        saveId,
        source: "exercises",
      });

      // Silent auto-save (B2): never throw an error overlay at the player in
      // the background. Any non-success flips the inline fallback so the
      // mission sheet offers a free manual "Retry save".
      if (silent && result.status !== "saved" && result.status !== "duplicate") {
        setAutoSaveFailed(true);
        return;
      }

      switch (result.status) {
        case "saved":
        case "duplicate": {
          setAutoSaveFailed(false);
          hapticSuccess();
          // Local-first save state. Empty txHash: off-chain saves have no
          // receipt, so `savedReceiptUrl` stays undefined (no CeloScan
          // link). Persisting under `selectedPiece` flips the SAVE button
          // to its saved-parity state, same as the on-chain path did.
          recordSaveFor(selectedPiece, scoreNum, "");

          // Off-chain save is always free (B1) and silent on auto-save (B2):
          // the background auto-save persists without popping the celebration
          // overlay. Only a manual (non-silent) save shows the score overlay.
          if (!silent) {
            setResultOverlay({ variant: "score" });
          }

          // Optimistic leaderboard entry (same key the leaderboard sheet
          // reads on open). The combined view (Slice 4) already includes
          // off-chain saves once the row lands.
          try {
            sessionStorage.setItem(
              "chesscito:optimistic-score",
              JSON.stringify({
                player: address.toLowerCase(),
                score: scoreNum,
                levelId: levelNum,
                ts: Date.now(),
              }),
            );
          } catch { /* storage unavailable */ }
          setLeaderboardRefreshTrigger((n) => n + 1);
          break;
        }

        case "insufficient_peones": {
          // Recovery, not a dead end: primary CTA opens Get Peones, the
          // secondary is a calm "Not now". No "Try again" loop.
          setResultOverlay({
            variant: "error",
            errorMessage: tResult("error.notEnoughPeones"),
            recoveryCta: {
              label: CHESSCITO_LITE_MODE ? "Get Season Pass" : tResult("cta.getPeones"),
              onPress: () => {
                setResultOverlay(null);
                if (CHESSCITO_LITE_MODE) {
                  setActiveDockTab("shop");
                } else {
                  setGetPeonesOpen(true);
                }
              },
            },
          });
          break;
        }

        case "rate_limited": {
          // Clear backoff, never an immediate retry loop. Toast shows the
          // wait in whole seconds; the SAVE button stays available so the
          // user can retry once the window passes.
          const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
          showToast(`${tResult("error.rateLimitedPrefix")} ${seconds}s`, 3000);
          break;
        }

        case "invalid":
        case "error":
        default: {
          // Controlled error overlay. A single user-initiated retry is
          // allowed (Try again button), which is not a loop.
          setResultOverlay({
            variant: "error",
            errorMessage: tResult("error.unknown"),
            retryAction: () => void handleSubmitScore(),
          });
          break;
        }
      }
    } finally {
      submittingScoreRef.current = false;
      setIsSavingScore(false);
    }
  }

  // MiniPay Lote 2 (B2): auto-save the off-chain score the moment a new score
  // is pending. Off-chain persistence is normal app behaviour (always free),
  // not a purchase — so it never waits for a CTA tap. Fires once per distinct
  // score via `autoSavedScoreRef`; a failure flips `autoSaveFailed` (surfacing
  // the free manual fallback) without looping. The on-chain proof stays the
  // only explicit value action.
  useEffect(() => {
    if (!scorePendingNew || isSubmitBusy) return;
    if (autoSavedScoreRef.current === localScoreNum) return;
    autoSavedScoreRef.current = localScoreNum;
    setAutoSaveFailed(false);
    void handleSubmitScore({ silent: true });
    // handleSubmitScore is a stable closure recreated each render; gating on
    // the score value + the ref makes the effect idempotent without it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorePendingNew, isSubmitBusy, localScoreNum]);

  /** QA round 2 (2026-06-11): the ORIGINAL on-chain SAVE, revived as an
   *  explicit second action (gas-only, no Peones). Faithful to the
   *  pre-Slice-5 flow: sign-score → submitScoreSigned → receipt watcher
   *  (recordSaveFor via pendingSubmitRef) → cache-score write-through →
   *  optimistic leaderboard entry. The leaderboard marks these rows via
   *  leaderboard_full_v.has_onchain. */
  async function handleSaveScoreOnChain() {
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
    // Clear the previous tx's state so a retry after revert shows "Signing…"
    // immediately instead of lingering on "Failed" until the new hash lands
    // (Cluster C SAVE residue defer #1).
    saveWrite.reset();
    doneHold.reset();
    track("score_submit_tx", { stage: "start", piece: selectedPiece });

    // Captured at broadcast so the save persists under the piece the player was
    // on when they submitted, even if they switch selectors while it confirms.
    const submittedPiece = selectedPiece;
    const submittedScore = Number(score);
    const submittedTimeMs = Number(timeMs);
    const submittedLevelId = Number(levelId);

    try {
      const outcome = await saveWrite.run({
        broadcast: async () => {
          const signed = await requestSignature("/api/sign-score", {
            player: address,
            levelId: submittedLevelId,
            score: submittedScore,
            timeMs: submittedTimeMs,
          });

          const hash = await writeWithOptionalFeeCurrency(writeScoreAsync, {
            address: scoreboardAddress,
            abi: scoreboardAbi,
            functionName: "submitScoreSigned" as const,
            args: [levelId, score, timeMs, BigInt(signed.nonce), BigInt(signed.deadline), signed.signature] as const,
            chainId,
            account: address,
          });
          track("score_submit_tx", { stage: "broadcast", piece: submittedPiece });
          return hash;
        },
        confirm: confirmReceipt,
      });

      if (outcome.status === "busy") return;

      if (outcome.status === "cancelled") {
        track("score_submit_tx", { stage: "cancelled", piece: submittedPiece });
        showToast(tFooter("submitCanceled"), 2000);
        return;
      }

      if (outcome.status === "failed") {
        const message = toErrorMessage(outcome.error);
        setLastError(message);
        track("score_submit_tx", { stage: "error", piece: submittedPiece, error_kind: outcome.kind });
        setResultOverlay({
          variant: "error",
          errorMessage: classifyTxError(outcome.error, tResult),
          retryAction: () => void handleSaveScoreOnChain(),
        });
        console.warn("[MiniPayTx] error", { label: "submit-score", levelId: submittedLevelId, error: message });
        return;
      }

      // Verified on-chain. Nothing below this line ran for a reverted tx before
      // — it ran for every broadcast, which is the bug.
      hapticSuccess();
      track("score_submit_tx", { stage: "success", piece: submittedPiece });

      applyScoreSaveSuccess(
        {
          // The sequencer is piece-agnostic (plain string); the screen owns the
          // PieceId narrowing.
          recordSaveFor: (piece, saved, hash) => recordSaveFor(piece as PieceKey, saved, hash),
          writeOptimisticScore: (entry) => {
            try {
              sessionStorage.setItem("chesscito:optimistic-score", JSON.stringify(entry));
            } catch { /* storage unavailable */ }
          },
          // Write-through to Supabase — what the combined leaderboard reads as
          // the on-chain `scores` source. Still fire-and-forget; its silent
          // failure handling is a tracked, deferred gap.
          cacheScore: (payload) => {
            void fetch("/api/cache-score", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(() => {});
          },
          refreshLeaderboard: () => setLeaderboardRefreshTrigger((n) => n + 1),
          showOverlay: (hash) => setResultOverlay({ variant: "score", txHash: hash }),
          startDoneHold: doneHold.start,
        },
        {
          piece: submittedPiece,
          score: submittedScore,
          timeMs: submittedTimeMs,
          levelId: submittedLevelId,
          player: address,
          txHash: outcome.txHash,
        },
      );
      console.info("[MiniPayTx] result", { label: "submit-score", txHash: outcome.txHash, levelId: submittedLevelId });
    } finally {
      submittingScoreRef.current = false;
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
    // PRO no longer reaches this handler (redirected to the rail
    // ProSheet in onSelectItem above) — Founder Badge is the only
    // remaining approve+buyItem consumer, so the source is constant.
    const txSource = "shop_founder_badge";
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
        txErrorKind: classifyTxErrorKind(error),
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

  /** Active exercise — switches to the SELECTED labyrinth when the L2
   *  layer is on. Slice 3C: selection comes from training path node
   *  taps (the old `labyrinthList[0]` hardcode and the 10★
   *  labyrinthAvailable gate are gone — unlock now lives in the path
   *  node statuses: first lab at 6★, then chain by completion). */
  const labyrinthList = useMemo(
    () => specialTrainingCatalog[selectedPiece] ?? [],
    [specialTrainingCatalog, selectedPiece],
  );
  const labyrinthAccess = useMemo<Readonly<Record<string, ContentAccessState>>>(
    () =>
      Object.fromEntries(
        labyrinthList.map((content) => [
          content.id,
          resolveContentAccess(content, trainingPass),
        ]),
      ),
    [labyrinthList, trainingPass],
  );
  // Drawer node labels: a Special Training entry's authored title, keyed by id
  // for COPY only. Untitled labs are omitted so the drawer falls back to the
  // generic "Special Training N" (B4.2.3).
  //
  // Every signature game routes its title through i18n. `entry.title` is the
  // AUTHORING copy in content/*.json — English, always — so a game that skips
  // this lookup ships its English title to Spanish players, silently: the row
  // is titled, just in the wrong language, which reads as content rather than
  // as a bug.
  const specialTrainingLabels = useMemo(
    () =>
      resolveSpecialTrainingLabels(specialTrainingCatalog[selectedPiece] ?? [], [
        {
          ids: new Set((diagonalRunCatalog[selectedPiece] ?? []).map((p) => p.id)),
          translate: (id) => tRun(`title.${id}`),
        },
        {
          ids: new Set((knightTourCatalog[selectedPiece] ?? []).map((p) => p.id)),
          translate: (id) => tTour(`title.${id}`),
        },
        {
          ids: new Set((queensCatalog[selectedPiece] ?? []).map((p) => p.id)),
          translate: (id) => tQueens(`title.${id}`),
        },
      ]),
    [specialTrainingCatalog, diagonalRunCatalog, knightTourCatalog, queensCatalog, selectedPiece, tRun, tTour, tQueens],
  );
  const selectedLabyrinth =
    labyrinthMode && selectedLabyrinthId
      ? labyrinthList.find((lab) => lab.id === selectedLabyrinthId) ?? null
      : null;
  const activeLabyrinth =
    selectedLabyrinth &&
    canMountTrainingContent({
      content: selectedLabyrinth,
      trainingPass,
      attemptGrantId: trainingAttemptGrantId,
    })
      ? selectedLabyrinth
      : null;
  const effectiveLabyrinthMode = activeLabyrinth !== null;
  const activeExercise = activeLabyrinth ?? currentExercise;
  // Pivot mode is derived from the runtime catalog (not an id-set/prefix): the
  // active Special-Training node is a Pivot Challenge iff it lives in the pivot
  // pool for this piece. Only then does the board intercept taps.
  const activeDiagonalRun =
    activeLabyrinth &&
    (diagonalRunCatalog[selectedPiece] ?? []).some((p) => p.id === activeLabyrinth.id)
      ? activeLabyrinth
      : null;

  /** Diagonal Run's live status line, hoisted here so it can render inside
   *  the mission band instead of as a second band under it (2026-07-16).
   *  Only the DR board writes this; every other board leaves it null and the
   *  mission band stays a plain "Move to XX". */
  const [diagonalRunBand, setDiagonalRunBand] = useState<{
    message: string
    phase: string
  } | null>(null);

  /** Same derivation as activeDiagonalRun, from the runtime catalog rather than
   *  an id prefix (B4.2.1): the active node is a tour iff it lives in the tour
   *  pool for this piece. */
  const activeKnightTour =
    activeLabyrinth &&
    (knightTourCatalog[selectedPiece] ?? []).some((p) => p.id === activeLabyrinth.id)
      ? activeLabyrinth
      : null;

  /** The tour's own band, hoisted like the Diagonal Run's. */
  const [knightTourBand, setKnightTourBand] = useState<{
    message: string
    phase: string
  } | null>(null);

  /** Same derivation again, for the queen's signature game. */
  const activeQueens =
    activeLabyrinth &&
    (queensCatalog[selectedPiece] ?? []).some((p) => p.id === activeLabyrinth.id)
      ? activeLabyrinth
      : null;

  /** The queens board's band, hoisted like the other two — plus the live count,
   *  which the mission CHIP renders rather than the band strip. Keeping the
   *  number out of the message is what leaves room for the objective sentence
   *  (founder, 2026-07-16). */
  const [queensBand, setQueensBand] = useState<{
    message: string
    phase: string
    placed: number
    ceiling: number
  } | null>(null);

  /** Same derivation again, for the king's signature game. */
  const activeSafePath =
    activeLabyrinth &&
    (safePathCatalog[selectedPiece] ?? []).some((p) => p.id === activeLabyrinth.id)
      ? activeLabyrinth
      : null;

  /** And once more for the pawn's — the sixth and last. */
  const activePromotionRun =
    activeLabyrinth &&
    (promotionRunCatalog[selectedPiece] ?? []).some((p) => p.id === activeLabyrinth.id)
      ? activeLabyrinth
      : null;

  /** Safe Path's band. Unlike the queens', the count it carries is a MOVE
   *  count against the optimal — lower is better. Same shape as queens', which
   *  is exactly why the two must never be wired to the same grader. */
  const [safePathBand, setSafePathBand] = useState<{
    message: string
    phase: string
    moves: number
    optimal: number
  } | null>(null);

  /** Bumped to walk the king back to the start after he is caught (D5) —
   *  whether he was rescued by a shield or the player waved the modal away. */
  const [safePathResetKey, setSafePathResetKey] = useState(0);

  /** Holds the attack beat so it can be cancelled. Without this, leaving the
   *  level mid-beat fires a failure into a board that is no longer there — and
   *  worse, into whatever level replaced it. */
  const safePathBeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Promotion Run's band. Same shape as the two above and a THIRD meaning: the
   *  count is live progress through a run whose length is fixed, so it is not a
   *  target to beat. It grades nothing. */
  const [promotionRunBand, setPromotionRunBand] = useState<{
    message: string
    phase: string
    moves: number
    optimal: number
  } | null>(null);

  /** Bumped to send the pawn — and the pieces it ate — back to the start. */
  const [promotionRunResetKey, setPromotionRunResetKey] = useState(0);

  /** Set when the pawn reaches the last rank: the picker is up and waiting for a
   *  choice (P3/P5). Cleared on reset. Not a boolean because the square it
   *  crowned on is what the completion reports. */
  const [promotionPick, setPromotionPick] = useState<{ moves: number } | null>(null);

  /** How many times THIS run went wrong — caught, or crowned wrong. This is the
   *  grade (`promotionRunStars`), because moves cannot be: every winning run is
   *  the same length.
   *
   *  ⚠️ A shield does NOT clear this. It buys the player out of replaying the
   *  run, not out of the record — otherwise three stars would be purchasable,
   *  and a star you can buy grades a wallet. Cleared only when the level is
   *  opened or completed, never by a rescue. */
  const promotionRunFailures = useRef(0);

  useEffect(
    () => () => {
      if (safePathBeatTimer.current) clearTimeout(safePathBeatTimer.current);
    },
    [],
  );

  /**
   * The king stepped where an enemy watches, and was seen (D4).
   *
   * ⚠️ Safe Path is the FIRST Special Training game that can be LOST. A
   * labyrinth, a tour, a pivot run, a queens board — none of them have a
   * failure state; the worst outcome is a worse score. So rather than grow a
   * second failure machine for the Special Training lane, this borrows the
   * exercise one wholesale: the same `phase = "failure"`, the same rescue
   * modal, the same FTUX gate, the same auto-reset fallback. The shield already
   * means "you failed, take another run at it" — that is exactly what happened.
   *
   * ⏱ The failure is DELAYED by the attack beat (founder, 2026-07-16). Firing
   * it immediately was correct and unreadable: the modal covered the board
   * before the laser landed, so the player was told "caught" without ever
   * seeing BY WHAT. The beam is the lesson — it names the piece that saw him
   * and draws its line of attack — and a lesson nobody sees is not one. The
   * board is already frozen in its `caught` phase, so the wait costs no
   * agency: there is nothing the player could do with those 850ms anyway.
   */
  function handleSafePathCaught(caughtOn: string) {
    if (!activeSafePath) return;
    const caughtId = activeSafePath.id;
    const movesAtCatch = safePathBand?.moves ?? 0;
    if (safePathBeatTimer.current) clearTimeout(safePathBeatTimer.current);
    safePathBeatTimer.current = setTimeout(() => {
      safePathBeatTimer.current = null;
      setPhase("failure");
      shieldRescueAttemptIdRef.current += 1;
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: caughtId,
        moves: movesAtCatch,
        is_capture: false,
        // Which square did the killing. Level-design telemetry: it names the
        // trap that actually works, which the builder cannot show.
        caught_on: caughtOn,
        isLite: CHESSCITO_LITE_MODE,
      });
      // Same gate as the exercise path: the modal pitches streaks and shields,
      // and a player who has never met either is being over-pitched. Without
      // the context the run just restarts — the king still walks home, because
      // handleRetryApplied lands in resetBoard.
      const hasRescueContext =
        streakCount >= 1 || shieldCount >= 1 || welcomePack.state === "claimed";
      if (!hasRescueContext) {
        holdForTap(() => handleRetryApplied("auto_reset"));
      }
      // else: the modal owns the dwell, and its own handlers reset the board.
    }, SAFE_PATH_ATTACK_BEAT_MS);
  }

  /**
   * The pawn landed where a SURVIVING enemy watches (P1).
   *
   * Safe Path's failure path, verbatim — same beat, same modal, same FTUX gate,
   * same auto-reset. The one difference is bookkeeping: this game grades
   * failures, so the run remembers.
   */
  function handlePromotionRunCaught(caughtOn: string) {
    if (!activePromotionRun) return;
    const caughtId = activePromotionRun.id;
    const movesAtCatch = promotionRunBand?.moves ?? 0;
    promotionRunFailures.current += 1;
    if (safePathBeatTimer.current) clearTimeout(safePathBeatTimer.current);
    // The same 850ms of clean beam, and for the same reason: the modal used to
    // cover the laser and the player read "caught" without seeing by what.
    safePathBeatTimer.current = setTimeout(() => {
      safePathBeatTimer.current = null;
      setPhase("failure");
      shieldRescueAttemptIdRef.current += 1;
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: caughtId,
        moves: movesAtCatch,
        is_capture: false,
        caught_on: caughtOn,
        isLite: CHESSCITO_LITE_MODE,
      });
      const hasRescueContext =
        streakCount >= 1 || shieldCount >= 1 || welcomePack.state === "claimed";
      if (!hasRescueContext) {
        holdForTap(() => handleRetryApplied("auto_reset"));
      }
    }, SAFE_PATH_ATTACK_BEAT_MS);
  }

  /**
   * The player crowned a piece (P3/P5). The picker reports; this judges.
   *
   * The mission is a typed contract (`{ promoteTo }`) and the picker names it on
   * screen, so a wrong crown is a choice the player was told about and made
   * anyway — which is the founder's condition for it costing anything.
   *
   * ⚠️ A wrong crown is a FAILURE, not a loss of chess: crowning a queen is
   * never an error at the board. What failed is the MISSION. It routes through
   * the same rescue machine as being caught, and lands back at the start, so a
   * shield means exactly one thing in this game (see resetBoard).
   */
  function handlePromotionPick(piece: PieceId) {
    if (!activePromotionRun || !promotionPick) return;
    const asked = activePromotionRun.mission?.promoteTo;
    if (piece !== asked) {
      promotionRunFailures.current += 1;
      setPromotionPick(null);
      setPhase("failure");
      shieldRescueAttemptIdRef.current += 1;
      track("exercise_fail", {
        piece: selectedPiece,
        exercise_id: activePromotionRun.id,
        moves: promotionPick.moves,
        is_capture: false,
        // Which piece they reached for instead. This is the only telemetry that
        // can tell "nobody read the mission" apart from "everyone auto-queens".
        promoted_to: piece,
        asked_for: asked ?? null,
        isLite: CHESSCITO_LITE_MODE,
      });
      const hasRescueContext =
        streakCount >= 1 || shieldCount >= 1 || welcomePack.state === "claimed";
      if (!hasRescueContext) {
        holdForTap(() => handleRetryApplied("auto_reset"));
      }
      return;
    }

    // Right piece: the run is done. Graded by FAILURES — see promotionRunStars.
    setPromotionPick(null);
    const failures = promotionRunFailures.current;
    promotionRunFailures.current = 0;
    handleLabyrinthMove(activePromotionRun.targetPos, promotionPick.moves, {
      metric: failures,
      starsFor: promotionRunStars,
    });
  }

  /** The active node graded by coverage, whichever game it belongs to. The two
   *  are mutually exclusive (a node lives in exactly one pool), so this is the
   *  one thing `handleCoverageComplete` needs to know.
   *
   *  ⚠️ Safe Path is NOT here. It is arrival-graded, so it goes through
   *  `handleLabyrinthMove` like the Diagonal Run. Adding it to this pair would
   *  hand a move count to a coverage grader — both are `number`, so nothing
   *  would complain and everyone would get three stars. */
  const activeCoverage = activeKnightTour ?? activeQueens;

  /** Integrated training path (Slice 2 — read-only display in the
   *  mission detail sheet). Bests live in localStorage, so
   *  `labyrinthCompleted` acts as a refresh signal to re-read them
   *  after each completion. */
  const trainingPath = useMemo(() => {
    void labyrinthCompleted;
    return buildTrainingPath({
      piece: selectedPiece,
      progress,
      labyrinthBests: Object.fromEntries(
        labyrinthList.map((lab) => [lab.id, getLabyrinthBest(selectedPiece, lab.id)]),
      ),
      badgeClaimed: badgesClaimed[selectedPiece] === true,
      catalog: { exercises: catalog, labyrinths: specialTrainingCatalog },
      coverageIds,
      starlessIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, progress, badgesClaimed, labyrinthCompleted, catalog, specialTrainingCatalog]);

  /** Always-fresh mirror of the path for callbacks that fire from
   *  timers (success auto-advance) — the 1500ms closure would
   *  otherwise see the pre-completion path where the just-unlocked
   *  labyrinth still reads as locked (QA G1). */
  const trainingPathRef = useRef(trainingPath);
  useEffect(() => {
    trainingPathRef.current = trainingPath;
  }, [trainingPath]);

  const implicitContentRequestRef = useRef<string | null>(null);
  const initialContentRequestRef = useRef(initialContentId);
  const pendingAutomaticContentRef = useRef<string | null>(null);

  /** One request boundary for Path taps, automatic continuation, URLs and
   *  restoration. It resolves commercial access first, then the existing
   *  curricular node status. Only `explicit_tap` may open checkout. */
  const requestTrainingContent = useCallback(
    (contentId: string, source: TrainingContentRequestSource) => {
      const result = resolveTrainingContentRequest({
        contentId,
        catalog: labyrinthList,
        trainingPass: trainingPassRef.current,
        source,
      });

      if (result.action === "pending") {
        if (source === "automatic") pendingAutomaticContentRef.current = contentId;
        return result;
      }
      if (pendingAutomaticContentRef.current === contentId) {
        pendingAutomaticContentRef.current = null;
      }

      if (result.action === "missing" || result.action === "locked") {
        setLabyrinthMode(false);
        setSelectedLabyrinthId(null);
        setTrainingAttemptGrantId(null);
        setLabyrinthCompleted(null);
        if (result.action === "locked" && result.openCheckout) {
          setExerciseDrawerOpen(false);
          setActiveDockTab("shop");
        } else {
          setExerciseDrawerOpen(true);
        }
        return result;
      }

      const node = trainingPathRef.current.find(
        (entry) => entry.kind === "labyrinth" && entry.id === contentId,
      );
      if (!node || node.status === "locked") {
        setLabyrinthMode(false);
        setSelectedLabyrinthId(null);
        setTrainingAttemptGrantId(null);
        setExerciseDrawerOpen(true);
        return { action: "missing" as const };
      }

      implicitContentRequestRef.current = `${selectedPiece}:${contentId}`;
      setSelectedLabyrinthId(contentId);
      setTrainingAttemptGrantId(result.attemptGrantId);
      setLabyrinthMode(true);
      setLabyrinthCompleted(null);
      setLabyrinthMoves(0);
      setLabyrinthKey((key) => key + 1);
      writeLastTrainingContentId(selectedPiece, contentId);
      return result;
    },
    [labyrinthList, selectedPiece],
  );

  const handleLabyrinthSelect = useCallback(
    (labyrinthId: string) => {
      requestTrainingContent(labyrinthId, "explicit_tap");
    },
    [requestTrainingContent],
  );

  /** Direct/restored ids wait through entitlement hydration, then either start
   *  once or return to the locked Path. They never open checkout. */
  useEffect(() => {
    const directContentId = initialContentRequestRef.current;
    const contentId = directContentId ?? readLastTrainingContentId(selectedPiece);
    if (!contentId) return;
    const requestKey = `${selectedPiece}:${contentId}`;
    if (implicitContentRequestRef.current === requestKey) return;
    const source: TrainingContentRequestSource = directContentId ? "direct" : "restore";
    const result = requestTrainingContent(contentId, source);
    if (result.action !== "pending") {
      if (directContentId) initialContentRequestRef.current = undefined;
      implicitContentRequestRef.current = requestKey;
    }
  }, [requestTrainingContent, selectedPiece, trainingPass]);

  useEffect(() => {
    if (trainingPass.loading) return;
    const contentId = pendingAutomaticContentRef.current;
    if (!contentId) return;
    pendingAutomaticContentRef.current = null;
    requestTrainingContent(contentId, "automatic");
  }, [requestTrainingContent, trainingPass]);

  /** Slice 3D: the path's recommended next challenge (first unlocked,
   *  uncompleted labyrinth). Drives the contextual "Enter Labyrinth"
   *  pin and nothing else — exercise flow is untouched when null. */
  const nextChallenge = getNextChallenge(
    trainingPath.filter((node) => {
      if (node.kind !== "labyrinth") return true;
      const access = labyrinthAccess[node.id];
      return Boolean(access && !isContentAccessPending(access) && access.allowed);
    }),
  );

  const handleExitLabyrinth = useCallback(() => {
    setLabyrinthMode(false);
    setSelectedLabyrinthId(null);
    setTrainingAttemptGrantId(null);
    setLabyrinthCompleted(null);
    setLabyrinthMoves(0);
  }, []);

  /** Continue from the solved overlay — routes to the next step after a
   *  labyrinth completion. Priority: pending exercise → next available lab
   *  → piece-complete. Never leaves the player on a dead screen. */
  function handleLabyrinthContinue() {
    handleExitLabyrinth();
    const pool = catalog[selectedPiece];
    // First pool slot with 0★ (id-map; absent id = not played) that is
    // also in today's visible set when rotation is on.
    const nextIdx = pool.findIndex(
      (exercise) =>
        (progress.stars[exercise.id] ?? 0) === 0 &&
        (!visibleExerciseIds || visibleExerciseIds.has(exercise.id)),
    );
    const route = resolvePostLabContinue(trainingPath, nextIdx >= 0);
    if (route.action === "next-exercise") {
      handleExerciseNavigate(nextIdx);
    } else if (route.action === "next-labyrinth") {
      requestTrainingContent(route.labyrinthId, "automatic");
    } else {
      setShowPieceComplete(true);
    }
  }

  /** Labyrinth move handler — fires the completion overlay when the
   *  player reaches the target. The Board's internal counter is the
   *  source of truth for move count. */
  const handleLabyrinthMove = useCallback(
    (
      position: BoardPosition,
      movesCount: number,
      /**
       * Promotion Run only. Everything else grades MOVES with `labyrinthStars`
       * and leaves this alone.
       *
       * ⚠️ Why it exists: that game cannot be graded by moves at all. A pawn
       * advances exactly one rank per move, so every winning run measures
       * `7 - startRank` — moves always equals optimal, three stars for
       * everyone. It grades FAILURES instead (`promotionRunStars`).
       *
       * `starsFor` is injected rather than a plain `stars` number because the
       * BEST is stored and re-graded: `previousBest` has to go through the same
       * function, or the ledger compares failures against a move-count scale
       * and silently invents stars. Both are `number`; nothing would complain.
       * `metric` is what gets STORED as the best — failures here, moves
       * everywhere else. Both are lower-is-better, so the store's own
       * semantics hold.
       */
      grading?: { metric: number; starsFor: (metric: number) => number },
    ) => {
      if (!activeLabyrinth) return;
      // Mirror the Board's internal counter to drive the live HUD
      // chip. Fires on every move; the completion check below only
      // runs when the player lands on the target square.
      setLabyrinthMoves(movesCount);
      const reached =
        position.file === activeLabyrinth.targetPos.file &&
        position.rank === activeLabyrinth.targetPos.rank;
      if (!reached) return;
      const metric = grading ? grading.metric : movesCount;
      const starsFor =
        grading?.starsFor ??
        ((m: number) => labyrinthStars(m, activeLabyrinth.optimalMoves));
      const stars = starsFor(metric);
      // Labyrinths sit outside the daily session: they never spend a quota
      // slot and their best is never frozen. They feed no score, so there is
      // nothing to farm — and the path auto-advances the player into one,
      // which used to silently eat the slot the next exercise needed.
      // Read previous best BEFORE recording so the overlay can
      // contextualize the new score against the player's history.
      const previousBest = getLabyrinthBest(selectedPiece, activeLabyrinth.id);
      const isNewBest = recordLabyrinthBest(selectedPiece, activeLabyrinth.id, metric);
      setLabyrinthCompleted({
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        previousBest,
        isNewBest,
        awardsStars: true,
      });

      // The daily star ledger is fed by exercises AND labyrinths, always as
      // net improvement — without this a player who spends the session in the
      // mazes never reaches a Great Focus Session. Labyrinth stars stay OUT of
      // `pieceStars` (gather-input owns that rule); only the ledger sees them.
      const previousLabStars = previousBest === null ? 0 : starsFor(previousBest);
      addNetStars(previousLabStars, stars);
      resolveMilestonesRef.current();

      track("labyrinth_complete", {
        labyrinth_id: activeLabyrinth.id,
        piece: selectedPiece,
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        is_new_best: isNewBest,
        previous_best: previousBest ?? null,
      });
      // Economy V1 (2026-07-21): labyrinths pay NO Peones. Completing
      // one still awards its stars, its best, its net-stars ledger
      // entry and any unlock behind it — only the +1 Peón is gone.
      // Ludic games and labyrinths must not be automatic faucets;
      // the training milestone and the Daily are the free sources.
    },
    [activeLabyrinth, selectedPiece],
  );

  /** Coverage completion — the twin of handleLabyrinthMove, shared by the
   *  Knight's Tour and N-Queens.
   *
   *  It exists BECAUSE it cannot reuse that handler: every scoring step there
   *  reads a move count where this reads coverage, and both are plain numbers,
   *  so reuse would compile, run, and be wrong in silence. labyrinthStars would
   *  award 3 to every run (best <= ceiling always), and recordLabyrinthBest
   *  would file the player's worst run as their record.
   *
   *  It is shared rather than duplicated for the mirror-image reason: the two
   *  games ask the identical question (how much of the ceiling did you fill),
   *  so a per-game copy would be two chances to drift on the ledger, the daily
   *  net-stars rule and the earn call.
   *
   *  Fires once, when the board says the run is over — a coverage game is never
   *  abandoned mid-run. */
  const handleCoverageComplete = useCallback(
    (covered: number, ceiling: number) => {
      if (!activeCoverage) return;
      const previousBest = getLabyrinthBest(selectedPiece, activeCoverage.id);
      const starResult = resolveCoverageStars({
        covered,
        ceiling,
        previousBest,
        starless: activeKnightTour !== null,
      });
      const stars = starResult.stars;
      const isNewBest = recordTourBest(selectedPiece, activeCoverage.id, covered);
      setLabyrinthCompleted({
        moves: covered,
        optimal: ceiling,
        stars,
        previousBest,
        isNewBest,
        awardsStars: starResult.awardsStars,
      });

      // Net improvement into the daily ledger, same rule as the labyrinths:
      // replaying a level you already aced must not farm stars.
      if (starResult.awardsStars) {
        addNetStars(starResult.previousStars, stars);
      }
      resolveMilestonesRef.current();
      // Premium authorization is attempt-scoped. The result overlay may stay,
      // but any retry/replay must pass through a fresh entitlement decision.
      setTrainingAttemptGrantId(null);

      track("labyrinth_complete", {
        labyrinth_id: activeCoverage.id,
        piece: selectedPiece,
        moves: covered,
        optimal: ceiling,
        stars,
        is_new_best: isNewBest,
        previous_best: previousBest ?? null,
      });

      // No Peones earn here either — see handleLabyrinthMove.
    },
    [activeCoverage, activeKnightTour, selectedPiece],
  );

  // Pivot Challenge copy, resolved from the i18n layer (EN/ES) by id.
  const runTitle = activeDiagonalRun ? tRun(`title.${activeDiagonalRun.id}`) : null;
  const runPrompt = activeDiagonalRun ? tRun(`prompt.${activeDiagonalRun.id}`) : null;
  // Knight's Tour copy, same id-keyed i18n shape.
  const tourTitle = activeKnightTour ? tTour(`title.${activeKnightTour.id}`) : null;
  const tourPrompt = activeKnightTour ? tTour(`prompt.${activeKnightTour.id}`) : null;
  // N-Queens copy, same id-keyed i18n shape.
  const queensTitle = activeQueens ? tQueens(`title.${activeQueens.id}`) : null;
  const queensPrompt = activeQueens ? tQueens(`prompt.${activeQueens.id}`) : null;
  // Safe Path copy, same id-keyed i18n shape.
  const safePathTitle = activeSafePath ? tSafePath(`title.${activeSafePath.id}`) : null;
  const safePathPrompt = activeSafePath ? tSafePath(`prompt.${activeSafePath.id}`) : null;
  // Promotion Run copy, same id-keyed i18n shape.
  const promotionRunTitle = activePromotionRun
    ? tPromotionRun(`title.${activePromotionRun.id}`)
    : null;
  const promotionRunPrompt = activePromotionRun
    ? tPromotionRun(`prompt.${activePromotionRun.id}`)
    : null;

  const targetLabel = activeDiagonalRun
    ? // Pivot is not measured in moves: the chip shows the destination square,
      //  never a "0 / 2 moves" counter (B4.2.1).
      `${String.fromCharCode(97 + activeDiagonalRun.targetPos.file)}${activeDiagonalRun.targetPos.rank + 1}`
    : activeKnightTour
      ? // Same rule: a tour is not measured in moves either, and it has no
        //  destination square to name. The chip states the bar; the live count
        //  rides the mission band, which is where the status line lives.
        tTour("chip.goal")
      : activeQueens
      ? // The counter chip (spec §2). optimalMoves holds ceiling-1 (the queens
        //  the PLAYER places), so the ceiling is optimalMoves + 1 — and before
        //  the board reports in, the level's own queen is already the 1.
        tQueens("chip.count", {
          placed: queensBand?.placed ?? 1,
          ceiling: queensBand?.ceiling ?? activeQueens.optimalMoves + 1,
        })
      : activeSafePath
      ? // Looks like the queens chip and means the opposite: this counts MOVES
        //  against the optimal, so lower is better. Same reason the two games
        //  must never share a grader.
        tSafePath("chip.count", {
          moves: safePathBand?.moves ?? 0,
          optimal: activeSafePath.optimalMoves,
        })
      : activePromotionRun
      ? // Looks like BOTH of the two above and means a third thing: pure live
        //  progress. `optimal` here is `7 - startRank`, which every winning run
        //  hits exactly — it cannot be beaten or missed, so it is not a target.
        //  The stars come from failures, never from this number.
        tPromotionRun("chip.count", {
          moves: promotionRunBand?.moves ?? 0,
          optimal: activePromotionRun.optimalMoves,
        })
      : activeLabyrinth
      ? // Labyrinth chip becomes a live counter: "0 / 4 · optimal" (no
        //  moves yet) → "3 / 4 · optimal" (live) → "5 / 4 · over" past
        //  optimal so the player can pace themselves in real time.
        `${labyrinthMoves} / ${activeLabyrinth.optimalMoves} moves`
      : activeExercise.isCapture
        ? tCapture("statsLabel")
        : `${String.fromCharCode(97 + activeExercise.targetPos.file)}${activeExercise.targetPos.rank + 1}`;

  const pieceHint = activeDiagonalRun
    ? (runPrompt as string)
    : activeKnightTour
    ? (tourPrompt as string)
    : activeQueens
    ? (queensPrompt as string)
    : activeSafePath
    ? (safePathPrompt as string)
    : activePromotionRun
    ? (promotionRunPrompt as string)
    : activeLabyrinth
      ? `${tLab("missionTitle")} · ${tLab("missionHint", { optimal: activeLabyrinth.optimalMoves })}`
      : currentExercise.isCapture
        ? tMission("captureHintCompact")
        : tMission(`pieceHint.${selectedPiece}` as const);

  // Show movement lane hints on the first exercise of each piece (until the player earns stars)
  const tutorialHints = useMemo(() => {
    const firstExerciseId = catalog[selectedPiece][0]?.id;
    if (
      currentExerciseIndex !== 0 ||
      (firstExerciseId ? (progress.stars[firstExerciseId] ?? 0) : 0) > 0
    )
      return undefined;
    const targets = getValidTargets(selectedPiece, currentExercise.startPos);
    return new Set(targets.map(getPositionLabel));
  }, [selectedPiece, currentExerciseIndex, progress.stars, currentExercise.startPos, catalog]);

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
              // Exit #1 of the flow. The nudge may DEFER this push and
              // complete it on dismiss; it never cancels it.
              onClick: () => streakNudge.interceptExit(() => router.push("/")),
              label: tStatus("backLabel"),
            }}
            trailingControl={
              // Header = Account only. Peones lives inside the Account sheet
              // now (Chesscito Card hero) — one wallet home, uncluttered header
              // (UX spec §6, 2026-07-06).
              !address ? (
                <button
                  type="button"
                  onClick={() => connectWallet()}
                  aria-label={tHud("connectAriaLabel")}
                  className="candy-tray-pill hub-hud-pill"
                >
                  <CandyIcon
                    name="wallet"
                    className="candy-tray-pill-icon candy-tray-pill-icon--floating"
                  />
                  <span>{tHud("connectLabel")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(true)}
                  aria-label={
                    proStatus?.active
                      ? tStatus("proManageLabel")
                      : tStatus("accountLabel")
                  }
                  data-testid="account-trigger"
                  className={`candy-tray-pill hub-hud-pill${proStatus?.active ? " hub-hud-pill--pro-text" : ""}`}
                >
                  <ThemeAssetPicture slot="shared.avatar-small-account" pictureClassName="candy-tray-pill-icon candy-tray-pill-icon--floating candy-tray-pill-icon--avatar-round" alt="" aria-hidden="true" draggable={false} />
                  <span>{tStatus("accountChipLabel")}</span>
                  {proStatus?.active ? (
                    (() => {
                      const days = daysRemaining(
                        proStatus.expiresAt,
                        Date.now(),
                      );
                      return days != null ? (
                        <span className="hub-hud-pill-pro-days">
                          PRO · {days}d
                        </span>
                      ) : null;
                    })()
                  ) : null}
                </button>
              )
            }
          />
        </div>
        {/* Step 7 of the evaluation order: the session limit is consulted ONLY
         *  once every pending recognition has drained. The wall never arrives
         *  before the praise — a player who burns the quota while struggling
         *  gets the celebration, not the paywall. */}
        {celebration.current === null && quotaDisplayState?.isAtLimit && (
          <DailyLimitBanner
            isHardMax={quotaDisplayState.isHardMax}
            onBack={() => router.push("/")}
          />
        )}
        <MissionPanelCandy
          selectedPiece={selectedPiece}
          onOpenPieceSheet={() => setBadgeSheetOpen(true)}
          phase={storeOpen ? "ready" : phase}
          awaitTapToContinue={awaitFlashTap}
          onFlashContinue={handleFlashContinue}
          targetLabel={targetLabel}
          pieceHint={pieceHint}
          exercisePrompt={runPrompt ?? currentExercise.playerPrompt}
          exerciseTitle={runTitle ?? tourTitle ?? queensTitle ?? safePathTitle ?? promotionRunTitle ?? currentExercise.title}
          isCapture={Boolean(currentExercise.isCapture)}
          isDockSheetOpen={activeDockTab !== null}
          labyrinthMode={effectiveLabyrinthMode}
          diagonalRunMode={
            activeDiagonalRun !== null || activeKnightTour !== null || activeQueens !== null
          }
          // The two games with no destination: the chip drops its "Move to"
          // frame for them. The Diagonal Run keeps it — it names a square.
          coverageMode={activeCoverage !== null}
          // Gated on the game being active, not merely on the state being set: a
          // stale line must never outlive the board that wrote it.
          missionStatus={
            activeDiagonalRun
              ? (diagonalRunBand ?? undefined)
              : activeKnightTour
                ? (knightTourBand ?? undefined)
                : activeQueens
                  ? (queensBand ?? undefined)
                  : activeSafePath
                    ? (safePathBand ?? undefined)
                    : activePromotionRun
                      ? (promotionRunBand ?? undefined)
                      : undefined
          }
          labyrinthOptimalMoves={activeLabyrinth?.optimalMoves}
          labyrinthId={activeLabyrinth?.id}
          labyrinthTitle={runTitle ?? tourTitle ?? queensTitle ?? safePathTitle ?? promotionRunTitle ?? activeLabyrinth?.title}
          onLabyrinthSelect={(contentId) =>
            requestTrainingContent(contentId, "automatic")
          }
          score={score.toString()}
          totalStars={totalStars}
          maxPossibleStars={maxPossibleStars}
          trainingPath={trainingPath}
          canSaveScore={scorePendingNew}
          isSavingScore={isSubmitBusy}
          // B2: off-chain save auto-runs silently. The sheet shows an
          // informative "Score saved" state (or a free manual retry on
          // failure) instead of a competing green CTA.
          scoreSaved={isSavedAtParity}
          saveFailed={autoSaveFailed}
          onRetrySave={() => void handleSubmitScore()}
          canSaveOnChain={canSaveOnChain}
          onSaveOnChain={() => void handleSaveScoreOnChain()}
          isSavingOnChain={saveWrite.isBusy}
          shieldCount={shieldCount}
          streakCount={streakCount}
          lastEarnedStars={lastEarnedStars}
          failureRescueSlot={
            phase === "failure" &&
            (streakCount >= 1 ||
              shieldCount >= 1 ||
              welcomePack.state === "claimed") ? (
              <FailRescueModal
                visible
                variant={failRescue.variant}
                shieldsCount={failRescue.shieldsCount}
                onUseShield={failRescue.onUseShield}
                onRetryAnyway={failRescue.onRetryAnyway}
                onClaimFree={failRescue.onClaimFree}
                onPrimerShown={failRescue.markPrimerShown}
              />
            ) : null
          }
          actionRowLeft={<DailyTacticSlot />}
          actionRowCenter={
            // Sally composition pass (2026-06-11): HINT is an
            // in-context action, so it joins the centered group next
            // to SAVE/CLAIM; the edges stay reserved for the
            // persistent entry points (Daily / Special Training).
            // Hidden (not row-shifting empty space) outside
            // phase=ready / in labyrinth mode.
            // Mode gate REMOVED 2026-07-22. It read `|| CHESSCITO_LITE_MODE`
            // on the premise that Lite "has no Peones surfaces" — false, and
            // the same premise that hid the balance chip from LEARN. LEARN
            // already earns Peones (Daily + milestones) and already spends
            // them (shield rescue), so withholding the cheapest sink from the
            // mode that accumulates the currency only starved the loop.
            activeLabyrinth || phase !== "ready" ? null : (
              <PeonesHintButton
                piece={selectedPiece}
                exerciseId={currentExercise.id}
                // Sprint 5 commit E — consume the live attemptSeq from
                // useExerciseProgress. Same attempt → same key →
                // duplicate=true (re-view free). Fresh attempt after a
                // legacy Retry → fresh key → real debit possible.
                attemptSeq={attemptSeq}
                disabled={false}
                firstStep={peonesHintFirstStep}
                onReveal={setPeonesHintSquare}
              />
            )
          }
          actionRowRight={
            <MiniArenaBridgeSlot
              setup={MINI_ARENA_SETUPS[0]}
              unlocked={selectedPiece === "rook" && totalStars >= 12}
              open={miniArenaOpen}
              onOpenChange={setMiniArenaOpen}
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
            ) : effectiveLabyrinthMode ? (
              // QA F2 (2026-06-11): mid-labyrinth the contextual slot is
              // owned by the muted exit pin — the full-width BACK TO
              // EXERCISES band above the board is gone.
              <ActionPin
                action="exitLabyrinth"
                size="pin"
                label={tLab("exitLabyrinth")}
                ariaLabel={tLab("exitLabyrinth")}
                onPress={handleExitLabyrinth}
              />
            ) : shouldShowWPCtaInSlot({
              liteMode: CHESSCITO_LITE_MODE,
              contextAction,
              wpMounted,
              wpState: welcomePack.state,
            }) ? (
              // Lite only: the unclaimed pack owns an otherwise-idle
              // contextual slot. Ahead of score-parity and path affordances;
              // badge actions excluded via contextAction (spec P0-4).
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <ActionPin
                  action="claimWelcomePack"
                  size="pin"
                  label={tFooter("claimWelcomePack")}
                  ariaLabel={tFooter("claimWelcomePack")}
                  onPress={
                    welcomePack.state === "connect"
                      ? welcomePack.onConnect
                      : welcomePack.onClaim
                  }
                  isBusy={welcomePack.state === "claiming"}
                />
              </div>
            ) : isSavedAtParity && contextAction === null ? (
              // Retire-when-done (Sally pass 2026-06-11): a saved-at-
              // parity score renders NOTHING — the SAVE pin reappears
              // on its own when the player beats the score. The
              // SavedChip status seal read as a sixth dock icon and
              // fed the "two docks" noise the founder flagged.
              null
            ) : starsConnectPrompt.isVisible ? (
              <ConnectPromptToast
                milestone="stars"
                onConnect={() => {
                  starsConnectPrompt.dismiss();
                  connectWallet();
                }}
                onDismiss={starsConnectPrompt.dismiss}
              />
            ) : rewardActions.length >= 1 ? (
              // Reward area: SAVE (sink) + CLAIM (badge) shown independently,
              // side by side, neither hiding the other. Each pin gets its own
              // busy flag so a save in flight doesn't grey out claim and vice
              // versa.
              <div className="flex items-center justify-center gap-3">
                {rewardActions.map((a) => (
                  <ContextualActionSlot
                    key={a}
                    action={a}
                    shieldsAvailable={shieldCount}
                    isBusy={claimWrite.isBusy}
                    onUseShield={handleUseShield}
                    onClaimBadge={() => void handleClaimBadge()}
                    onRetry={handleRetryApplied}
                    onConnectWallet={() => connectWallet()}
                    onSwitchNetwork={() => configuredChainId != null && switchChain({ chainId: configuredChainId })}
                    compact
                  />
                ))}
              </div>
            ) : contextAction === null &&
              nextChallenge &&
              !effectiveLabyrinthMode ? (
              // Slice 3D — the next challenge comes to the player: when
              // the slot is otherwise idle and the path recommends an
              // unlocked, uncompleted labyrinth, surface it right here.
              // Hidden while already inside a labyrinth. contextAction
              // === null also rules out every failure state (those
              // always resolve to retry/useShield).
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <ActionPin
                  action="enterLabyrinth"
                  size="pin"
                  tone="default"
                  label={tPath("nextChallengeCta")}
                  ariaLabel={tPath("nextChallengeCta")}
                  onPress={() => requestTrainingContent(nextChallenge.id, "automatic")}
                />
              </div>
            ) : (
              <ContextualActionSlot
                action={contextAction}
                shieldsAvailable={shieldCount}
                isBusy={claimWrite.isBusy}
                onUseShield={handleUseShield}
                onClaimBadge={() => void handleClaimBadge()}
                // Sprint 5 commit G — route the legacy free Retry
                // through the same guard the paid chip would have
                // used. This reset the board, advances attemptSeq
                // (so the next Hint gets a fresh idempotency key),
                // and emits `training_retry_completed` exactly once
                // per applied retry. Double-tap protection lives
                // inside the guard.
                onRetry={handleRetryApplied}
                onConnectWallet={() => connectWallet()}
                onSwitchNetwork={() => configuredChainId != null && switchChain({ chainId: configuredChainId })}
                compact
              />
            )
          }
          persistentDock={<PersistentDock />}
          board={
            activeDiagonalRun ? (
              <DiagonalRunBoard
                key={`dr-${activeDiagonalRun.id}-${labyrinthKey}`}
                level={activeDiagonalRun}
                onComplete={(moves) =>
                  handleLabyrinthMove(activeDiagonalRun.targetPos, moves)
                }
                onBandChange={setDiagonalRunBand}
              />
            ) : activeKnightTour ? (
              <TrainingContentGate
                content={activeKnightTour}
                trainingPass={trainingPass}
                attemptGrantId={trainingAttemptGrantId}
              >
                <KnightTourBoard
                  key={`kt-${activeKnightTour.id}-${labyrinthKey}`}
                  level={activeKnightTour}
                  // NOT handleLabyrinthMove: a tour reports coverage, and that
                  // handler grades move counts. See handleCoverageComplete.
                  onComplete={handleCoverageComplete}
                  onBandChange={setKnightTourBand}
                />
              </TrainingContentGate>
            ) : activeQueens ? (
              <QueensBoard
                key={`q-${activeQueens.id}-${labyrinthKey}`}
                level={activeQueens}
                // Same coverage handler as the tour, for the same reason.
                onComplete={handleCoverageComplete}
                onBandChange={setQueensBand}
              />
            ) : activeSafePath ? (
              <SafePathBoard
                key={`sp-${activeSafePath.id}-${labyrinthKey}`}
                level={activeSafePath}
                resetKey={safePathResetKey}
                // handleLabyrinthMove, NOT handleCoverageComplete: this game is
                // graded by ARRIVAL, like the Diagonal Run. Its neighbours above
                // report coverage; wiring this one to them would feed a move
                // count to a percentage grader — same `number`, opposite
                // meaning, no type error, three stars for everyone.
                onComplete={(moves) =>
                  handleLabyrinthMove(activeSafePath.targetPos, moves)
                }
                onCaught={handleSafePathCaught}
                onBandChange={setSafePathBand}
              />
            ) : activePromotionRun ? (
              <PromotionRunBoard
                key={`pr-${activePromotionRun.id}-${labyrinthKey}`}
                level={activePromotionRun}
                resetKey={promotionRunResetKey}
                /* Neither neighbour's handler. The board only reports that the
                   pawn REACHED the last rank — the run is not over yet, because
                   the crown has not been chosen (P3/P5). So this opens the
                   picker, and `handlePromotionPick` is what finishes (or fails)
                   the level. */
                onComplete={(moves) => setPromotionPick({ moves })}
                onCaught={handlePromotionRunCaught}
                onBandChange={setPromotionRunBand}
              />
            ) : (
              <Board
                key={`${boardKey}-${labyrinthMode ? `lab-${labyrinthKey}` : "ex"}`}
                pieceType={selectedPiece}
                startPosition={activeExercise.startPos}
                mode={activeLabyrinth ? "labyrinth" : "practice"}
                targetPosition={activeExercise.targetPos}
                obstacles={activeExercise.obstacles}
                captureTargets={activeExercise.captureTargets}
                isLocked={!activeLabyrinth ? (phase === "failure" || phase === "success") : labyrinthCompleted !== null}
                onMove={activeLabyrinth ? handleLabyrinthMove : handleMove}
                isCapture={activeExercise.isCapture ?? false}
                tutorialHints={activeLabyrinth ? undefined : tutorialHints}
                peonesHint={activeLabyrinth ? null : peonesHintSquare}
              />
            )
          }
          exerciseDrawer={
            <ExerciseDrawer
              open={exerciseDrawerOpen}
              // Exit #2: opening the drawer to pick what is next is the other
              // decision moment. Closing it is not an exit and passes through.
              onOpenChange={(open) => {
                if (!open) {
                  setExerciseDrawerOpen(false);
                  return;
                }
                streakNudge.interceptExit(() => setExerciseDrawerOpen(true));
              }}
              piece={selectedPiece}
              exercises={catalog[selectedPiece]}
              stars={progress.stars}
              activeIndex={currentExerciseIndex}
              totalStars={totalStars}
              onNavigate={handleExerciseNavigate}
              shieldCount={shieldCount}
              streakCount={streakCount}
              visibleExerciseIds={visibleExerciseIds}
              labyrinthNodes={trainingPath.filter((n) => n.kind === "labyrinth")}
              labyrinthLabels={specialTrainingLabels}
              onLabyrinthSelect={handleLabyrinthSelect}
              labyrinthAccess={labyrinthAccess}
              onTrainingPassUnlock={() => setActiveDockTab("shop")}
              quotaState={
                quotaDisplayState?.isAtLimit
                  ? {
                      isAtLimit: true,
                      consumedContentIds: quotaDisplayState.consumedContentIds,
                      piece: selectedPiece,
                    }
                  : null
              }
              badgeClaimable={badgeEarned && !hasClaimedBadge && !justClaimed[selectedPiece]}
              onClaimBadge={() => void handleClaimBadge()}
            />
          }
          balanceChip={
            // Peones V1 UX (2026-07-21): the balance must be visible on
            // the surface where it is spent, not only on the Hub. Sits in
            // the quest tray next to stars/shields/combo and stays up for
            // the whole exercise, so a Hint debit is seen where it
            // happens.
            //
            // NOT gated on mode (fixed 2026-07-22). It shipped behind
            // `!CHESSCITO_LITE_MODE`, copied from the Hint's gate whose
            // comment claims Lite "has no Peones surfaces". That claim is
            // false: `CHESSCITO_LITE_MODE` is just `mode === "learn"`
            // (feature-flags.ts), LEARN is a shipped mode, its Hub mounts
            // this very chip ungated, and LEARN is where Peones are EARNED
            // (Daily + exercise milestones). The gate therefore hid the
            // balance from the exact players who accumulate one — a
            // currency you cannot see may as well not exist.
            <PeonesBalanceChip surface="exercises" />
          }
          isReplay={isReplay}
        />

        {!CHESSCITO_LITE_MODE && <PurchaseConfirmSheet
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
        />}

        {!CHESSCITO_LITE_MODE && <ProSheet {...proSheet.sheetProps} />}
        {address ? (
          <AccountSheet
            open={accountSheetOpen}
            onOpenChange={setAccountSheetOpen}
            walletAddress={address}
            walletShort={formatWalletShort(address)}
            chainId={chainId}
            proActive={proStatus?.active === true}
            proExpiresAt={proStatus?.expiresAt ?? null}
            coachCredits={coachCredits}
            onManagePro={() => {
              setAccountSheetOpen(false);
              proSheet.openSheet();
            }}
            onOpenCoach={() => {
              setAccountSheetOpen(false);
              router.push("/coach/history");
            }}
            onOpenShieldsHelp={() => {
              setAccountSheetOpen(false);
              router.push("/exercises");
            }}
            onOpenShop={() => {
              setAccountSheetOpen(false);
              setStoreOpen(true);
            }}
            onDisconnect={() => {
              setAccountSheetOpen(false);
              signOut();
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
        {shouldShowMissionBriefing({
          showBriefing,
          dockSheetOpen: activeDockTab !== null,
          proSheetOpen: proSheet.open,
          accountSheetOpen,
          // Micro-fix 2026-06-11: never mount the exercise briefing
          // over a labyrinth — its objective copy would interpolate
          // the live move counter. Defers until back on exercises.
          labyrinthActive: effectiveLabyrinthMode,
        }) ? (
          <MissionBriefing
            pieceType={selectedPiece}
            targetLabel={targetLabel}
            isCapture={Boolean(currentExercise.isCapture)}
            exercisePrompt={currentExercise.playerPrompt}
            onPlay={markOnboarded}
          />
        ) : null}

        {/* The crown. Mounts only while the pawn is standing on the last rank
            waiting to become something — `promotionPick` is set by the board's
            arrival and cleared by the pick, by a reset, or by a wrong choice.

            One `aria-modal` at a time holds by construction: a wrong pick
            clears this BEFORE it sets phase="failure", so the picker is gone
            before the rescue modal mounts. They cannot overlap. */}
        {activePromotionRun && promotionPick ? (
          <PromotionPicker
            promoteTo={activePromotionRun.mission?.promoteTo ?? "queen"}
            onPick={handlePromotionPick}
          />
        ) : null}

        {/* ── The one-dialog rule ──────────────────────────────────────────
         *  Every popup below is suppressed while the milestone machine has a
         *  recognition pending. The machine owns the celebration moment; a
         *  legacy popup rendering alongside `<UnlockOverlay>` would stack two
         *  `role="dialog"` shells (both are `VictoryPopupShell`, both
         *  `z-[70]`) and drop the intensity right after the climax.
         *
         *  These are RENDER gates, not state gates: the state survives, so
         *  each popup resumes the moment the queue drains — which is the
         *  intended flow for the piece-complete menu, the labyrinth
         *  score card and the tx result overlay (they are continuations, not
         *  celebrations). The one popup that must NEVER resurface is the
         *  legacy badge prompt; it is never primed at all when the queue owns
         *  the badge moment (see `badgeMomentOwnedByQueue` in `handleMove`). */}
        {/* `<PieceCompletePrompt>` is the LOWEST-priority modal on this screen:
         *  it is a continuation menu, not a moment. Its 15s `autoReset` timer
         *  is armed by the solve and keeps ticking through a MiniPay round
         *  trip, so on the badge path `showPieceComplete` routinely flips true
         *  while the player is still signing. When the claim confirms,
         *  `applyBadgeClaimSuccess` sets `resultOverlay` + `unlockedPiece` and
         *  the queue drains in the SAME commit — every gate below would open
         *  at once and stack two `aria-modal` surfaces. Yielding to each of
         *  them defers the menu; it never swallows it, because none of these
         *  clears `showPieceComplete`. The player still lands on it, alone,
         *  once the last one is closed. */}
        {showPieceComplete &&
        !showBadgeEarned &&
        !resultOverlay &&
        !unlockedPiece &&
        !welcomeGiftOpen &&
        celebration.current === null ? (
          <PieceCompletePrompt
            pieceType={selectedPiece}
            nextPiece={nextPiece ?? null}
            hasClaimedBadge={!!hasClaimedBadge}
            totalStars={totalStars}
            maxPossibleStars={maxPossibleStars}
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
              // Slice 3E: only a PENDING labyrinth (unlocked, not yet
              // completed — getNextChallenge semantics) takes the CTA.
              // A fully-completed labyrinth leg falls through to the
              // nextPiece primary. Routes through the path, never the
              // old [0] hardcode.
              nextChallenge
                ? () => {
                    setShowPieceComplete(false);
                    requestTrainingContent(nextChallenge.id, "automatic");
                    resetBoard();
                  }
                : undefined
            }
            onChoosePiece={() => {
              setShowPieceComplete(false);
              // Unified Piece Sheet (D3): "Choose another piece" lands
              // on the badges sheet, which now owns the switch grid.
              setBadgeSheetOpen(true);
            }}
            // MiniPay Lote 2 F1: no manual off-chain save CTA here — the score
            // auto-saves on completion. The primary continuation CTAs
            // (next piece / labyrinth / choose piece) advance the flow.
          />
        ) : null}

        {labyrinthCompleted && celebration.current === null ? (
          <LabyrinthCompleteOverlay
            moves={labyrinthCompleted.moves}
            optimalMoves={labyrinthCompleted.optimal}
            stars={labyrinthCompleted.stars}
            awardsStars={labyrinthCompleted.awardsStars}
            previousBest={labyrinthCompleted.previousBest}
            isNewBest={labyrinthCompleted.isNewBest}
            onContinue={handleLabyrinthContinue}
            onRetry={() => {
              if (selectedLabyrinthId) {
                requestTrainingContent(selectedLabyrinthId, "automatic");
              } else {
                handleExitLabyrinth();
                setExerciseDrawerOpen(true);
              }
            }}
            onEnterArena={
              selectedPiece === "king" &&
              areAllLabyrinthsSolved(
                "king",
                labyrinthCatalog.king.map((l) => l.id),
              )
                ? () => {
                    setLabyrinthCompleted(null);
                    router.push("/arena?fresh=1");
                  }
                : undefined
            }
          />
        ) : null}

        {/* One dialog, always: the queue emits a single step at a time and
         *  absorbs lower majors into it as lines.
         *
         *  Separated from the WELL DONE flash (founder 2026-07-17): while the
         *  flash is holding for the player's tap, its reward/milestone modal
         *  stays back. Stacking the two buried the celebration under the reward
         *  ("First Reward Earned" popped on top of "Well done!"). The queue
         *  state survives untouched, so the moment the player taps to continue
         *  (`awaitFlashTap` clears), this resumes as its own beat. */}
        {celebration.current && !awaitFlashTap ? (
          <UnlockOverlay
            step={celebration.current}
            onPrimary={handleCelebrationPrimary}
            onDismiss={celebration.dismissCurrent}
          />
        ) : null}

        {/* The destination of `first-reward`'s primary. Same modal, same claim
         *  hook, same `claimed` write `<DailyTacticSlot>` uses — the gift the
         *  overlay actually promised. */}
        {welcomeGiftOpen && celebration.current === null ? (
          <WelcomePackageModal
            phase={welcomeGiftClaim.claimPhase}
            onClaim={() => welcomeGiftClaim.handleClaim(claimWelcomePackageGift)}
            onDismiss={() => {
              if (welcomeGiftClaim.claimPhase === "signing") return;
              welcomeGiftClaim.handleSuccess();
              setWelcomeGiftOpen(false);
            }}
            onSuccess={() => {
              welcomeGiftClaim.handleSuccess();
              setWelcomeGiftOpen(false);
            }}
            onRetry={welcomeGiftClaim.handleRetry}
          />
        ) : null}

        {showBadgeEarned && celebration.current === null ? (
          <BadgeEarnedPrompt
            pieceType={selectedPiece}
            totalStars={totalStars}
            maxPossibleStars={maxPossibleStars}
            // MiniPay Lote 2 F1: no manual off-chain SAVE CTA — the score
            // auto-saves. The badge celebration just continues to the piece
            // complete flow.
            onContinue={handleBadgeEarnedDismiss}
          />
        ) : null}

        {/* A failed claim sets this in the SAME tick as `releaseAbsorbed` —
         *  without the gate the error card would stack on the recognition it
         *  just released. Recognition first, then the error. */}
        {resultOverlay && celebration.current === null ? (
          <ResultOverlay
            variant={resultOverlay.variant}
            pieceType={selectedPiece}
            itemLabel={selectedItem?.label}
            itemAsset={selectedItem?.icon}
            itemAssetSlot={selectedItem?.iconSlot}
            txHash={resultOverlay.txHash}
            celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
            errorMessage={resultOverlay.errorMessage}
            errorKind={resultOverlay.errorKind}
            txErrorKind={resultOverlay.txErrorKind}
            totalStars={totalStars}
            maxPossibleStars={maxPossibleStars}
            recoveryCta={resultOverlay.recoveryCta}
            onDismiss={() => setResultOverlay(null)}
            onRetry={resultOverlay.retryAction}
          />
        ) : null}

        {getPeonesOpen ? (
          <GetPeonesSheet
            open={getPeonesOpen}
            onOpenChange={setGetPeonesOpen}
          />
        ) : null}

        {/* Same shell and same primary as every other unlock in the ladder
         *  (`UnlockOverlay`). This screen used to be the odd one out — a
         *  `CandyGlassShell` behind a hand-rolled `role="dialog"` wrapper —
         *  so the piece a player just earned was announced in a visual
         *  vocabulary nothing else in LEARN speaks. The shell owns the scrim
         *  and the `aria-modal`, so the wrapper is gone with it. */}
        {unlockedPiece && !resultOverlay && (
          <VictoryPopupShell
            onClose={() => setUnlockedPiece(null)}
            ariaLabel={tUnlock("title", { piece: tPiece(unlockedPiece) })}
            closeLabel={tMission("closeLabel")}
          >
            <div className="progression-overlay-icon relative flex items-center justify-center">
              <div className="pointer-events-none absolute h-36 w-36">
                <LottieAnimation src="/animations/sparkle-burst.lottie" loop={false} className="h-full w-full" />
              </div>
              <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_75%)]" />
              <ThemeAssetPicture slot={pieceThemeSlot("w", unlockedPiece)} pictureClassName="relative z-10 h-20 w-20" alt={tPiece(unlockedPiece)} className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(120,65,5,0.35)]" />
            </div>

            <h2 className="language-modal-title">
              {tUnlock("title", { piece: tPiece(unlockedPiece) })}
            </h2>
            <p className="progression-overlay-body">{tTutorial(unlockedPiece)}</p>

            <PrincipalButton
              onClick={() => {
                setUnlockedPiece(null);
                setSelectedPiece(unlockedPiece);
                resetBoard();
              }}
              className="self-center"
            >
              {tUnlock("cta", { piece: tPiece(unlockedPiece) })}
            </PrincipalButton>
          </VictoryPopupShell>
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
          showTrigger={false}
          selectedPiece={selectedPiece}
          onSelectPiece={(piece) => {
            autoReset.invalidate();
            setSelectedPiece(piece);
            setResultOverlay(null);
            claimWrite.reset();
            saveWrite.reset();
            doneHold.reset();
            setShowBadgeEarned(false);
            setShowPieceComplete(false);
            resetBoard();
          }}
        />
        {CHESSCITO_LITE_MODE ? (
          <LearnShopSheet
            open={storeOpen}
            onOpenChange={setStoreOpen}
            onSuccess={() => void trainingPassStatus.refresh()}
          />
        ) : (
          <ShopSheet
            open={storeOpen}
            onOpenChange={setStoreOpen}
            items={displayShopCatalog}
            onSelectItem={(itemId) => {
              // PRO no longer buys through approve+buyItem — redirect to
              // the already-mounted rail-based <ProSheet> (same one the
              // floating PRO chip opens) and skip the confirm sheet.
              // Founder Badge falls through to the normal path below.
              if (itemId === PRO_ITEM_ID) {
                setStoreOpen(false);
                proSheet.openSheet();
                return;
              }
              setSelectedItemId(itemId);
              const item = shopCatalog.find((i) => i.itemId === itemId);
              if (item) setPaymentToken(selectPaymentToken(item.onChainPrice, itemId));
              setStoreOpen(false);
              setConfirmOpen(true);
            }}
            showTrigger={false}
            welcomePack={welcomePack}
          />
        )}
        <TrophiesSheet
          open={trophiesSheetOpen}
          onOpenChange={setTrophiesSheetOpen}
          showTrigger={false}
        />
        <LeaderboardSheet
          open={leaderboardOpen}
          onOpenChange={setLeaderboardOpen}
          showTrigger={false}
          refreshTrigger={leaderboardRefreshTrigger}
          canSaveOnChain={canSaveOnChain}
          onSaveOnChain={() => void handleSaveScoreOnChain()}
          isSavingOnChain={saveWrite.isBusy}
        />
        {/* Last in the tree on purpose: it only ever appears once every other
            surface is done, on the way out of the flow. */}
        {streakNudge.visible && (
          <StreakNudgeScreen
            onDismiss={streakNudge.handleDismiss}
            onOpenDaily={streakNudge.handleOpenDaily}
          />
        )}
      </main>
    </div>
  );
}
