'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { HudResourceChip } from '@/components/hud/hud-resource-chip'
import {
  HUD_COPY,
  LABYRINTH_COPY,
  MISSION_BRIEFING_COPY,
  PHASE_FLASH_COPY,
  PIECE_LABELS,
} from '@/lib/content/editorial'
import { LottieAnimation } from '@/components/ui/lottie-animation'
import { PiecePickerSheet } from '@/components/exercises/piece-picker-sheet'
import { PiecePickerTrigger } from '@/components/exercises/piece-picker-trigger'
import { MissionDetailSheet } from '@/components/exercises/mission-detail-sheet'

type PieceOption = {
  key: 'rook' | 'bishop' | 'knight' | 'pawn' | 'queen' | 'king'
  label: string
  enabled: boolean
}

type MissionPanelProps = {
  selectedPiece: PieceOption['key']
  onSelectPiece: (piece: PieceOption['key']) => void
  pieces: readonly PieceOption[]
  phase: 'ready' | 'success' | 'failure'
  targetLabel: string
  score: string
  timeMs: string
  board: ReactNode
  exerciseDrawer: ReactNode
  isReplay: boolean
  contextualAction: ReactNode
  persistentDock: ReactNode
  pieceHint?: string
  isCapture?: boolean
  /** Live retry-shield count from `readDisplayedShields()`. Rendered
   *  by the persistent shield-chip row inserted between the
   *  mission-detail row and the optional L2 toggle. Pass `0` when
   *  the player has no shields — the chip stays mounted to mirror
   *  /hub canon and avoid layout jumps when the count transitions
   *  0↔1. */
  shieldCount: number
  /** Total stars earned on the current piece (0–15). Feeds the
   *  mission-detail journey rail so the user sees how close they are
   *  to claiming the badge. */
  currentStars: number
  /** On-chain badge claim status per piece. Feeds the journey rail
   *  unlock/locked tiers. */
  claimedBadges: Partial<Record<PieceOption['key'], boolean>>
  /** Signal from the parent that a dock destination sheet is open.
   *  When true, we close piece-picker and mission-detail so the user
   *  never sees a picker stacked behind a badge/shop/leaderboard
   *  sheet. */
  isDockSheetOpen: boolean
  /** L2 layer toggle. Visible only when labyrinthAvailable. Lets the
   *  player switch between L1 exercises and L2 labyrinths inline. */
  labyrinthAvailable?: boolean
  labyrinthMode?: boolean
  labyrinthOptimalMoves?: number
  onToggleLabyrinth?: (next: boolean) => void
  /** Optional slot rendered between the chip row and the board.
   *  Used by the Hub to surface the Daily Tactic card without
   *  pulling daily-feature concerns into this presentational
   *  component. */
  headerSlot?: ReactNode
  /** Optional flanking slots rendered next to the contextual action
   *  pin. Used for compact entry points (Daily Tactic mini, Mini-Arena
   *  bridge) that shouldn't push the board down. */
  actionRowLeft?: ReactNode
  actionRowRight?: ReactNode
}

type FlashConfig = { text: string; accent: string; stroke: string }

/* Warm-amber on grass reads better than emerald or rose. The stroke
   is the darkest paper-text brown so the glyph silhouette stays
   crisp against any background (forest, paper, etc.). */
const PHASE_FLASH: Record<MissionPanelProps['phase'], FlashConfig | null> = {
  ready: null,
  success: {
    text: PHASE_FLASH_COPY.success,
    accent: 'rgb(245, 158, 11)', // amber-500
    stroke: 'rgba(63, 34, 8, 0.95)', // darkest paper text
  },
  failure: {
    text: PHASE_FLASH_COPY.failure,
    accent: 'rgb(244, 63, 94)', // rose-500
    stroke: 'rgba(63, 34, 8, 0.95)',
  },
}

function PhaseFlash({ phase }: { phase: MissionPanelProps['phase'] }) {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const flash = PHASE_FLASH[phase]

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      setFading(false)
      return
    }

    setVisible(true)
    setFading(false)

    const fadeTimer = setTimeout(() => setFading(true), 600)
    const hideTimer = setTimeout(() => setVisible(false), 950)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [phase, flash])

  if (!visible || !flash) return null

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-2 animate-in zoom-in-90 duration-300">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {phase === 'success' && (
            <div className="pointer-events-none absolute inset-0">
              <LottieAnimation
                src="/animations/sparkle-burst.lottie"
                loop={false}
                className="h-full w-full"
              />
            </div>
          )}
          {/* Soft warm halo behind the mascot — gives the figure mass
              without competing with the sparkle burst on success. */}
          <div
            className="pointer-events-none absolute h-28 w-28 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 80%)',
            }}
          />
          <picture className="relative z-10">
            <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
            <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-24 w-24 drop-shadow-[0_4px_14px_rgba(120,65,5,0.55)]"
              style={{
                animation:
                  'reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            />
          </picture>
        </div>
        <span
          /* Stroke (via -webkit-text-stroke) gives the glyphs a crisp
             dark outline so the warm-amber fill pops against any
             backdrop. text-shadow adds a soft cream halo for depth. */
          className="fantasy-title victory-text-slam text-5xl font-extrabold leading-none"
          style={{
            color: flash.accent,
            WebkitTextStroke: `2px ${flash.stroke}`,
            textShadow:
              '0 2px 0 rgba(255, 245, 215, 0.85), 0 4px 10px rgba(120, 65, 5, 0.40)',
            paintOrder: 'stroke fill',
          }}
        >
          {flash.text}
        </span>
      </div>
    </div>
  )
}

export function MissionPanelCandy({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  targetLabel,
  score,
  timeMs,
  board,
  exerciseDrawer,
  contextualAction,
  persistentDock,
  isCapture = false,
  currentStars,
  claimedBadges,
  isDockSheetOpen,
  labyrinthAvailable = false,
  labyrinthMode = false,
  labyrinthOptimalMoves,
  onToggleLabyrinth,
  headerSlot,
  actionRowLeft,
  actionRowRight,
  shieldCount,
  pieceHint,
}: MissionPanelProps) {
  // Quick-picker (Type C) open state — owned here so we can auto-close
  // them when the parent signals a dock destination sheet is opening.
  const [piecePickerOpen, setPiecePickerOpen] = useState(false)
  const [missionDetailOpen, setMissionDetailOpen] = useState(false)

  useEffect(() => {
    if (isDockSheetOpen) {
      setPiecePickerOpen(false)
      setMissionDetailOpen(false)
    }
  }, [isDockSheetOpen])

  /* Candy-palette chip class — replaces the legacy var(--surface-c-mid)
     dark navy background that was leftover from the pre-candy era.
     Warm cream paper bg + warm-brown text + soft amber border so the
     header reads as part of the same family as the candy modals,
     dock sheets, and the toggle pill below. */
  const candyChipTextStyle = {
    color: 'rgba(63, 34, 8, 0.95)',
    textShadow: '0 1px 0 rgba(255, 245, 215, 0.65)',
  } as const

  const visibleMissionLabel =
    labyrinthMode && labyrinthOptimalMoves
      ? String(labyrinthOptimalMoves)
      : isCapture
      ? 'Capture'
      : `${MISSION_BRIEFING_COPY.targetPrefix.replace(':', '')} ${targetLabel}`
  const missionAriaLabel =
    labyrinthMode && labyrinthOptimalMoves
      ? `Open mission details — optimal path ${labyrinthOptimalMoves} moves`
      : `Open mission details${
          isCapture ? ' — capture target' : ` — target ${targetLabel}`
        }`
  const showLayerTabs = Boolean(onToggleLabyrinth)

  const missionPeek = (
    <button
      type="button"
      className="quest-tray-slot flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-1.5 text-center transition-all active:scale-[0.97]"
      aria-label={missionAriaLabel}
    >
      <CandyIcon name="crosshair" className="h-3.5 w-3.5 shrink-0" />
      <span
        key={targetLabel}
        className="truncate text-sm font-extrabold"
        style={candyChipTextStyle}
      >
        {visibleMissionLabel}
      </span>
    </button>
  )

  return (
    // GlobalStatusBar (Z1) lives above this section in <main>'s flex
    // column; this shell consumes the remaining height instead of
    // owning 100dvh, otherwise Z1 + 100dvh would push the dock past
    // the viewport. See spec docs/specs/ui/global-status-bar-spec-2026-05-02.md
    // §10 canary plan.
    <section className="mission-shell mission-shell-candy atmosphere flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Paper/wood quest tray. Sally read: a single diegetic control
          tray, not four unrelated floating chips. Built with CSS and
          existing chess sprites. */}
      <div className="mt-1 px-3 py-2.5">
        <div className="grid grid-cols-[minmax(0,1.06fr)_minmax(0,0.96fr)_minmax(0,0.5fr)] gap-1">
          <PiecePickerTrigger
            selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
            onClick={() => setPiecePickerOpen(true)}
            showLabel
          />
          <MissionDetailSheet
            open={missionDetailOpen}
            onOpenChange={setMissionDetailOpen}
            selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
            targetLabel={targetLabel}
            isCapture={isCapture}
            score={score}
            timeMs={timeMs}
            currentStars={currentStars}
            claimedBadges={claimedBadges}
            trigger={missionPeek}
          />
          <div className="min-w-0">{exerciseDrawer}</div>
        </div>

        {showLayerTabs && onToggleLabyrinth && (
          <div className="mt-2 flex justify-center">
            <div
              className="quest-tray-tabs grid w-full grid-cols-2 overflow-hidden rounded-2xl border p-0.5"
              role="tablist"
              aria-label="Layer toggle"
            >
              {[
                {
                  active: !labyrinthMode,
                  value: false,
                  label: LABYRINTH_COPY.toggleExercises,
                  disabled: false,
                },
                {
                  active: labyrinthMode,
                  value: true,
                  label: LABYRINTH_COPY.toggleLabyrinths,
                  disabled: !labyrinthAvailable,
                },
              ].map(({ active, value, label, disabled }) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => onToggleLabyrinth(value)}
                  className={[
                    'rounded-[0.9rem] px-2 py-2 transition-all active:scale-[0.97]',
                    'fantasy-title text-[0.72rem] font-extrabold uppercase tracking-[0.08em]',
                    active
                      ? 'shadow-[inset_0_1px_0_rgba(255,248,216,0.72),0_1px_3px_rgba(126,76,20,0.22)]'
                      : '',
                    disabled ? 'cursor-not-allowed opacity-55' : '',
                  ].join(' ')}
                  style={{
                    background: active
                      ? 'linear-gradient(180deg, #ffbf32 0%, #f49a08 100%)'
                      : 'transparent',
                    color: active
                      ? 'rgba(255, 250, 229, 0.98)'
                      : 'rgba(110, 65, 15, 0.78)',
                    WebkitTextStroke: active
                      ? '0.35px rgba(95, 49, 9, 0.80)'
                      : undefined,
                    textShadow: active
                      ? '0 1px 0 rgba(95, 49, 9, 0.65)'
                      : '0 1px 0 rgba(255, 245, 215, 0.65)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {shieldCount > 0 && (
          <div className="mt-2 flex justify-end">
            <HudResourceChip
              tone="default"
              size="compact"
              icon="shield"
              value={shieldCount}
              ariaLabel={HUD_COPY.shieldsAriaLabel(shieldCount)}
            />
          </div>
        )}
      </div>

      {/* PiecePickerSheet rendered as a sibling of the canopy. Open state
          is owned here; trigger is inside the canopy's piece cluster. */}
      <PiecePickerSheet
        open={piecePickerOpen}
        onOpenChange={setPiecePickerOpen}
        selectedPiece={selectedPiece}
        pieces={pieces}
        onSelectPiece={onSelectPiece}
      />

      {/* Optional header slot (e.g., Daily Tactic card). Rendered between
          the chip row and the board so it's the first thing the player
          sees on hub entry without competing with the mission CTA. */}
      {headerSlot && <div className="shrink-0 mx-2 mt-2">{headerSlot}</div>}

      {/* Zone B: Board Stage — flex-1, maximum space. No panel frame so the
          board image floats directly on the grass field bg. */}
      <div className="board-stage-focus min-h-0 flex-1 mx-2 mt-1.5">
        {board}
      </div>

      {/* Zone C: action row — contextual action pin in the center, with
          optional flanking slots on each side for compact entry points
          (Daily Tactic, Mini-Arena bridge). The pin stays visually
          anchored because the flanks are absolutely positioned at the
          edges, leaving the centerline untouched. */}
      <div
        className="relative mx-2 flex min-h-[4.75rem] shrink-0 items-center justify-center"
        style={{ marginTop: 'var(--shell-gap-xs)' }}
      >
        {actionRowLeft && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            {actionRowLeft}
          </div>
        )}
        {contextualAction}
        {actionRowRight && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {actionRowRight}
          </div>
        )}
      </div>

      {/* Dock — persistent navigation.
          - z-[60] on the direct child of .atmosphere escapes the
            z-index: 1 stacking context that .atmosphere > * forces.
          - pointer-events-auto re-enables clicks while a Radix Sheet
            is open. Radix in modal=true sets pointer-events: none on
            the portal's siblings (our entire page tree) so outside
            clicks can't hit underlying elements. That also disables
            the dock visually-on-top. pointer-events: auto on the
            wrapper restores interactivity for dock + descendants
            without touching Radix's modal semantics elsewhere. */}
      <div
        className="shrink-0 relative z-[60] pointer-events-auto"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          marginTop: 'var(--shell-gap-sm)',
        }}
      >
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  )
}
