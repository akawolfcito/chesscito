"use client";

/**
 * The promotion picker — Promotion Run's second mechanic.
 *
 * ⚠️ This is NOT chrome. P5 killed auto-queen (reversing D7) precisely so this
 * choice exists: the mission names a piece, and picking it is the lesson.
 *
 * What the lesson IS, though, changed (founder, 2026-07-16). P4 said promotion
 * teaches the VALUE CHAIN — queen 9, rook 5, bishop/knight 3. But a player here
 * has not learned to play a knight yet, so "crown a knight and you mate" is a
 * sentence they cannot evaluate; obeying it teaches obedience. At this stage the
 * lesson is simpler and truer: **a pawn that crosses the board summons the piece
 * you choose**. The mission makes that concrete by naming one. The numbers come
 * back when a level earns them.
 *
 * So the picker states the mission plainly rather than hiding it — the founder's
 * explicit condition for a wrong pick costing anything at all. Failing a choice
 * the player was never told is a gotcha, not a lesson.
 *
 * It reports the pick and judges nothing: the host owns the consequence.
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §3.3 (P3/P5),
 * §4 stage 10.
 */

import { useTranslations } from "next-intl";
import { PROMOTABLE_PIECES } from "@/lib/game/promotion-run";
import { hapticTap } from "@/lib/haptics";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { pieceThemeSlot } from "@/lib/themes/piece-theme-assets";
import type { PieceId } from "@/lib/game/types";

export function PromotionPicker({
  promoteTo,
  onPick,
}: {
  /** The piece the mission asks for. Named on screen — never hidden. */
  promoteTo: PieceId;
  /** The piece the player chose, right or wrong. The picker does not compare
   *  them; the host decides what a wrong crown costs. */
  onPick: (piece: PieceId) => void;
}) {
  const t = useTranslations("PROMOTION_RUN_COPY.picker");
  const tPiece = useTranslations("PIECE_LABELS");

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300"
      aria-modal="true"
      role="dialog"
      aria-labelledby="promotion-picker-mission"
      data-testid="pr-picker"
    >
      {/* No scrim dismiss, and no close button: a pawn on the last rank MUST
          become something. "Not now" is not a state chess has. */}
      <div className="relative mx-4 w-full max-w-[340px] rounded-2xl border border-amber-300/50 bg-amber-100/95 px-4 py-4 text-[#3f2208] animate-in zoom-in-95 duration-300">
        <div className="text-center text-sm font-semibold">{t("title")}</div>
        <div
          id="promotion-picker-mission"
          data-testid="pr-picker-mission"
          className="mt-1 text-center text-base font-bold"
        >
          {t("mission", { piece: tPiece(promoteTo) })}
        </div>
        <div className="mt-1 text-center text-xs opacity-80">{t("hint")}</div>

        {/* All four, always — see the docblock. The asked piece is NOT visually
            pre-picked: highlighting it would answer the question for the
            player, the same call the boards make about the watched squares. */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PROMOTABLE_PIECES.map((piece) => (
            <button
              key={piece}
              type="button"
              data-testid={`pr-picker-option-${piece}`}
              aria-label={tPiece(piece)}
              onClick={() => {
                hapticTap();
                onPick(piece);
              }}
              className="flex flex-col items-center gap-1 rounded-xl border border-amber-400/60 bg-amber-50 px-1 py-2 active:scale-95"
            >
              <ThemeAssetPicture slot={pieceThemeSlot("w", piece)} alt="" className="w-full max-w-[44px]" />
              <span className="text-[10px] font-semibold leading-none">
                {tPiece(piece)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
