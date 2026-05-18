// apps/web/src/lib/hub/hero-cta.ts
import { HERO_CTA_COPY } from "@/lib/content/editorial";

export type HeroVariant = "new-player" | "daily-pending" | "default";

export type HeroContextState = {
  isLoading: boolean;
  exercisesCompletedCount: number;
  dailyHistoryCount: number;
  isDailyCompletedToday: boolean;
};

export type HeroCTA = {
  variant: HeroVariant;
  label: string;
  sub: string;
  destination: string | null; // null = no nav (default state highlights LEARN rail)
  color: "amber" | "blue";
};

const FALLBACK_DEFAULT: HeroCTA = {
  variant: "default",
  label: HERO_CTA_COPY.defaultCaughtUp.label,
  sub: HERO_CTA_COPY.defaultCaughtUp.sub,
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
      label: HERO_CTA_COPY.newPlayer.label,
      sub: HERO_CTA_COPY.newPlayer.sub,
      destination: "/exercises?piece=rook",
      color: "amber",
    };
  }

  // daily-pending: today's daily not solved
  if (!state.isDailyCompletedToday) {
    return {
      variant: "daily-pending",
      label: HERO_CTA_COPY.dailyPending.label,
      sub: HERO_CTA_COPY.dailyPending.sub,
      destination: "/exercises?slot=daily",
      color: "blue",
    };
  }

  return FALLBACK_DEFAULT;
}
