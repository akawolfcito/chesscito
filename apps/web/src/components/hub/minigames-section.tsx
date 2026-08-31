"use client";

import { useTranslations } from "next-intl";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import type { MiniGameEngineId } from "@/lib/minigames/catalog";
import type { FeaturedCardState } from "@/lib/minigames/card-state";
import type { PieceId } from "@/lib/game/types";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

/**
 * Mini-games — the Learn Home surface. FREE Early Access, featured rotation.
 *
 * ⚠️ IT IS A GROUP INSIDE THE LEARN RAIL, NOT A SECTION OF ITS OWN (2026-08-19).
 * It used to be a standalone `<section>` with its own heading and 96×100 cards.
 * Together with the exercise-path row underneath, that cost ~185px and made the
 * home scroll at 360×640 while PLAY — which solves the same problem with a
 * compact rail of 50px tiles — did not. Both surfaces now render as
 * `HubActionTile`s in one rail, separated by a divider, and the rail owns the
 * heading. The SEPARATION did not go away, it moved from "two blocks" to "one
 * rail, two groups": this group keeps its own `role="group"`, its own accessible
 * name and the EARLY ACCESS tag that marks where it begins.
 *
 * PURELY PRESENTATIONAL. No hooks beyond `useTranslations`, no data fetch, no
 * storage, no telemetry: the container hydrates the cards and owns the events,
 * the same contract `HubLiteScaffold` already imposes on itself. That is what
 * lets this mount in a test and in a `/dev` probe without a wallet provider.
 *
 * ⛔ THE PROPS CANNOT EXPRESS A PRICE. There is no `balance`, no `cost`, no
 * `locked` and no purchase callback anywhere in this API, and `FeaturedCardState`
 * has no locked or purchasable member. Wiring a Peones experiment into this
 * surface is therefore a deliberate, reviewable type change — not a prop
 * somebody passed by accident.
 */

export type MiniGamesCard = {
  challengeId: string;
  engineId: MiniGameEngineId;
  piece: PieceId;
  /** The CHALLENGE's authored title — what the tile actually opens. */
  title: string;
  state: FeaturedCardState;
  /** True when this player has never completed it. No storage of its own: it
   *  is the completion set, inverted. */
  isNew: boolean;
};

/** What the container needs to fire `minigame_start`. `entry` is decided HERE,
 *  at the tap, from the state the card actually rendered — so the funnel can
 *  never disagree with what the player saw. */
export type MiniGameStartIntent = {
  challengeId: string;
  engineId: MiniGameEngineId;
  piece: PieceId;
  entry: "featured" | "replay";
};

export type MiniGamesSectionProps = {
  cards: readonly MiniGamesCard[];
  comingSoon: readonly MiniGameEngineId[];
  /** Assigned challenges already completed — the numerator of `n/3 today`. */
  completedToday: number;
  /** Assigned slots this window. Usually 3; smaller only near the pool's end. */
  slotCount: number;
  /**
   * Whole hours until the next replenishment window, or null to show no timer.
   *
   * ⛔ NULL IS A PRODUCT STATE, NOT A LOADING STATE. It is null at `0/3` —
   * nothing has been consumed, so nothing is charging, and a countdown there is
   * the noise that trains people to stop reading this row — and null when the
   * healthy pool is exhausted, because nothing will refill and promising hours
   * for content that does not exist is the one way this row could lie.
   */
  hoursUntilNext: number | null;
  onPlay: (intent: MiniGameStartIntent) => void;
  onViewAll: () => void;
};

/**
 * Per-engine icon slot. ONE SLOT PER GAME, so swapping an icon is a builder
 * edit and never a code edit (founder, 2026-08-19: "con su espacio en el
 * builder para actualizarlos de manera sencilla").
 *
 * ⚠️ The defaults are the PIECE sprites — the piece IS each game's identity
 * (Rook Rail = rook, Pivot Run = bishop, N-Queens = queen), and they are the
 * only art that tells the three tiles apart today. Bespoke mini-game icons are
 * an open art request; when they land, only the slot DEFAULTS in
 * `theme-registry.ts` change and nothing here moves.
 *
 * ⛔ Explicit map, never a template literal: the asset-integrity scan is static
 * and an interpolated path is invisible to it (same convention as
 * `mastery-tile.tsx` and `arena-utils.ts`).
 */
const ENGINE_ICON_SLOT: Record<MiniGameEngineId, ThemeAssetKey> = {
  "rook-rail": "hub.minigame.rook-rail",
  "pivot-run": "hub.minigame.pivot-run",
  "n-queens": "hub.minigame.n-queens",
  "safe-path": "hub.minigame.safe-path",
  "knight-tour": "hub.minigame.knight-tour",
  "promotion-run": "hub.minigame.promotion-run",
};

function ctaKeyFor(state: FeaturedCardState): "play" | "continueLabel" | "playAgain" {
  if (state === "FEATURED_COMPLETED") return "playAgain";
  if (state === "FEATURED_IN_PROGRESS") return "continueLabel";
  return "play";
}

export function MiniGamesSection({
  cards,
  completedToday,
  slotCount,
  hoursUntilNext,
  onPlay,
  onViewAll,
  /* ⛔ `comingSoon` is IN THE TYPE BUT NOT DESTRUCTURED, on purpose. The row
     that rendered it was removed on 2026-08-20; the prop stays so the
     container keeps deriving and passing the roster, and bringing the line
     back is a render change rather than a cross-file one.
     ⚠️ Not an `eslint-disable` either — the first attempt named
     `@typescript-eslint/no-unused-vars`, a rule this project does not
     configure, and `next build` refused to compile ("Definition for rule ...
     was not found"). Simply not naming the binding needs no suppression. */
}: MiniGamesSectionProps) {
  const t = useTranslations("MINIGAMES_COPY");

  // Nothing to show is not an empty group with a tag — it is no group.
  if (cards.length === 0) return null;

  return (
    /* ⛔ A FRAGMENT, NOT A WRAPPER — and the flatness is the whole point.
       While the tiles and the footnote lived inside one column box, that box
       was as wide as its WIDEST child: the footnote (248px) against 170px of
       tiles. The tiles were then centred inside 248px, which opened a 51px dead
       gap between the divider and the first mini-game and pushed the footnote's
       centre 38px off the rail's. Measured, not guessed.
       As siblings, the tile group is exactly as wide as its tiles, the divider
       sits against them, and the footnote centres on the rail. */
    <>
      {/* ⛔ THE DIVIDER IS GONE (2026-08-30), and the comment it replaces is
          worth keeping as history: it travelled with this group so it would
          "exist exactly when there is something to divide, by construction".
          That construction assumed something sat to its LEFT — the Exercises
          tile. Exercises was promoted out of the rail and became the primary
          CTA, so the divider led the rail and separated nothing: the very
          defect (red-team EC-1) the ownership move existed to prevent,
          re-created from the other side.

          ⚠️ If anything is ever placed before this group again, the divider
          comes back WITH that thing, not with this one. */}
      <div
        data-testid="minigames-section"
        data-completed-today={String(completedToday)}
        className="hub-minigames-tiles"
        role="group"
        aria-label={t("sectionAriaLabel")}
      >
        {cards.map((card) => (
          <HubActionTile
            key={card.challengeId}
            className="hub-lite-path-tile"
            testId={`minigame-card-${card.challengeId}`}
            /* State stays READABLE FROM THE DOM after the move onto the tile.
               `data-state` is also what keeps the CTA verdict assertable now
               that the label plate belongs to the game's name. */
            dataAttrs={{
              "data-state": card.state,
              "data-new": String(card.isNew),
              "data-engine": card.engineId,
            }}
            iconSlot={ENGINE_ICON_SLOT[card.engineId]}
            /* ⛔ THE PLATE NAMES THE CHALLENGE, NOT THE ENGINE (2026-08-21).
               It used to read "Rook Rail", which is the GAME FAMILY — and the
               tile opens ONE level of it. A player who cleared "Two Roads" and
               came back to a tile still labelled "Rook Rail" could not tell
               whether it was the same thing. The engine survives as the
               secondary term in the accessible name and as `data-engine`.
               ⚠️ Titles are AUTHORED and vary in length ("Two Roads" vs "Turn
               to the Star"), so the mini-games tiles clamp their label to two lines
               with an ellipsis — the rail's approved 50px geometry is held by
               the CSS, not by hoping content stays short. */
            label={card.title}
            /* The CTA state ("Play" / "Continue" / "Play again") has no caption
               line on a 50px tile. It lives in the accessible name, alongside
               the family, and stays assertable through `data-state`. */
            ariaLabel={`${card.title} — ${t(
              `engines.${card.engineId}` as const,
            )} — ${t(ctaKeyFor(card.state))}`}
            badge={
              card.isNew ? (
                <span className="hub-minigame-tile-flag" aria-hidden="true">
                  {t("newFlag")}
                </span>
              ) : undefined
            }
            onClick={() =>
              onPlay({
                challengeId: card.challengeId,
                engineId: card.engineId,
                piece: card.piece,
                // A completed card is the ONLY replay. An unplayed level of a
                // game the player already knows is still a first start of that
                // challenge — calling it a replay would inflate H1.5.
                entry: card.state === "FEATURED_COMPLETED" ? "replay" : "featured",
              })
            }
          />
        ))}
      </div>

      {/* ⛔ THE FOOTNOTE ROW WAS REMOVED (founder, 2026-08-20: "esa línea
         completa retirarla"). It carried `MINI-GAMES · EARLY ACCESS` and the
         coming-soon roster, and it read as two unrelated notices jammed onto
         one line under the tiles.

         TWO THINGS WENT WITH IT, and both are deliberate, not oversights:
          1. the word "Mini-games" no longer appears on the Learn home at all —
             it survives as this group's accessible name. The DIVIDER is now
             the only visible thing separating the two destinations, which is
             why its presence and position are pinned by a test and by the
             driven smoke.
          2. the EARLY ACCESS framing is off the surface. `MINIGAMES_COPY`
             still holds `earlyAccess`, `comingSoonLabel` and the coming-soon
             props still flow in — nothing was deleted from the API — so
             restoring the label (in the rail heading, say) is a render
             change, not a rebuild.

         `comingSoon` is therefore an ACCEPTED-BUT-UNRENDERED prop on purpose.
         Do not "clean it up": the roster is still derived and still validated,
         and dropping it from the type would make bringing the line back a
         cross-file change. */}

      {/* ⛔ ONE ROW, TWO OBJECTS — separated by FORM, not by words (Sally,
          2026-08-21). `VIEW ALL` stays a pill: bordered, filled, tappable, a
          place to go. The status sits OUTSIDE it as plain text. It used to live
          INSIDE the pill as `VIEW ALL  4/13`, and a number inside a button
          reads as part of what the button does — which is exactly why `4/13`
          was heard as "nine more are available somewhere".

          ⛔ AND THE TOTAL IS GONE FROM THE HOME. `n/13` described a catalogue;
          what a player can act on is `n/3 today`. The tiles themselves already
          say what is playable, so this row carries the only thing they cannot:
          where today ends, and when more arrives. */}
      <div className="hub-minigames-footer">
        <button
          type="button"
          onClick={onViewAll}
          data-testid="minigames-view-all"
          className="hub-minigames-view-all"
          aria-label={t("viewAllAria")}
        >
          {t("viewAll")}
        </button>
        <span
          className="hub-minigames-status"
          data-testid="minigames-status"
          data-hours={hoursUntilNext === null ? "none" : String(hoursUntilNext)}
        >
          <span className="tabular-nums" data-testid="minigames-today">
            {t("todayFormat", { done: completedToday, total: slotCount })}
          </span>
          {hoursUntilNext !== null ? (
            <>
              <span aria-hidden="true" className="hub-minigames-status-dot">
                ·
              </span>
              <span
                className="hub-minigames-refill tabular-nums"
                data-testid="minigames-refill"
                aria-label={t("refillAria", { hours: hoursUntilNext })}
              >
                {t("refillFormat", { hours: hoursUntilNext })}
              </span>
            </>
          ) : null}
        </span>
      </div>

      {/* ⛔ THE ALL-CLEAR SENTENCE WAS DELETED (2026-08-21), not replaced.
          It read "You cleared them all — Featured challenges change from time
          to time", which is now false twice over: there is no global rotation,
          and content does not change "from time to time" for everyone. The
          founder never noticed it in smoke, which is the evidence that prose
          under the rail does no work. The status row above carries the state.
          ⚠️ A future Peones affordance does NOT go here either — Sally's
          placement is the tile group's top-right corner, the slot the NEW flags
          vacate at 3/3. Nothing renders it while monetization is disabled. */}
    </>
  );
}
