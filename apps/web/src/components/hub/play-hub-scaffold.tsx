"use client";

import { useTranslations } from "next-intl";
import { AppModeSwitch } from "@/components/hub/app-mode-switch";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { LanguageChip } from "@/components/hub/language-chip";
import { KingdomCard } from "@/components/kingdom/kingdom-card";
import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PlayTacticsTile } from "@/components/tactics/play-tactics-tile";
import { hapticTap } from "@/lib/haptics";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

type PlayHubScaffoldProps = {
  mintedVictoryCount: number;
  isWalletConnected: boolean;
  pro: { active: true; daysRemaining: number } | { active: false };
  /** Peones balance, READ BY THE CALLER. The chip used to fetch it itself, which
   *  put a wagmi hook inside this tree and made the scaffold impossible to mount
   *  in a `/dev` probe — so the PLAY hub had zero visual coverage. */
  peones: PeonesBalanceState;
  onPeonesRefetch: () => void;
  onConnectTap: () => void;
  onTrophyTap: () => void;
  onProTap: () => void;
  onCoachTap: () => void;
  onShopTap: () => void;
  onArenaPress: () => void;
};

/** Play Kingdom home. Mirrors the LEARN/LITE hub's visual system (unified
 *  vocabulary): floating HUD + Kingdom portal + mode switch + Kingdom hero
 *  panel + dominant Play Chess CTA + CHESS TOOLS square-tile grid.
 *
 *  Pure presentational — caller owns navigation + on-chain state. That claim is
 *  now true: it used to render a Peones chip that read the wallet on its own. */
export function PlayHubScaffold({
  mintedVictoryCount,
  isWalletConnected,
  pro,
  peones,
  onPeonesRefetch,
  onConnectTap,
  onTrophyTap,
  onProTap,
  onCoachTap,
  onShopTap,
  onArenaPress,
}: PlayHubScaffoldProps) {
  const tHud = useTranslations("HUD_COPY");
  const tRail = useTranslations("HUB_ACTION_RAIL_COPY");
  const tPlay = useTranslations("PLAY_HUB_COPY");
  const proAriaLabel = pro.active
    ? tHud("proAriaLabel", { days: pro.daysRemaining })
    : tHud("proInactiveAriaLabel");

  return (
    <main className="hub-scaffold play-hub-scaffold" aria-label={tPlay("rootAriaLabel")}>
      <header className="hub-scaffold-hud">
        <div className="hub-scaffold-hud-top">
          <div className="hub-scaffold-hud-left">
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
          </div>
          <div className="hub-scaffold-hud-right">
            {/* Account entry intentionally omitted here (founder 2026-07-07):
                the PLAY hub keeps only trophy·Peones·language + PRO badge. The
                account surface is reachable from /arena instead. */}
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
            <HubProBadge
              active={pro.active}
              daysRemaining={pro.active ? pro.daysRemaining : undefined}
              daysLabel={
                pro.active
                  ? tHud("proRemainingFormat", { days: pro.daysRemaining })
                  : undefined
              }
              sublineInactive={tRail("proDiscoverySubtitle")}
              ariaLabel={proAriaLabel}
              onClick={onProTap}
            />
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
        <ThemeAssetPicture slot="brand.title" pictureClassName="hub-lite-title" alt="Chesscito" width={512} height={249} responsiveWidths={[288, 384]} sizes="(max-width: 352px) 141px, (max-width: 417px) 40vw, 167px" draggable={false} />
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture slot="hub.avatar-lite" pictureClassName="hub-lite-avatar" alt="" aria-hidden="true" width={499} height={560} responsiveWidths={[224, 340]} sizes="(max-width: 337px) 101px, (max-width: 377px) 30vw, 113px" draggable={false} />
        <AppModeSwitch activeMode="play" />
      </div>

      {/* Kingdom hero panel — one panel, PRO chip is the only per-state
          difference. The non-PRO chip opens the PRO sheet (onProTap). */}
      <KingdomCard pro={pro} onProDiscover={onProTap} />

      {/* Dominant CTA — occupies the Start Focus slot of the LEARN/LITE hub.
          A 1:1 blue clone of that button's geometry (`.play-chess-cta` mirrors
          `.hub-lite-start-focus`), keeping the crossed-swords icon. */}
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

      {/* CHESS TOOLS — reuses the LEARN training-path square-tile visual
          (HubActionTile already mirrors .reward-tile). Tactics stays
          self-contained; Coach/Shop are prop-driven. Pinned to the floor
          (margin-top:auto) like the LEARN Training Path. */}
      <section className="play-hub-tools" aria-label={tPlay("chessToolsLabel")}>
        <h2 className="play-hub-tools-label">{tPlay("chessToolsLabel")}</h2>
        <div className="play-hub-tools-grid" aria-label={tPlay("actionsAriaLabel")}>
          <PlayTacticsTile className="" />
          {/* No PRO badge: the tile no longer guards a paywall. It opens the
              Journal, which any connected wallet can read. The badge would be
              announcing a wall that isn't there. */}
          <HubActionTile
            iconSlot="hub.training"
            label={tPlay("coachLabel")}
            ariaLabel={tHud("coachAriaLabel")}
            onClick={onCoachTap}
          />
          <HubActionTile
            iconSlot="hub.shop-icon"
            label={tPlay("shopLabel")}
            ariaLabel={tPlay("shopAriaLabel")}
            onClick={onShopTap}
          />
        </div>
      </section>
    </main>
  );
}
