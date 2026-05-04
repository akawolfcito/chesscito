"use client";

import { HudResourceChip } from "@/components/hud/hud-resource-chip";
import { HudSecondaryRow } from "@/components/hud/hud-secondary-row";
import { KingdomAnchor } from "@/components/kingdom/kingdom-anchor";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { RewardColumn, type RewardTile } from "@/components/kingdom/reward-column";
import { MissionRibbon } from "@/components/pro-mission/mission-ribbon";
import { PremiumSlot } from "@/components/pro-mission/premium-slot";
import { PrimitiveBoundary } from "@/components/error/primitive-boundary";
import { HUD_COPY } from "@/lib/content/editorial";

type HubScaffoldProps = {
  /** Trophies count rendered on the primary HUD chip. */
  trophies: number;
  /** PRO state. When active, the chip renders the days-remaining value;
   *  when inactive the chip collapses (parent decides to show a secondary
   *  PRO entry — e.g. <PremiumSlot inactive>). */
  pro: { active: true; daysRemaining: number } | { active: false };
  /** Optional secondary HUD row content. Each field is independently
   *  optional and the row collapses when all are null. */
  streak?: number | null;
  stars?: { current: number; total: number } | null;
  shields?: number | null;
  /** Reward column tiles — up to 3 visible, overflow indicator otherwise. */
  rewardTiles: RewardTile[];
  /** Premium slot inactive CTA label (prop-driven per Path A canon, Story 1.7). */
  premiumInactiveLabel: string;
  /** Premium slot active kicker (e.g. "Training Pass"). Prop-driven (Path A). */
  premiumKicker: string;
  /** Premium slot active progress format (uses → "Sessions: 3/12"). */
  premiumProgressFormat: (used: number, total: number) => string;
  /** Premium slot aria-label. */
  premiumAriaLabel: string;
  /** When PRO is active, the consumed/total session counts for the progress bar. */
  premiumUsed?: number;
  premiumTotal?: number;
  /** Primary CTA prop-driven label + aria. */
  playLabel: string;
  playAriaLabel: string;
  /** Tap handlers — caller wires navigation when the flag flips real. */
  onTrophyTap?: () => void;
  onProTap?: () => void;
  onPremiumTap?: () => void;
  onPlayPress?: () => void;
  onError?: (
    context: import("@/components/error/primitive-boundary").PrimitiveBoundaryErrorContext,
  ) => void;
};

const SURFACE = "play-hub";
const ATMOSPHERE = "adventure";

/** Game Home redesign Hub composition. Renders the 3-zone "floating HUD"
 *  layout: HUD top + Kingdom Anchor center (with reward column left and
 *  premium slot right) + mission ribbon + dominant PLAY CTA. Each
 *  primitive is wrapped in a `<PrimitiveBoundary>` so a single primitive
 *  crash does not blank the surface. Pure presentational — caller owns
 *  navigation, telemetry, and on-chain state.
 *
 *  Behind the `?hub=new` flag during the migration window. See Story 1.12
 *  (`_bmad-output/planning-artifacts/epics.md`). */
export function HubScaffold({
  trophies,
  pro,
  streak = null,
  stars = null,
  shields = null,
  rewardTiles,
  premiumInactiveLabel,
  premiumKicker,
  premiumProgressFormat,
  premiumAriaLabel,
  premiumUsed = 0,
  premiumTotal = 0,
  playLabel,
  playAriaLabel,
  onTrophyTap,
  onProTap,
  onPremiumTap,
  onPlayPress,
  onError,
}: HubScaffoldProps) {
  const proValue = pro.active ? HUD_COPY.proRemainingFormat(pro.daysRemaining) : null;
  const proAriaLabel = pro.active
    ? HUD_COPY.proAriaLabel(pro.daysRemaining)
    : HUD_COPY.proInactiveAriaLabel;

  const wrap = (primitiveName: string, children: React.ReactNode) => (
    <PrimitiveBoundary
      primitiveName={primitiveName}
      surface={SURFACE}
      atmosphere={ATMOSPHERE}
      onError={onError}
    >
      {children}
    </PrimitiveBoundary>
  );

  return (
    <main
      className="hub-scaffold"
      aria-label="Chesscito Hub"
    >
      <header className="hub-scaffold-hud">
        <div className="hub-scaffold-hud-top">
          {wrap(
            "HudResourceChip",
            <HudResourceChip
              tone="trophy"
              value={trophies}
              ariaLabel={HUD_COPY.trophiesAriaLabel(trophies)}
              onClick={onTrophyTap}
            />,
          )}
          {wrap(
            "HudResourceChip",
            <HudResourceChip
              tone="pro"
              value={proValue}
              ariaLabel={proAriaLabel}
              onClick={onProTap}
            />,
          )}
        </div>
        {wrap(
          "HudSecondaryRow",
          <HudSecondaryRow streak={streak} stars={stars} shields={shields} />,
        )}
      </header>

      <section className="hub-scaffold-body">
        <div className="hub-scaffold-side hub-scaffold-side--left">
          {wrap("RewardColumn", <RewardColumn tiles={rewardTiles} />)}
        </div>
        <div className="hub-scaffold-anchor">
          {wrap("KingdomAnchor", <KingdomAnchor variant="playhub" />)}
        </div>
        <div className="hub-scaffold-side hub-scaffold-side--right">
          {wrap(
            "PremiumSlot",
            <PremiumSlot
              active={pro.active}
              daysRemaining={pro.active ? pro.daysRemaining : undefined}
              usedSessions={premiumUsed}
              totalSessions={premiumTotal}
              kicker={premiumKicker}
              inactiveCtaLabel={premiumInactiveLabel}
              progressFormat={premiumProgressFormat}
              ariaLabel={premiumAriaLabel}
              onTap={onPremiumTap}
            />,
          )}
        </div>
      </section>

      <footer className="hub-scaffold-footer">
        {wrap("MissionRibbon", <MissionRibbon surface="hub" />)}
        {wrap(
          "PrimaryPlayCta",
          <PrimaryPlayCta
            surface="playhub"
            label={playLabel}
            ariaLabel={playAriaLabel}
            onPress={onPlayPress}
          />,
        )}
      </footer>
    </main>
  );
}
