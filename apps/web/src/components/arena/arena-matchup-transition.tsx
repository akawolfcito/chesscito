"use client";

import type { Rival } from "@/lib/game/rivals";

export type ArenaMatchupTransitionProps = {
  rivalName: string;
  rivalAvatarSrc: string;
  rivalFrame: Rival["frame"];
  /** Primary line on the player's ribbon — "You" / "Tú". */
  playerLabel: string;
  /** Deterministic nickname (Identity Lite). Undefined until the wallet /
   *  guest identity hydrates; the slot still reserves its height. */
  playerNickname?: string;
  playerAvatarSrc: string;
  getReadyLabel: string;
};

/**
 * Matchup screen shown between PLAY and the board (~1.8s, auto-advancing).
 *
 * The background art already contains the VS crest and the pawn divider, so
 * this component only lays the two ribbons and the "Get ready!" line over it —
 * no VS mark or pawn is drawn here. Art: `/art/arena/bg-matchup.*`.
 *
 * Spec: docs/specs/2026-07-13-arena-matchup-transition-spec.md
 */
export function ArenaMatchupTransition({
  rivalName,
  rivalAvatarSrc,
  rivalFrame,
  playerLabel,
  playerNickname,
  playerAvatarSrc,
  getReadyLabel,
}: ArenaMatchupTransitionProps) {
  return (
    <div className="arena-matchup" data-testid="arena-matchup-transition">
      <div className="arena-matchup-side arena-matchup-side--rival">
        <div className={`arena-matchup-ribbon arena-matchup-ribbon--${rivalFrame}`}>
          <img
            className="arena-matchup-avatar"
            src={rivalAvatarSrc}
            alt={rivalName}
          />
          <div className="arena-matchup-text">
            <p className="arena-matchup-name">{rivalName}</p>
          </div>
        </div>
      </div>

      <div className="arena-matchup-side arena-matchup-side--player">
        <div className="arena-matchup-ribbon arena-matchup-ribbon--player">
          <img
            className="arena-matchup-avatar"
            src={playerAvatarSrc}
            alt={playerNickname ?? playerLabel}
          />
          <div className="arena-matchup-text">
            <p className="arena-matchup-name">{playerLabel}</p>
            {/* Height is reserved even while empty so a late-hydrating
                nickname does not shift the ribbon. */}
            <p
              className="arena-matchup-nickname"
              data-testid="arena-matchup-nickname"
            >
              {playerNickname}
            </p>
          </div>
        </div>
      </div>

      {/* Sits just above the pawn divider baked into the background. */}
      <p className="arena-matchup-getready" role="status">
        {getReadyLabel}
      </p>
    </div>
  );
}
