import { MISSION_RIBBON_COPY } from "@/lib/content/editorial";

export type MissionRibbonSurface =
  | "hub"
  | "arena"
  | "pro-sheet"
  | "landing-cta-bar";
export type MissionRibbonTone = "default" | "emphatic";
export type Atmosphere = "adventure" | "scholarly";

type Props = {
  surface: MissionRibbonSurface;
  tone?: MissionRibbonTone;
  /** Visual register. Adventure (default) for Hub/Arena/landing-cta-bar;
   *  Scholarly for the PRO sheet hybrid (canon §11). */
  atmosphere?: Atmosphere;
  className?: string;
};

/** Per-surface mission tagline rendered ABOVE every payment CTA (canon §11
 *  rule: mission before CTA). Pure presentational — copy is single-sourced
 *  from `editorial.ts.MISSION_RIBBON_COPY[surface]`. The reveal animation
 *  is owned by CSS via `--duration-mission-ribbon-reveal`. */
export function MissionRibbon({
  surface,
  tone = "default",
  atmosphere = "adventure",
  className = "",
}: Props) {
  const classes = [
    "mission-ribbon",
    `mission-ribbon--${surface}`,
    `mission-ribbon--tone-${tone}`,
    `is-atmosphere-${atmosphere}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p
      role="note"
      aria-label={MISSION_RIBBON_COPY.ariaLabel}
      className={classes}
    >
      {MISSION_RIBBON_COPY[surface]}
    </p>
  );
}
