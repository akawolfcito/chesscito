"use client";

import Link from "next/link";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";
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

        {/* §2 Pre-chess — chess BEFORE chess. Frames the product as
            short, visual, low-pressure challenges so a parent or
            curious player understands the entry bar is zero. */}
        <section
          className="flex flex-col gap-4 border-t px-5 py-10"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {WHY_PAGE_COPY.preChess.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.preChess.body}
          </p>

          {/* Visual placeholder — second instance of the in-world art
              frame; commit 5 swaps for a real exercise screenshot. */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border-2"
            style={{
              aspectRatio: "4 / 3",
              borderColor: "rgba(245, 158, 11, 0.45)",
              boxShadow:
                "0 6px 18px rgba(120, 65, 5, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
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

          {/* Bullets — three short claims that earn trust without
              promising too much. */}
          <ul className="grid grid-cols-1 gap-2" role="list">
            {WHY_PAGE_COPY.preChess.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  borderColor: "rgba(110, 65, 15, 0.22)",
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                <CandyIcon name="check" className="h-4 w-4 shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        {/* §3 Cognitive — anchor target for the hero's secondary CTA.
            Communicates the cognitive-stimulation thesis with the
            five capabilities chips, then renders the required
            no-medical-claims disclaimer as a soft amber card so it
            is noticed but never alarming. */}
        <section
          id="purpose"
          className="flex flex-col gap-4 border-t px-5 py-10"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {WHY_PAGE_COPY.cognitive.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.cognitive.body}
          </p>

          {/* Capabilities — five chips as a flex-wrap row so the
              layout breathes naturally on small viewports. */}
          <ul
            className="flex flex-wrap justify-center gap-2 pt-1"
            role="list"
          >
            {WHY_PAGE_COPY.cognitive.capabilities.map((cap) => (
              <li
                key={cap.label}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.10em]"
                style={{
                  background: "rgba(255, 245, 215, 0.85)",
                  borderColor: "rgba(245, 158, 11, 0.45)",
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 1px 3px rgba(120, 65, 5, 0.18)",
                }}
              >
                <CandyIcon name={cap.icon} className="h-3.5 w-3.5 shrink-0" />
                {cap.label}
              </li>
            ))}
          </ul>

          {/* Disclaimer — required render. Amber-tinted so it reads
              as caring transparency, not legalese. Repeats once more
              in the footer per spec. */}
          <div
            className="mt-2 flex items-start gap-3 rounded-2xl border px-4 py-3"
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              borderColor: "rgba(245, 158, 11, 0.45)",
              color: "rgba(63, 34, 8, 0.95)",
              boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
            role="note"
          >
            <CandyIcon
              name="shield"
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "rgba(120, 65, 5, 0.85)" }}
            />
            <p
              className="text-[0.78rem] leading-relaxed"
              style={{ textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)" }}
            >
              {WHY_PAGE_COPY.cognitive.disclaimer}
            </p>
          </div>
        </section>

        {/* §4 Progress — adventure framing. The retention loop
            (worlds, stars, badges) reads as exploration, not grind. */}
        <section
          className="flex flex-col gap-4 border-t px-5 py-10"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {WHY_PAGE_COPY.progress.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.progress.body}
          </p>

          {/* Visual placeholder — third instance of the in-world art
              frame; commit 5 swaps for a real trophies/badges shot. */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border-2"
            style={{
              aspectRatio: "4 / 3",
              borderColor: "rgba(245, 158, 11, 0.45)",
              boxShadow:
                "0 6px 18px rgba(120, 65, 5, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
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

          {/* Bullets — exploration vocabulary. Star icon for the
              middle one ties to the in-game star reward. */}
          <ul className="grid grid-cols-1 gap-2" role="list">
            {WHY_PAGE_COPY.progress.bullets.map((bullet, idx) => (
              <li
                key={bullet}
                className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  borderColor: "rgba(110, 65, 15, 0.22)",
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                <CandyIcon
                  name={idx === 0 ? "crown" : idx === 1 ? "star" : "trophy"}
                  className="h-4 w-4 shrink-0"
                />
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        {/* §5 Community — three audience-specific cards (families,
            educators, communities) packaged invitationally rather than
            transactionally. Reads to parents and institution
            stakeholders without aggressive selling. */}
        <section
          className="flex flex-col gap-4 border-t px-5 py-10"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {WHY_PAGE_COPY.community.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.community.body}
          </p>

          <ul className="flex flex-col gap-2.5" role="list">
            {WHY_PAGE_COPY.community.cards.map((card) => (
              <li
                key={card.title}
                className="flex flex-col gap-1.5 rounded-2xl border px-4 py-3.5"
                style={{
                  background: "rgba(255, 245, 215, 0.55)",
                  borderColor: "rgba(110, 65, 15, 0.22)",
                  boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                <h3
                  className="fantasy-title text-sm font-extrabold uppercase tracking-[0.10em]"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  }}
                >
                  {card.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--paper-text-muted)" }}
                >
                  {card.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* §6 Sponsors — built for impact. Carries the Den Labs
            framing (parent brand, first vertical of a cognitive
            platform thesis) and offers two contact paths (email +
            GitHub) without asking for a form. */}
        <section
          className="flex flex-col gap-4 border-t px-5 py-10"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {WHY_PAGE_COPY.sponsors.title}
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.sponsors.body}
          </p>

          <div
            className="rounded-2xl border px-4 py-3.5"
            style={{
              background: "rgba(255, 245, 215, 0.55)",
              borderColor: "rgba(110, 65, 15, 0.22)",
              boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {WHY_PAGE_COPY.sponsors.denLabs}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
                style={{ color: "var(--paper-text)" }}
              >
                <CandyIcon name="share" className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold">
                  {WHY_PAGE_COPY.sponsors.contactPrimary}
                </span>
              </a>
            ) : null}
            <a
              href={WHY_PAGE_COPY.sponsors.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
              style={{ color: "var(--paper-text)" }}
            >
              <CandyIcon name="copy" className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">
                {WHY_PAGE_COPY.sponsors.contactSecondary}
              </span>
            </a>
          </div>
        </section>

        {/* §7–§8 land in the next commit per the spec. */}
      </div>
    </main>
  );
}
