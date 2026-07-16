'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { ConfettiBurst } from '@/components/redesign/confetti-burst'
import { HudResourceChip } from '@/components/hud/hud-resource-chip'
import type { PIECE_LABELS } from '@/lib/content/editorial'
import { LottieAnimation } from '@/components/ui/lottie-animation'
import { PiecePickerTrigger } from '@/components/exercises/piece-picker-trigger'
import { MissionDetailSheet } from '@/components/exercises/mission-detail-sheet'
import type { TrainingNode } from '@/lib/training/path'

type PieceKey = 'rook' | 'bishop' | 'knight' | 'pawn' | 'queen' | 'king'

type MissionPanelProps = {
  selectedPiece: PieceKey
  /** Unified Piece Sheet (surface redistribution D3): the TORRE chip
   *  no longer opens a local picker — it asks the host to open the
   *  badges sheet, which owns the journey + switch grid. */
  onOpenPieceSheet: () => void
  phase: 'ready' | 'success' | 'failure'
  targetLabel: string
  score: string
  board: ReactNode
  exerciseDrawer: ReactNode
  isReplay: boolean
  contextualAction: ReactNode
  persistentDock: ReactNode
  pieceHint?: string
  /** Curated prompt for the ACTIVE exercise; forwarded to the mission detail
   *  sheet, where it replaces the generic per-piece hint (A1/A7). */
  exercisePrompt?: string
  isCapture?: boolean
  /** Live retry-shield count from `readDisplayedShields()`. Rendered
   *  by the persistent shield-chip row inserted between the
   *  mission-detail row and the optional L2 toggle. Pass `0` when
   *  the player has no shields — the chip stays mounted to mirror
   *  /hub canon and avoid layout jumps when the count transitions
   *  0↔1. */
  shieldCount: number
  /** Live consecutive-success streak counter. Surfaces in the WELL
   *  DONE flash (commit 2 of this cluster's polish pass) so the
   *  Shield rescue mechanic gains psychological weight — the user
   *  sees what they're protecting. */
  streakCount?: number
  /** Stars earned on the just-completed exercise (0-3). Drives the
   *  "+N STAR" pill in the WELL DONE flash. Only consumed when
   *  phase === 'success'. */
  lastEarnedStars?: number
  /** Integrated per-piece path, forwarded to the mission detail sheet
   *  for its "Now: X" line (surface redistribution D1). */
  trainingPath?: TrainingNode[]
  /** D5 — save-score affordance inside the mission detail sheet.
   *  Forwarded untouched; the host owns gating and busy state. */
  canSaveScore?: boolean
  isSavingScore?: boolean
  /** B2 (Lote 2): off-chain save auto-runs + is free. Forwarded to
   *  MissionDetailSheet, which renders the informative saved state / free
   *  manual retry instead of a green CTA. */
  scoreSaved?: boolean
  saveFailed?: boolean
  onRetrySave?: () => void
  /** Score transparency breakdown. Forwarded to MissionDetailSheet. */
  totalStars?: number
  maxPossibleStars?: number
  /** QA round 2 — on-chain SAVE trio, forwarded untouched. */
  canSaveOnChain?: boolean
  onSaveOnChain?: () => void
  isSavingOnChain?: boolean
  /** Signal from the parent that a dock destination sheet is open.
   *  When true, we close mission-detail so the user never sees it
   *  stacked behind a badge/shop/leaderboard sheet. */
  isDockSheetOpen: boolean
  /** L2 labyrinth layer state. Entry happens via training path node
   *  taps (onLabyrinthSelect); the exit affordance lives in the host's
   *  contextual action row (QA F2 2026-06-11). These two only shape
   *  the mission peek chip label. */
  labyrinthMode?: boolean
  /** Pivot Challenge is a Special Training that is NOT measured in moves, so the
   *  chip must never show the optimal-moves counter. Derived by the host from the
   *  runtime catalog (activePivot), never from an id (B4.2.1). */
  diagonalRunMode?: boolean
  labyrinthOptimalMoves?: number
  /** Identity of the active labyrinth. Surfaced on the mission chip as
   *  data-* attributes so E2E can pin the rendered board to its catalog
   *  entry (id/title/optimalMoves) without matching bare on-board numbers. */
  labyrinthId?: string
  labyrinthTitle?: string
  /** Tap on an unlocked labyrinth node in the mission detail sheet's
   *  training path. Forwarded down; absent → read-only rail. */
  onLabyrinthSelect?: (labyrinthId: string) => void
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
  /** Contextual pins that join the centered group alongside
   *  `contextualAction` (e.g. the Peones Hint pin). Founder action-row
   *  composition 2026-06-11: edges = persistent entry points, center =
   *  in-context actions distributed without holes. */
  actionRowCenter?: ReactNode
  /** Sprint 4 commit K — floating overlay anchored to the top-right
   *  of the board zone. Used by the Peones Hint affordance so the
   *  button can grow / shrink across states (idle / loading /
   *  revealed / insufficient / error) WITHOUT pushing the bottom
   *  action row. Wrapper uses pointer-events-none so the slot
   *  itself doesn't intercept board taps; consumers opt back in on
   *  the actual control. */
  floatingActionSlot?: ReactNode
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

function PhaseFlash({
  phase,
  failureRescueSlot,
  streakCount,
  lastEarnedStars,
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
  /** Streak counter for the WELL DONE "STREAK ×N" pill. Only shown
   *  when phase === 'success' AND streakCount >= 2. */
  streakCount?: number
  /** Stars earned on this exercise for the WELL DONE "+N STAR"
   *  pill. Only shown when phase === 'success' AND > 0. */
  lastEarnedStars?: number
}) {
  const tFlash = useTranslations('PHASE_FLASH_COPY')
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const flash = PHASE_FLASH[phase]
  const isSuccess = phase === 'success'
  const flashText = flash ? tFlash(flash.textKey) : ''
  const hasRescue = phase === 'failure' && Boolean(failureRescueSlot)

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      setFading(false)
      return
    }

    setVisible(true)
    setFading(false)

    if (hasRescue) {
      /* Failure-with-rescue: single coherent moment — the rescue
         modal fades in immediately alongside the scrim instead of
         the legacy banner-then-modal 2-step (user feedback
         2026-05-31: the prior split felt disjointed). No autodismiss
         either: the flash holds until the parent transitions phase
         away from 'failure'. */
      return
    }

    /* Success holds longer so the radial burst + gentle gravity fall
       (~3s + delays) can play through. Failure-without-rescue (rare
       — host that doesn't wire failureRescueSlot) keeps the legacy
       short flash. 1.8/2.2s is enough to read "Try Again" + the
       avatar without dragging on a 3-fail run. */
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
        {isSuccess && <ConfettiBurst />}
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

  /* Reward pills — surface "what the player just gained" so the
     shield rescue mechanic gains psychological weight when the next
     failure threatens it (commit 2 of polish pass). Success-only;
     never renders during failure. */
  const showStarPill =
    isSuccess && typeof lastEarnedStars === 'number' && lastEarnedStars > 0
  const showStreakPill =
    isSuccess && typeof streakCount === 'number' && streakCount >= 2
  const rewardPills =
    showStarPill || showStreakPill ? (
      <div className="fail-rescue-reward-row" aria-hidden="true">
        {showStarPill ? (
          <span className="fail-rescue-reward-pill fail-rescue-reward-pill--star">
            <picture>
              <source
                srcSet="/art/redesign/icons/star.avif"
                type="image/avif"
              />
              <source
                srcSet="/art/redesign/icons/star.webp"
                type="image/webp"
              />
              <img
                src="/art/redesign/icons/star.png"
                alt=""
                aria-hidden="true"
              />
            </picture>
            <span>+{lastEarnedStars} STAR</span>
          </span>
        ) : null}
        {showStreakPill ? (
          <span className="fail-rescue-reward-pill fail-rescue-reward-pill--streak">
            <span aria-hidden="true">×{streakCount}</span>
            <span>COMBO</span>
          </span>
        ) : null}
      </div>
    ) : null

  /* Rescue path: the FailRescueModal is a fully self-contained
     overlay (its own scrim + panel + wolf inside the panel asset).
     PhaseFlash hands rendering entirely over to it — no wrapping
     scrim, no separate wolf block — so the user sees a single
     coherent moment fading in. The modal's `visible` prop is
     controlled by the slot itself; PhaseFlash just decides whether
     to mount the React subtree.

     Non-rescue path (success, or failure without a wired host):
     legacy scrim + wolf + reward pills, unchanged. */
  if (hasRescue) {
    return <>{failureRescueSlot}</>
  }

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-3 px-4">
        {wolfBlock}
        {rewardPills}
      </div>
    </div>
  )
}

export function MissionPanelCandy({
  selectedPiece,
  onOpenPieceSheet,
  phase,
  targetLabel,
  score,
  board,
  exerciseDrawer,
  contextualAction,
  persistentDock,
  isCapture = false,
  trainingPath,
  canSaveScore,
  isSavingScore,
  scoreSaved,
  saveFailed,
  onRetrySave,
  totalStars,
  maxPossibleStars,
  canSaveOnChain,
  onSaveOnChain,
  isSavingOnChain,
  isDockSheetOpen,
  labyrinthMode = false,
  diagonalRunMode = false,
  labyrinthOptimalMoves,
  labyrinthId,
  labyrinthTitle,
  onLabyrinthSelect,
  headerSlot,
  actionRowLeft,
  actionRowRight,
  actionRowCenter,
  floatingActionSlot,
  shieldCount,
  streakCount,
  lastEarnedStars,
  pieceHint,
  exercisePrompt,
  failureRescueSlot,
}: MissionPanelProps) {
  const tMission = useTranslations('MISSION_BRIEFING_COPY')
  const tHud = useTranslations('HUD_COPY')
  // Mission-detail open state — owned here so we can auto-close it
  // when the parent signals a dock destination sheet is opening.
  const [missionDetailOpen, setMissionDetailOpen] = useState(false)

  useEffect(() => {
    if (isDockSheetOpen) {
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

  // Pivot Challenge is not measured in moves: suppress the optimal-moves chip so
  // it never reads "2" (or "0 / 2 moves") — it falls back to the target square.
  const showMoveCounter = labyrinthMode && !!labyrinthOptimalMoves && !diagonalRunMode
  const visibleMissionLabel =
    showMoveCounter
      ? String(labyrinthOptimalMoves)
      : isCapture
      ? tMission('captureLabel')
      : tMission('visibleMissionTargetFormat', { target: targetLabel })
  const missionAriaLabel =
    showMoveCounter
      ? tMission('openDetailsLabyrinthAriaFormat', { moves: labyrinthOptimalMoves })
      : isCapture
        ? tMission('openDetailsCaptureAriaLabel')
        : tMission('openDetailsTargetAriaFormat', { target: targetLabel })

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
        data-testid={showMoveCounter ? 'mission-optimal-moves' : undefined}
        data-optimal-moves={showMoveCounter ? labyrinthOptimalMoves : undefined}
        data-labyrinth-id={labyrinthMode ? labyrinthId : undefined}
        data-labyrinth-title={labyrinthMode ? labyrinthTitle : undefined}
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
              onClick={onOpenPieceSheet}
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
              exercisePrompt={exercisePrompt}
              score={score}
              trainingPath={trainingPath}
              onLabyrinthSelect={onLabyrinthSelect}
              canSaveScore={canSaveScore}
              isSavingScore={isSavingScore}
              scoreSaved={scoreSaved}
              saveFailed={saveFailed}
              onRetrySave={onRetrySave}
              totalStars={totalStars}
              maxPossibleStars={maxPossibleStars}
              canSaveOnChain={canSaveOnChain}
              onSaveOnChain={onSaveOnChain}
              isSavingOnChain={isSavingOnChain}
              trigger={missionPeek}
            />
          </div>
          <div className="shrink-0 min-w-[4.5rem]">
            {exerciseDrawer}
          </div>
        </div>

        {/* QA F2 (2026-06-11): the full-width BACK TO EXERCISES band is
            gone — it resurrected the retired tab strip visually. The
            exit affordance now lives as a muted ActionPin in the host's
            contextual action row. */}

        {/* Shield chip standalone row removed 2026-05-31: shield count
            now lives INSIDE the candy-tray-pill stars trigger (see
            ExerciseDrawer trigger). One row, not two — consistent
            with the rest of the candy-tray-pill HUD family. */}
      </div>

      {/* Optional header slot (e.g., Daily Tactic card). Rendered between
          the chip row and the board so it's the first thing the player
          sees on hub entry without competing with the mission CTA. */}
      {headerSlot && <div className="shrink-0 mx-2 mt-2">{headerSlot}</div>}

      {/* Zone B: Board Stage — flex-1, maximum space. No panel frame so the
          board image floats directly on the grass field bg. */}
      <div className="board-stage-focus relative min-h-0 flex-1 mx-2 mt-1">
        {board}
        {/* Sprint 4 commit L — floating overlay anchored to the
            bottom-right of the board zone (grass strip between the
            board and the action row). Founder UX call 2026-06-08:
            top-right was occluding pieces that start in h7/h8/g8.
            Bottom-right keeps the chip near the board for context
            but moves it out of the playable area entirely. */}
        {floatingActionSlot && (
          <div className="pointer-events-none absolute bottom-2 right-2 z-30 flex max-w-[55%] justify-end">
            {floatingActionSlot}
          </div>
        )}
      </div>

      {/* Zone C: action row — 3-column grid (Sally composition pass
          2026-06-11). Edges host the PERSISTENT entry points (Daily
          left, Special Training right) so they keep their muscle-memory
          anchors; the middle column groups the IN-CONTEXT actions
          (Hint + SAVE/CLAIM) centered with even gaps — 1 pin sits at
          the exact geometric center, 2-3 group around it, never a
          one-sided hole. `1fr auto 1fr` keeps the center group at the
          true screen center even when only one edge slot is mounted.
          All columns align by vertical center (pedestals have no label,
          pins do — bottom-alignment is what knocked Daily askew). */}
      <div
        className="mx-2 grid min-h-[4.75rem] shrink-0 grid-cols-[1fr_auto_1fr] items-center"
        style={{ marginTop: 'var(--shell-gap-xs)' }}
      >
        <div className="flex items-center justify-start">{actionRowLeft}</div>
        <div className="flex items-center justify-center gap-3">
          {actionRowCenter}
          {contextualAction}
        </div>
        <div className="flex items-center justify-end">{actionRowRight}</div>
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
      <PhaseFlash
        phase={phase}
        failureRescueSlot={failureRescueSlot}
        streakCount={streakCount}
        lastEarnedStars={lastEarnedStars}
      />
    </section>
  )
}
