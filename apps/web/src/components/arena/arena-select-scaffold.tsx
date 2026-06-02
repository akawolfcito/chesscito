'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

import { ContextualHeader } from '@/components/ui/contextual-header'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { PrimitiveBoundary } from '@/components/error/primitive-boundary'
import { PrimaryPlayCta } from '@/components/kingdom/primary-play-cta'
import { MissionRibbon } from '@/components/pro-mission/mission-ribbon'
import { SoftGateSheet } from '@/components/arena/soft-gate-sheet'
import type { ArenaDifficulty } from '@/lib/game/types'
import type { PlayerColor } from '@/lib/game/use-chess-game'

/* Green check pill — clones the PRO sheet perk badge styling
   (pro-sheet.tsx:389-399) so selection feedback across PRO and the
   arena selector reads as the same visual vocabulary. */
function SelectedCheck() {
  return (
    <span
      aria-hidden="true"
      className="arena-scaffold-selected-badge flex items-center justify-center rounded-full text-sm font-bold text-white"
      style={{
        background: 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.22)',
        border: '2px solid rgba(255, 255, 255, 0.9)',
      }}
    >
      ✓
    </span>
  )
}

const DIFFICULTY_CARD: Record<
  ArenaDifficulty,
  {
    piece: 'pawn' | 'knight' | 'bishop'
    score: string
  }
> = {
  easy: { piece: 'pawn', score: '0 - 800 ELO' },
  medium: { piece: 'knight', score: '801 - 1500 ELO' },
  hard: { piece: 'bishop', score: '1501 - 2200 ELO' },
}

const DIFFICULTY_ORDER: ArenaDifficulty[] = ['easy', 'medium', 'hard']
const COLOR_ORDER: PlayerColor[] = ['w', 'b']
const COLOR_PIECE: Record<PlayerColor, 'w-pawn' | 'b-pawn'> = {
  w: 'w-pawn',
  b: 'b-pawn',
}

const SURFACE = 'arena-select'
const ATMOSPHERE = 'adventure'

type SoftGate = {
  onLearn: () => void
  onDismiss: () => void
}

type Props = {
  difficulty: ArenaDifficulty
  playerColor: PlayerColor
  onSelectDifficulty: (d: ArenaDifficulty) => void
  onSelectColor: (c: PlayerColor) => void
  onStart: () => void
  onBack?: () => void
  softGate?: SoftGate
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
  errorMessage,
  onError,
}: Props) {
  const t = useTranslations('ARENA_COPY')
  const arenaTitle = t('title')
  const colorLabels: Record<PlayerColor, string> = {
    w: t('playAsWhite'),
    b: t('playAsBlack'),
  }
  const colorNames: Record<PlayerColor, string> = {
    w: t('playAsWhiteName'),
    b: t('playAsBlackName'),
  }
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
      aria-label={t('scaffoldPageAriaFormat', { title: arenaTitle })}
    >
      {/* Divider DROPPED on purpose (Sally pass 8, 2026-05-20):
       *  /arena selection is the entrance ramp to gameplay — diegetic,
       *  not navigation. Per the canonical rule, divider presence
       *  signals "meta" and absence signals "you're playing". */}
      <header className="arena-scaffold-hud">
        {onBack ? (
          <ContextualHeader
            variant="back-control"
            title={arenaTitle}
            back={{ onClick: onBack, label: t('backToHubAria') }}
          />
        ) : (
          <ContextualHeader variant="title" title={arenaTitle} />
        )}
      </header>

      <section className="arena-scaffold-body">
        <SoftGateSheet softGate={softGate} />

        <div
          role="group"
          aria-label={t('colorPickerAriaLabel')}
          className="arena-scaffold-color-toggle"
        >
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={playerColor === c}
              aria-label={colorLabels[c]}
              onClick={() => onSelectColor(c)}
              className="arena-scaffold-color-pill"
            >
              {playerColor === c ? <SelectedCheck /> : null}
              <picture className="arena-scaffold-color-piece">
                <source
                  srcSet={`/art/redesign/pieces/${COLOR_PIECE[c]}.avif`}
                  type="image/avif"
                />
                <source
                  srcSet={`/art/redesign/pieces/${COLOR_PIECE[c]}.webp`}
                  type="image/webp"
                />
                <img
                  src={`/art/redesign/pieces/${COLOR_PIECE[c]}.png`}
                  alt=""
                />
              </picture>
              <span className="arena-scaffold-color-copy">
                <span>{t('playAsPrefix')}</span>
                <span>{colorNames[c]}</span>
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
                {difficulty === key ? <SelectedCheck /> : null}
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
                    {t(`difficulty.${key}`)}
                  </span>
                  <span className="arena-scaffold-difficulty-desc">
                    {t(`difficultyDesc.${key}`)}
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
        {wrap(
          'PrimaryPlayCta',
          <PrimaryPlayCta
            surface="arena-entry"
            label={t('startMatch')}
            ariaLabel={t('startMatch')}
            onPress={onStart}
          />,
        )}
        {wrap(
          'MissionRibbon',
          <div className="pt-2 flex justify-center">
            <MissionRibbon surface="arena" />
          </div>,
        )}
      </footer>
    </main>
  )
}
