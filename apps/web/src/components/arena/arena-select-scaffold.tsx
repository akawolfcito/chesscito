'use client'

import type { ReactNode } from 'react'

import { CandyBanner } from '@/components/redesign/candy-banner'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { PrimitiveBoundary } from '@/components/error/primitive-boundary'
import { PrimaryPlayCta } from '@/components/kingdom/primary-play-cta'
import { MissionRibbon } from '@/components/pro-mission/mission-ribbon'
import { ARENA_COPY } from '@/lib/content/editorial'
import type { ArenaDifficulty } from '@/lib/game/types'
import type { PlayerColor } from '@/lib/game/use-chess-game'

const DIFFICULTY_CARD: Record<
  ArenaDifficulty,
  {
    piece: 'pawn' | 'knight' | 'bishop'
    score: string
  }
> = {
  easy: { piece: 'pawn', score: '0 - 800' },
  medium: { piece: 'knight', score: '800 - 1500' },
  hard: { piece: 'bishop', score: '1500 - 2200' },
}

const DIFFICULTY_ORDER: ArenaDifficulty[] = ['easy', 'medium', 'hard']
const COLOR_ORDER: PlayerColor[] = ['w', 'b']
const COLOR_CARD: Record<
  PlayerColor,
  { label: string; piece: 'w-pawn' | 'b-pawn' }
> = {
  w: { label: ARENA_COPY.playAsWhite, piece: 'w-pawn' },
  b: { label: ARENA_COPY.playAsBlack, piece: 'b-pawn' },
}

const SURFACE = 'arena-select'
const ATMOSPHERE = 'adventure'

type SoftGate = {
  onLearn: () => void
  onDismiss: () => void
}

type PrizePool = {
  formatted: string | null
  isLoading: boolean
}

type Props = {
  difficulty: ArenaDifficulty
  playerColor: PlayerColor
  onSelectDifficulty: (d: ArenaDifficulty) => void
  onSelectColor: (c: PlayerColor) => void
  onStart: () => void
  onBack?: () => void
  softGate?: SoftGate
  prizePool?: PrizePool
  errorMessage?: string | null
  onError?: (
    context: import('@/components/error/primitive-boundary').PrimitiveBoundaryErrorContext,
  ) => void
}

/** Arena selecting-state scaffold — applies the kingdom-anchored 3-zone
 *  pattern (HUD / body / footer) to the difficulty + color picker.
 *  Mirror of `<HubScaffold>`: pure presentational, caller owns telemetry,
 *  navigation, and on-chain side effects. Each primitive is wrapped in
 *  `<PrimitiveBoundary>` so a single child crash does not blank the
 *  whole surface. */
export function ArenaSelectScaffold({
  difficulty,
  playerColor,
  onSelectDifficulty,
  onSelectColor,
  onStart,
  onBack,
  softGate,
  prizePool,
  errorMessage,
  onError,
}: Props) {
  const wrap = (primitiveName: string, children: ReactNode) => (
    <PrimitiveBoundary
      primitiveName={primitiveName}
      surface={SURFACE}
      atmosphere={ATMOSPHERE}
      onError={onError}
    >
      {children}
    </PrimitiveBoundary>
  )

  return (
    <main
      className="arena-scaffold"
      aria-label={`Chesscito ${ARENA_COPY.title}`}
    >
      <header className="arena-scaffold-hud">
        <div className="arena-scaffold-hud-top">
          <h2 className="arena-scaffold-title">{ARENA_COPY.title}</h2>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={ARENA_COPY.backToHub}
              className="arena-scaffold-back"
            >
              <CandyBanner name="btn-back" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {/* <p className="arena-scaffold-subtitle">{ARENA_COPY.subtitle}</p> */}
      </header>

      <section className="arena-scaffold-body">
        {softGate ? (
          <div
            role="region"
            aria-label="Warm-up gate"
            className="arena-scaffold-soft-gate"
          >
            <p className="arena-scaffold-soft-gate-title">
              {ARENA_COPY.softGateTitle}
            </p>
            <p className="arena-scaffold-soft-gate-body">
              {ARENA_COPY.softGateBody}
            </p>
            <div className="arena-scaffold-soft-gate-actions">
              <button
                type="button"
                onClick={softGate.onLearn}
                className="arena-scaffold-soft-gate-primary"
              >
                {ARENA_COPY.softGateLearn}
              </button>
              <button
                type="button"
                onClick={softGate.onDismiss}
                className="arena-scaffold-soft-gate-secondary"
              >
                {ARENA_COPY.softGateEnter}
              </button>
            </div>
          </div>
        ) : null}

        {prizePool ? (
          <div
            className="arena-scaffold-prize-pool"
            aria-label={ARENA_COPY.prizePoolLabel}
          >
            <img
              src="/art/arena/community-pool.png"
              alt=""
              aria-hidden="true"
              className="arena-scaffold-prize-pool-icon"
            />
            <div className="arena-scaffold-prize-pool-text">
              <span className="arena-scaffold-prize-pool-headline">
                {ARENA_COPY.prizePoolLabel}
                {' · '}
                <span className="tabular-nums">
                  {prizePool.isLoading
                    ? ARENA_COPY.prizePoolLoading
                    : prizePool.formatted ?? ARENA_COPY.prizePoolUnavailable}
                </span>
              </span>
              <span className="arena-scaffold-prize-pool-hint">
                {ARENA_COPY.prizePoolSoonHint}
              </span>
            </div>
          </div>
        ) : null}

        <div
          role="group"
          aria-label="Choose your color"
          className="arena-scaffold-color-toggle"
        >
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={playerColor === c}
              aria-label={COLOR_CARD[c].label}
              onClick={() => onSelectColor(c)}
              className="arena-scaffold-color-pill"
            >
              {playerColor === c ? (
                <CandyIcon
                  name="check"
                  className="arena-scaffold-selected-badge reward-tile-status--claimed"
                />
              ) : null}
              <picture className="arena-scaffold-color-piece">
                <source
                  srcSet={`/art/redesign/pieces/${COLOR_CARD[c].piece}.avif`}
                  type="image/avif"
                />
                <source
                  srcSet={`/art/redesign/pieces/${COLOR_CARD[c].piece}.webp`}
                  type="image/webp"
                />
                <img
                  src={`/art/redesign/pieces/${COLOR_CARD[c].piece}.png`}
                  alt=""
                />
              </picture>
              <span className="arena-scaffold-color-copy">
                <span>Play as</span>
                <strong>{c === 'w' ? 'White' : 'Black'}</strong>
              </span>
            </button>
          ))}
        </div>

        <ul className="arena-scaffold-difficulty">
          {DIFFICULTY_ORDER.map((key) => (
            <li key={key}>
              <button
                type="button"
                aria-pressed={difficulty === key}
                onClick={() => onSelectDifficulty(key)}
                className="arena-scaffold-difficulty-pill"
              >
                {difficulty === key ? (
                  <CandyIcon
                    name="check"
                    className="arena-scaffold-selected-badge reward-tile-status--claimed"
                  />
                ) : null}
                <picture className="arena-scaffold-difficulty-piece">
                  <source
                    srcSet={`/art/redesign/pieces/w-${DIFFICULTY_CARD[key].piece}.avif`}
                    type="image/avif"
                  />
                  <source
                    srcSet={`/art/redesign/pieces/w-${DIFFICULTY_CARD[key].piece}.webp`}
                    type="image/webp"
                  />
                  <img
                    src={`/art/redesign/pieces/w-${DIFFICULTY_CARD[key].piece}.png`}
                    alt=""
                  />
                </picture>
                <span className="arena-scaffold-difficulty-text">
                  <span className="arena-scaffold-difficulty-label">
                    {ARENA_COPY.difficulty[key]}
                  </span>
                  <span className="arena-scaffold-difficulty-desc">
                    {ARENA_COPY.difficultyDesc[key]}
                  </span>
                  <span className="arena-scaffold-difficulty-score">
                    <CandyIcon
                      name="trophy"
                      className="arena-scaffold-difficulty-trophy"
                      aria-hidden="true"
                    />
                    {DIFFICULTY_CARD[key].score}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {errorMessage ? (
          <p role="alert" className="arena-scaffold-error">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <footer className="arena-scaffold-footer">
        {wrap('MissionRibbon', <MissionRibbon surface="arena" />)}
        {wrap(
          'PrimaryPlayCta',
          <PrimaryPlayCta
            surface="arena-entry"
            label={ARENA_COPY.startMatch}
            ariaLabel={ARENA_COPY.startMatch}
            onPress={onStart}
          />,
        )}
      </footer>
    </main>
  )
}
