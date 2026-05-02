"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { PIECE_IMAGES, PIECE_LABELS } from "@/lib/content/editorial";
import { THEME_CONFIG } from "@/lib/theme";

type PieceKey = keyof typeof PIECE_LABELS;

type Props = {
  /** Currently selected piece — drives the icon shown inside the trigger. */
  selectedPiece: PieceKey;
  /** Fires when the user wants to open the piece picker. The parent owns
   *  the open state of <PiecePickerSheet>. */
  onClick: () => void;
};

/**
 * Compact "switch piece" trigger that lives in the trailing slot of
 * <ContextualHeader variant="title-control">. The piece label is owned
 * by the header's `title` slot, so this button only carries the
 * iconographic affordance: piece sprite + down chevron.
 */
export function PiecePickerTrigger({ selectedPiece, onClick }: Props) {
  const src = PIECE_IMAGES[selectedPiece];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch piece (current: ${PIECE_LABELS[selectedPiece]})`}
      aria-haspopup="dialog"
      className="flex min-h-[44px] items-center gap-1 rounded-full border px-2 py-1 transition-all active:scale-[0.97]"
      style={{
        background: "rgba(255, 245, 215, 0.55)",
        borderColor: "rgba(110, 65, 15, 0.28)",
        boxShadow:
          "inset 0 1px 0 rgba(255, 245, 215, 0.65), 0 1px 3px rgba(120, 65, 5, 0.18)",
      }}
    >
      <picture className="h-6 w-6 shrink-0">
        {THEME_CONFIG.hasOptimizedFormats && (
          <>
            <source srcSet={`${src}.avif`} type="image/avif" />
            <source srcSet={`${src}.webp`} type="image/webp" />
          </>
        )}
        <img
          src={`${src}.png`}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </picture>
      <CandyIcon
        name="chevron-down"
        className="h-3.5 w-3.5"
        style={{ color: "rgba(63, 34, 8, 0.95)" }}
      />
    </button>
  );
}
