"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useTranslations } from "next-intl";

import { track } from "@/lib/telemetry";

const ARIA_TITLE_ID = "splash-title";

/** Hub V2 onboarding splash primitive (Splash A per design-lock §1.1).
 *  Renders once on first-ever-visit; never re-mounts after dismiss.
 *  Tap-anywhere or Enter/Space dismisses (P0-3 fix: no auto-dismiss timer,
 *  WCAG 2.2.1 compliance).
 *
 *  Phase 4 commit 1 (`26fd0e8`) shipped the primitive contract.
 *  Phase 4 commit 2 wires `HUB_V2_SPLASH_COPY` (editorial.ts §2.1) and
 *  introduces a decorative SVG placeholder for the hero — the real
 *  `splash-knight-hero.webp` (≤6 KB, design-lock §3.2) lands in commit 3
 *  once the hero crop is delivered. Hub scaffold integration is wired
 *  separately in the rails reframe (Phase 5).
 *
 *  Design-lock spec: `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-design-lock.md` §1.1 + §2.1 + §9.2 */

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
  const t = useTranslations("HUB_V2_SPLASH_COPY");
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
      aria-labelledby={ARIA_TITLE_ID}
      tabIndex={-1}
      onClick={dismiss}
      onKeyDown={handleKeyDown}
    >
      {/* Decorative placeholder until splash-knight-hero.webp ships
       *  (design-lock §3.2 — ≤6 KB WebP, gold-tinted hero crop). The
       *  inline SVG keeps layout/aria stable so commit 3 swap is purely
       *  asset-level. aria-hidden because the dialog is already labelled
       *  by the title element. */}
      <svg
        data-testid="splash-hero"
        data-component="hub-v2-splash-hero-placeholder"
        className="hub-v2-splash-hero"
        width="160"
        height="160"
        viewBox="0 0 160 160"
        aria-hidden="true"
        role="presentation"
      >
        <rect
          x="2"
          y="2"
          width="156"
          height="156"
          rx="14"
          fill="none"
          stroke="currentColor"
          strokeDasharray="6 4"
          opacity="0.4"
        />
        <text
          x="80"
          y="104"
          fontSize="80"
          textAnchor="middle"
          fill="currentColor"
          opacity="0.55"
        >
          ♞
        </text>
      </svg>
      <h2 id={ARIA_TITLE_ID}>{t("title")}</h2>
      <p>{t("tagline")}</p>
      <p
        data-testid="splash-hint"
        data-visible={hintVisible ? "true" : "false"}
      >
        {t("dismissHint")}
      </p>
    </div>
  );
}
