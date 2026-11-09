"use client";

import { useCallback, useState } from "react";

const STORAGE_PREFIX = "chesscito:connect-prompt-shown:";

export type ConnectPromptMilestone = "stars" | "victory" | "badges";

function storageKey(milestone: ConnectPromptMilestone): string {
  return `${STORAGE_PREFIX}${milestone}`;
}

function readShown(milestone: ConnectPromptMilestone): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(milestone)) === "1";
  } catch {
    return false;
  }
}

function writeShown(milestone: ConnectPromptMilestone): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(milestone), "1");
  } catch {
    // Quota-exceeded / disabled storage — fall through. The prompt
    // will re-fire on a future milestone hit; users without storage
    // simply opt out of the "shown once" guarantee.
  }
}

export interface UseConnectPromptResult {
  /** True while the toast/banner should be rendered. */
  isVisible: boolean;
  /** Call when the milestone is hit. No-op if the prompt has already
   *  been shown for this milestone in this browser. Idempotent — safe
   *  to call inside effects that may re-run. */
  show: () => void;
  /** Hide the toast. The "already shown" flag is set on `show()`, not
   *  here, so dismissing does NOT reset the one-shot guarantee. */
  dismiss: () => void;
}

/**
 * Tracks whether the "Connect to save your progress on-chain" nudge
 * has already fired for a given milestone (`stars` / `victory` /
 * `badges`) in this browser. Phase 2 of plan
 * `2026-05-25-account-chip-and-local-progress.md`.
 *
 * Contract:
 *   - `show()` is the only entry point that flips the localStorage
 *     flag. It does so the FIRST time it's called per milestone; any
 *     subsequent call is a no-op.
 *   - `dismiss()` only flips the in-memory visibility. It does not
 *     touch the flag, because the goal is to never re-nag the same
 *     milestone — whether the user actually dismissed or just
 *     navigated away.
 *   - Each milestone has its own flag, so they fire independently
 *     (a user dismissing the stars prompt still sees the victory one).
 *   - The hook does NOT check connection state. Callers should only
 *     invoke `show()` when the user is disconnected (the prompt is
 *     pointless for connected users). This keeps the hook pure.
 *
 * LocalStorage keys: `chesscito:connect-prompt-shown:{milestone}` →
 * value `"1"` once shown. Missing key = not yet shown.
 */
export function useConnectPrompt(
  milestone: ConnectPromptMilestone,
): UseConnectPromptResult {
  const [isVisible, setVisible] = useState(false);

  // Memoized so consumers can list `show` / `dismiss` (or the whole hook
  // result) as `useEffect` deps without thrashing — fresh references each
  // render would re-run the effect every commit. Caused a regression in
  // /arena where the `isPreparing → game.startGame()` 400ms timer kept
  // being torn down by neighbouring effects' deps changing.
  const show = useCallback((): void => {
    if (readShown(milestone)) return;
    writeShown(milestone);
    setVisible(true);
  }, [milestone]);

  const dismiss = useCallback((): void => {
    setVisible(false);
  }, []);

  return { isVisible, show, dismiss };
}
