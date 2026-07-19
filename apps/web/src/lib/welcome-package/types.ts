export interface WelcomePackageState {
  version: 1;
  unlocked: boolean;
  unlockedAt: string | null;
  claimed: boolean;
  claimedAt: string | null;
  dismissed: boolean;
  dismissedAt: string | null;
  dismissCount: number;
  autoShowCount: number;
}

export const WELCOME_PACKAGE_REWARD = {
  id: "focus-stamp-day1",
  kind: "cosmetic",
  label: "Focus Stamp: Day 1",
  assetSlot: "welcome.focus-stamp",
} as const;
