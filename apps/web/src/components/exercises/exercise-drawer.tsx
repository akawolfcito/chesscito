'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ContextualHeader } from '@/components/ui/contextual-header'
import { TileIconSlot } from '@/components/ui/tile-icon-slot'
import { ThemeAssetPicture } from '@/components/themes/theme-asset-picture'
import type { Exercise, PieceId, PieceProgress } from '@/lib/game/types'
import {
  badgeRequiredCount,
  resolveExerciseDescription,
} from '@/lib/game/exercises'
import { useExerciseDescriptions } from '@/lib/content/catalog-context'
import { pieceThemeSlot } from '@/lib/themes/piece-theme-assets'
import {
  interleaveTrainingRows,
  LABYRINTH_MIN_EXERCISES,
  type TrainingNode,
} from '@/lib/training/path'
import { buildContentId } from '@/lib/daily/session-quota'
import {
  BASE_PIXEL_OFFSET,
  BASE_SEAM_OFFSET_Y,
  LABYRINTH_PIXEL_OFFSET,
  NODE_PIXEL_OFFSET,
  padIndexForNode,
  pathLayout,
} from '@/lib/exercises/path-layout'

type QuotaState = {
  isAtLimit: boolean
  consumedContentIds: string[]
  piece: string
}

type ExerciseDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  piece: PieceId
  exercises: Exercise[]
  stars: PieceProgress['stars']
  activeIndex: number
  totalStars: number
  onNavigate: (index: number) => void
  shieldCount?: number
  streakCount?: number
  visibleExerciseIds?: ReadonlySet<string> | null
  labyrinthNodes?: TrainingNode[]
  /** Resolved display label per Special Training node id (title, localized for
   *  pivots). Absent id → the generic "Special Training N" fallback. Keyed by id
   *  for COPY only; the drawer never branches behaviour on it (B4.2.3). */
  labyrinthLabels?: Record<string, string>
  onLabyrinthSelect?: (labyrinthId: string) => void
  quotaState?: QuotaState | null
  badgeClaimable?: boolean
  onClaimBadge?: () => void
}

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <CandyIcon
          key={i}
          name="star"
          className={`h-6 w-6 ${i <= count ? 'opacity-100' : 'opacity-25'}`}
        />
      ))}
    </span>
  )
}

export function ExerciseDrawer({
  open,
  onOpenChange,
  piece,
  exercises,
  stars,
  activeIndex,
  totalStars,
  onNavigate,
  shieldCount,
  streakCount,
  visibleExerciseIds,
  labyrinthNodes,
  labyrinthLabels,
  onLabyrinthSelect,
  quotaState,
  badgeClaimable,
  onClaimBadge,
}: ExerciseDrawerProps) {
  const t = useTranslations('EXERCISE_DRAWER_COPY')
  const tPiece = useTranslations('PIECE_LABELS')
  const tPath = useTranslations('TRAINING_PATH_COPY')
  const descriptions = useTranslations('EXERCISE_DESCRIPTIONS')
  const overlayDescriptions = useExerciseDescriptions()
  const maxStars = exercises.length * 3
  // Badge progress bar tracks COMPLETION, not stars: fill = completed / pool,
  // marker = 80% required. Stars stay visible on each node as a reward metric.
  const completedCount = exercises.filter(
    (ex) => (stars[ex.id] ?? 0) > 0,
  ).length
  const badgeRequired = badgeRequiredCount(exercises.length)

  const lastCompleted = exercises.reduce(
    (acc, exercise, i) => ((stars[exercise.id] ?? 0) > 0 ? i : acc),
    -1,
  )
  const maxAllowed = Math.min(lastCompleted + 1, exercises.length - 1)
  const rotationOn = visibleExerciseIds != null

  // Auto-scroll to active node when drawer opens
  const activeNodeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [open])

  // Tooltip for locked nodes
  const [lockedTooltip, setLockedTooltip] = useState<string | null>(null)
  const tooltipTimer = useRef<number | undefined>(undefined)

  function showLockedTooltip(text: string) {
    window.clearTimeout(tooltipTimer.current)
    setLockedTooltip(text)
    tooltipTimer.current = window.setTimeout(() => setLockedTooltip(null), 2000)
  }

  function isExerciseReplayable(exercise: Exercise): boolean {
    if (!quotaState?.isAtLimit) return true
    return (
      (stars[exercise.id] ?? 0) > 0 ||
      quotaState.consumedContentIds.includes(
        buildContentId('exercise', quotaState.piece, exercise.id),
      )
    )
  }

  function isLabReplayable(node: TrainingNode): boolean {
    if (!quotaState?.isAtLimit) return true
    return (
      node.status === 'complete' ||
      quotaState.consumedContentIds.includes(
        buildContentId('labyrinth', quotaState.piece, node.id),
      )
    )
  }

  function lockedFor(exercise: Exercise, index: number): boolean {
    const isDone = (stars[exercise.id] ?? 0) > 0
    // Rotation gates only fresh exercises. Solved ones stay open forever.
    if (rotationOn && !isDone && !visibleExerciseIds!.has(exercise.id))
      return true
    return index > maxAllowed
  }

  function handleSelect(exercise: Exercise, index: number) {
    if (lockedFor(exercise, index)) return
    onOpenChange(false)
    onNavigate(index)
  }

  // Rotation picks today's fresh set, but anything already solved stays on
  // the path — the player must always be able to walk back and replay it.
  const rows = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(
      ({ exercise }) =>
        !rotationOn ||
        visibleExerciseIds!.has(exercise.id) ||
        (stars[exercise.id] ?? 0) > 0,
    )

  const orderedRows = interleaveTrainingRows(rows, labyrinthNodes ?? [])

  // Fixed base cap (node 0 = exercise 1) + seamless tiles repeated above it,
  // so any node count grows the trail. `layout.positions` are %coords over
  // the composite canvas, node 0 = visual bottom.
  const layout = pathLayout(orderedRows.length)
  const nodePositions = layout.positions

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t('ariaLabel')}
          className="candy-tray-pill min-h-[36px]"
        >
          <CandyIcon
            name="star"
            className="candy-tray-pill-icon candy-tray-pill-icon--floating"
          />
          <span
            className="tabular-nums text-sm font-extrabold"
            aria-label={t('starsEarnedAriaFormat', {
              total: totalStars,
              max: maxStars,
            })}
          >
            {totalStars}
          </span>
          {typeof shieldCount === 'number' && shieldCount > 0 ? (
            <>
              <span aria-hidden="true" className="candy-tray-pill-divider" />
              <ThemeAssetPicture slot="shared.shield" pictureClassName="candy-tray-pill-icon candy-tray-pill-icon--floating" alt="" aria-hidden={true} draggable={false} />
              <span className="tabular-nums text-sm font-extrabold">
                {shieldCount}
              </span>
            </>
          ) : null}
          {typeof streakCount === 'number' && streakCount >= 2 ? (
            <>
              <span aria-hidden="true" className="candy-tray-pill-divider" />
              <ThemeAssetPicture slot="exercises.combo" pictureClassName="candy-tray-pill-icon candy-tray-pill-icon--floating candy-tray-pill-icon--streak" alt="" aria-hidden={true} draggable={false} />
              <span className="tabular-nums text-sm font-extrabold">
                {streakCount}
              </span>
            </>
          ) : null}
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        hideClose
        title={t('title')}
        description={tPiece(piece)}
        className="sheet-bg-exercises relative h-[100dvh] overflow-hidden rounded-none border-0 p-0"
        style={{ background: '#489909' }}
      >
        {/* Locked tooltip — fixed so it floats above the scroll container */}
        {lockedTooltip ? (
          <div
            role="alert"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-[18%] z-[200] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-xl"
            style={{ background: 'rgba(30,20,10,0.92)', whiteSpace: 'nowrap' }}
          >
            {lockedTooltip}
          </div>
        ) : null}

        <div
          className="absolute inset-x-0 top-0 z-20 border-b border-[rgba(110,65,15,0.25)] pt-[calc(env(safe-area-inset-top)+0.25rem)]"
          style={{
            background: 'rgba(255,248,228,0.42)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot slot={pieceThemeSlot('w', piece)} />}
            title={t('title')}
            subtitle={tPiece(piece)}
            close={{
              onClick: () => onOpenChange(false),
              label: t('closeAriaLabel'),
            }}
          />
        </div>

        {/* Path map — one scrollable canvas: a fixed base cap pinned to the
            bottom + the seamless tile repeated above it. Nodes are pinned to
            %coords so map and icons scroll together; node 0 sits on the base
            pad, the rest on the tiles. */}
        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <div
            className="exercise-path-canvas"
            style={{ aspectRatio: `1 / ${layout.totalUnits}` }}
          >
            {layout.tilesAbove > 0 && (
              <div
                className="path-tiles"
                style={{
                  height: `${(1 - layout.baseFrac) * 100}%`,
                  backgroundSize: `100% ${100 / layout.tilesAbove}%`,
                  backgroundPosition: `center ${BASE_SEAM_OFFSET_Y}px`,
                }}
              />
            )}
            <div
              className="path-base"
              style={{ height: `${layout.baseFrac * 100}%` }}
            />
            {orderedRows.map((row, originalIndex) => {
              const pos = nodePositions[originalIndex] ?? { x: 50, y: 50 }
              // Seam slides the tile nodes with the tile trail; the base
              // node (0) stays anchored to the pinned base cap.
              const seamY = originalIndex === 0 ? 0 : BASE_SEAM_OFFSET_Y
              // Which painted pad this node lands on. The two pads face
              // different ways, so each column carries its own nudge.
              const padIndex = padIndexForNode(originalIndex)

              if (row.kind === 'labyrinth') {
                const node = row.value
                const labIndex = (labyrinthNodes ?? []).indexOf(node)
                // B4.2.3: a Special Training node shows its authored title (Rook
                // Rails, Pivot Challenge) when it has one; untitled labs fall back
                // to the generic "Special Training N". No id drives behaviour.
                const nodeLabel =
                  labyrinthLabels?.[node.id] ??
                  tPath('specialTrainingLabelFormat', { number: labIndex + 1 })
                const isLocked = node.status === 'locked'
                const isQuotaLocked = !isLocked && !isLabReplayable(node)
                const isDone = node.status === 'complete'
                const effectiveLocked =
                  isLocked || isQuotaLocked || !onLabyrinthSelect
                const tooltipText = isLocked
                  ? node.unlock.type === 'stars'
                    ? tPath('labyrinthLockedStarsFormat', {
                        stars: node.unlock.min,
                        exercises: LABYRINTH_MIN_EXERCISES,
                      })
                    : tPath('labyrinthLockedChain')
                  : nodeLabel

                return (
                  <div
                    key={node.id}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: `translate(calc(-50% + ${LABYRINTH_PIXEL_OFFSET[padIndex].x}px), calc(-50% + ${LABYRINTH_PIXEL_OFFSET[padIndex].y + seamY}px))`,
                    }}
                  >
                    <div className="relative flex flex-col items-center gap-0">
                      {/* Badge: green check if done, number otherwise */}
                      {isDone ? (
                        <span
                          className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full shadow"
                          style={{ background: 'rgba(60,140,60,0.95)' }}
                        >
                          <svg
                            viewBox="0 0 12 10"
                            className="h-3 w-3"
                            fill="none"
                          >
                            <polyline
                              points="1,5 4.5,8.5 11,1"
                              stroke="white"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                          style={{
                            background: isLocked
                              ? 'rgba(63,34,8,0.80)'
                              : 'rgba(245,158,11,0.95)',
                          }}
                        >
                          {labIndex + 1}
                        </span>
                      )}

                      {/* Labyrint icon node */}
                      <button
                        type="button"
                        aria-label={nodeLabel}
                        data-locked={effectiveLocked ? 'true' : undefined}
                        data-quota-locked={isQuotaLocked ? 'true' : undefined}
                        onClick={() => {
                          if (effectiveLocked) {
                            showLockedTooltip(tooltipText)
                            return
                          }
                          onOpenChange(false)
                          onLabyrinthSelect!(node.id)
                        }}
                        className="relative"
                        style={{
                          filter: effectiveLocked
                            ? 'grayscale(1) brightness(0.85)'
                            : !isDone
                            ? 'drop-shadow(0 0 6px rgba(255,213,74,0.85)) drop-shadow(0 0 14px rgba(255,200,40,0.55))'
                            : undefined,
                        }}
                      >
                        <ThemeAssetPicture slot="exercises.labyrinth-icon" pictureClassName="block h-auto w-20 drop-shadow-md" alt="" aria-hidden={true} draggable={false} className="h-full w-full object-contain" />
                        {effectiveLocked && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <CandyIcon
                              name="lock"
                              className="h-7 w-7 drop-shadow"
                            />
                          </span>
                        )}
                        {/* Accessible text for screen readers and tests */}
                        <span className="sr-only">{nodeLabel}</span>
                        {isLocked ? (
                          <span className="sr-only">
                            {node.unlock.type === 'stars'
                              ? tPath('labyrinthLockedStarsFormat', {
                                  stars: node.unlock.min,
                                  exercises: LABYRINTH_MIN_EXERCISES,
                                })
                              : tPath('labyrinthLockedChain')}
                          </span>
                        ) : null}
                      </button>

                      {/* Stars */}
                      {isDone ? (
                        <div className="absolute left-1/2 top-full -translate-x-1/2 pt-0.5">
                          <StarDisplay count={node.stars ?? 0} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              }

              // Exercise node
              const { exercise, index } = row.value
              const isActive = index === activeIndex
              const starCount = stars[exercise.id] ?? 0
              const isDone = starCount > 0
              const isLocked = lockedFor(exercise, index)
              const isQuotaLocked = !isLocked && !isExerciseReplayable(exercise)
              const effectiveLocked = isLocked || isQuotaLocked
              const description = resolveExerciseDescription(
                exercise.id,
                index,
                (eid) => (descriptions.has(eid) ? descriptions(eid) : null),
                (n) => t('exerciseFallbackFormat', { n }),
                overlayDescriptions,
              )
              // node 0 (exercise 1) sits on the base cap pad → its own knob.
              // Every other node takes the nudge for the column it landed in.
              const exOffset =
                originalIndex === 0
                  ? BASE_PIXEL_OFFSET
                  : NODE_PIXEL_OFFSET[padIndex]
              const exOffsetY = exOffset.y + seamY

              return (
                <div
                  key={exercise.id}
                  ref={isActive ? activeNodeRef : undefined}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: `translate(calc(-50% + ${exOffset.x}px), calc(-50% + ${exOffsetY}px))`,
                  }}
                >
                  <div className="relative flex flex-col items-center gap-0">
                    {/* Badge: green check if done, number otherwise */}
                    {isDone ? (
                      <span
                        className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full shadow"
                        style={{ background: 'rgba(60,140,60,0.95)' }}
                      >
                        <svg
                          viewBox="0 0 12 10"
                          className="h-3 w-3"
                          fill="none"
                        >
                          <polyline
                            points="1,5 4.5,8.5 11,1"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="absolute -top-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                        style={{
                          background: effectiveLocked
                            ? 'rgba(63,34,8,0.80)'
                            : 'rgba(245,158,11,0.95)',
                        }}
                      >
                        {index + 1}
                      </span>
                    )}

                    {/* btn-nodo + piece on top */}
                    <button
                      type="button"
                      aria-label={description}
                      data-locked={effectiveLocked ? 'true' : undefined}
                      data-quota-locked={isQuotaLocked ? 'true' : undefined}
                      onClick={() => {
                        if (effectiveLocked) {
                          showLockedTooltip(description)
                          return
                        }
                        handleSelect(exercise, index)
                      }}
                      className="relative"
                      style={{
                        filter: effectiveLocked
                          ? 'grayscale(1) brightness(0.85)'
                          : isActive && !isDone
                          ? 'drop-shadow(0 0 6px rgba(255,213,74,0.85)) drop-shadow(0 0 14px rgba(255,200,40,0.55))'
                          : undefined,
                      }}
                    >
                      {/* Node button image */}
                      <ThemeAssetPicture slot="exercises.btn-nodo" pictureClassName="block h-auto w-20 drop-shadow-md" alt="" aria-hidden={true} draggable={false} className="h-full w-full object-contain" />

                      {/* Chess piece centered on the button */}
                      <span className="absolute inset-0 flex items-center justify-center pb-14">
                        <TileIconSlot
                          slot={pieceThemeSlot('w', piece)}
                          className="h-auto w-11"
                        />
                      </span>

                      {/* Lock overlay */}
                      {effectiveLocked ? (
                        <span className="absolute inset-0 flex items-end justify-center pb-1">
                          <CandyIcon
                            name="lock"
                            className="h-5 w-5 opacity-90 drop-shadow"
                          />
                        </span>
                      ) : null}
                      {/* Accessible text for screen readers and tests */}
                      <span className="sr-only">{description}</span>
                    </button>

                    {/* Stars */}
                    {isDone ? (
                      <div className="absolute left-1/2 top-full -translate-x-1/2 pt-0.5">
                        <StarDisplay count={starCount} />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress summary — flush bottom bar over the map */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 space-y-1.5 rounded-t-2xl px-4 pt-3"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.85rem)',
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="relative h-2 overflow-hidden rounded-full"
            style={{ background: 'rgba(110, 65, 15, 0.18)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${exercises.length ? (completedCount / exercises.length) * 100 : 0}%`,
                background:
                  'linear-gradient(90deg, rgba(245, 158, 11, 0.95), rgba(255, 220, 120, 0.95))',
              }}
            />
            <div
              className="absolute top-0 h-full w-1"
              style={{
                left: `${exercises.length ? (badgeRequired / exercises.length) * 100 : 0}%`,
                background: 'rgba(120, 65, 5, 0.55)',
              }}
            />
          </div>
          {badgeClaimable && onClaimBadge ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onClaimBadge()
              }}
              className="mt-1 w-full rounded-xl py-2 text-sm font-bold text-white transition-opacity active:opacity-80"
              style={{
                background:
                  'linear-gradient(145deg, #fbe04b 0%, #fcc00a 40%, #d38804 100%)',
                boxShadow:
                  '0 0 0 2px rgba(255,216,74,0.7), 0 0 8px 2px rgba(255,200,40,0.6), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -4px 0 rgba(142,78,0,0.3)',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              {t('claimBadgeCta')}
            </button>
          ) : (
            <p
              className="text-center text-xs"
              style={{ color: 'rgba(110, 65, 15, 0.65)' }}
            >
              {t('badgeThresholdHint', { count: badgeRequired })}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
