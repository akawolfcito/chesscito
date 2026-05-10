"use client";

import { HUB_V2_MASTERY_COPY } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";

/** Hub V2 mastery dashboard tile primitive (design-lock §1.3 + §9.3).
 *
 *  4 visual states:
 *    - mastered        → ★★★ + golden glow (CSS hook: is-mastered)
 *    - in-progress     → partial stars + sub "n/total"
 *    - locked-buildable → no stars, dim filter (CSS hook: is-locked-buildable)
 *    - coming-soon     → "Coming soon" sub + wax-seal SVG overlay (Q/K only)
 *
 *  This commit ships the JSX/contract only; CSS palette + golden-glow filter
 *  + dim filter + wax-seal styling land in Phase 7 alongside the atmosphere
 *  shift work (P0-4 contrast gate). The tile is testable today via the
 *  `data-state` + `data-piece` + class-name hooks.
 *
 *  Telemetry is emitted by the parent `<MasteryDashboard>`, not here — keeps
 *  the primitive cohesive and side-effect-free per design-lock §6.4. */

export type MasteryState =
  | "mastered"
  | "in-progress"
  | "locked-buildable"
  | "coming-soon";

export type MasteryTileProps = {
  piece: PieceId;
  state: MasteryState;
  starsEarned: number;
  starsTotal: number;
  onTap: () => void;
  testId?: string;
  claimed?: boolean;
};

const STATE_CLASS: Record<MasteryState, string> = {
  mastered: "is-mastered",
  "in-progress": "is-in-progress",
  "locked-buildable": "is-locked-buildable",
  "coming-soon": "is-coming-soon",
};

/** Per-piece asset paths declared as literals so `asset-integrity.test.ts`
 *  can statically verify each path exists in `/public/art/pieces/`.
 *  Template-string interpolation breaks the integrity scan; convention
 *  in this repo is the explicit Record<PieceId, string> map (see
 *  `lib/game/arena-utils.ts` for the same pattern). */
const PIECE_ART: Record<PieceId, string> = {
  rook: "/art/pieces/w-rook.webp",
  bishop: "/art/pieces/w-bishop.webp",
  knight: "/art/pieces/w-knight.webp",
  pawn: "/art/pieces/w-pawn.webp",
  queen: "/art/pieces/w-queen.webp",
  king: "/art/pieces/w-king.webp",
};

export function MasteryTile({
  piece,
  state,
  starsEarned,
  starsTotal,
  onTap,
  testId,
  claimed,
}: MasteryTileProps) {
  const copy = HUB_V2_MASTERY_COPY[piece];
  const ariaLabel = copy.ariaLabel(state, starsEarned, starsTotal);

  return (
    <button
      type="button"
      data-testid={testId}
      data-component="mastery-tile"
      data-piece={piece}
      data-state={state}
      data-claimed={claimed === undefined ? undefined : String(claimed)}
      className={`mastery-tile ${STATE_CLASS[state]}`}
      aria-label={ariaLabel}
      onClick={onTap}
    >
      <img
        src={PIECE_ART[piece]}
        alt=""
        aria-hidden="true"
        className="mastery-tile-piece"
        width={48}
        height={48}
      />
      <span className="mastery-tile-label">{copy.label}</span>
      {state === "mastered" ? (
        <span
          data-testid="mastery-stars"
          data-stars-earned={starsEarned}
          data-stars-total={starsTotal}
          className="mastery-tile-stars"
        >
          {copy.subMastered}
        </span>
      ) : null}
      {state === "in-progress" ? (
        <>
          <span
            data-testid="mastery-stars"
            data-stars-earned={starsEarned}
            data-stars-total={starsTotal}
            className="mastery-tile-stars"
            aria-hidden="true"
          >
            {"★".repeat(Math.max(0, starsEarned))}
            {"·".repeat(Math.max(0, starsTotal - starsEarned))}
          </span>
          <span data-testid="mastery-sub" className="mastery-tile-sub">
            {copy.subInProgress(starsEarned, starsTotal)}
          </span>
        </>
      ) : null}
      {state === "locked-buildable" ? (
        <span data-testid="mastery-sub" className="mastery-tile-sub">
          {copy.subLocked}
        </span>
      ) : null}
      {state === "coming-soon" ? (
        <>
          <span data-testid="mastery-sub" className="mastery-tile-sub">
            {copy.subComingSoon}
          </span>
          {/* Wax-seal stamp placeholder — final SVG art lands in Phase 7
           *  (design-lock §3.2 wax-seal-pro.svg, ≤2 KB). */}
          <svg
            data-testid="mastery-wax-seal"
            className="mastery-tile-wax-seal"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.5" />
          </svg>
        </>
      ) : null}
    </button>
  );
}
