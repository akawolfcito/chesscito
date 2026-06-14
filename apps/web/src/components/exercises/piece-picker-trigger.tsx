'use client'

import { useTranslations } from 'next-intl'

import { PIECE_IMAGES, PIECE_LABELS } from '@/lib/content/editorial'
import { THEME_CONFIG } from '@/lib/theme'

type PieceKey = keyof typeof PIECE_LABELS

type Props = {
  /** Currently selected piece — drives the icon shown inside the trigger. */
  selectedPiece: PieceKey
  /** Fires when the user wants to open the piece picker. The parent owns
   *  the open state of <PiecePickerSheet>. */
  onClick: () => void
  /** Optional compact label for larger integrated header slots. */
  showLabel?: boolean
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
}: Props) {
  const tPiece = useTranslations('PIECE_LABELS')
  const tRail = useTranslations('PIECE_RAIL_COPY')
  const src = PIECE_IMAGES[selectedPiece]
  const pieceLabel = tPiece(selectedPiece)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tRail('triggerAriaFormat', { piece: pieceLabel })}
      aria-haspopup="dialog"
      className={
        showLabel
          ? 'candy-tray-pill'
          : 'flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-[0.97]'
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
      <picture
        className={
          showLabel
            ? 'candy-tray-pill-icon candy-tray-pill-icon--floating'
            : 'h-5 w-5 shrink-0'
        }
      >
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
    </button>
  )
}
