"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { LanguageChip } from "@/components/hub/language-chip";
import { HubDailyTile } from "@/components/hub/hub-daily-tile";
import { AppModeSwitch } from "@/components/hub/app-mode-switch";
import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";
import { RewardColumn, type RewardTile } from "@/components/kingdom/reward-column";
import {
  ChallengeCard,
  type ChallengeCardSeasonPass,
} from "@/components/hub/challenge-card";
import type { ContentLoopAction } from "@/lib/hub/content-loop";
import type {
  HubFocusPassport,
  SeasonChallengeMeta,
} from "@/components/hub/use-hub-data";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

export type HubLiteScaffoldProps = {
  // ── HUD ──
  trophies: number;
  isWalletConnected: boolean;
  /** Peones balance, READ BY THE CONTAINER. The chip used to fetch it itself,
   *  which smuggled a wagmi hook into this "no hooks here" tree and made the
   *  scaffold impossible to mount in a `/dev` probe. */
  peones: PeonesBalanceState;
  onPeonesRefetch: () => void;
  /** null when already connected (Connect chip hides). */
  onConnectTap: (() => void) | null;
  onTrophyTap: () => void;
  // ── 21-Day Mind Challenge card ──
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: ChallengeCardSeasonPass;
  /** null when the pass is active (no purchase CTA). */
  onJoinChallenge: (() => void) | null;
  // ── Start Focus (primary daily action) ──
  primaryFocus: {
    onPress: () => void;
    /** Drives the label intent (P1-C). null = pre-hydration → safe default. */
    contentLoop: ContentLoopAction | null;
    isHydrated: boolean;
  };
  // ── Training Path (horizontal piece roster) ──
  rewardTiles: RewardTile[];
  /** Re-launches the intro mini-tour from the Focus Passport `?`. Optional so
   *  the scaffold still mounts in `/dev` probes that don't wire the tour. */
  onReplayTour?: () => void;
  /** Effective PRO subscriber flag from the global entitlement decision. */
  isPro: boolean;
  /** Opens the account surface. Routes to /exercises?sheet=account (the
   *  account sheet lives there) — the hub has no account sheet of its own. */
  onAccountTap: () => void;
};

/** Chesscito Learn hub presenter — habit-first vertical stack (spec
 *  lite-hub-redesign.md). Single-screen-first at 390px: the Start Focus CTA and
 *  the challenge-card primary CTA stay above the fold (P1-A); the Training Path
 *  is secondary and may sit at/just below it. Composes existing leaves
 *  (LanguageChip, HubDailyTile corner-icon, KingdomAnchor, RewardColumn,
 *  ChallengeCard) — no data/hooks here; the container hydrates and passes props. */
export function HubLiteScaffold({
  trophies,
  isWalletConnected,
  peones,
  onPeonesRefetch,
  onConnectTap,
  onTrophyTap,
  focusPassport,
  challenge,
  seasonPass,
  onJoinChallenge,
  primaryFocus,
  rewardTiles,
  onReplayTour,
}: HubLiteScaffoldProps) {
  const t = useTranslations("HUB_LITE_COPY");
  const tHud = useTranslations("HUD_COPY");

  // Start Focus always reads "Start Focus" (founder: stable label, not the
  // per-variant intent). It still routes to /exercises in every state.
  const startFocusLabel = t("startFocus");

  return (
    <main className="hub-lite-scaffold" aria-label={t("rootAriaLabel")}>
      <header className="hub-lite-hud">
        <div className="hub-lite-hud-left">
          <button
            type="button"
            onClick={onTrophyTap}
            aria-label={tHud("trophiesAriaLabel", { count: trophies })}
            className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
          >
            <CandyIcon
              name="trophy"
              className="candy-tray-pill-icon candy-tray-pill-icon--floating"
            />
            <span>{trophies}</span>
          </button>
          {/* Peones balance + recharge rail (self-contained: taps open the
              Chesito Card → Get Peones). The green "+" advertises recharge.
              Left cluster = status pills (trophy · Peones · language), matching
              the PLAY/FULL header grammar. Hidden for guests by the chip. */}
          {isWalletConnected ? (
            <PeonesBalanceChipView
              state={peones}
              onRefetch={onPeonesRefetch}
              surface="hub"
              showRecharge
            />
          ) : null}
          <LanguageChip />
        </div>
        <div className="hub-lite-hud-right">
          {/* Account entry (circular avatar chip) is intentionally hidden on
              the Learn hub header — account access lives on /exercises.
              `onAccountTap`/`isPro` stay in the props API for the container
              but are not rendered here. */}
          {!isWalletConnected && onConnectTap ? (
            <button
              type="button"
              onClick={onConnectTap}
              aria-label={tHud("connectAriaLabel")}
              className="candy-tray-pill hub-hud-pill"
            >
              <CandyIcon
                name="wallet"
                className="candy-tray-pill-icon candy-tray-pill-icon--floating"
              />
              <span>{tHud("connectLabel")}</span>
            </button>
          ) : null}
          {/* Daily gift = corner-icon trigger (P1-B); opens the same daily sheet.
              `data-tour-target` is what the Hub Tour measures its spotlight
              against — the wrapper, not the tile, so the ring survives the
              tile swapping its own root between variants.

              The pulse is the tour's last word: once it ends, nothing else on
              the hub points at the daily, and the tour no longer spends a step
              on Start Focus. It runs only while the daily is actually pending —
              a solved daily that keeps pulsing is a nag, not a cue. */}
          <div
            className={`hub-lite-daily-anchor${
              !focusPassport.isLoading && !focusPassport.todayDone
                ? " is-pending"
                : ""
            }`}
            data-tour-target="daily"
          >
            <HubDailyTile variant="corner-icon" />
          </div>
        </div>
      </header>

      <div className="hub-lite-mascot">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture
          slot="brand.title"
          pictureClassName="hub-lite-title"
          alt="Chesscito"
          sizes="(max-width: 352px) 141px, (max-width: 417px) 40vw, 167px"
          draggable={false}
        />
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture
          slot="hub.avatar-lite"
          pictureClassName="hub-lite-avatar"
          alt=""
          aria-hidden="true"
          sizes="(max-width: 337px) 101px, (max-width: 377px) 30vw, 113px"
          draggable={false}
        />
        <AppModeSwitch activeMode="learn" />
      </div>

      <div className="hub-lite-challenge-anchor" data-tour-target="challenge">
        <ChallengeCard
          focusPassport={focusPassport}
          challenge={challenge}
          seasonPass={seasonPass}
          onJoinChallenge={onJoinChallenge}
          // Tapping the flame/streak block routes into today's focus, same as
          // Start Focus (ritual entry point — UX spec §5 clickability).
          onFocusTap={primaryFocus.onPress}
          onReplayTour={onReplayTour}
        />
      </div>

      <div className="hub-lite-start-focus-wrap">
        <button
          type="button"
          className="hub-lite-start-focus"
          data-testid="start-focus-cta"
          aria-label={t("startFocusAriaLabel")}
          onClick={primaryFocus.onPress}
        >
          {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
          <ThemeAssetPicture
            slot="hub.train-pieces"
            pictureClassName="hub-lite-start-focus-icon"
            pictureProps={{ "aria-hidden": true }}
            alt=""
            width={64}
            height={64}
            draggable={false}
          />
          {startFocusLabel}
        </button>
        <ThemeAssetPicture
          slot="brand.ring-start-focus"
          pictureClassName="hub-lite-start-focus-ring"
          pictureProps={{ "aria-hidden": true }}
          alt=""
          width={512}
          height={260}
          fetchPriority="high"
          draggable={false}
        />
      </div>

      <section className="hub-lite-training-path" aria-label={t("trainingPathLabel")}>
        <h2 className="hub-lite-training-path-label">{t("trainingPathLabel")}</h2>
        <RewardColumn
          tiles={rewardTiles}
          className="hub-lite-training-path-tiles"
          compact
        />
      </section>
    </main>
  );
}
