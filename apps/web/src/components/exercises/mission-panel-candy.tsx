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
  /** Optional handler for the floating help (`?`) badge layered on the
   *  piece selector. When provided the badge is rendered and tapping it
   *  re-opens the MissionBriefing on demand — no localStorage state is
   *  altered. */
  onHelpClick?: () => void
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

const CONFETTI_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#facc15', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
] as const

/* Deterministic radial-burst confetti specs — 24 chips with angles
   spaced every 15° around a full circle so the explosion reads as a
   true radial burst. Each piece has a precomputed (burstX, burstY)
   target on a ring of radius 90–140px (six varied radii for organic
   feel). Hardcoded so the spread is designed, not random — and avoids
   hydration mismatches. Y positive = down (CSS convention), so chips
   with positive burstY shoot below the avatar; negative ones shoot up
   then are pulled back by gravity in the fall phase. */
const CONFETTI: Array<{
  burstX: string
  burstY: string
  driftX: string // extra horizontal drift during fall
  spin: string // total rotation across the animation
  size: string
  color: number
  delay: string
  duration: string
}> = [
  { burstX: '90px',   burstY: '0px',    driftX: '20px',  spin: '720deg',  size: '10px', color: 0, delay: '0ms',   duration: '2400ms' },
  { burstX: '116px',  burstY: '-31px',  driftX: '24px',  spin: '-660deg', size: '8px',  color: 2, delay: '20ms',  duration: '2350ms' },
  { burstX: '87px',   burstY: '-50px',  driftX: '18px',  spin: '600deg',  size: '12px', color: 4, delay: '0ms',   duration: '2450ms' },
  { burstX: '92px',   burstY: '-92px',  driftX: '14px',  spin: '-540deg', size: '9px',  color: 7, delay: '40ms',  duration: '2400ms' },
  { burstX: '55px',   burstY: '-95px',  driftX: '10px',  spin: '720deg',  size: '11px', color: 1, delay: '10ms',  duration: '2350ms' },
  { burstX: '36px',   burstY: '-135px', driftX: '12px',  spin: '-720deg', size: '8px',  color: 3, delay: '30ms',  duration: '2500ms' },
  { burstX: '0px',    burstY: '-90px',  driftX: '0px',   spin: '540deg',  size: '12px', color: 5, delay: '0ms',   duration: '2400ms' },
  { burstX: '-31px',  burstY: '-116px', driftX: '-10px', spin: '-600deg', size: '10px', color: 8, delay: '20ms',  duration: '2350ms' },
  { burstX: '-50px',  burstY: '-87px',  driftX: '-14px', spin: '660deg',  size: '9px',  color: 0, delay: '40ms',  duration: '2450ms' },
  { burstX: '-92px',  burstY: '-92px',  driftX: '-12px', spin: '-720deg', size: '11px', color: 2, delay: '10ms',  duration: '2500ms' },
  { burstX: '-95px',  burstY: '-55px',  driftX: '-18px', spin: '540deg',  size: '8px',  color: 6, delay: '30ms',  duration: '2400ms' },
  { burstX: '-135px', burstY: '-36px',  driftX: '-22px', spin: '-540deg', size: '12px', color: 1, delay: '0ms',   duration: '2350ms' },
  { burstX: '-90px',  burstY: '0px',    driftX: '-26px', spin: '720deg',  size: '10px', color: 4, delay: '20ms',  duration: '2400ms' },
  { burstX: '-116px', burstY: '31px',   driftX: '-20px', spin: '-660deg', size: '9px',  color: 7, delay: '40ms',  duration: '2450ms' },
  { burstX: '-87px',  burstY: '50px',   driftX: '-12px', spin: '600deg',  size: '11px', color: 3, delay: '10ms',  duration: '2400ms' },
  { burstX: '-92px',  burstY: '92px',   driftX: '-16px', spin: '-540deg', size: '8px',  color: 5, delay: '30ms',  duration: '2350ms' },
  { burstX: '-55px',  burstY: '95px',   driftX: '-10px', spin: '720deg',  size: '10px', color: 8, delay: '0ms',   duration: '2400ms' },
  { burstX: '-36px',  burstY: '135px',  driftX: '-6px',  spin: '-720deg', size: '12px', color: 6, delay: '20ms',  duration: '2500ms' },
  { burstX: '0px',    burstY: '90px',   driftX: '0px',   spin: '540deg',  size: '9px',  color: 0, delay: '40ms',  duration: '2400ms' },
  { burstX: '31px',   burstY: '116px',  driftX: '10px',  spin: '-600deg', size: '11px', color: 2, delay: '10ms',  duration: '2350ms' },
  { burstX: '50px',   burstY: '87px',   driftX: '14px',  spin: '660deg',  size: '8px',  color: 4, delay: '30ms',  duration: '2450ms' },
  { burstX: '92px',   burstY: '92px',   driftX: '18px',  spin: '-540deg', size: '12px', color: 7, delay: '0ms',   duration: '2400ms' },
  { burstX: '95px',   burstY: '55px',   driftX: '22px',  spin: '720deg',  size: '10px', color: 1, delay: '20ms',  duration: '2350ms' },
  { burstX: '135px',  burstY: '36px',   driftX: '28px',  spin: '-540deg', size: '9px',  color: 3, delay: '40ms',  duration: '2500ms' },
]

/* Renders inside the avatar container so the radial burst emanates
   from the avatar's center. Each chip lives at top:50%/left:50% of the
   container and is translated by transform — `translate(-50%, -50%)`
   keeps the chip's geometric center at that anchor. The container
   must NOT set `overflow: hidden` or chips will be clipped mid-flight. */
function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-[2px]"
          style={{
            width: c.size,
            height: c.size,
            background: CONFETTI_COLORS[c.color],
            ['--burst-x' as string]: c.burstX,
            ['--burst-y' as string]: c.burstY,
            ['--drift-x' as string]: c.driftX,
            ['--spin' as string]: c.spin,
            animation: `confetti-burst-fall ${c.duration} cubic-bezier(0.22, 0.61, 0.36, 1) ${c.delay} both`,
            boxShadow: '0 1px 2px rgba(63, 34, 8, 0.35)',
          }}
        />
      ))}
    </div>
  )
}

function PhaseFlash({ phase }: { phase: MissionPanelProps['phase'] }) {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const flash = PHASE_FLASH[phase]
  const isSuccess = phase === 'success'

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      setFading(false)
      return
    }

    setVisible(true)
    setFading(false)

    /* Success holds longer so the radial burst + gentle gravity fall
       (~2.5s + delays) can play through. The confetti opacity reaches
       0 inside the keyframe (100%) before the scrim fade kicks in, so
       fadeAt lines up with the last chips dissolving naturally.
       Failure keeps the snappy original timing. */
    const fadeAt = isSuccess ? 2200 : 600
    const hideAt = isSuccess ? 2600 : 950

    const fadeTimer = setTimeout(() => setFading(true), fadeAt)
    const hideTimer = setTimeout(() => setVisible(false), hideAt)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [phase, flash, isSuccess])

  if (!visible || !flash) return null

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center gap-3 animate-in zoom-in-90 duration-300">
        {isSuccess ? (
          <img
            src="/art/welldone-sms.png"
            alt={flash.text}
            className="h-auto w-[78%] max-w-[300px] drop-shadow-[0_6px_14px_rgba(120,65,5,0.45)]"
            style={{
              animation:
                'reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}
          />
        ) : null}
        <div className="relative flex h-44 w-44 items-center justify-center">
          {/* Confetti lives inside the avatar container so the radial
              burst emanates from the avatar's center. Container must
              NOT clip overflow — chips travel far beyond. */}
          {isSuccess && <Confetti />}
          {isSuccess && (
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
            className="pointer-events-none absolute h-40 w-40 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 80%)',
            }}
          />
          {isSuccess ? (
            <img
              src="/art/avatar-fun.png"
              alt=""
              aria-hidden="true"
              className="relative z-10 h-40 w-40 object-contain drop-shadow-[0_4px_14px_rgba(120,65,5,0.55)]"
              style={{
                animation:
                  'reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both',
              }}
            />
          ) : (
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
          )}
        </div>
        {!isSuccess ? (
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
        ) : null}
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
  onHelpClick,
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
      className="quest-tray-slot w-full transition-all active:scale-[0.97]"
      aria-label={missionAriaLabel}
    >
      <CandyIcon name="crosshair" className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span
        key={targetLabel}
        className="truncate text-sm font-extrabold uppercase tracking-tight"
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
          existing chess sprites.
          IMPORTANT: NO unifying border with Z1. Per Sally's pass 6
          guidance: Z1 (identity chrome) and this quest tray (game
          context — piece selector, mission peek, exercise drawer, layer
          toggle, shield count) are PHILOSOPHICALLY DIFFERENT zones.
          Binding them with a shared divider grouped them visually into
          a single "header" band that violated the user's mental model
          (back+PRO belong in chrome; chips belong in game context).
          Keep them visually separated — Z1 floats above, quest tray
          floats below with negative space between. */}
      <div className="mt-0.5 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <div className="relative flex-1 min-w-0">
            <PiecePickerTrigger
              selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
              onClick={() => setPiecePickerOpen(true)}
              showLabel
            />
            {onHelpClick ? (
              <button
                type="button"
                onClick={onHelpClick}
                aria-label={MISSION_BRIEFING_COPY.helpButtonAriaLabel}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white transition-all active:scale-90"
                style={{
                  background:
                    'radial-gradient(circle at 30% 30%, #60a5fa 0%, #2563eb 80%)',
                  boxShadow:
                    '0 2px 5px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.65)',
                  lineHeight: 1,
                }}
              >
                ?
              </button>
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
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
          </div>
          <div className="shrink-0 min-w-[4.5rem]">
            {exerciseDrawer}
          </div>
        </div>

        {showLayerTabs && onToggleLabyrinth && (
          <div className="mt-1 flex justify-center">
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
                    'rounded-xl px-2 py-1.5 transition-all active:scale-[0.98]',
                    'fantasy-title text-[0.65rem] font-black uppercase tracking-[0.08em]',
                    active ? 'quest-tray-tab-active' : '',
                    disabled ? 'cursor-not-allowed opacity-30' : '',
                  ].join(' ')}
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
      <div className="board-stage-focus min-h-0 flex-1 mx-2 mt-1">
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
