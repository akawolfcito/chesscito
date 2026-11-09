import { MISSION_RIBBON_COPY } from '@/lib/content/editorial'

export type MissionRibbonSurface =
  | 'hub'
  | 'arena'
  | 'pro-sheet'
  | 'exercises'
export type MissionRibbonTone = 'default' | 'emphatic'
export type Atmosphere = 'adventure' | 'scholarly'

type Props = {
  surface: MissionRibbonSurface
  /** Optional copy override. When provided, the primitive renders this
   *  text instead of `MISSION_RIBBON_COPY[surface]`. Used by
   *  `surface="exercises"` to feed runtime `pieceHint`. When omitted,
   *  falls back to the editorial map — preserving existing callsites. */
  text?: string
  tone?: MissionRibbonTone
  /** Visual register. Adventure (default) for Hub/Arena; Scholarly for the
   *  PRO sheet hybrid (canon §11). */
  atmosphere?: Atmosphere
  className?: string
}

/** Per-surface mission tagline rendered ABOVE every payment CTA (canon §11
 *  rule: mission before CTA). Pure presentational — default copy is
 *  single-sourced from `editorial.ts.MISSION_RIBBON_COPY[surface]`; an
 *  optional `text` prop overrides for runtime-computed strings (e.g.
 *  exercise pieceHint). The reveal animation is owned by CSS via
 *  `--duration-mission-ribbon-reveal`. */
export function MissionRibbon({
  surface,
  text,
  tone = 'default',
  atmosphere = 'adventure',
  className = '',
}: Props) {
  const content = text ?? MISSION_RIBBON_COPY[surface]
  const classes = [
    'mission-ribbon',
    `mission-ribbon--${surface}`,
    `mission-ribbon--tone-${tone}`,
    `is-atmosphere-${atmosphere}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (surface === 'hub' && text == null) {
    return (
      <p
        role="note"
        aria-label={MISSION_RIBBON_COPY.ariaLabel}
        className={classes}
      >
        <span className="sr-only">{content}</span>
        {/* <img
          src="/art/scene-rooted/sms-chesscito.png"
          alt=""
          aria-hidden="true"
          className="mission-ribbon-img"
        /> */}
      </p>
    )
  }

  return (
    <p
      role="note"
      aria-label={MISSION_RIBBON_COPY.ariaLabel}
      className={classes}
    >
      {content}
    </p>
  )
}
