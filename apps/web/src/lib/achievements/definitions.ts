import type { VictoryEntry } from "@/lib/game/victory-events";

/** Difficulty numeric values on-chain. 1 = Easy, 2 = Medium, 3 = Hard. */
export const DIFFICULTY_HARD = 3;
export const DIFFICULTY_MEDIUM = 2;

/**
 * Every achievement is derived entirely from existing on-chain data
 * (Victory NFTs). No new contracts required.
 *
 * Each definition has:
 *   id          — stable key, used for React keys + localStorage if ever needed
 *   goal        — numeric threshold for progress display (undefined = boolean)
 *   check(vs)   — returns { earned, progress? } given the player's victories
 *
 * Copy lives in editorial.ts (ACHIEVEMENTS_COPY) so all user-facing text
 * stays centralised.
 */

export type AchievementCheck = {
  earned: boolean;
  /** 0–N progress toward the goal when not yet earned (optional for boolean-only). */
  progress?: { current: number; goal: number };
};

export type AchievementDef = {
  id: string;
  goal?: number;
  check: (victories: VictoryEntry[]) => AchievementCheck;
};

const SPEEDRUN_MOVE_LIMIT = 20;
const RAPID_TIME_LIMIT_MS = 30_000;

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    id: "first-victory",
    goal: 1,
    check(vs) {
      const current = Math.min(vs.length, 1);
      return {
        earned: vs.length >= 1,
        progress: vs.length >= 1 ? undefined : { current, goal: 1 },
      };
    },
  },
  {
    id: "arena-champion-medium",
    check(vs) {
      return { earned: vs.some((v) => v.difficulty >= DIFFICULTY_MEDIUM) };
    },
  },
  {
    id: "arena-champion-hard",
    check(vs) {
      return { earned: vs.some((v) => v.difficulty === DIFFICULTY_HARD) };
    },
  },
  {
    id: "speedrunner",
    check(vs) {
      return { earned: vs.some((v) => v.totalMoves > 0 && v.totalMoves <= SPEEDRUN_MOVE_LIMIT) };
    },
  },
  {
    id: "rapid-finish",
    check(vs) {
      return { earned: vs.some((v) => v.timeMs > 0 && v.timeMs <= RAPID_TIME_LIMIT_MS) };
    },
  },
  {
    id: "five-crowns",
    goal: 5,
    check(vs) {
      return {
        earned: vs.length >= 5,
        progress: vs.length >= 5 ? undefined : { current: vs.length, goal: 5 },
      };
    },
  },
  {
    id: "dedication",
    goal: 25,
    check(vs) {
      return {
        earned: vs.length >= 25,
        progress: vs.length >= 25 ? undefined : { current: vs.length, goal: 25 },
      };
    },
  },
];
