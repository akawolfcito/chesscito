"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { LanguageChip } from "@/components/hub/language-chip";
import { AppModeSwitch } from "@/components/hub/app-mode-switch";
import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";
import type { RewardTile } from "@/components/kingdom/reward-column";
import { LearnPathEntry } from "@/components/hub/learn-path-entry";
import {
  ChallengeCard,
  type ChallengeCardSeasonPass,
} from "@/components/hub/challenge-card";
import type { ContentLoopAction } from "@/lib/hub/content-loop";
import { toCtaSlotPresentation } from "@/lib/hub/cta-slot";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";
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
  /** Focus Days state, assembled by the container. Told, not derived. */
  progress: ChallengeProgressView;
  /** null when the pass is active (no purchase CTA). */
  onJoinChallenge: (() => void) | null;
  /** The daily affordance, BUILT BY THE CONTAINER (mirrors PlayHubScaffold).
   *  The scaffold owns the anchor — its `data-tour-target` and pending pulse —
   *  but not the tile: `HubDailyTile` calls `useAccount()`, and mounting it
   *  here made the whole scaffold unrenderable without a wagmi provider. */
  dailySlot: ReactNode;
  /** Tapping the flame/streak block opens today's Daily. The container routes
   *  it to the SAME instance it put in `dailySlot`; from here it is only
   *  "not the training CTA". */
  onPassportTap: () => void;
  /** Live shields balance for the card's stat chip. Optional: `/dev` probes
   *  mount the scaffold without a wallet and must not fake a count. */
  shields?: { count: number };
  // ── Start Focus (primary daily action) ──
  primaryFocus: {
    /** Navigates. Receives the slot's destination as an ARGUMENT: the adapter
     *  above owns routing (including the `daily-pending` legacy exception), and
     *  a `() => void` here is how that ownership leaks back down. */
    onPress: (destination: string) => void;
    /** The next-best-action. `null` = pre-hydration → the slot renders a status,
     *  never a button: a button before hydration promises a destination nobody
     *  has computed yet. */
    contentLoop: ContentLoopAction | null;
    isHydrated: boolean;
  };
  /** Mini-games (Early Access), BUILT BY THE CONTAINER. A node rather than
   *  props for the same reason `dailySlot` is one: the container owns the
   *  rotation, the player's bests and the telemetry, and this scaffold must
   *  stay mountable without any of them. Null renders no section at all. */
  miniGamesSlot?: ReactNode;
  /** The Inbox chip, BUILT BY THE CONTAINER. A node for the same reason
   *  `dailySlot` is one: it reads the wallet, and this scaffold must stay
   *  mountable without a wagmi provider. Omitted renders no chip at all. */
  inboxSlot?: ReactNode;
  // ── Exercise path (ONE entry; formerly the horizontal piece roster) ──
  /** Still the roster's array. `LearnPathEntry` reads it only to count how many
   *  pieces are mastered — the tiles' own `onTap` handlers are no longer wired
   *  from this surface, and that is deliberate: six destinations under the
   *  Mini-games rail is what made the home unreadable. */
  rewardTiles: RewardTile[];
  /** Opens the exercise path. The CONTAINER owns where that lands (it resolves
   *  the player's primary piece through the content loop) — this scaffold only
   *  knows "not the Mini-games rail, not the daily". */
  onOpenExercisePath: () => void;
  /** Re-launches the intro mini-tour from the Focus Passport `?`. Optional so
   *  the scaffold still mounts in `/dev` probes that don't wire the tour. */
  onReplayTour?: () => void;
  /** Strip mode for the Focus Passport — see `ChallengeCard.compact`. */
  compactPassport?: boolean;
  /** UTC "YYYY-MM-DD" anchoring the weekly row. Forwarded to `ChallengeCard`,
   *  which defaults to `todayUtc()` when omitted — production omits it.
   *
   *  ⚠️ Fixtures that get SCREENSHOTTED must pin it. Left on the real clock,
   *  the "today" column advances at UTC midnight and every baseline of this
   *  scaffold goes red on its own: that is exactly how the four
   *  `vr18-learn-hub-*` baselines rotted (recorded Aug 8 UTC, read back on
   *  Aug 9 UTC) with no code change behind it. */
  today?: string;
  /** Effective PRO subscriber flag from the global entitlement decision. */
  isPro: boolean;
  /** Opens the account surface. Routes to /exercises?sheet=account (the
   *  account sheet lives there) — the hub has no account sheet of its own. */
  onAccountTap: () => void;
};

/** Chesscito Learn hub presenter — habit-first vertical stack (spec
 *  lite-hub-redesign.md). Single-screen-first at 390px: the Start Focus CTA and
 *  the challenge-card primary CTA stay above the fold (P1-A).
 *
 *  THE SURFACE HIERARCHY, top to bottom and in priority order (2026-08-19):
 *    1. season pass / daily  — the habit
 *    2. Mini-games           — one entry, its own surface
 *    3. Exercises            — one entry, the piece training path
 *  Two destinations, one door each. The six-tile roster that used to close the
 *  page was a third navigation competing with the second; see `LearnPathEntry`.
 *
 *  Composes existing leaves (LanguageChip, HubDailyTile corner-icon,
 *  ChallengeCard, LearnPathEntry) — no data/hooks here; the container hydrates
 *  and passes props. */
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
  progress,
  onJoinChallenge,
  dailySlot,
  onPassportTap,
  shields,
  primaryFocus,
  miniGamesSlot,
  inboxSlot,
  rewardTiles,
  onOpenExercisePath,
  onReplayTour,
  compactPassport = false,
  today,
}: HubLiteScaffoldProps) {
  const t = useTranslations("HUB_LITE_COPY");
  const tHud = useTranslations("HUD_COPY");

  return (
    <section
      className="hub-lite-scaffold hub-home-scaffold"
      aria-label={t("rootAriaLabel")}
    >
      <header className="hub-lite-hud hub-home-hud">
        <div className="hub-lite-hud-left hub-home-hud-left">
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
          {/* Inbox — its OWN chip, next to the status pills. The gift icon on
              the right is the Welcome Package claim (7.101 rows in
              peones_ledger) and is deliberately left alone.

              ⛔ A SLOT, not the component. `InboxChip` calls `useAccount()`, and
              mounting a wagmi hook in this tree is exactly what the note at the
              top of this file forbids: it made every `/dev` probe and every
              scaffold test throw `WagmiProviderNotFoundError`. Same shape as
              `dailySlot` and `miniGamesSlot`, and for the same reason. */}
          {inboxSlot}
        </div>
        <div className="hub-lite-hud-right hub-home-hud-right">
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
            {dailySlot}
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

      {/* No `data-tour-target` here on purpose: the challenge step now lights
          the card's CTA row. A spotlight over the whole panel covered four
          tappable things at once and singled out none of them. */}
      <div className="hub-lite-challenge-anchor">
        <ChallengeCard
          compact={compactPassport}
          focusPassport={focusPassport}
          challenge={challenge}
          seasonPass={seasonPass}
          progress={progress}
          onJoinChallenge={onJoinChallenge}
          shields={shields}
          today={today}
          // Tapping the flame/streak block opens today's Daily, same as the
          // corner gift, through the SAME mounted HubDailyTile — the container
          // owns that instance and wires both. The primary CTA intentionally
          // keeps its piece-specific Exercises route.
          onPassportTap={onPassportTap}
          onFocusTap={primaryFocus.onPress}
          // Hydration — not the variant — decides whether the slot may be a
          // button. `view-progress` fires both when the catalog is genuinely
          // empty and while it is still loading; treating "I don't know yet"
          // and "I know, and there's nothing" alike is what produced a
          // confident button over unloaded data.
          ctaSlot={
            primaryFocus.isHydrated && primaryFocus.contentLoop
              ? toCtaSlotPresentation(primaryFocus.contentLoop)
              : null
          }
          onReplayTour={onReplayTour}
        />
      </div>

      {/* The standalone Start Focus button used to live here. It is HIDDEN for
          now (founder, 2026-07-25): the ChallengeCard's single state-driven CTA
          absorbed its job, and two primary CTAs one above the other made the
          panel ambiguous. `primaryFocus.onPress` remains on the card CTA; the
          flame block intentionally opens Daily. The props stay in the API so
          restoring the standalone button is a revert, not a rewrite. */}

      {/* ── THE LEARN RAIL ────────────────────────────────────────────────
          ONE row of shortcut tiles, mirroring PLAY's `.play-hub-path` down to
          the component (`HubActionTile`). Two passes got here:

          1. the 6-piece roster left, because six destinations under the
             Mini-games rail read as a competing navigation;
          2. its full-width replacement row left too — right hierarchy, wrong
             FORM. Row + mini-game cards cost ~185px and the home scrolled at
             360×640, while PLAY solved the same problem in ~85px and did not
             (founder, 2026-08-19: "mira como PLAY sí lo resuelve bien").

          ⛔ ONE RAIL IS NOT ONE SURFACE. The divider and the EARLY ACCESS tag
          are load-bearing: they are what keeps "Exercises" and "Mini-games"
          legible as two destinations after they stopped being two blocks.
          Removing either collapses the separation this whole pass exists to
          create — and it would collapse it invisibly, because the tiles would
          still all work. */}
      <section
        className="hub-lite-path-rail"
        aria-label={t("pathRailAriaLabel")}
      >
        <h2 className="hub-lite-path-rail-label">{t("pathRailLabel")}</h2>
        <div className="hub-lite-path-rail-grid">
          <LearnPathEntry
            tiles={rewardTiles}
            isHydrated={primaryFocus.isHydrated}
            onOpen={onOpenExercisePath}
          />
          {/* ⛔ THE DIVIDER IS NOT DRAWN HERE, and that is the fix for red-team
              EC-1. It used to be `{miniGamesSlot ? <divider/> : null}` — but the
              container always passes `<MiniGamesSlot />`, and a React ELEMENT is
              truthy even when the component returns `null`, which it does on
              every first paint (bests hydrate in a mount effect) and forever if
              a rotation resolves no cards. Measured: `divider=RENDERED
              minigameTiles=0` — a separator with nothing to separate.
              The mini-games group now brings its own leading divider, so the
              line cannot outlive the thing it divides. */}
          {miniGamesSlot}
        </div>
      </section>

    </section>
  );
}
