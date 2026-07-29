'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { ThemeAssetPicture } from '@/components/themes/theme-asset-picture'
import { ConfettiBurst } from '@/components/redesign/confetti-burst'
import { HudResourceChip } from '@/components/hud/hud-resource-chip'
import type { PIECE_LABELS } from '@/lib/content/editorial'
import { LottieAnimation } from '@/components/ui/lottie-animation'
import {
  ArchedHeadline,
  CELEBRATION_ACCENT,
  CELEBRATION_STROKE,
} from '@/components/ui/arched-headline'
import { PiecePickerTrigger } from '@/components/exercises/piece-picker-trigger'
import { MissionDetailSheet } from '@/components/exercises/mission-detail-sheet'
import { PinStatusMarker } from '@/components/redesign/pin-status-marker'
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
  /** Peones balance chip, third slot of the quest tray (2026-07-21).
   *  Passed in rather than mounted here for the same reason as
   *  `exerciseDrawer`: the chip reads the wallet through wagmi, which
   *  throws with no WagmiProvider above it, and this panel is rendered
   *  by /dev probes that deliberately mount none. Optional so those
   *  probes — and Chesscito Lite, which has no Peones surfaces — simply
   *  omit it. */
  balanceChip?: ReactNode
  isReplay: boolean
  contextualAction: ReactNode
  persistentDock: ReactNode
  pieceHint?: string
  /** Curated prompt for the ACTIVE exercise; forwarded to the mission detail
   *  sheet, where it replaces the generic per-piece hint (A1/A7). */
  exercisePrompt?: string
  /** Curated TITLE of the active exercise ("Step by step"). Rendered as the
   *  mission band's tail so the band names the lesson instead of only the
   *  target square. Short and imperative by construction, which is why the
   *  band takes this and not `exercisePrompt` — see `missionTail`. */
  exerciseTitle?: string
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
  canOfferScoreSave?: boolean
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
  /** The active game is scored by COVERAGE (Knight's Tour, N-Queens), so it has
   *  no destination square and the chip's "Move to {target}" frame does not
   *  apply — `targetLabel` is the whole statement on its own. Distinct from
   *  `diagonalRunMode`, which also suppresses the move counter but DOES name a
   *  square to reach ("Move to h8" is right for it). */
  coverageMode?: boolean
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
  /** Live status line hoisted out of a game board (Diagonal Run) so the
   *  surface shows ONE band instead of two stacked ones — "Move to g1"
   *  sat above "Tap the bishop to begin." until 2026-07-16. When set, the
   *  mission band renders the line beside the target and adopts the
   *  `dr-band` / `dr-band-msg` / `data-phase` hooks the board used to own. */
  missionStatus?: { message: string; phase: string }
  /** Tap-to-continue for the success/failure flash (founder 2026-07-17).
   *  Forwarded to PhaseFlash: when true the overlay holds until the player
   *  taps, and `onFlashContinue` runs the host's deferred advance/retry. The
   *  host arms this only on the paths where it also defers the continuation. */
  awaitTapToContinue?: boolean
  onFlashContinue?: () => void
}

type FlashConfig = { textKey: 'success' | 'failure'; accent: string; stroke: string }

/* Success quotes the shared celebration palette so this overlay and the Daily
   one cannot drift apart. Failure keeps its own accent — rose is the signal
   that the attempt did not land. */
const PHASE_FLASH: Record<MissionPanelProps['phase'], FlashConfig | null> = {
  ready: null,
  success: {
    textKey: 'success',
    accent: CELEBRATION_ACCENT,
    stroke: CELEBRATION_STROKE,
  },
  failure: {
    textKey: 'failure',
    accent: 'rgb(244, 63, 94)', // rose-500
    stroke: CELEBRATION_STROKE,
  },
}

export function PhaseFlash({
  phase,
  failureRescueSlot,
  streakCount,
  lastEarnedStars,
  lessonTitle,
  awaitTap,
  onContinue,
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
  /** Curated title of the just-finished exercise — the lesson line under the
   *  success banner ("You learned: {title}"). Success-only; absent on games
   *  that carry no title. */
  lessonTitle?: string
  /** Tap-to-continue (founder 2026-07-17): when true the overlay does NOT
   *  auto-dismiss — it holds until the player taps, so the celebration/lesson
   *  is never missed. The host arms this on the paths where it also defers the
   *  advance to the tap (success + plain failure); the rescue path ignores it
   *  (its modal already owns the dwell). */
  awaitTap?: boolean
  /** Fired when the player taps a tap-to-continue overlay. The host runs the
   *  deferred continuation (advance / retry) here. Ignored unless awaitTap. */
  onContinue?: () => void
}) {
  const tFlash = useTranslations('PHASE_FLASH_COPY')
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  // Tap is armed a beat AFTER reveal so an eager tap can't skip the
  // celebration the instant it appears. Only meaningful when awaitTap.
  const [tapArmed, setTapArmed] = useState(false)
  const flash = PHASE_FLASH[phase]
  const isSuccess = phase === 'success'
  const flashText = flash ? tFlash(flash.textKey) : ''
  const hasRescue = phase === 'failure' && Boolean(failureRescueSlot)

  /* The entry beat: the phase flips the instant the move resolves, but the
     board is still animating the piece onto the star. Holding the banner back
     ~600ms lets the player SEE the capture land before the celebration covers
     it (founder 2026-07-17). Timers are offset by this beat so the total
     on-screen time is unchanged. */
  const entryBeat = isSuccess ? 600 : 450

  useEffect(() => {
    if (!flash) {
      setVisible(false)
      setFading(false)
      setTapArmed(false)
      return
    }

    setVisible(false)
    setFading(false)
    setTapArmed(false)

    const revealTimer = setTimeout(() => setVisible(true), entryBeat)

    if (hasRescue) {
      /* Failure-with-rescue: single coherent moment — the rescue
         modal fades in (after the beat) alongside the scrim instead of
         the legacy banner-then-modal 2-step (user feedback
         2026-05-31: the prior split felt disjointed). No autodismiss
         either: the flash holds until the parent transitions phase
         away from 'failure'. */
      return () => clearTimeout(revealTimer)
    }

    if (awaitTap) {
      /* Tap-to-continue: no auto-dismiss at all — the overlay holds until the
         player taps (the host defers the advance to that same tap). Arm the tap
         a beat after reveal so the celebration is seen and an eager tap can't
         skip it the instant it appears. */
      const armTimer = setTimeout(() => setTapArmed(true), entryBeat + 550)
      return () => {
        clearTimeout(revealTimer)
        clearTimeout(armTimer)
      }
    }

    /* Success holds longer so the radial burst + gentle gravity fall
       (~3s + delays) can play through. Failure-without-rescue (rare
       — host that doesn't wire failureRescueSlot) keeps the legacy
       short flash. 1.8/2.2s is enough to read "Try Again" + the
       avatar without dragging on a 3-fail run. All offset by the beat. */
    const fadeAt = entryBeat + (isSuccess ? 2700 : 1800)
    const hideAt = entryBeat + (isSuccess ? 3100 : 2200)

    const fadeTimer = setTimeout(() => setFading(true), fadeAt)
    const hideTimer = setTimeout(() => setVisible(false), hideAt)

    return () => {
      clearTimeout(revealTimer)
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [phase, flash, isSuccess, hasRescue, entryBeat, awaitTap])

  function handleTapContinue() {
    if (!awaitTap || !tapArmed) return
    setFading(true)
    setTimeout(() => {
      setVisible(false)
      onContinue?.()
    }, 260)
  }

  if (!visible || !flash) return null

  const avatarBase = isSuccess ? 'avatar-fun' : 'avatar-try-again'

  /* Wolf block extracted so both layouts (rescue + non-rescue) can
     render it without JSX duplication. The headline is LIVE Rowdies text
     (var(--font-game-action)) instead of the old baked-in welldone/try-again
     art, so it translates (ES: "¡Bien hecho!" / "Reintenta") and the lesson
     line can sit beneath it (founder 2026-07-17). The 4-corner text-shadow is
     a cross-browser outline that keeps the glyphs crisp on any background. */
  const wolfBlock = (
    <div className="relative animate-in zoom-in-90 duration-300">
      {/* Two things this className is load-bearing for (founder 2026-07-29):
          - Negative bottom margin, not a positive one. The block hangs above
            the wolf and grows UPWARD, so the arch — the tallest thing on
            screen — was running off the top edge. This drops it into the
            slack over the wolf's head.
          - An explicit viewport width. The containing block here is the
            wolf's 320px frame, so an auto-width absolute child can never get
            wider than that however big its own max-width is, and the lesson
            line wrapped early with half the screen empty beside it. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -mb-6 flex w-[92vw] -translate-x-1/2 flex-col items-center gap-1">
        <ArchedHeadline
          text={flashText}
          stroke={flash.stroke}
          accent={flash.accent}
          style={{
            fontSize: 'clamp(2.75rem, 13vw, 4.25rem)',
            animation:
              'reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        />
        {isSuccess && lessonTitle ? (
          <span
            className="overlay-lesson"
            style={{
              animation:
                'reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 180ms both',
            }}
          >
            {tFlash('lesson', { title: lessonTitle })}
          </span>
        ) : null}
      </div>
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
            className="h-72 w-72 object-contain drop-shadow-[0_6px_22px_rgba(255,245,215,0.95)]"
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
      <div className="overlay-reward-row" aria-hidden="true">
        {showStarPill ? (
          <span className="overlay-reward">
            <ThemeAssetPicture slot="shared.star" alt="" aria-hidden="true" />
            <span className="overlay-reward-label">+{lastEarnedStars} Stars</span>
          </span>
        ) : null}
        {/* COMBO = Session Combo (consecutive correct exercises, from
            useStreak/`chesscito:streak`) — NOT the daily streak. See
            docs/product/2026-07-23-combo-streak-vocabulary.md. Reuses the
            `exercises.combo` slot the drawer already renders, so the reward
            and the counter that tracks it share one icon. */}
        {showStreakPill ? (
          <span className="overlay-reward">
            <ThemeAssetPicture slot="exercises.combo" alt="" aria-hidden="true" />
            <span className="overlay-reward-label">×{streakCount} Combo</span>
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
      className={`fixed inset-0 z-[70] flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${
        awaitTap ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
      } ${fading ? 'opacity-0' : 'opacity-100'}`}
      onClick={awaitTap ? handleTapContinue : undefined}
      onKeyDown={
        awaitTap
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleTapContinue()
            }
          : undefined
      }
      role={awaitTap ? 'button' : undefined}
      tabIndex={awaitTap ? 0 : undefined}
      aria-label={awaitTap ? tFlash('tapToContinue') : undefined}
    >
      <div className="flex flex-col items-center gap-3 px-4">
        {wolfBlock}
        {rewardPills}
      </div>
      {/* Tap-to-continue prompt — glowing Rowdies text near the bottom, armed a
          beat after the flash appears (founder reference 2026-07-17). */}
      {awaitTap && tapArmed ? (
        <div className="playhub-phase-flash-tap" aria-hidden="true">
          {tFlash('tapToContinue')}
        </div>
      ) : null}
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
  balanceChip,
  contextualAction,
  persistentDock,
  isCapture = false,
  trainingPath,
  canOfferScoreSave,
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
  coverageMode = false,
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
  exerciseTitle,
  failureRescueSlot,
  missionStatus,
  awaitTapToContinue,
  onFlashContinue,
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
      ? (labyrinthTitle ?? String(labyrinthOptimalMoves))
      : isCapture
      ? tMission('captureLabel')
      : coverageMode
      ? // A coverage game has NOWHERE to move to, so the "Move to" frame is
        //  meaningless on it: the tour shipped reading "Move to Cover 80%" and
        //  queens read "Move to queen 1/5" (founder, 2026-07-16). The label is
        //  already the whole statement — show it as it is.
        targetLabel
      : tMission('visibleMissionTargetFormat', { target: targetLabel })

  /* The band's tail — what the band SAYS beyond where to go. It read "Move to
     b6" and nothing else for an exercise, and a bare "4" for a labyrinth, while
     the lesson sat unread inside the mission modal (founder, 2026-07-16).
     Precedence: a live game line (Diagonal Run) always wins; a Special Training
     level names its cost; an exercise names its lesson. `title` is the right
     field for this and `playerPrompt` is not — the title is curated short and
     imperative ("Step by step"), while the prompt is a full sentence that a
     30px strip can only truncate into noise. The prompt stays in the modal,
     which is where it fits. */
  const missionTail =
    missionStatus?.message ??
    (showMoveCounter
      ? tMission('missionMovesFormat', { moves: labyrinthOptimalMoves })
      : exerciseTitle)
  const missionAriaLabel =
    showMoveCounter
      ? tMission('openDetailsLabyrinthAriaFormat', { moves: labyrinthOptimalMoves })
      : isCapture
        ? tMission('openDetailsCaptureAriaLabel')
        : tMission('openDetailsTargetAriaFormat', { target: targetLabel })

  /* Mission peek — full-width band below the two chips (2026-07-15),
     compacted to a SLIM strip on Sally's unified-tray pass (same day):
     the chip row and this band read as ONE quest tray, so the band
     carries a single text line (~30px) instead of panel weight (~50px)
     and gives the recovered height back to the board. Full-width keeps
     the tap target generous despite the reduced height (Fitts: 390px
     wide beats a 44px pill). Same MissionDetailSheet trigger and tap
     behavior; Diagonal Run band palette. The E2E hooks
     (`mission-optimal-moves` testid + data-* attrs, `Open mission
     details` aria-label) are kept verbatim on the same elements. */
  const missionBand = (
    <button
      type="button"
      data-testid={missionStatus ? 'dr-band' : 'mission-band'}
      data-phase={missionStatus?.phase}
      className="relative w-full candy-tray-pill min-h-[36px]"
      aria-label={missionAriaLabel}
    >
      {/* Pending on-chain save → pulsing dot, same art as DAILY / reward
          rail. Invites the player into Missions where "Save proof" lives.
          Save-On-Chain's PRIMARY entry is the Leaders footer; this stays a
          secondary hint. */}
      {canSaveOnChain ? <PinStatusMarker status="pending" /> : null}
      <CandyIcon name="crosshair" className="candy-tray-pill-icon" />
      <span
        key={targetLabel}
        className="shrink-0 truncate text-xs font-extrabold leading-tight"
        style={candyChipTextStyle}
        data-testid={showMoveCounter ? 'mission-optimal-moves' : undefined}
        data-optimal-moves={showMoveCounter ? labyrinthOptimalMoves : undefined}
        data-labyrinth-id={labyrinthMode ? labyrinthId : undefined}
        data-labyrinth-title={labyrinthMode ? labyrinthTitle : undefined}
      >
        {visibleMissionLabel}
      </span>
      {/* The tail: the live Diagonal Run line, a level's move cost, or the
          exercise's lesson. One band, two facts — where to go, and what this
          is about. Carries the `dr-band-msg` hook (only when a game owns the
          line) so the real-flow E2E keeps reading it from wherever it renders. */}
      {missionTail ? (
        <span
          className="truncate text-xs font-semibold leading-tight opacity-90"
          style={candyChipTextStyle}
          data-testid={missionStatus ? 'dr-band-msg' : 'mission-band-tail'}
        >
          <span aria-hidden="true" className="mx-1 opacity-50">
            ·
          </span>
          {missionTail}
        </span>
      ) : null}
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
          <div className="shrink-0 min-w-[4.5rem]">
            {exerciseDrawer}
          </div>
          {/* Peones balance — third slot, so the tray reads
           *  [piece] [stars|shields|combo] [peones] (2026-07-21).
           *
           *  Deliberately joins the EXISTING row instead of adding one:
           *  a second row would cost vertical space the board owns, and
           *  at 390px the board is already the scarce resource. The
           *  compression lands on the piece picker (flex-1, its label is
           *  the reducible part), never on the board.
           *
           *  Z2 by design: the header (Z1) stays Account-only per UX
           *  spec §6. A balance you earn and spend by playing is game
           *  context, not identity chrome — same zone as stars and
           *  shields, which is exactly where a player looks for it. */}
          {balanceChip ? (
            <div className="shrink-0">{balanceChip}</div>
          ) : null}
        </div>

        {/* Mission band — full-width, attached right under the chip row
            (2026-07-15, Sally unified-tray pass). mt-1 keeps it visually
            glued to the chips so row + band read as one tray, not two
            stacked headers. Tap opens the same MissionDetailSheet. */}
        <div className="mt-1">
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
            canOfferScoreSave={canOfferScoreSave}
            isSavingScore={isSavingScore}
            scoreSaved={scoreSaved}
            saveFailed={saveFailed}
            onRetrySave={onRetrySave}
            totalStars={totalStars}
            maxPossibleStars={maxPossibleStars}
            canSaveOnChain={canSaveOnChain}
            onSaveOnChain={onSaveOnChain}
            isSavingOnChain={isSavingOnChain}
            trigger={missionBand}
          />
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
        lessonTitle={exerciseTitle}
        awaitTap={awaitTapToContinue}
        onContinue={onFlashContinue}
      />
    </section>
  )
}
