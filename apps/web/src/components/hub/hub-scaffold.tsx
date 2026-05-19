"use client";

import { HudResourceChip } from "@/components/hud/hud-resource-chip";
import { HudSecondaryRow } from "@/components/hud/hud-secondary-row";
import { KingdomAnchor } from "@/components/kingdom/kingdom-anchor";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { RewardColumn, type RewardTile } from "@/components/kingdom/reward-column";
import { MissionRibbon } from "@/components/pro-mission/mission-ribbon";
import { PremiumSlot } from "@/components/pro-mission/premium-slot";
import { PrimitiveBoundary } from "@/components/error/primitive-boundary";
import { SecondaryCta } from "@/components/hub/secondary-cta";
import { DailyTacticSlot } from "@/components/daily/daily-tactic-slot";
import { MiniArenaBridgeSlot } from "@/components/mini-arena/mini-arena-bridge-slot";
import { StonePedestal } from "@/components/scene-rooted/stone-pedestal";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { HUD_COPY } from "@/lib/content/editorial";

/** Contextual Hero CTA — replaces the legacy PrimaryPlayCta when wired.
 *  `color` drives the visual tint (amber = default/onboarding, blue =
 *  daily-pending). See `lib/hub/hero-cta.ts` for the derivation rules
 *  the integration layer (Task 5.5) uses to compute this value. */
export type HeroCtaProps = {
  label: string;
  sub: string;
  color: "amber" | "blue";
  ariaLabel: string;
  onPress: () => void;
};

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
  /** Optional secondary text-link rendered below `<PrimaryPlayCta>` for
   *  the "alternate destination" affordance (currently: practice pieces
   *  → /exercises). Both fields are required when present, omit the
   *  prop entirely to skip the link. Caller owns navigation. */
  secondaryAction?: {
    label: string;
    ariaLabel: string;
    onPress: () => void;
  };
  /** Tap handlers — caller wires navigation when the flag flips real. */
  onTrophyTap?: () => void;
  onProTap?: () => void;
  /** Coach chip (top row, always visible) — opens session history. */
  onCoachTap?: () => void;
  onCoachProCardCta?: () => void;
  onPremiumTap?: () => void;
  onPlayPress?: () => void;
  /** Secondary-row chip taps. The shields chip is the home for shop
   *  conversion (forwarded to `<HudSecondaryRow onShieldsTap>`). */
  onStreakTap?: () => void;
  onStarsTap?: () => void;
  onShieldsTap?: () => void;
  /** Wallet connect affordance (desktop fallback). When `false` and
   *  `onConnectTap` is wired, a "Connect" chip renders next to the PRO
   *  chip — gives desktop users an explicit path to populate the
   *  trophy / PRO / shields state that depends on `useAccount().address`.
   *  Defaults to `true` so legacy callers keep the original layout. */
  isWalletConnected?: boolean;
  onConnectTap?: () => void;
  showPremiumSlot?: boolean;
  /** Contextual Hero CTA (SPEC 1 D2). When provided, supersedes the
   *  legacy `<PrimaryPlayCta>` hero with a label/sub two-line button
   *  tinted amber (default) or blue (daily-pending). Legacy
   *  `playLabel`/`playAriaLabel`/`onPlayPress` stay supported for
   *  callers that haven't migrated yet. */
  heroCta?: HeroCtaProps;
  /** Secondary CTA "Enter Arena" — calm link below the Hero (SPEC 1 D5).
   *  Renders only when wired so legacy surfaces opt in explicitly. */
  onArenaPress?: () => void;
  /** When true, the Hub right-rail "Special Training" tile becomes
   *  active (K+R vs K mini-arena). Caller derives from rook stars ≥12
   *  so the threshold lives at the source of truth, not the scaffold. */
  miniArenaUnlocked?: boolean;
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
  secondaryAction,
  onTrophyTap,
  onProTap,
  onCoachTap,
  onPremiumTap,
  onPlayPress,
  onStreakTap,
  onStarsTap,
  onShieldsTap,
  isWalletConnected = true,
  onConnectTap,
  showPremiumSlot = false,
  heroCta,
  onArenaPress,
  miniArenaUnlocked = false,
  onError,
}: HubScaffoldProps) {
  const proValue = pro.active
    ? `PRO ${HUD_COPY.proRemainingFormat(pro.daysRemaining)}`
    : null;
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
          {!isWalletConnected && onConnectTap
            ? wrap(
                "HudResourceChip",
                <HudResourceChip
                  tone="default"
                  icon="wallet"
                  value={HUD_COPY.connectLabel}
                  ariaLabel={HUD_COPY.connectAriaLabel}
                  onClick={onConnectTap}
                />,
              )
            : null}
        </div>
        {wrap(
          "HudSecondaryRow",
          <HudSecondaryRow
            streak={streak}
            stars={stars}
            shields={shields}
            onStreakTap={onStreakTap}
            onStarsTap={onStarsTap}
            onShieldsTap={onShieldsTap}
          />,
        )}
      </header>

      <section className="hub-scaffold-body">
        <div className="hub-scaffold-side hub-scaffold-side--left">
          <div className="hub-scaffold-rail-stack">
            <div className="hub-scaffold-rail-header" data-rail="left">
              LEARN
            </div>
            {wrap("RewardColumn", <RewardColumn tiles={rewardTiles} />)}
          </div>
        </div>
        <div className="hub-scaffold-center">
          <div className="hub-scaffold-anchor">
            {wrap("KingdomAnchor", <KingdomAnchor variant="playhub" />)}
          </div>
          <footer className="hub-scaffold-footer">
            {wrap("MissionRibbon", <MissionRibbon surface="hub" />)}
            {secondaryAction ? (
              wrap(
                "PrimaryPlayCta",
                <PrimaryPlayCta
                  surface="playhub"
                  label={secondaryAction.label}
                  ariaLabel={secondaryAction.ariaLabel}
                  onPress={secondaryAction.onPress}
                  pieceIconSrc="/art/new-icons-chesscito/practice-pieces.png"
                  className="hub-scaffold-practice-cta"
                />,
              )
            ) : null}
            <div className="hub-scaffold-guide" aria-hidden="true">
              <picture className="hub-scaffold-guide-piece">
                <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
                <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
                <img src="/art/redesign/pieces/w-pawn.png" alt="" />
              </picture>
              <img
                src="/art/scene-rooted/guide-secuencia.png"
                alt=""
                className="hub-scaffold-guide-sequence"
              />
              <picture className="hub-scaffold-guide-piece">
                <source srcSet="/art/redesign/pieces/w-king.avif" type="image/avif" />
                <source srcSet="/art/redesign/pieces/w-king.webp" type="image/webp" />
                <img src="/art/redesign/pieces/w-king.png" alt="" />
              </picture>
            </div>
            {heroCta ? (
              wrap(
                "HubHeroCta",
                <button
                  type="button"
                  aria-label={heroCta.ariaLabel}
                  onClick={heroCta.onPress}
                  className={`hub-scaffold-hero hub-scaffold-hero--single hub-scaffold-hero--${heroCta.color}`}
                >
                  <span className="hub-scaffold-hero-label">{heroCta.label}</span>
                </button>,
              )
            ) : onPlayPress ? (
              // Legacy Play CTA — only renders when the caller still
              // wires an onPlayPress handler. The redesigned hub-
              // scaffold-client omits it on purpose so the action stack
              // stays single-primary (TRAIN PIECES via `secondaryAction`).
              wrap(
                "PrimaryPlayCta",
                <PrimaryPlayCta
                  surface="playhub"
                  label={playLabel}
                  ariaLabel={playAriaLabel}
                  onPress={onPlayPress}
                  pieceIconSrc="/art/new-icons-chesscito/play-chess.png"
                />,
              )
            ) : null}
            {onArenaPress ? (
              wrap("SecondaryCta", <SecondaryCta onPress={onArenaPress} />)
            ) : null}
          </footer>
        </div>
        <div className="hub-scaffold-side hub-scaffold-side--right">
          {showPremiumSlot ? (
            <>
              <div className="hub-scaffold-rail-header" data-rail="right">
                UNLOCK
              </div>
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
            </>
          ) : null}
          {wrap(
            "HubActionRail",
            <div className="hub-action-rail">
              <DailyTacticSlot />
              <MiniArenaBridgeSlot
                setup={MINI_ARENA_SETUPS[0]}
                unlocked={miniArenaUnlocked}
                renderLocked
              />
              {onCoachTap ? (
                <StonePedestal
                  stone={2}
                  size="large"
                  className="action-row-pedestal hub-action-rail-coach"
                  icon={
                    <img
                      src="/art/new-icons-chesscito/training.png"
                      alt=""
                      aria-hidden="true"
                      className="h-14 w-14 object-contain"
                      draggable={false}
                    />
                  }
                  onClick={onCoachTap}
                  aria-label={HUD_COPY.coachAriaLabel}
                />
              ) : null}
            </div>,
          )}
        </div>
      </section>
    </main>
  );
}
