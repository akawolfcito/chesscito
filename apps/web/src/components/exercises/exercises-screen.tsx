"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
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
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

import { Board } from "@/components/board";
import { useCoachCredits } from "@/lib/coach/use-coach-credits";
import { useShieldsCount } from "@/lib/shop/use-shields-count";
import { useFounderStatus } from "@/lib/founder/use-founder-status";
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
import { ChesitoCard } from "@/components/peones/chesito-card";
// PeonesRetryButton intentionally NOT imported — Sprint 5 commit G
// unmounted the paid Retry chip pending differential-value
// calibration. The component + tests + spend endpoint support stay
// as dormant infrastructure (see Sprint 5 handoff §1).
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { useRetryGuard } from "@/lib/exercises/use-retry-guard";
import { ENABLE_EXERCISE_ROTATION } from "@/lib/exercises/rotation-flag";
import { MiniArenaBridgeSlot } from "@/components/mini-arena/mini-arena-bridge-slot";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";
import { ContextualActionSlot } from "@/components/exercises/contextual-action-slot";
import {
  shouldFireStarsConnectPrompt,
  shouldFireLocalSavedToast,
  shouldShowWPCtaInSlot,
} from "@/components/exercises/exercises-save-flow-logic";
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
import { useExerciseProgress } from "@/hooks/use-exercise-progress";
import { useExerciseCatalog, useLabyrinthCatalog } from "@/lib/content/catalog-context";
import { useRotationSteering } from "@/hooks/use-rotation-steering";
import { useSaveScoreState } from "@/hooks/use-save-score-state";
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
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ProSheet } from "@/components/pro/pro-sheet";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { formatWalletShort } from "@/lib/wallet/format";
import { ACCEPTED_TOKENS, CELO_TOKEN, erc20Abi, normalizePrice } from "@/lib/contracts/tokens";
import { waitForReceiptWithTimeout } from "@/lib/contracts/transaction-helpers";
import { PIECE_IMAGES } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { getPositionLabel, getValidTargets } from "@/lib/game/board";
import type { BoardPosition } from "@/lib/game/types";
import { BadgeEarnedPrompt, PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";
import { GetPeonesSheet } from "@/components/payments/get-peones-sheet";
import { SeasonPassSheet } from "@/components/payments/season-pass-sheet";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/telemetry";
import { classifyTxError, classifyTxErrorKind, isTransactionTimeout, isUserCancellation, type TxErrorKind } from "@/lib/errors";
import { getContextAction, getRewardActions } from "@/lib/game/context-action";
import { BADGE_THRESHOLD, labyrinthStars } from "@/lib/game/exercises";
import { getMaxPossibleStars } from "@/lib/game/progress-adapter";
import {
  areAllLabyrinthsSolved,
  getLabyrinthBest,
  recordLabyrinthBest,
} from "@/lib/game/labyrinth-progress";
import {
  buildTrainingPath,
  getLabyrinthForAutoAdvance,
  getNextChallenge,
  resolvePostLabContinue,
} from "@/lib/training/path";
import { submitLabyrinthCompletionEarn } from "@/lib/peones/labyrinth-earn";
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
  isAtFreeLimit,
  isAtHardMax,
  shouldFreezeScoring,
} from "@/lib/daily/session-quota";
import { subscribeToDailySessionChanges } from "@/lib/daily/session-events";
import { DailyLimitBanner } from "@/components/daily/daily-limit-banner";

// SHOP_ITEMS lives in lib/contracts/shop-catalog.ts so it's testable
// in isolation. The import is below with the other contract helpers.


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
  /** Asset basename from SHOP_TILE_ASSETS (e.g. "/art/shop/coach-pack-20").
   *  PurchaseConfirmSheet renders the AVIF/WebP/PNG triplet from this
   *  base so the modal header carries the same per-SKU icon the
   *  shop tile already shows. */
  icon: string;
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
  proExpiresAt,
  coachCredits,
  onManagePro,
  onOpenCoach,
  onOpenShieldsHelp,
  onOpenShop,
  onDisconnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  walletShort: string;
  chainId: number | undefined;
  proActive: boolean;
  /** Unix-ms expiry of the active PRO pass. When paired with
   *  `proActive`, drives the "N days left" sub-line under the Manage
   *  PRO row. `null` hides the sub-line — either no PRO or the
   *  server payload omitted the timestamp. */
  proExpiresAt: number | null;
  coachCredits: number;
  onManagePro: () => void;
  onOpenCoach: () => void;
  /** 2026-05-30: open the surface where shields fire (exercises retry).
   *  Lets the user verify "yes, this is where my shields get spent". */
  onOpenShieldsHelp: () => void;
  /** 2026-05-30: open the Shop sheet — used by the Founder row when
   *  the user does not yet own the badge. Owned-state row stays
   *  decorative (status pill only). */
  onOpenShop: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations("ACCOUNT_SHEET_COPY");
  const tPro = useTranslations("PRO_COPY");
  const tAbout = useTranslations("ABOUT_LINK_COPY");
  const proDaysLeft = proActive ? daysRemaining(proExpiresAt, Date.now()) : null;
  const [copied, setCopied] = useState(false);
  // 2026-05-30 (shop oscuridad fix): live inventory reads for the
  // Streak Shields + Founder Badge rows. Both hooks are SSR-safe and
  // re-render on storage changes (shields) / fetch completion (founder).
  const shieldsCount = useShieldsCount();
  const founderOwned = useFounderStatus();

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
        className="sheet-bg-hub rounded-none border-0 h-[100dvh] flex flex-col focus:outline-none focus-visible:outline-none"
      >
        <div className="-mx-6 -mt-6 shrink-0 border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/screen-mission/account-icon" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <div className="mt-3 flex flex-col gap-3">
          {/* Chesito Card — the rechargeable Peones "wallet" hero. Visual-first
           *  spend-economy anchor; its Top up CTA opens the Get Peones rail. */}
          {!CHESSCITO_LITE_MODE && <ChesitoCard />}

          <div className="account-tiles-grid">
            {/* Wallet — tile click copies the full address */}
            <button
              type="button"
              onClick={() => void copyAddress()}
              aria-label={copied ? t("copiedAddress") : t("copyAddress")}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/wallet-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/wallet-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/wallet-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("walletLabel")}</span>
              <span className="account-status-pill" data-tone="celo">
                {copied ? <CandyIcon name="check" className="h-3 w-3" /> : null}
                {copied ? t("copiedAddress") : walletShort}
              </span>
            </button>

            {/* Network — read-only */}
            <div className="account-tile is-static" role="group" aria-label={t("networkLabel")}>
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/network-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/network-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/network-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("networkLabel")}</span>
              <span className="account-status-pill" data-tone="celo">
                <CandyIcon name="check" className="h-3 w-3" />
                {networkName(chainId, t("unknownNetwork"))}
              </span>
            </div>

            {/* Manage PRO — hidden in Lite (no Shop/PRO monetization surface) */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={onManagePro}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/screen-mission/corona-pro.avif" type="image/avif" />
                  <source srcSet="/art/screen-mission/corona-pro.webp" type="image/webp" />
                  <img
                    src="/art/screen-mission/corona-pro.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">
                {proActive ? t("managePro") : t("viewPro")}
              </span>
              <span
                className="account-status-pill"
                data-tone={proActive ? "active" : "inactive"}
              >
                <span aria-hidden="true">★</span>
                {proActive && proDaysLeft != null
                  ? tPro("statusActiveSuffix", { daysLeft: proDaysLeft })
                  : proActive
                    ? t("activePro")
                    : t("inactivePro")}
              </span>
            </button>
            )}

            {/* Coach — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (() => {
              const coachStatusKey = proActive
                ? "coachStatusActive"
                : coachCredits > 0
                  ? "coachStatusFree"
                  : "coachStatusEmpty";
              const coachStatusLabel =
                !proActive && coachCredits > 0
                  ? t("coachStatusFreeWithCount", { count: coachCredits })
                  : t(coachStatusKey);
              const coachTone = proActive
                ? "active"
                : coachCredits > 0
                  ? "celo"
                  : "inactive";
              return (
                <button
                  type="button"
                  onClick={onOpenCoach}
                  aria-label={t("coachRowLabel")}
                  className="account-tile"
                >
                  <span className="account-tile-icon">
                    <picture>
                      <source srcSet="/art/new-icons-chesscito/training.avif" type="image/avif" />
                      <source srcSet="/art/new-icons-chesscito/training.webp" type="image/webp" />
                      <img
                        src="/art/new-icons-chesscito/training.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                    </picture>
                  </span>
                  <span className="account-tile-label">{t("coachRowLabel")}</span>
                  <span className="account-status-pill" data-tone={coachTone}>
                    {coachStatusLabel}
                  </span>
                </button>
              );
            })()}

            {/* Shields — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={onOpenShieldsHelp}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/shop/shield.avif" type="image/avif" />
                  <source srcSet="/art/shop/shield.webp" type="image/webp" />
                  <img
                    src="/art/shop/shield.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("shieldsRowLabel")}</span>
              <span
                className="account-status-pill"
                data-tone={shieldsCount > 0 ? "celo" : "inactive"}
              >
                {shieldsCount > 0
                  ? t("shieldsStatusAvailable", { count: shieldsCount })
                  : t("shieldsStatusEmpty")}
              </span>
            </button>
            )}

            {/* Founder Badge — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={founderOwned ? () => onOpenChange(false) : onOpenShop}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/shop/founder.avif" type="image/avif" />
                  <source srcSet="/art/shop/founder.webp" type="image/webp" />
                  <img
                    src="/art/shop/founder.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("founderRowLabel")}</span>
              <span
                className="account-status-pill"
                data-tone={founderOwned ? "active" : "inactive"}
              >
                {founderOwned ? t("founderStatusOwned") : t("founderStatusNotYet")}
              </span>
            </button>
            )}

            {/* Language — segmented switcher inline at tile base */}
            <div className="account-tile is-static" role="group" aria-label={t("languageLabel")}>
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/language-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/language-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/language-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("languageLabel")}</span>
              <LocaleSwitcher />
            </div>
          </div>

          {/* Disconnect — full-width secondary CTA */}
          <button
            type="button"
            onClick={onDisconnect}
            className="arena-result-secondary-action w-full"
          >
            <CandyIcon name="close" className="mr-2 h-4 w-4" />
            {t("disconnect")}
          </button>

          {/* About Chesscito — ghost link, secondary to Disconnect */}
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center justify-center py-2 text-sm font-bold opacity-50 transition-opacity active:opacity-100"
            style={{ color: "rgba(110,65,15,0.9)", fontFamily: "var(--font-game-display)" }}
          >
            {tAbout("label")}
          </Link>
        </div>
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
  /** B2.3b: content slot discriminator. "daily" and "challenge" bypass
   *  the Lite daily quota banner. Absent/other values → gated in Lite mode. */
  slot?: string;
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
}: ExercisesScreenProps = {}) {
  const isFreeSlot = slot === "daily" || slot === "challenge";
  const tShopItem = useTranslations("SHOP_ITEM_COPY");
  const tCapture = useTranslations("CAPTURE_COPY");
  const tLab = useTranslations("LABYRINTH_COPY");
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
  const { address, isConnected } = useAccount();
  const starsConnectPrompt = useConnectPrompt("stars");
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const { connectWallet } = useConnectWallet();
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
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [submitTxHash, setSubmitTxHash] = useState<string | null>(null);
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
    if (slug === "shop" && !CHESSCITO_LITE_MODE) setActiveDockTab("shop");
    else if (slug === "badges") setActiveDockTab("badge");
    else if (slug === "trophies") setActiveDockTab("trophies");
    else if (slug === "leaderboard") setActiveDockTab("leaderboard");
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
    /** SaveScore off-chain (Slice 5): Peones spent on a paid save. Passed
     *  to the score overlay so the player sees the 1-Peón charge. */
    spentPeones?: number;
    /** SaveScore: free saves remaining after this save (free/duplicate). */
    freeSavesLeft?: number;
    /** Recovery CTA (insufficient Peones → Get Peones). */
    recoveryCta?: { label: string; onPress: () => void };
  } | null>(null);

  // SaveScore off-chain (Slice 5): in-flight flag for the /api/scores/save
  // request. Replaces the wagmi `isScoreWriting`/`isSubmitConfirming` busy
  // signal for the base save path (now off-chain, no tx to confirm).
  const [isSavingScore, setIsSavingScore] = useState(false);
  // Get Peones recovery sheet — opened from the insufficient-save overlay.
  const [getPeonesOpen, setGetPeonesOpen] = useState(false);
  // Season Pass sheet — opened from insufficient-save overlay in Lite mode.
  const [seasonPassSheetOpen, setSeasonPassSheetOpen] = useState(false);

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

  // Phase 2b-2: read the active pools from the catalog context (baseline
  // EXERCISES when no provider is mounted → byte-identical flag-off), so
  // this screen's pool reads agree with the hook's. Phase 2c mounts the
  // provider with merged pools at the /exercises server boundary.
  const catalog = useExerciseCatalog();
  // Labyrinth pools from the same provider, so the screen's labyrinth reads
  // (list, king-gate, training path) agree with the merged catalog under the
  // flag — and stay baseline (byte-identical) when no provider is mounted.
  const labyrinthCatalog = useLabyrinthCatalog();

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
  const score = useMemo(() => BigInt(Math.max(1, totalStars)) * POINTS_PER_STAR, [totalStars]);
  const maxPossibleStars = useMemo(() => getMaxPossibleStars(selectedPiece), [selectedPiece]);

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
  // QA round 2 (2026-06-11): the on-chain SAVE is back (gas-only
  // submitScoreSigned). Address resolution is chain-specific; null →
  // the surface never renders the button (fail-closed, no dead CTA).
  const scoreboardAddress = useMemo(
    () => getScoreboardAddress(chainId),
    [chainId],
  );
  const isClaimBusy = isBadgeWriting || isClaimConfirming;
  const isSubmitBusy = isScoreWriting || isSubmitConfirming || isSavingScore;
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
    onOpenShop: () => {
      // Variante B (red-team approved): preserve phase=failure
      // throughout the shop visit so the modal re-mounts cleanly
      // when the sheet closes — with the freshly-acquired shields
      // now available. Don't resetStreak; opening shop in the
      // middle of a rescue is the player ACTING on their streak,
      // not abandoning it. The display-phase trick below
      // (storeOpen ? "ready" : phase) hides the PhaseFlash overlay
      // while the shop is on-screen so it doesn't sit above the
      // Sheet z-stack.
      autoReset.clear();
      setStoreOpen(true);
    },
  });

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
      // Session-over freeze: once the daily limit is reached the player can
      // keep replaying completed exercises as practice, but no stars are
      // persisted. Read the quota BEFORE recordExtraConsumed below so the
      // attempt that *reaches* the limit (a fresh exercise) still counts.
      const scoringFrozen = shouldFreezeScoring(CHESSCITO_LITE_MODE, getDailySession());
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
        recordExtraConsumed(buildContentId("exercise", selectedPiece, currentExercise.id));
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

      // On last exercise: check if badge is earned (including this completion)
      if (isLastExercise && !isReplay) {
        const exercise = currentExercise;
        const newStars = computeStars(movesCount, exercise.optimalMoves);
        const prevStarValue = progress.stars[exercise.id] ?? 0;
        const starDelta = Math.max(0, newStars - prevStarValue);
        const newTotal = totalStars + starDelta;

        if (newTotal >= BADGE_THRESHOLD && !hasClaimedBadge) {
          setShowBadgeEarned(true);
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
      autoReset.schedule(() => {
        // Local-save feedback (spec P0-2/P0-3): fires here (t=1500ms)
        // AFTER the WELL DONE phase-flash, not at completeExercise time.
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
          handleLabyrinthSelect(pendingLab.id);
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
      }, 1500);
      return;
    }

    // Solo ejercicios de 1 movimiento: el primer click incorrecto = auto-reset
    // Ejercicios multi-movimiento: el jugador sigue navegando libremente
    if (currentExercise.optimalMoves === 1) {
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
        autoReset.schedule(() => handleRetryApplied("auto_reset"), 1500);
      }
      // else: modal handles the dwell; no autoReset.
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
    // SaveScore off-chain (Slice 5): the base save no longer signs
    // (/api/sign-score), never broadcasts `submitScoreSigned`, never
    // prompts approve/send, and never enters the signer 429 loop. It POSTs
    // /api/scores/save (5 free saves per wallet, then 1 Peón) and renders
    // exactly what the server returns. The retained on-chain path lives in
    // @/lib/contracts/scoreboard for the future Leaderboard Proof lane.
    //
    // `canSaveScore` (no badgeEarned requirement) gates the surface; the
    // scoreboard address is no longer a precondition.
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

      switch (result.status) {
        case "saved":
        case "duplicate": {
          hapticSuccess();
          // Local-first save state. Empty txHash: off-chain saves have no
          // receipt, so `savedReceiptUrl` stays undefined (no CeloScan
          // link). Persisting under `selectedPiece` flips the SAVE button
          // to its saved-parity state, same as the on-chain path did.
          recordSaveFor(selectedPiece, scoreNum, "");

          const paid = result.status === "saved" && result.mode === "peones";
          const spentPeones = paid ? result.spent : undefined;
          // Communicate the free-save quota progressively: on a free save
          // (or idempotent duplicate) show how many free saves remain so
          // the wall never arrives as a surprise.
          const freeSavesLeft = paid ? undefined : result.quota.freeRemaining;

          setResultOverlay({ variant: "score", spentPeones, freeSavesLeft });

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
                  setSeasonPassSheetOpen(true);
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
    // Clear the previous tx's hash so a retry after revert shows
    // "Signing…" immediately instead of lingering on "Failed" until the
    // new hash lands (Cluster C SAVE residue defer #1).
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
      // Capture (piece, score, txHash) at broadcast time so the
      // receipt-success effect persists the SUBMITTED score under the
      // CORRECT piece even if the user switches pieces before the
      // receipt arrives.
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

      // Write-through to Supabase (fire-and-forget) — this is what the
      // combined leaderboard reads as the on-chain `scores` source.
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
      setLeaderboardRefreshTrigger((n) => n + 1);
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
        retryAction: () => void handleSaveScoreOnChain(),
      });
      console.warn("[MiniPayTx] error", { label: "submit-score", levelId: Number(levelId), error: message });
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
  const labyrinthList = labyrinthCatalog[selectedPiece] ?? [];
  const activeLabyrinth =
    labyrinthMode && selectedLabyrinthId
      ? labyrinthList.find((lab) => lab.id === selectedLabyrinthId) ?? null
      : null;
  const effectiveLabyrinthMode = activeLabyrinth !== null;
  const activeExercise = activeLabyrinth ?? currentExercise;

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
      catalog: { exercises: catalog, labyrinths: labyrinthCatalog },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, progress, badgesClaimed, labyrinthCompleted, catalog, labyrinthCatalog]);

  /** Always-fresh mirror of the path for callbacks that fire from
   *  timers (success auto-advance) — the 1500ms closure would
   *  otherwise see the pre-completion path where the just-unlocked
   *  labyrinth still reads as locked (QA G1). */
  const trainingPathRef = useRef(trainingPath);
  useEffect(() => {
    trainingPathRef.current = trainingPath;
  }, [trainingPath]);

  /** Slice 3C: enter the labyrinth layer with a specific lab. Defense
   *  in depth — locked nodes are not tappable in the rail, but the
   *  handler validates against the path anyway so a stale tap can
   *  never open a locked lab. Validation reads the ref so timer-fired
   *  callers (QA G1 auto-advance) see post-completion unlocks.
   *  labyrinthKey bump remounts the board so switching labs always
   *  starts clean. */
  const handleLabyrinthSelect = useCallback((labyrinthId: string) => {
    const node = trainingPathRef.current.find(
      (n) => n.kind === "labyrinth" && n.id === labyrinthId,
    );
    if (!node || node.status === "locked") return;
    setSelectedLabyrinthId(labyrinthId);
    setLabyrinthMode(true);
    setLabyrinthCompleted(null);
    setLabyrinthMoves(0);
    setLabyrinthKey((k) => k + 1);
  }, []);

  /** Slice 3D: the path's recommended next challenge (first unlocked,
   *  uncompleted labyrinth). Drives the contextual "Enter Labyrinth"
   *  pin and nothing else — exercise flow is untouched when null. */
  const nextChallenge = getNextChallenge(trainingPath);

  const handleExitLabyrinth = useCallback(() => {
    setLabyrinthMode(false);
    setSelectedLabyrinthId(null);
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
      handleLabyrinthSelect(route.labyrinthId);
    } else {
      setShowPieceComplete(true);
    }
  }

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
      // Session-over freeze: practice replays past the daily limit do not
      // update the recorded best (read quota before recordExtraConsumed below).
      const scoringFrozen = shouldFreezeScoring(CHESSCITO_LITE_MODE, getDailySession());
      // Read previous best BEFORE recording so the overlay can
      // contextualize the new score against the player's history.
      const previousBest = getLabyrinthBest(selectedPiece, activeLabyrinth.id);
      const isNewBest = scoringFrozen
        ? false
        : recordLabyrinthBest(selectedPiece, activeLabyrinth.id, movesCount);
      setLabyrinthCompleted({
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        previousBest,
        isNewBest,
      });

      // B2.3a: track extra content consumption (Lite-only; idempotent).
      if (CHESSCITO_LITE_MODE) {
        recordExtraConsumed(buildContentId("labyrinth", selectedPiece, activeLabyrinth.id));
      }

      track("labyrinth_complete", {
        labyrinth_id: activeLabyrinth.id,
        piece: selectedPiece,
        moves: movesCount,
        optimal: activeLabyrinth.optimalMoves,
        stars,
        is_new_best: isNewBest,
        previous_best: previousBest ?? null,
      });
      // Slice 4: flat +1 Peón on the FIRST completion only
      // (previousBest === null), wallet-connected only. Fire-and-forget
      // like training-earn: the local best + overlay never wait on (or
      // fail with) the ledger write. Guests skip the call entirely.
      if (isConnected && address && previousBest === null) {
        void submitLabyrinthCompletionEarn({
          wallet: address,
          piece: selectedPiece,
          labyrinthId: activeLabyrinth.id,
          bestBefore: previousBest,
        });
      }
    },
    [activeLabyrinth, selectedPiece, isConnected, address],
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
              onClick: () => router.push("/"),
              label: tStatus("backLabel"),
            }}
            trailingControl={
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
                  <picture className="candy-tray-pill-icon candy-tray-pill-icon--floating">
                    <source srcSet="/art/screen-mission/account-icon.avif" type="image/avif" />
                    <source srcSet="/art/screen-mission/account-icon.webp" type="image/webp" />
                    <img
                      src="/art/screen-mission/account-icon.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  </picture>
                  <span>{tStatus("accountChipLabel")}</span>
                </button>
              )
            }
          />
        </div>
        {quotaDisplayState?.isAtLimit && (
          <DailyLimitBanner
            isHardMax={quotaDisplayState.isHardMax}
            onBack={() => router.push("/")}
          />
        )}
        <MissionPanelCandy
          selectedPiece={selectedPiece}
          onOpenPieceSheet={() => setBadgeSheetOpen(true)}
          phase={storeOpen ? "ready" : phase}
          targetLabel={targetLabel}
          pieceHint={pieceHint}
          isCapture={Boolean(currentExercise.isCapture)}
          isDockSheetOpen={activeDockTab !== null}
          labyrinthMode={effectiveLabyrinthMode}
          labyrinthOptimalMoves={activeLabyrinth?.optimalMoves}
          onLabyrinthSelect={handleLabyrinthSelect}
          score={score.toString()}
          totalStars={totalStars}
          maxPossibleStars={maxPossibleStars}
          trainingPath={trainingPath}
          canSaveScore={scorePendingNew}
          onSaveScore={() => void handleSubmitScore()}
          isSavingScore={isSubmitBusy}
          canSaveOnChain={scorePendingNew && scoreboardAddress != null}
          onSaveOnChain={() => void handleSaveScoreOnChain()}
          isSavingOnChain={isScoreWriting || isSubmitConfirming}
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
            // Lite isolation: the hint is a Peones spend, so it never mounts
            // in Chesscito Lite (no Peones surfaces in Lite). Season Pass is
            // the only entitlement and is reachable via the Hub + Lite CTAs.
            activeLabyrinth || phase !== "ready" || CHESSCITO_LITE_MODE ? null : (
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
                    isBusy={
                      a === "submitScore"
                        ? isSavingScore
                        : isBadgeWriting || isClaimConfirming
                    }
                    onSubmitScore={() => void handleSubmitScore()}
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
                  onPress={() => handleLabyrinthSelect(nextChallenge.id)}
                />
              </div>
            ) : (
              <ContextualActionSlot
                action={contextAction}
                shieldsAvailable={shieldCount}
                isBusy={isSavingScore || isBadgeWriting || isClaimConfirming}
                onSubmitScore={() => void handleSubmitScore()}
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
              peonesHint={activeLabyrinth ? null : peonesHintSquare}
            />
          }
          exerciseDrawer={
            <ExerciseDrawer
              open={exerciseDrawerOpen}
              onOpenChange={setExerciseDrawerOpen}
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
              onLabyrinthSelect={handleLabyrinthSelect}
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
              // Slice 3E: only a PENDING labyrinth (unlocked, not yet
              // completed — getNextChallenge semantics) takes the CTA.
              // A fully-completed labyrinth leg falls through to the
              // nextPiece primary. Routes through the path, never the
              // old [0] hardcode.
              nextChallenge
                ? () => {
                    setShowPieceComplete(false);
                    handleLabyrinthSelect(nextChallenge.id);
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
            onContinue={handleLabyrinthContinue}
            onRetry={() => {
              setLabyrinthCompleted(null);
              setLabyrinthKey((k) => k + 1);
              setLabyrinthMoves(0);
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
            itemAsset={selectedItem?.icon}
            txHash={resultOverlay.txHash}
            celoscanHref={resultOverlay.txHash ? txLink(chainId, resultOverlay.txHash) : undefined}
            errorMessage={resultOverlay.errorMessage}
            errorKind={resultOverlay.errorKind}
            txErrorKind={resultOverlay.txErrorKind}
            totalStars={totalStars}
            spentPeones={resultOverlay.spentPeones}
            freeSavesLeft={resultOverlay.freeSavesLeft}
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

        {seasonPassSheetOpen ? (
          <SeasonPassSheet
            open={seasonPassSheetOpen}
            onOpenChange={setSeasonPassSheetOpen}
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
          showTrigger={false}
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
        />
        {!CHESSCITO_LITE_MODE && <ShopSheet
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
        />}
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
        />
      </main>
    </div>
  );
}
