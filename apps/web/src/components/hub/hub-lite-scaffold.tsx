"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { LanguageChip } from "@/components/hub/language-chip";
import { HubDailyTile } from "@/components/hub/hub-daily-tile";
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

export type HubLiteScaffoldProps = {
  // ── HUD ──
  trophies: number;
  isWalletConnected: boolean;
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
};

/** Chesscito Lite hub presenter — habit-first vertical stack (spec
 *  lite-hub-redesign.md). Single-screen-first at 390px: the Start Focus CTA and
 *  the challenge-card primary CTA stay above the fold (P1-A); the Training Path
 *  is secondary and may sit at/just below it. Composes existing leaves
 *  (LanguageChip, HubDailyTile corner-icon, KingdomAnchor, RewardColumn,
 *  ChallengeCard) — no data/hooks here; the container hydrates and passes props. */
export function HubLiteScaffold({
  trophies,
  isWalletConnected,
  onConnectTap,
  onTrophyTap,
  focusPassport,
  challenge,
  seasonPass,
  onJoinChallenge,
  primaryFocus,
  rewardTiles,
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
          <LanguageChip />
        </div>
        <div className="hub-lite-hud-right">
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
          {/* Daily gift = corner-icon trigger (P1-B); opens the same daily sheet. */}
          <HubDailyTile variant="corner-icon" />
        </div>
      </header>

      <div className="hub-lite-mascot">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <picture className="hub-lite-title">
          <source srcSet="/art/title-chesscito.avif" type="image/avif" />
          <source srcSet="/art/title-chesscito.webp" type="image/webp" />
          <img src="/art/title-chesscito.png" alt="Chesscito" draggable={false} />
        </picture>
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <picture className="hub-lite-avatar">
          <source srcSet="/art/avatar-lite-hub.avif" type="image/avif" />
          <source srcSet="/art/avatar-lite-hub.webp" type="image/webp" />
          <img src="/art/avatar-lite-hub.png" alt="" aria-hidden="true" draggable={false} />
        </picture>
      </div>

      <ChallengeCard
        focusPassport={focusPassport}
        challenge={challenge}
        seasonPass={seasonPass}
        onJoinChallenge={onJoinChallenge}
      />

      {/* Start Focus framed by the gold ring: the wrap carries the ring at its
          native aspect (no stretch) and the button fits the inner opening. */}
      <div className="hub-lite-start-focus-wrap">
        <button
          type="button"
          className="hub-lite-start-focus"
          data-testid="start-focus-cta"
          aria-label={t("startFocusAriaLabel")}
          onClick={primaryFocus.onPress}
        >
          {startFocusLabel}
        </button>
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
