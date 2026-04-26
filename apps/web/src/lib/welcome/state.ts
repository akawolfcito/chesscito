/**
 * First-run welcome — minimal localStorage flag so the 3-card
 * onboarding only fires once per device. Dismissal is permanent;
 * the player never sees the overlay again from the same browser.
 */

const STORAGE_KEY = "chesscito:welcome-dismissed";

export function isWelcomeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* quota / privacy mode — accept the dismissal in-memory only */
  }
}

export function resetWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
