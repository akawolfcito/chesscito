import type { WelcomePackageState } from "./types";
import { dispatchWelcomePackageChange } from "./welcome-package-events";

const STORAGE_KEY = "chesscito:welcome-package";

export const DEFAULT_STATE: WelcomePackageState = {
  version: 1,
  unlocked: false,
  unlockedAt: null,
  claimed: false,
  claimedAt: null,
  dismissed: false,
  dismissedAt: null,
  dismissCount: 0,
  autoShowCount: 0,
};

export function getWelcomePackageState(): WelcomePackageState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== 1) return { ...DEFAULT_STATE };
    return parsed as unknown as WelcomePackageState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** The single write path. It notifies AFTER the write, so every reader that
 *  subscribes to `welcome-package-events` re-reads committed state — never a
 *  mount-time snapshot. Notifying here (rather than in each caller) is
 *  deliberate: a future writer that forgets to dispatch cannot exist. */
export function setWelcomePackageState(state: WelcomePackageState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or privacy mode — skip persist
  }
  dispatchWelcomePackageChange();
}
