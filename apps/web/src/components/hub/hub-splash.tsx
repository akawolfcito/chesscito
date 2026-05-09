"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { track } from "@/lib/telemetry";

/** Phase 4 commit 1 — Hub V2 onboarding splash primitive (Splash A per
 *  design-lock §1.1). Renders once on first-ever-visit; never re-mounts
 *  after dismiss. Tap-anywhere or Enter/Space dismisses (P0-3 fix: no
 *  auto-dismiss timer, WCAG 2.2.1 compliance).
 *
 *  This commit ships the primitive contract only — `splash-knight-hero.webp`
 *  asset wiring + `HUB_V2_SPLASH_COPY` migration land in commit 2 once the
 *  hero crop is delivered. The dialog is also NOT yet mounted into
 *  `<HubScaffoldV2Client>`; that integration arrives with the `?hub=v2`
 *  flag in Phase 7.
 *
 *  Design-lock spec: `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` §1.1 + §9.2 */

const SPLASH_FLAG_KEY = "chesscito:hub-v2:splash:seen";
/** 1200ms entrance pulse + 600ms breathing room before the dismiss hint
 *  fades in (design-lock §1.1, motion table §4). Reduced-motion bypasses
 *  the timer and reveals the hint at mount. */
const HINT_DELAY_MS = 1800;

function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HubV2Splash() {
  // Three-state flag: `null` = not yet read (prevents first-paint flash on
  // returning visitors), `true` = already seen (don't render), `false` =
  // first-visit (render).
  const [seenFlag, setSeenFlag] = useState<boolean | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountStartRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem(SPLASH_FLAG_KEY);
    const reduced = detectReducedMotion();
    setReducedMotion(reduced);
    setSeenFlag(stored !== null);

    if (stored !== null) return undefined;

    mountStartRef.current = Date.now();
    track("splash_view");

    if (reduced) {
      setHintVisible(true);
      return undefined;
    }

    const handle = setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    return () => clearTimeout(handle);
  }, []);

  // Focus the dialog after it commits to the DOM so screen readers announce
  // the title (P1-11 keyboard focus gap fix). Runs after the seenFlag
  // transitions from null → false and the conditional render below mounts.
  useEffect(() => {
    if (seenFlag === false) {
      dialogRef.current?.focus();
    }
  }, [seenFlag]);

  const dismiss = useCallback(() => {
    const elapsedMs = mountStartRef.current
      ? Date.now() - mountStartRef.current
      : 0;
    localStorage.setItem(SPLASH_FLAG_KEY, "1");
    track("splash_dismiss", { method: "tap", elapsedMs });
    setSeenFlag(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dismiss();
      }
    },
    [dismiss],
  );

  if (seenFlag !== false) return null;

  return (
    <div
      ref={dialogRef}
      data-testid="hub-v2-splash"
      data-component="hub-v2-splash"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
      tabIndex={-1}
      onClick={dismiss}
      onKeyDown={handleKeyDown}
    >
      {/* Hero placeholder — splash-knight-hero.webp lands in Phase 4 commit 2. */}
      <div data-testid="splash-hero" />
      {/* TODO(phase-4-commit-2): move strings to HUB_V2_SPLASH_COPY in editorial.ts */}
      <h2 id="splash-title">Welcome, friend</h2>
      <p>Small plays. Big habits.</p>
      <p
        data-testid="splash-hint"
        data-visible={hintVisible ? "true" : "false"}
      >
        (tap anywhere)
      </p>
    </div>
  );
}
