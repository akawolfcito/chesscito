// apps/web/src/lib/hub/hero-cta.ts

export type HeroVariant = "new-player" | "daily-pending" | "default";

export type HeroContextState = {
  isLoading: boolean;
  exercisesCompletedCount: number;
  dailyHistoryCount: number;
  isDailyCompletedToday: boolean;
};

/**
 * Pure routing decision: returns the variant + destination + color
 * for the hub hero CTA. Labels are NOT baked in — callers resolve
 * `t(\`heroCta.${variant}.label\`)` and
 * `t(\`heroCta.${variant}.sub\`)` so the chip localizes per request.
 */
export type HeroCTA = {
  variant: HeroVariant;
  destination: string | null; // null = no nav (default state highlights LEARN rail)
  color: "amber" | "blue";
};

const FALLBACK_DEFAULT: HeroCTA = {
  variant: "default",
  destination: null,
  color: "amber",
};

export function getHeroContextAction(state: HeroContextState): HeroCTA {
  // Loading state: never flash new-player while data is hydrating (P1-7)
  if (state.isLoading) return FALLBACK_DEFAULT;

  // new-player: 0 exercises AND 0 daily history (genuinely never played)
  if (state.exercisesCompletedCount === 0 && state.dailyHistoryCount === 0) {
    return {
      variant: "new-player",
      destination: "/exercises?piece=rook",
      color: "amber",
    };
  }

  // daily-pending: today's daily not solved
  if (!state.isDailyCompletedToday) {
    return {
      variant: "daily-pending",
      destination: "/exercises?slot=daily",
      color: "blue",
    };
  }

  return FALLBACK_DEFAULT;
}
