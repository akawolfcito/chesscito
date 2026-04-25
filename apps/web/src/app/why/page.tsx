"use client";

import Link from "next/link";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { Button } from "@/components/ui/button";
import { WHY_PAGE_COPY } from "@/lib/content/editorial";
import { THEME_CONFIG } from "@/lib/theme";
import { track } from "@/lib/telemetry";

/**
 * /why — Public landing page (MVP).
 *
 * Single-page vertical scroll. Mobile-first (max-width 390 px to match
 * the rest of Chesscito). This commit lands the page chrome + hero.
 * Subsequent commits in the spec plan add §2 → §8.
 *
 * Behavioral contract for the hero CTAs:
 *   - Primary  → navigates to "/" (Play Hub)
 *   - Secondary → smooth-scrolls to #purpose anchor (added in commit 2)
 *   - Both fire `why_cta_click` telemetry with a slot label so we can
 *     read the funnel later.
 */
export default function WhyPage() {
  const handlePrimaryCta = () => {
    track("why_cta_click", { slot: "hero-primary" });
  };

  const handleSecondaryCta = () => {
    track("why_cta_click", { slot: "hero-secondary" });
    if (typeof document !== "undefined") {
      document
        .getElementById("purpose")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main
      className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center"
      style={{ scrollBehavior: "smooth" }}
    >
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl"
        style={{ background: "var(--paper-bg)" }}
      >
        {/* Top bar — back arrow to Play Hub. Mirrors the legal-page
            shell so navigation feels consistent across secondary
            surfaces. */}
        <header
          className="relative flex items-center gap-3 border-b px-5 py-5 rounded-t-3xl"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center"
            aria-label={WHY_PAGE_COPY.back}
          >
            <CandyBanner name="btn-back" className="h-8 w-8" />
          </Link>
          <span
            className="fantasy-title text-sm font-extrabold uppercase tracking-[0.18em]"
            style={{
              color: "var(--paper-text-muted)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            Chesscito
          </span>
        </header>

        {/* Hero — players first. Eyebrow, headline, subcopy, dual CTA,
            visual placeholder. Visual is a styled candy frame around
            an existing in-world asset for now; commit 5 swaps it for
            the real Playwright-generated screenshot. */}
        <section className="flex flex-col items-center gap-5 px-5 pb-10 pt-8 text-center">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: "rgba(255, 245, 215, 0.85)",
              borderColor: "rgba(245, 158, 11, 0.55)",
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              boxShadow:
                "inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 1px 3px rgba(120, 65, 5, 0.18)",
            }}
          >
            {WHY_PAGE_COPY.hero.eyebrow}
          </span>

          <h1
            className="fantasy-title text-3xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow:
                "0 1px 0 rgba(255, 245, 215, 0.85), 0 2px 6px rgba(245, 158, 11, 0.30)",
            }}
          >
            {WHY_PAGE_COPY.hero.headline}
          </h1>

          <p
            className="max-w-[28ch] text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.hero.subcopy}
          </p>

          {/* Hero visual — temporary placeholder using the existing
              candy board art so the section reads complete during the
              multi-commit rollout. Commit 5 replaces with a real
              play-hub screenshot from Playwright snapshots. */}
          <div
            className="relative my-2 w-full max-w-[300px] overflow-hidden rounded-3xl border-2"
            style={{
              aspectRatio: "3 / 4",
              borderColor: "rgba(245, 158, 11, 0.55)",
              boxShadow:
                "0 10px 28px rgba(120, 65, 5, 0.28), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
              background: "rgba(255, 245, 215, 0.55)",
            }}
            aria-hidden="true"
          >
            <picture className="absolute inset-0 flex items-center justify-center">
              {THEME_CONFIG.hasOptimizedFormats && (
                <>
                  <source
                    srcSet="/art/redesign/board/board-ch.avif"
                    type="image/avif"
                  />
                  <source
                    srcSet="/art/redesign/board/board-ch.webp"
                    type="image/webp"
                  />
                </>
              )}
              <img
                src="/art/redesign/board/board-ch.png"
                alt=""
                className="h-full w-full object-cover"
              />
            </picture>
          </div>

          <div className="flex w-full max-w-[280px] flex-col gap-2.5">
            <Button asChild variant="game-primary" size="game">
              <Link href="/" onClick={handlePrimaryCta}>
                {WHY_PAGE_COPY.hero.primaryCta}
              </Link>
            </Button>
            <Button
              type="button"
              variant="game-ghost"
              size="game"
              onClick={handleSecondaryCta}
            >
              {WHY_PAGE_COPY.hero.secondaryCta}
            </Button>
          </div>
        </section>

        {/* §2–§8 land in subsequent commits per the spec. */}
      </div>
    </main>
  );
}
