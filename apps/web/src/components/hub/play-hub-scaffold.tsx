"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppModeSwitch } from "@/components/hub/app-mode-switch";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { LanguageChip } from "@/components/hub/language-chip";
import { KingdomCard } from "@/components/kingdom/kingdom-card";
import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PlayTacticsTile } from "@/components/tactics/play-tactics-tile";
import { hapticTap } from "@/lib/haptics";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ProDisplayState } from "@/lib/pro/use-is-pro-active";

type PlayHubScaffoldProps = {
  mintedVictoryCount: number;
  isWalletConnected: boolean;
  pro: ProDisplayState;
  /** Peones balance, READ BY THE CALLER. The chip used to fetch it itself, which
   *  put a wagmi hook inside this tree and made the scaffold impossible to mount
   *  in a `/dev` probe — so the PLAY hub had zero visual coverage. */
  peones: PeonesBalanceState;
  /** The client-owned Daily trigger. Composition keeps this scaffold free of
   *  wagmi/localStorage hooks and preserves the provider-less `/dev` fixture. */
  dailySlot: ReactNode;
  /** Client-owned Inbox chip. Optional so the `/dev` fixture and every
   *  existing caller keep working without one. Same slot pattern, same
   *  reason: `InboxChip` calls `useAccount()`. */
  inboxSlot?: ReactNode;
  onPeonesRefetch: () => void;
  onConnectTap: () => void;
  onTrophyTap: () => void;
  onProTap: () => void;
  onCoachTap: () => void;
  onShopTap: () => void;
  onArenaPress: () => void;
  onReplayTour?: () => void;
};

/** Temporary product switch. PLAY remains available in PLAY PATH below.
 *  Flip this single value to `true` to restore the standalone CTA without
 *  reconstructing its markup, handler, theme slot or styles. */
/**
 * Standalone primary CTA on the PLAY hub.
 *
 * Turned OFF on 2026-07-26 (`b7840ab4`, "PLAY PATH now owns the Arena entry")
 * without a measurement of the effect. Turned back ON on 2026-08-29 with one:
 * of the 5.643 people who complete the hub tour, **35,4% never start a match**,
 * and 2.321 of the 5.957 who reach this hub (39%) never start one either.
 * With the CTA off, the heaviest object on the screen was the $1.99 PRO
 * banner and the entry to the game was a 64px tile in the floor rail.
 * docs/audits/2026-08-28-core-loop-diagnostic.md §D.
 *
 * ⚠️ This is a hardcoded constant, NOT a feature flag: no env, no config, no
 * remote kill-switch. Flipping it needs a deploy. It is kept as a constant
 * only so the disabled branch stays compile-checked.
 */
const SHOW_STANDALONE_PLAY_CHESS_CTA = true;

/** Play Kingdom home. Mirrors the LEARN/LITE hub's visual system (unified
 *  vocabulary): floating HUD + Kingdom portal + mode switch + Kingdom hero
 *  panel + PLAY PATH square-tile grid.
 *
 *  Pure presentational — caller owns navigation + on-chain state. That claim is
 *  now true: it used to render a Peones chip that read the wallet on its own. */
export function PlayHubScaffold({
  mintedVictoryCount,
  isWalletConnected,
  pro,
  peones,
  dailySlot,
  inboxSlot,
  onPeonesRefetch,
  onConnectTap,
  onTrophyTap,
  onProTap,
  onCoachTap,
  onShopTap,
  onArenaPress,
  onReplayTour,
}: PlayHubScaffoldProps) {
  const tHud = useTranslations("HUD_COPY");
  const tPlay = useTranslations("PLAY_HUB_COPY");

  return (
    <section
      className="hub-scaffold play-hub-scaffold hub-home-scaffold"
      aria-label={tPlay("rootAriaLabel")}
    >
      <header className="hub-scaffold-hud">
        <div className="hub-scaffold-hud-top hub-home-hud">
          <div className="hub-scaffold-hud-left hub-home-hud-left">
            <button
              type="button"
              onClick={onTrophyTap}
              aria-label={tPlay("victoriesAriaLabel", {
                count: mintedVictoryCount,
              })}
              className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
            >
              <CandyIcon name="trophy" className="candy-tray-pill-icon candy-tray-pill-icon--floating" />
              <span>{mintedVictoryCount}</span>
            </button>
            {/* Peones balance + recharge — same universal economy chip as the
                LEARN header. The chip hides itself on a `guest` balance; the
                wallet gate here keeps it out of the tree entirely. */}
            {isWalletConnected ? (
              <PeonesBalanceChipView
                state={peones}
                onRefetch={onPeonesRefetch}
                surface="hub"
                showRecharge
              />
            ) : null}
            <LanguageChip />
            {/* Inbox — 2026-08-29. PLAY never had one: `InboxChip` was mounted
                only in the LEARN hub, so notifications simply did not reach
                anyone in PLAY. The gift icon on the right is NOT the inbox —
                it is the Daily Tactic (`dailySlot`, variant "corner-icon").

                ⛔ A SLOT, not the component, for the same reason as
                `dailySlot`: `InboxChip` calls `useAccount()`, and a wagmi hook
                in this tree throws `WagmiProviderNotFoundError` in every /dev
                probe and scaffold test. Mirrors hub-lite-scaffold.tsx. */}
            {inboxSlot}
          </div>
          <div className="hub-scaffold-hud-right hub-home-hud-right">
            {/* Account entry intentionally omitted here (founder 2026-07-07):
                the PLAY hub keeps the same universal header grammar as LEARN:
                trophy · Peones · language + Daily. PRO discovery/status moved
                into KingdomCard, where its value can be explained. */}
            {!isWalletConnected ? (
              <button
                type="button"
                onClick={onConnectTap}
                aria-label={tHud("connectAriaLabel")}
                className="candy-tray-pill hub-hud-pill"
              >
                <CandyIcon name="wallet" className="candy-tray-pill-icon candy-tray-pill-icon--floating" />
                <span>{tHud("connectLabel")}</span>
              </button>
            ) : null}
            <div className="play-hub-daily-anchor" data-tour-target="daily">
              {dailySlot}
            </div>
          </div>
        </div>
      </header>

      {/* Flat sibling stack — mirrors the LEARN/LITE hub's DOM so both hubs
          share ONE distribution: header · mascot · panel · CTA · shortcuts flow
          as direct children of <main> (no intermediate centered body wrapper). */}

      {/* Title + avatar reuse the EXACT LEARN/LITE mascot (wordmark banner +
          circular gold-ring wizard) so the two hubs share one identity.
          Avatar flips to the PRO variant in lockstep with `pro.active`. */}
      <div className="hub-lite-mascot play-hub-mascot">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture slot="brand.title" pictureClassName="hub-lite-title" alt="Chesscito" sizes="(max-width: 352px) 141px, (max-width: 417px) 40vw, 167px" draggable={false} />
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture slot="hub.avatar-lite" pictureClassName="hub-lite-avatar" alt="" aria-hidden="true" sizes="(max-width: 337px) 101px, (max-width: 377px) 30vw, 113px" draggable={false} />
        <AppModeSwitch activeMode="play" />
      </div>

      {/* Kingdom hero panel — the PRO chip is embedded in an explanatory,
          full-width CTA. Every state opens the same discovery/manage sheet. */}
      <KingdomCard
        pro={pro}
        onProDiscover={onProTap}
        onReplayTour={onReplayTour}
      />

      {SHOW_STANDALONE_PLAY_CHESS_CTA ? (
        /* Temporarily hidden: PLAY PATH now owns the Arena entry. Keeping this
           compile-checked branch makes restoration a one-value product switch. */
        <div className="hub-scaffold-cta-row play-hub-cta-row">
          <button
            type="button"
            className="play-chess-cta"
            data-testid="play-chess-cta"
            aria-label={tPlay("arenaAriaLabel")}
            onClick={() => {
              hapticTap();
              onArenaPress();
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
            <ThemeAssetPicture
              slot="hub.enter-arena"
              pictureClassName="play-chess-cta-icon"
              pictureProps={{ "aria-hidden": true }}
              alt=""
              draggable={false}
            />
            <span>{tPlay("arenaLabel")}</span>
          </button>
        </div>
      ) : null}

      {/* PLAY PATH mirrors the LEARN Training Path: one compact, persistent
          action rail pinned to the floor. DOM and visual order are identical
          (Play → Warm-up → Coach → Shop), preserving keyboard/screen-reader
          navigation while keeping the primary activity first in LTR locales. */}
      <section className="play-hub-path" aria-label={tPlay("playPathLabel")}>
        <h2 className="play-hub-path-label">{tPlay("playPathLabel")}</h2>
        <div className="play-hub-path-grid" aria-label={tPlay("actionsAriaLabel")}>
          <HubActionTile
            className="play-hub-path-tile play-hub-path-tile--primary"
            tourTarget="play"
            iconSlot="hub.enter-arena"
            label={tPlay("playPathPlayLabel")}
            ariaLabel={tPlay("playPathPlayAriaLabel")}
            onClick={() => {
              hapticTap();
              onArenaPress();
            }}
          />
          <PlayTacticsTile className="play-hub-path-tile" />
          {/* No PRO badge: the tile no longer guards a paywall. It opens the
              Journal, which any connected wallet can read. The badge would be
              announcing a wall that isn't there. */}
          <HubActionTile
            className="play-hub-path-tile"
            iconSlot="hub.training"
            label={tPlay("coachLabel")}
            ariaLabel={tHud("coachAriaLabel")}
            onClick={onCoachTap}
          />
          <HubActionTile
            className="play-hub-path-tile"
            iconSlot="hub.shop-icon"
            label={tPlay("shopLabel")}
            ariaLabel={tPlay("shopAriaLabel")}
            onClick={onShopTap}
          />
        </div>
      </section>
    </section>
  );
}
