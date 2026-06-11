"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { HudSecondaryRow } from "@/components/hud/hud-secondary-row";
import { KingdomAnchor } from "@/components/kingdom/kingdom-anchor";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { RewardColumn, type RewardTile } from "@/components/kingdom/reward-column";
import { MissionRibbon } from "@/components/pro-mission/mission-ribbon";
import { PremiumSlot } from "@/components/pro-mission/premium-slot";
import { PrimitiveBoundary } from "@/components/error/primitive-boundary";
import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubTileStatusChip } from "@/components/hub/hub-tile-status-chip";
import { LanguageChip } from "@/components/hub/language-chip";
import { HubArenaTile } from "@/components/hub/hub-arena-tile";
import { HubDailyTile } from "@/components/hub/hub-daily-tile";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { PeonesBalanceChip } from "@/components/peones/peones-balance-chip";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";

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
  /** PRO right-rail tile — opens the PRO sheet (same canonical surface
   *  as the HUD chip and `?initialSheet=pro` deep-link). Surfaces the
   *  subscription affordance from "moment 0" without a banner. */
  onProTilePress?: () => void;
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
  onProTilePress,
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
  const tHud = useTranslations("HUD_COPY");
  const tRail = useTranslations("HUB_ACTION_RAIL_COPY");
  const tSecondary = useTranslations("SECONDARY_CTA_COPY");
  const tScaffold = useTranslations("HUB_SCAFFOLD_COPY");
  const tRailLabels = useTranslations("HUB_RAIL_COPY");
  const proAriaLabel = pro.active
    ? tHud("proAriaLabel", { days: pro.daysRemaining })
    : tHud("proInactiveAriaLabel");

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
      aria-label={tScaffold("rootAriaLabel")}
    >
      <header className="hub-scaffold-hud">
        <div className="hub-scaffold-hud-top">
          <div className="hub-scaffold-hud-left">
            <button
              type="button"
              onClick={onTrophyTap}
              aria-label={tHud("trophiesAriaLabel", { count: trophies })}
              className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
            >
              <CandyIcon name="trophy" className="candy-tray-pill-icon candy-tray-pill-icon--floating" />
              <span>{trophies}</span>
            </button>
            {/* Sprint 3 commit G — Peones balance chip. Self-gates on
             *  useAccount(): renders null for guests, the canonical
             *  chip family for connected wallets. NO spend, NO top-up,
             *  read-only surface backed by /api/peones/balance. */}
            {wrap("PeonesBalanceChip", <PeonesBalanceChip />)}
            {/* Language chip (founder 2026-06-11): flag + locale code,
             *  tap → confirm card to switch EN ↔ ES. */}
            {wrap("LanguageChip", <LanguageChip />)}
          </div>
          <div className="hub-scaffold-hud-right">
            {!isWalletConnected && onConnectTap ? (
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
            {wrap(
              "HubProBadge",
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
              />,
            )}
          </div>
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
              {tRailLabels("learnLabel")}
            </div>
            {wrap("RewardColumn", <RewardColumn tiles={rewardTiles} compact />)}
          </div>
        </div>
        <div className="hub-scaffold-center">
          <div className="hub-scaffold-anchor">
            {wrap("KingdomAnchor", <KingdomAnchor variant="playhub" />)}
          </div>
          <div className="hub-scaffold-center-stack">
            {wrap("MissionRibbon", <MissionRibbon surface="hub" />)}
            <div className="hub-scaffold-guide" aria-hidden="true">
              <picture className="hub-scaffold-guide-piece">
                <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
                <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
                <img src="/art/redesign/pieces/w-pawn.png" alt="" />
              </picture>
              <picture className="hub-scaffold-guide-sequence">
                <source srcSet="/art/scene-rooted/guide-secuencia.avif" type="image/avif" />
                <source srcSet="/art/scene-rooted/guide-secuencia.webp" type="image/webp" />
                <img src="/art/scene-rooted/guide-secuencia.png" alt="" />
              </picture>
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
          </div>
        </div>
        <div className="hub-scaffold-side hub-scaffold-side--right">
          {showPremiumSlot ? (
            <>
              <div className="hub-scaffold-rail-header" data-rail="right">
                {tRailLabels("unlockLabel")}
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
          {/* HubProDiscoveryPanel removed 2026-05-24 — the PRO entry
           *  point now lives in the top-right HUD as <HubProBadge>.
           *  See hub-scaffold-hud-right cluster above. */}
          {wrap(
            "HubActionRail",
            <div className="hub-action-rail">
              <HubDailyTile />
              <HubArenaTile
                setup={MINI_ARENA_SETUPS[0]}
                unlocked={miniArenaUnlocked}
              />
              {onCoachTap ? (
                <HubActionTile
                  iconSrc="/art/new-icons-chesscito/training.png"
                  label={tRail("coachLabel")}
                  ariaLabel={tHud("coachAriaLabel")}
                  onClick={onCoachTap}
                  // Static signal only (founder micro-block
                  // 2026-06-11): Coach is not a daily — PRO members
                  // see their membership, everyone else a calm "Ask".
                  // Never auto-triggers analysis (gate untouched).
                  badge={
                    <HubTileStatusChip
                      kind="label"
                      text={pro.active ? "PRO" : "Ask"}
                    />
                  }
                />
              ) : null}
            </div>,
          )}
        </div>
      </section>

      <footer className="hub-scaffold-footer">
        {secondaryAction || onArenaPress ? (
          <div className="hub-scaffold-cta-row">
            {secondaryAction
              ? wrap(
                  "PrimaryPlayCta",
                  <div className="hub-scaffold-practice-cta-wrap">
                    <PrimaryPlayCta
                      surface="playhub"
                      label={secondaryAction.label}
                      ariaLabel={secondaryAction.ariaLabel}
                      onPress={secondaryAction.onPress}
                      className="hub-scaffold-practice-cta"
                      pieceIconSrc="/art/hub/train-pieces.png"
                    />
                    <span
                      className="hub-scaffold-start-here-ribbon"
                      aria-hidden="true"
                    >
                      {tScaffold("startHereLabel")}
                    </span>
                  </div>,
                )
              : null}
            {secondaryAction && onArenaPress ? (
              <svg
                className="hub-scaffold-cta-chevron"
                viewBox="0 0 24 36"
                aria-hidden="true"
                focusable="false"
              >
                <polyline
                  points="8,6 18,18 8,30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            {onArenaPress
              ? wrap(
                  "ArenaCta",
                  <PrimaryPlayCta
                    surface="playhub"
                    label={tSecondary("arena.label")}
                    ariaLabel={tSecondary("arena.ariaLabel")}
                    onPress={onArenaPress}
                    className="hub-scaffold-arena-cta"
                    pieceIconSrc="/art/hub/enter-arena.png"
                  />,
                )
              : null}
          </div>
        ) : null}
      </footer>
    </main>
  );
}
