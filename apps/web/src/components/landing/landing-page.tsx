"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PhoneFrame } from "@/components/landing/phone-frame";
import { PhoneStack } from "@/components/landing/phone-stack";
import { useMiniPay } from "@/hooks/use-minipay";
import { LANDING_COPY, WHY_PAGE_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

/**
 * LandingPage — public web-responsive landing rendered at `/` for
 * non-wallet visitors. Wallet players get a server-side redirect
 * before this component ever mounts; the useMiniPay effect below is
 * the client-side fallback for wallets the UA detection missed.
 *
 * Layout:
 *   - Mobile: single-column scroll (carries over from /why).
 *   - Desktop: split hero + alternating image/text rows (Duolingo
 *     reference). Each row is 50/50 with the image wrapped in a
 *     PhoneFrame for the "product-in-a-phone" framing.
 */
export function LandingPage() {
  const router = useRouter();
  const minipay = useMiniPay();

  // Client-side wallet fallback — fires when the server-side UA sniff
  // missed a wallet (custom build, spoofed UA, etc.).
  useEffect(() => {
    if (!minipay.isReady) return;
    if (minipay.isMiniPay) {
      track("landing_redirect", { via: "client", reason: "minipay" });
      router.replace("/hub");
    }
  }, [minipay.isReady, minipay.isMiniPay, router]);

  const onCta = (slot: string) => () => {
    track("why_cta_click", { slot });
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--paper-bg)]">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-5 md:px-10">
        <span
          className="fantasy-title text-base font-extrabold uppercase tracking-[0.18em] md:text-lg"
          style={{
            color: "var(--landing-text)",
            textShadow: "var(--landing-text-shadow)",
          }}
        >
          Chesscito
        </span>
        <Button asChild variant="game-primary" size="game-sm" className="!w-auto px-4 py-2">
          <Link href="/hub" onClick={onCta("nav-primary")}>
            {WHY_PAGE_COPY.hero.primaryCta}
          </Link>
        </Button>
      </header>

      {/* §1 Hero — split on desktop, stacked on mobile */}
      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-10 px-5 py-12 md:grid-cols-2 md:gap-16 md:px-10 md:py-24">
        <div className="flex flex-col items-start gap-5 text-left">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: "rgba(255, 248, 230, 0.85)",
              borderColor: "var(--landing-accent-border-strong)",
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow)",
            }}
          >
            {WHY_PAGE_COPY.hero.eyebrow}
          </span>
          <h1
            className="fantasy-title text-3xl font-extrabold leading-tight md:text-5xl md:leading-[1.05]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-title-glow)",
            }}
          >
            {WHY_PAGE_COPY.hero.headline}
          </h1>
          <p
            className="max-w-[36ch] text-base leading-relaxed md:text-lg"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.hero.subcopy}
          </p>
          <div className="flex w-full max-w-[320px] flex-col gap-2.5 md:w-auto md:flex-row md:gap-3">
            <Button asChild variant="game-primary" size="game" className="md:!w-auto md:px-8">
              <Link href="/hub" onClick={onCta("hero-primary")}>
                {WHY_PAGE_COPY.hero.primaryCta}
              </Link>
            </Button>
            <Button asChild variant="game-ghost" size="game" className="md:!w-auto md:px-8">
              <a href="#purpose" onClick={onCta("hero-secondary")}>
                {WHY_PAGE_COPY.hero.secondaryCta}
              </a>
            </Button>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <PhoneStack
            variant="right"
            primary={{
              src: "/art/landing/hero-play-hub",
              alt: "Chesscito play hub — Rook on the board",
              label: "Chesscito play hub",
            }}
            secondary={{
              src: "/art/landing/pre-chess-exercise",
              alt: "Tablero con dots de movimiento del Rook",
              label: "Pre-chess exercise board",
            }}
            floatingNode={
              <div
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.14em] shadow-[0_8px_20px_rgba(40,22,8,0.18)]"
                style={{
                  background: "rgba(255, 248, 230, 0.95)",
                  borderColor: "var(--landing-accent-border-strong)",
                  color: "var(--landing-text)",
                }}
              >
                <CandyIcon name="star" className="h-4 w-4" />
                7-day streak
              </div>
            }
          />
        </div>
      </section>

      {/* §2 Problem — anchor target for the hero "Conocer la
          iniciativa" secondary CTA (wired in C9 when the hero copy
          migrates to LANDING_COPY). Title + body centered, three
          claim cards in a row on desktop, stacked on mobile. */}
      <section
        id="problem"
        className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-10 md:py-20"
      >
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.problem.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.problem.body}
          </p>
        </div>

        <ul
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {LANDING_COPY.problem.claims.map((claim) => (
            <li
              key={claim.label}
              className="flex items-start gap-3 rounded-2xl border px-4 py-3.5"
              style={{
                background: "var(--landing-card-bg)",
                borderColor: "var(--landing-card-border)",
                boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--landing-accent-bg)",
                  border: "1px solid var(--landing-accent-border)",
                }}
                aria-hidden="true"
              >
                <CandyIcon name={claim.icon} className="h-5 w-5" />
              </span>
              <p
                className="text-sm font-semibold leading-snug md:text-base"
                style={{
                  color: "var(--landing-text)",
                  textShadow: "var(--landing-text-shadow)",
                }}
              >
                {claim.label}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* §3 (legacy preChess block — image LEFT, text RIGHT on
          desktop). Will migrate to LANDING_COPY.solution in C9. */}
      <SectionRow
        eyebrow={null}
        title={WHY_PAGE_COPY.preChess.title}
        body={WHY_PAGE_COPY.preChess.body}
        bullets={[...WHY_PAGE_COPY.preChess.bullets]}
        imageSrc="/art/landing/pre-chess-exercise"
        imageAlt="Reto pre-ajedrez — pieza, tablero y objetivo"
        imageOnLeft={true}
      />

      {/* §3 Cognitive — text LEFT, image RIGHT. Anchor: #purpose */}
      <section
        id="purpose"
        className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-10 md:py-20"
      >
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-4">
            <h2
              className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
              style={{
                color: "var(--landing-text)",
                textShadow: "var(--landing-text-shadow-soft)",
              }}
            >
              {WHY_PAGE_COPY.cognitive.title}
            </h2>
            <p
              className="text-sm leading-relaxed md:text-base"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {WHY_PAGE_COPY.cognitive.body}
            </p>
            <ul className="flex flex-wrap gap-2 pt-1" role="list">
              {WHY_PAGE_COPY.cognitive.capabilities.map((cap) => (
                <li
                  key={cap.label}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.10em]"
                  style={{
                    background: "rgba(255, 248, 230, 0.78)",
                    borderColor: "var(--landing-accent-border)",
                    color: "var(--landing-text)",
                    textShadow: "var(--landing-text-shadow)",
                  }}
                >
                  <CandyIcon name={cap.icon} className="h-3.5 w-3.5 shrink-0" />
                  {cap.label}
                </li>
              ))}
            </ul>
            <div
              className="mt-2 flex items-start gap-3 rounded-2xl border px-4 py-3"
              style={{
                background: "var(--landing-accent-bg-strong)",
                borderColor: "var(--landing-accent-border)",
                color: "var(--landing-text)",
              }}
              role="note"
            >
              <CandyIcon
                name="shield"
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "var(--landing-accent)" }}
              />
              <p
                className="text-[0.78rem] leading-relaxed"
                style={{ textShadow: "var(--landing-text-shadow)" }}
              >
                {WHY_PAGE_COPY.cognitive.disclaimer}
              </p>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <PhoneFrame label="Mecánica del Rook con dots de movimiento">
              <picture>
                <source srcSet="/art/landing/pre-chess-exercise.avif" type="image/avif" />
                <source srcSet="/art/landing/pre-chess-exercise.webp" type="image/webp" />
                <img
                  src="/art/landing/pre-chess-exercise.png"
                  alt="Tablero con dots de movimiento del Rook"
                  className="h-full w-full object-cover"
                />
              </picture>
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* §4 Progress — image LEFT, text RIGHT */}
      <SectionRow
        eyebrow={null}
        title={WHY_PAGE_COPY.progress.title}
        body={WHY_PAGE_COPY.progress.body}
        bullets={[...WHY_PAGE_COPY.progress.bullets]}
        imageSrc="/art/landing/progress-trophies"
        imageAlt="Trofeos y badges — progreso del jugador"
        imageOnLeft={true}
      />

      {/* §5 Community — full-width row of 3 cards */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-10 md:py-20">
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {WHY_PAGE_COPY.community.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.community.body}
          </p>
        </div>
        <ul
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {WHY_PAGE_COPY.community.cards.map((card) => (
            <li
              key={card.title}
              className="flex flex-col gap-2 rounded-2xl border px-5 py-4"
              style={{
                background: "var(--landing-card-bg)",
                borderColor: "var(--landing-card-border)",
                boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
              }}
            >
              <h3
                className="fantasy-title text-sm font-extrabold uppercase tracking-[0.10em]"
                style={{
                  color: "var(--landing-text)",
                  textShadow: "var(--landing-text-shadow)",
                }}
              >
                {card.title}
              </h3>
              <p
                className="text-xs leading-relaxed md:text-sm"
                style={{ color: "var(--paper-text-muted)" }}
              >
                {card.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* §6 Sponsors — Den Labs framing + contact links */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[800px] grid-cols-1 gap-6 text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {WHY_PAGE_COPY.sponsors.title}
          </h2>
          <p
            className="mx-auto max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {WHY_PAGE_COPY.sponsors.body}
          </p>
          <div
            className="mx-auto max-w-[60ch] rounded-2xl border px-5 py-4"
            style={{
              background: "var(--landing-card-bg)",
              borderColor: "var(--landing-card-border)",
              boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
            }}
          >
            <p
              className="text-xs leading-relaxed md:text-sm"
              style={{ color: "var(--paper-text-muted)" }}
            >
              {WHY_PAGE_COPY.sponsors.denLabs}
            </p>
          </div>
          <div className="mx-auto flex w-full max-w-[400px] flex-col gap-2 md:flex-row md:justify-center">
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                onClick={onCta("sponsors-email")}
                className="paper-tray flex min-h-[44px] items-center justify-center gap-3 transition active:scale-[0.99] md:px-6"
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
              onClick={onCta("sponsors-github")}
              className="paper-tray flex min-h-[44px] items-center justify-center gap-3 transition active:scale-[0.99] md:px-6"
              style={{ color: "var(--paper-text)" }}
            >
              <CandyIcon name="copy" className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">
                {WHY_PAGE_COPY.sponsors.contactSecondary}
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* §7 Final CTA */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-12 text-center md:px-10 md:py-20">
        <h2
          className="fantasy-title text-2xl font-extrabold leading-tight md:text-5xl md:leading-[1.05]"
          style={{
            color: "var(--landing-text)",
            textShadow: "var(--landing-title-glow)",
          }}
        >
          {WHY_PAGE_COPY.finalCta.headline}
        </h2>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="game-primary" size="game" className="!w-auto px-10">
            <Link href="/hub" onClick={onCta("final-primary")}>
              {WHY_PAGE_COPY.finalCta.cta}
            </Link>
          </Button>
        </div>
        <p
          className="mx-auto mt-4 max-w-[40ch] text-xs leading-relaxed md:text-sm"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {WHY_PAGE_COPY.finalCta.note}
        </p>
      </section>

      {/* §8 Footer */}
      <footer
        className="border-t px-5 py-8 md:px-10 md:py-10"
        style={{ borderColor: "var(--paper-divider)" }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-4 text-center">
          <p
            className="text-[0.7rem] leading-relaxed md:text-xs"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {WHY_PAGE_COPY.cognitive.disclaimer}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.7rem] md:text-xs">
            <Link
              href="/privacy"
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Privacy
            </Link>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <Link
              href="/terms"
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Terms
            </Link>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <Link
              href="/support"
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Support
            </Link>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <Link
              href="/about"
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              About
            </Link>
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            <p
              className="fantasy-title text-xs font-extrabold uppercase tracking-[0.18em]"
              style={{
                color: "rgba(110, 65, 15, 0.78)",
                textShadow: "var(--landing-text-shadow)",
              }}
            >
              {WHY_PAGE_COPY.footer.brand}
            </p>
            <p
              className="text-[0.65rem]"
              style={{ color: "rgba(110, 65, 15, 0.55)" }}
            >
              {WHY_PAGE_COPY.footer.year}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/**
 * SectionRow — alternating image/text row used by §2 and §4.
 * `imageOnLeft` flips the visual order on desktop; mobile always
 * stacks image above text for natural top-down scanning.
 */
function SectionRow({
  title,
  body,
  bullets,
  imageSrc,
  imageAlt,
  imageOnLeft,
}: {
  eyebrow: string | null;
  title: string;
  body: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  imageOnLeft: boolean;
}) {
  const visual = (
    <div className="flex justify-center md:justify-start">
      <PhoneFrame label={imageAlt}>
        <picture>
          <source srcSet={`${imageSrc}.avif`} type="image/avif" />
          <source srcSet={`${imageSrc}.webp`} type="image/webp" />
          <img
            src={`${imageSrc}.png`}
            alt={imageAlt}
            className="h-full w-full object-cover"
          />
        </picture>
      </PhoneFrame>
    </div>
  );

  const text = (
    <div className="flex flex-col gap-4">
      <h2
        className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
        style={{
          color: "var(--landing-text)",
          textShadow: "var(--landing-text-shadow-soft)",
        }}
      >
        {title}
      </h2>
      <p
        className="text-sm leading-relaxed md:text-base"
        style={{ color: "var(--paper-text-muted)" }}
      >
        {body}
      </p>
      <ul className="flex flex-col gap-2" role="list">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold"
            style={{
              background: "var(--landing-card-bg)",
              borderColor: "var(--landing-card-border)",
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow)",
              boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
            }}
          >
            <CandyIcon name="check" className="h-4 w-4 shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-10 md:py-20">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        {imageOnLeft ? (
          <>
            {visual}
            {text}
          </>
        ) : (
          <>
            {text}
            {visual}
          </>
        )}
      </div>
    </section>
  );
}
