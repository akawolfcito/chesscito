import { MISSION_RIBBON_COPY } from "@/lib/content/editorial";

export type MissionRibbonSurface =
  | "hub"
  | "arena"
  | "pro-sheet"
  | "landing-cta-bar";
export type MissionRibbonTone = "default" | "emphatic";

type Props = {
  surface: MissionRibbonSurface;
  tone?: MissionRibbonTone;
  className?: string;
};

/** Per-surface mission tagline rendered ABOVE every payment CTA (canon §11
 *  rule: mission before CTA). Pure presentational — copy is single-sourced
 *  from `editorial.ts.MISSION_RIBBON_COPY[surface]`. The reveal animation
 *  is owned by CSS via `--duration-mission-ribbon-reveal`. */
export function MissionRibbon({
  surface,
  tone = "default",
  className = "",
}: Props) {
  const classes = [
    "mission-ribbon",
    `mission-ribbon--${surface}`,
    `mission-ribbon--tone-${tone}`,
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
