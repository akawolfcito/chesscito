"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { CandyCard } from "@/components/redesign/candy-card";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import { WELCOME_COPY } from "@/lib/content/editorial";
import { useOnboardingSignal } from "@/hooks/use-onboarding-signal";
import { track } from "@/lib/telemetry";
import {
  dismissWelcome,
  isWelcomeDismissed,
} from "@/lib/welcome/state";

type Card = {
  icon: CandyIconName;
  title: string;
  body: string;
};

const CARDS: Card[] = [
  {
    icon: "trophy",
    title: WELCOME_COPY.slide1Title,
    body: WELCOME_COPY.slide1Body,
  },
  {
    icon: "coach",
    title: WELCOME_COPY.slide2Title,
    body: WELCOME_COPY.slide2Body,
  },
  {
    icon: "crown",
    title: WELCOME_COPY.slide3Title,
    body: WELCOME_COPY.slide3Body,
  },
];

type WelcomeOverlayProps = {
  /** When true, suppresses the overlay even if the user is on
   *  first-run. Used by the play-hub to hide welcome cards when any
   *  dock sheet (shop, badges, trophies, leaderboard, arena) or the
   *  PRO sheet is open, so the onboarding never lands on top of
   *  another overlay. The first-run flag is preserved either way —
   *  once the suppressing sheet closes the welcome overlay re-renders
   *  and the user sees it then. */
  suppressed?: boolean;
};

/**
 * WelcomeOverlay — first-run 3-card onboarding shown once per
 * device AND only to wallets with no detectable on-chain progress.
 *
 * Cluster D (addendum §2.1 + §0.2/§0.3):
 *  - `useOnboardingSignal` runs PRO + badge + shield + founder reads
 *    in parallel; first positive commits "returning" and the overlay
 *    self-dismisses (no carousel friction for returning users).
 *  - Fresh wallets see the gold candy frame, English copy, persistent
 *    `[Skip]` link on every slide.
 *  - The `chesscito:welcome-dismissed` flag persists across reloads;
 *    `useOnboardingSignal`'s separate `chesscito:onboarding-signal:*`
 *    cache (7-day TTL) skips the network reads on repeat visits.
 */
export function WelcomeOverlay({ suppressed = false }: WelcomeOverlayProps = {}) {
  const { address } = useAccount();
  const signal = useOnboardingSignal(address);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Cluster D Blind hunter defer #4 (2026-05-20): funnel telemetry —
  // dedupes `welcome_view` so re-renders on the same slide don't double-fire
  // (StrictMode mount/unmount/mount or signal-cache resolution flickers).
  const viewFiredRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isWelcomeDismissed()) setOpen(true);
  }, []);

  // When the signal commits "returning", auto-dismiss without showing
  // the carousel — the user has prior progress on this wallet.
  useEffect(() => {
    if (signal.status === "returning" && open) {
      // Funnel telemetry: distinguish "user finished" vs "system auto-skipped"
      // by source. Fired BEFORE dismissWelcome so the at_slide reflects the
      // last slide actually shown (or 0 if signal beat the first paint).
      track("welcome_auto_dismissed", {
        signal: signal.signal,
        at_slide: index,
      });
      dismissWelcome();
      setOpen(false);
    }
  }, [signal.status, signal.signal, open, index]);

  // Funnel telemetry: fire `welcome_view` once per slide_index the user
  // actually sees. Gated by the same rendering conditions as the early
  // returns below so suppressed / resolving / dismissed states stay silent.
  useEffect(() => {
    if (!open || suppressed) return;
    if (signal.status === "resolving") return;
    if (viewFiredRef.current.has(index)) return;
    viewFiredRef.current.add(index);
    track("welcome_view", {
      slide_index: index,
      slide_count: CARDS.length,
    });
  }, [open, suppressed, signal.status, index]);

  if (!open || suppressed) return null;
  // Suppress the flash of carousel while the signal is still resolving
  // (cold MiniPay-Vercel cold start). Without this, returning users on
  // a cache miss would see 1-2 frames of the carousel before signal
  // resolves and dismisses it.
  if (signal.status === "resolving") return null;

  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  function handleNext() {
    if (isLast) {
      track("welcome_complete", { via: "play_cta", final_slide: index });
      dismissWelcome();
      setOpen(false);
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleSkip() {
    track("welcome_skip", {
      at_slide: index,
      slide_count: CARDS.length,
    });
    dismissWelcome();
    setOpen(false);
  }

  return (
    <div
      data-testid="welcome-overlay"
      className="candy-modal-scrim fixed inset-0 z-[70] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-card-title"
      aria-roledescription="carousel"
    >
      {/* Slide content container — WAI-ARIA APG carousel pattern places
       *  `aria-roledescription="slide"` + the slide counter label on
       *  the CONTENT element, not on the action region. Patched per
       *  Cluster D review (Edge case hunter #7). */}
      <div
        data-slide-index={index}
        aria-roledescription="slide"
        aria-label={`Slide ${index + 1} of ${CARDS.length}`}
        className="contents"
      >
      <CandyCard
        atmosphere="gold"
        className="w-full max-w-[340px] items-center text-center"
        media={
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(245, 158, 11, 0.22)",
              border: "1px solid rgba(245, 158, 11, 0.55)",
            }}
            aria-hidden="true"
          >
            <CandyIcon name={card.icon} className="h-9 w-9" />
          </span>
        }
        footer={
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={handleNext}
              data-testid="welcome-next"
              className="rounded-full px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide"
              style={{
                background: "rgba(63, 34, 8, 0.92)",
                color: "rgba(255, 245, 215, 0.98)",
                boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.18)",
              }}
            >
              {isLast ? WELCOME_COPY.ctaPlay : WELCOME_COPY.ctaContinue}
            </button>
            {/* Persistent Skip — visible on EVERY slide per §0.2 escape
             *  hatch, including the terminal slide. Same destination as
             *  the Play CTA (dismiss + stay on /exercises). */}
            <button
              type="button"
              onClick={handleSkip}
              data-testid="welcome-skip"
              className="text-xs font-bold underline-offset-4 opacity-70 hover:underline"
            >
              {WELCOME_COPY.ctaSkip}
            </button>
          </div>
        }
      >
        <h2
          id="welcome-card-title"
          className="candy-card-title fantasy-title text-lg leading-tight"
        >
          {card.title}
        </h2>
        <p className="text-sm leading-relaxed opacity-85">{card.body}</p>

        <div className="flex justify-center gap-1.5 pt-1" aria-hidden="true">
          {CARDS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? "1.25rem" : "0.5rem",
                background:
                  i === index
                    ? "rgba(63, 34, 8, 0.85)"
                    : "rgba(63, 34, 8, 0.30)",
              }}
            />
          ))}
        </div>
      </CandyCard>
      </div>
    </div>
  );
}
