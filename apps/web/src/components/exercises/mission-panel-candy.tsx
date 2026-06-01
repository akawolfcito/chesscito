'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { HudResourceChip } from '@/components/hud/hud-resource-chip'
import type { PIECE_LABELS } from '@/lib/content/editorial'
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
  /** Optional fail-rescue overlay (FailRescueModal). When supplied and
   *  phase === 'failure', PhaseFlash holds open without autodismiss
   *  and mounts the slot below the wolf after 1800ms. When omitted
   *  (no rescue host wired), failure behavior stays byte-identical to
   *  pre-cluster. */
  failureRescueSlot?: ReactNode
}

type FlashConfig = { textKey: 'success' | 'failure'; accent: string; stroke: string }

/* Warm-amber on grass reads better than emerald or rose. The stroke
   is the darkest paper-text brown so the glyph silhouette stays
   crisp against any background (forest, paper, etc.). */
const PHASE_FLASH: Record<MissionPanelProps['phase'], FlashConfig | null> = {
  ready: null,
  success: {
    textKey: 'success',
    accent: 'rgb(245, 158, 11)', // amber-500
    stroke: 'rgba(63, 34, 8, 0.95)', // darkest paper text
  },
  failure: {
    textKey: 'failure',
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

function PhaseFlash({
  phase,
  failureRescueSlot,
}: {
  phase: MissionPanelProps['phase']
  /** Optional failure-only overlay slot. When supplied AND phase ===
   *  'failure', PhaseFlash:
   *    - skips the 1800/2200ms autodismiss timers (modal needs explicit
   *      user action; see spec §3.2 decision 1)
   *    - mounts the slot below the wolf after the 1800ms banner entry
   *      animation finishes (spec §3.1)
   *    - flips the scrim to pointer-events-auto so the modal CTAs are
   *      tappable (background taps still do nothing — decision 2)
   *  Success path and the no-slot failure path stay byte-identical to
   *  pre-cluster behavior. */
  failureRescueSlot?: React.ReactNode
}) {
  const tFlash = useTranslations('PHASE_FLASH_COPY')
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const [rescueMounted, setRescueMounted] = useState(false)
  const flash = PHASE_FLASH[phase]
  const isSuccess = phase === 'success'
  const flashText = flash ? tFlash(flash.textKey) : ''
  const hasRescue = phase === 'failure' && Boolean(failureRescueSlot)

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      setFading(false)
      setRescueMounted(false)
      return
    }

    setVisible(true)
    setFading(false)
    setRescueMounted(false)

    if (hasRescue) {
      /* Failure-with-rescue: NO autodismiss. The flash holds until
         the parent transitions phase away from 'failure' (after a
         rescue or skip handler resets the board). Mount the rescue
         slot once the banner entry animation has finished so the
         wolf + banner read first, then the decision overlay slides
         up beneath them. */
      const rescueTimer = setTimeout(() => setRescueMounted(true), 1800)
      return () => clearTimeout(rescueTimer)
    }

    /* Success holds longer so the radial burst + gentle gravity fall
       (~3s + delays) can play through. Failure is intentionally shorter
       than success — it's informative feedback, not a celebration, and
       a long modal punishes losing streaks. 1.8/2.2s is enough to read
       "Try Again" + the avatar without dragging on a 3-fail run. */
    const fadeAt = isSuccess ? 2700 : 1800
    const hideAt = isSuccess ? 3100 : 2200

    const fadeTimer = setTimeout(() => setFading(true), fadeAt)
    const hideTimer = setTimeout(() => setVisible(false), hideAt)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [phase, flash, isSuccess, hasRescue])

  if (!visible || !flash) return null

  const bannerBase = isSuccess ? 'welldone-sms' : 'try-again'
  const avatarBase = isSuccess ? 'avatar-fun' : 'avatar-try-again'

  /* Wolf block extracted so both layouts (rescue + non-rescue) can
     render it without JSX duplication. Identical to the pre-cluster
     markup. */
  const wolfBlock = (
    <div className="relative animate-in zoom-in-90 duration-300">
      <picture className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2">
        <source srcSet={`/art/${bannerBase}.avif`} type="image/avif" />
        <source srcSet={`/art/${bannerBase}.webp`} type="image/webp" />
        <img
          src={`/art/${bannerBase}.png`}
          alt={flashText}
          className="h-auto w-[260px] max-w-[78vw] drop-shadow-[0_6px_14px_rgba(120,65,5,0.45)]"
          style={{
            animation:
              'reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        />
      </picture>
      <div className="relative flex h-80 w-80 items-center justify-center">
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
        <div
          className="pointer-events-none absolute h-72 w-72 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 80%)',
          }}
        />
        <picture className="relative z-10">
          <source srcSet={`/art/${avatarBase}.avif`} type="image/avif" />
          <source srcSet={`/art/${avatarBase}.webp`} type="image/webp" />
          <img
            src={`/art/${avatarBase}.png`}
            alt=""
            aria-hidden="true"
            className="h-80 w-80 object-contain drop-shadow-[0_6px_22px_rgba(255,245,215,0.95)]"
            style={{
              animation:
                'reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both',
            }}
          />
        </picture>
      </div>
    </div>
  )

  /* Layered scrim. pointer-events flip: by default `-none` so the flash
     is purely informational (success path unchanged); flips to `-auto`
     ONLY when the rescue slot is mounted so the modal's CTAs are
     interactive. The scrim itself has no onClick → background taps do
     nothing (spec §3.2 decision 2). */
  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${
        fading ? 'opacity-0' : 'opacity-100'
      } ${hasRescue ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {hasRescue ? (
        <div className="flex flex-col items-center gap-3 px-4">
          {wolfBlock}
          {rescueMounted ? failureRescueSlot : null}
        </div>
      ) : (
        wolfBlock
      )}
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
  failureRescueSlot,
}: MissionPanelProps) {
  const tMission = useTranslations('MISSION_BRIEFING_COPY')
  const tLab = useTranslations('LABYRINTH_COPY')
  const tHud = useTranslations('HUD_COPY')
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
      ? tMission('captureLabel')
      : tMission('visibleMissionTargetFormat', { target: targetLabel })
  const missionAriaLabel =
    labyrinthMode && labyrinthOptimalMoves
      ? tMission('openDetailsLabyrinthAriaFormat', { moves: labyrinthOptimalMoves })
      : isCapture
        ? tMission('openDetailsCaptureAriaLabel')
        : tMission('openDetailsTargetAriaFormat', { target: targetLabel })
  const showLayerTabs = Boolean(onToggleLabyrinth)

  const missionPeek = (
    <button
      type="button"
      className="candy-tray-pill"
      aria-label={missionAriaLabel}
    >
      <CandyIcon
        name="crosshair"
        className="candy-tray-pill-icon candy-tray-pill-icon--floating"
      />
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
          <div className="flex-1 min-w-0">
            <PiecePickerTrigger
              selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
              onClick={() => setPiecePickerOpen(true)}
              showLabel
            />
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
              aria-label={tLab('layerToggleAriaLabel')}
            >
              {[
                {
                  active: !labyrinthMode,
                  value: false,
                  label: tLab('toggleExercises'),
                  disabled: false,
                },
                {
                  active: labyrinthMode,
                  value: true,
                  label: tLab('toggleLabyrinths'),
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
              ariaLabel={tHud('shieldsAriaLabel', { count: shieldCount })}
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
      <PhaseFlash phase={phase} failureRescueSlot={failureRescueSlot} />
    </section>
  )
}
