"use client";

import { useTranslations } from "next-intl";
import { AppModeSwitch } from "@/components/hub/app-mode-switch";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { LanguageChip } from "@/components/hub/language-chip";
import { KingdomAnchor } from "@/components/kingdom/kingdom-anchor";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PlayTacticsTile } from "@/components/tactics/play-tactics-tile";

type PlayHubScaffoldProps = {
  mintedVictoryCount: number;
  isWalletConnected: boolean;
  pro: { active: true; daysRemaining: number } | { active: false };
  onConnectTap: () => void;
  onTrophyTap: () => void;
  onProTap: () => void;
  onCoachTap: () => void;
  onShopTap: () => void;
  onArenaPress: () => void;
};

/** Competitive Play home. Tactics is a Play-owned warm-up; Enter Arena remains
 * the only dominant CTA and no Learn/Daily primitives are mounted. */
export function PlayHubScaffold({
  mintedVictoryCount,
  isWalletConnected,
  pro,
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
              {/* <span className="play-hub-victories-label">{tPlay("victoriesLabel")}</span> */}
            </button>
            <LanguageChip />
          </div>
          <div className="hub-scaffold-hud-right">
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

      <section className="play-hub-body">
        <div className="play-hub-portal">
          <KingdomAnchor variant="playhub" showTagline={false} />
          <AppModeSwitch activeMode="play" />
        </div>
        <div className="play-hub-secondary-actions" aria-label={tPlay("actionsAriaLabel")}>
          <PlayTacticsTile />
          <HubActionTile
            className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
            iconSrc="/art/redesign/icons/coach.png"
            label={tPlay("coachLabel")}
            ariaLabel={tHud("coachAriaLabel")}
            onClick={onCoachTap}
            badge={<span className="play-hub-action-badge">PRO</span>}
          />
          <HubActionTile
            className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
            iconSrc="/art/redesign/icons/shop.png"
            label={tPlay("shopLabel")}
            ariaLabel={tPlay("shopAriaLabel")}
            onClick={onShopTap}
          />
        </div>
      </section>

      <footer className="hub-scaffold-footer play-hub-footer mt-3">
        <div className="hub-scaffold-cta-row">
          <PrimaryPlayCta
            surface="playhub"
            label={tPlay("arenaLabel")}
            ariaLabel={tPlay("arenaAriaLabel")}
            onPress={onArenaPress}
            className="hub-scaffold-arena-cta play-hub-arena-cta"
            pieceIconSrc="/art/hub/enter-arena.png"
          />
        </div>
      </footer>
    </main>
  );
}
