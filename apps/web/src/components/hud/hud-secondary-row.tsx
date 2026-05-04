import { HudResourceChip } from "./hud-resource-chip";
import { HUD_COPY } from "@/lib/content/editorial";

type Stars = {
  current: number;
  total: number;
};

type Props = {
  streak?: number | null;
  stars?: Stars | null;
  shields?: number | null;
  className?: string;
};

/** Conditional second HUD row for power-user resources. Adventure primitive
 *  rendered ONLY when at least one chip has live content — collapses to
 *  null otherwise so the Hub layout stays compact for new players.
 *
 *  Chip order is fixed: streak → stars → shields. The future ELO Chesscito
 *  chip slots after shields once `editorial.ts.HUD_COPY` exposes its label
 *  + formatter (currently out of scope for Phase 0.5+ visual coherence). */
export function HudSecondaryRow({
  streak = null,
  stars = null,
  shields = null,
  className = "",
}: Props) {
  const hasStreak = typeof streak === "number";
  const hasStars = stars !== null && stars !== undefined;
  const hasShields = typeof shields === "number";

  if (!hasStreak && !hasStars && !hasShields) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={HUD_COPY.secondaryRowAriaLabel}
      className={`hud-secondary-row ${className}`.trim()}
    >
      {hasStreak ? (
        <HudResourceChip
          tone="default"
          size="compact"
          icon="time"
          value={HUD_COPY.streakFormat(streak as number)}
          ariaLabel={HUD_COPY.streakAriaLabel(streak as number)}
        />
      ) : null}
      {hasStars ? (
        <HudResourceChip
          tone="default"
          size="compact"
          icon="star"
          value={HUD_COPY.starsFormat(stars!.current, stars!.total)}
          ariaLabel={HUD_COPY.starsAriaLabel(stars!.current, stars!.total)}
        />
      ) : null}
      {hasShields ? (
        <HudResourceChip
          tone="default"
          size="compact"
          icon="shield"
          value={HUD_COPY.shieldsFormat(shields as number)}
          ariaLabel={HUD_COPY.shieldsAriaLabel(shields as number)}
        />
      ) : null}
    </div>
  );
}
