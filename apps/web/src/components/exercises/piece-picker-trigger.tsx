'use client'

import { useTranslations } from 'next-intl'

import { PIECE_LABELS } from '@/lib/content/editorial'
import { ThemeAssetPicture } from '@/components/themes/theme-asset-picture'
import { pieceThemeSlot } from '@/lib/themes/piece-theme-assets'

type PieceKey = keyof typeof PIECE_LABELS

type Props = {
  /** Currently selected piece — drives the icon shown inside the trigger. */
  selectedPiece: PieceKey
  /** Fires when the user wants to open the piece picker. The parent owns
   *  the open state of <PiecePickerSheet>. */
  onClick: () => void
  /** Optional compact label for larger integrated header slots. */
  showLabel?: boolean
  /** How far this piece is toward its badge. Renders the same corner chip the
   *  hub tile shows, so the player recognises it instead of learning it.
   *
   *  ⚠️ A FLOATING chip, not more text inside the pill: the pill's own label
   *  already renders `min-w-0 truncate` in a row competing with the
   *  stars/shield/streak/peones pills, so as those numbers grow the piece NAME
   *  is what gives way. Adding the count inside would hand it to the same
   *  squeeze. Omitted → no chip. */
  progress?: { completed: number; required: number }
}

/**
 * Compact "switch piece" trigger that lives in the trailing slot of
 * <ContextualHeader variant="title-control">. The piece label is owned
 * by the header's `title` slot, so this button only carries the
 * iconographic affordance: piece sprite + down chevron.
 */
export function PiecePickerTrigger({
  selectedPiece,
  onClick,
  showLabel = false,
  progress,
}: Props) {
  const tPiece = useTranslations('PIECE_LABELS')
  const tRail = useTranslations('PIECE_RAIL_COPY')
  const tProgress = useTranslations('REWARD_PROGRESS_COPY')
  const pieceLabel = tPiece(selectedPiece)
  // The chip is aria-hidden, so the count has to reach assistive tech here or
  // not at all. Same shared message the hub tile uses.
  const ariaLabel = progress
    ? tProgress('ariaLabel', {
        piece: pieceLabel,
        completed: progress.completed,
        required: progress.required,
      })
    : tRail('triggerAriaFormat', { piece: pieceLabel })
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={
        showLabel
          ? 'candy-tray-pill min-h-[36px] piece-picker-trigger'
          : 'flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-[0.97] piece-picker-trigger'
      }
      style={
        showLabel
          ? undefined
          : {
              background: 'rgba(255, 245, 215, 0.55)',
              borderColor: 'rgba(110, 65, 15, 0.28)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 245, 215, 0.65), 0 1px 3px rgba(120, 65, 5, 0.18)',
            }
      }
    >
      <ThemeAssetPicture
        slot={pieceThemeSlot('w', selectedPiece)}
        pictureClassName={
          showLabel
            ? 'candy-tray-pill-icon candy-tray-pill-icon--floating'
            : 'h-5 w-5 shrink-0'
        }
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
      />
      {showLabel && (
        <span
          className="min-w-0 truncate text-sm font-extrabold"
          style={{
            color: 'rgba(63, 34, 8, 0.92)',
            textShadow: '0 1px 0 rgba(255, 245, 215, 0.75)',
          }}
        >
          {pieceLabel}
        </span>
      )}
      {showLabel && (
        <span aria-hidden="true" className="candy-tray-pill-caret">
          ▾
        </span>
      )}
      {progress ? (
        <span
          aria-hidden="true"
          data-testid="piece-picker-progress"
          className="progress-count-chip piece-picker-progress"
        >
          {progress.completed}/{progress.required}
        </span>
      ) : null}
    </button>
  )
}
