import type { ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PhoneFrame } from "@/components/landing/phone-frame";
import { PhoneStack } from "@/components/landing/phone-stack";
import { LANDING_COPY, WHY_PAGE_COPY } from "@/lib/content/editorial";

const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL ?? "https://lite.chesscito.com";
const LEGAL_URL = process.env.NEXT_PUBLIC_LEGAL_URL ?? PLAY_URL;

const GHOST_CTA_CLASS =
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-bold transition-all rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15 text-[rgba(110,65,15,0.90)] [text-shadow:0_1px_0_rgba(255,245,215,0.55)] backdrop-blur-[6px] hover:bg-white/25 active:scale-[0.97] w-full py-3 md:!w-auto md:px-8";

type LandingGreenCtaLinkProps = {
  children: ReactNode;
  href: string;
  size?: "medium" | "large";
  className?: string;
  "aria-label"?: string;
  target?: string;
  rel?: string;
};

function LandingGreenCtaLink({
  children,
  href,
  size = "medium",
  className,
  "aria-label": ariaLabel,
  target,
  rel,
}: LandingGreenCtaLinkProps) {
  return (
    <a
      href={href}
      className={["landing-green-cta", `landing-green-cta--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
      target={target}
      rel={rel}
    >
      {children}
    </a>
  );
}

export function LandingPage() {
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
          {LANDING_COPY.nav.brand}
        </span>
        <LandingGreenCtaLink
          size="medium"
          href={`${PLAY_URL}/hub`}
          aria-label={LANDING_COPY.nav.primaryCta}
        >
          {LANDING_COPY.nav.primaryCta}
        </LandingGreenCtaLink>
      </header>

      {/* §1 Hero */}
      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-8 px-5 pb-10 pt-6 md:grid-cols-2 md:gap-16 md:px-10 md:py-24">
        <div className="flex flex-col items-start gap-5 text-left">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] md:tracking-[0.18em]"
            style={{
              background: "rgba(255, 248, 230, 0.85)",
              borderColor: "var(--landing-accent-border-strong)",
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow)",
            }}
          >
            {LANDING_COPY.hero.eyebrow}
          </span>
          <h1
            className="fantasy-title text-[1.75rem] font-extrabold leading-[1.1] md:text-5xl md:leading-[1.05]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-title-glow)",
            }}
          >
            {LANDING_COPY.hero.headline}
          </h1>
          <p
            className="max-w-[36ch] text-[0.95rem] leading-relaxed md:text-lg"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.hero.subcopy}
          </p>
          <div className="flex w-full flex-col items-start gap-2.5 md:w-auto md:flex-row md:items-center md:gap-3">
            <LandingGreenCtaLink
              size="medium"
              className="w-full max-w-[300px]"
              href={`${PLAY_URL}/hub`}
              aria-label={LANDING_COPY.hero.primaryCta}
            >
              {LANDING_COPY.hero.primaryCta}
            </LandingGreenCtaLink>
            <a href="#problem" className={GHOST_CTA_CLASS}>
              {LANDING_COPY.hero.secondaryCta}
            </a>
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

      {/* §2 Problem */}
      <section
        id="problem"
        className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20"
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

      {/* §3 preChess */}
      <SectionRow
        eyebrow={null}
        title={WHY_PAGE_COPY.preChess.title}
        body={WHY_PAGE_COPY.preChess.body}
        bullets={[...WHY_PAGE_COPY.preChess.bullets]}
        imageSrc="/art/landing/pre-chess-exercise"
        imageAlt="Reto pre-ajedrez — pieza, tablero y objetivo"
        imageOnLeft={true}
      />

      {/* §3 Cognitive */}
      <section
        id="purpose"
        className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20"
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
                {LANDING_COPY.disclaimer}
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

      {/* §4 How it works */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.howItWorks.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.howItWorks.body}
          </p>
        </div>
        <ol
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-5 md:gap-4"
          role="list"
        >
          {LANDING_COPY.howItWorks.steps.map((step, idx) => (
            <li
              key={step.label}
              className="flex flex-col gap-2 rounded-2xl border px-4 py-4"
              style={{
                background: "var(--landing-card-bg)",
                borderColor: "var(--landing-card-border)",
                boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold"
                style={{
                  background: "var(--landing-accent-bg-strong)",
                  border: "1px solid var(--landing-accent-border)",
                  color: "var(--landing-text)",
                }}
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <h3
                className="fantasy-title text-xs font-extrabold uppercase tracking-[0.14em]"
                style={{
                  color: "var(--landing-text)",
                  textShadow: "var(--landing-text-shadow)",
                }}
              >
                {step.label}
              </h3>
              <p
                className="text-xs leading-relaxed md:text-sm"
                style={{ color: "var(--paper-text-muted)" }}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* §4 Progress */}
      <SectionRow
        eyebrow={null}
        title={WHY_PAGE_COPY.progress.title}
        body={WHY_PAGE_COPY.progress.body}
        bullets={[...WHY_PAGE_COPY.progress.bullets]}
        imageSrc="/art/landing/progress-trophies"
        imageAlt="Trofeos y badges — progreso del jugador"
        imageOnLeft={true}
      />

      {/* §6 Audiences */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.audiences.title}
          </h2>
        </div>
        <ul
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {LANDING_COPY.audiences.cards.map((card) => (
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

      {/* §7 Plans */}
      <section
        id="plans"
        className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20"
      >
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.plans.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.plans.body}
          </p>
        </div>
        <ul
          className="-mx-5 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
          role="list"
        >
          {LANDING_COPY.plans.tiers.map((tier) => {
            const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
            let ctaHref: string;
            if (tier.ctaKind === "internal") {
              ctaHref = `${PLAY_URL}/hub`;
            } else if (supportEmail) {
              const subject = encodeURIComponent(`Chesscito · ${"ctaSubject" in tier ? tier.ctaSubject : ""}`);
              ctaHref = `mailto:${supportEmail}?subject=${subject}`;
            } else {
              ctaHref = WHY_PAGE_COPY.sponsors.githubUrl;
            }
            const isInternal = tier.ctaKind === "internal";
            const isFeatured = "featured" in tier && tier.featured === true;
            const priceLabel = "priceLabel" in tier ? tier.priceLabel : undefined;
            const badge = "badge" in tier ? tier.badge : undefined;
            const isExternal = !isInternal;
            const externalTarget = supportEmail ? undefined : "_blank";
            const externalRel = supportEmail ? undefined : "noopener noreferrer";
            return (
              <li
                key={tier.name}
                className="flex min-w-[72%] shrink-0 snap-center flex-col gap-3 rounded-2xl border px-5 py-5 md:min-w-0 md:shrink"
                style={{
                  background: "var(--landing-card-bg)",
                  borderColor: isFeatured
                    ? "var(--landing-accent-border)"
                    : "var(--landing-card-border)",
                  boxShadow: isFeatured
                    ? "inset 0 1px 0 var(--landing-card-shadow-inner), 0 0 0 2px var(--landing-accent-border)"
                    : "inset 0 1px 0 var(--landing-card-shadow-inner)",
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.14em]"
                      style={{
                        background: "var(--landing-accent-bg)",
                        borderColor: "var(--landing-accent-border)",
                        color: "var(--landing-text)",
                      }}
                    >
                      {tier.name}
                    </span>
                    {badge ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.10em]"
                        style={{
                          borderColor: "var(--landing-card-border)",
                          color: "var(--paper-text-muted)",
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-extrabold" style={{ color: "var(--landing-text)" }}>
                    {tier.tagline}
                  </p>
                  {priceLabel ? (
                    <p className="text-xs font-bold" style={{ color: "var(--paper-text-muted)" }}>
                      {priceLabel}
                    </p>
                  ) : null}
                </div>
                <ul className="flex flex-col gap-1.5" role="list">
                  {tier.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-xs leading-relaxed md:text-sm"
                      style={{ color: "var(--paper-text-muted)" }}
                    >
                      <CandyIcon name="check" className="mt-[0.15em] h-3.5 w-3.5 shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-1">
                  {isFeatured ? (
                    <LandingGreenCtaLink
                      size="medium"
                      className="w-full"
                      href={ctaHref}
                      aria-label={tier.ctaLabel}
                      target={isExternal ? externalTarget : undefined}
                      rel={isExternal ? externalRel : undefined}
                    >
                      {tier.ctaLabel}
                    </LandingGreenCtaLink>
                  ) : isInternal ? (
                    <a
                      href={ctaHref}
                      className="landing-green-cta landing-green-cta--medium w-full"
                      aria-label={tier.ctaLabel}
                    >
                      {tier.ctaLabel}
                    </a>
                  ) : (
                    <a
                      href={ctaHref}
                      target={externalTarget}
                      rel={externalRel}
                      className="paper-tray flex min-h-[40px] items-center justify-center gap-2 transition active:scale-[0.99]"
                      style={{ color: "var(--paper-text)" }}
                    >
                      <span className="text-xs font-extrabold uppercase tracking-[0.10em]">
                        {tier.ctaLabel}
                      </span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p
          className="mx-auto mt-6 max-w-[60ch] text-center text-xs leading-relaxed md:text-sm"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {LANDING_COPY.plans.complement}
        </p>
      </section>

      {/* §8 Impact */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.impact.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.impact.body}
          </p>
        </div>
        <ul
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {LANDING_COPY.impact.pillars.map((pillar) => (
            <li
              key={pillar.title}
              className="flex flex-col gap-2 rounded-2xl border px-5 py-4"
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
                <CandyIcon name={pillar.icon} className="h-5 w-5" />
              </span>
              <h3
                className="fantasy-title text-sm font-extrabold uppercase tracking-[0.10em]"
                style={{
                  color: "var(--landing-text)",
                  textShadow: "var(--landing-text-shadow)",
                }}
              >
                {pillar.title}
              </h3>
              <p
                className="text-xs leading-relaxed md:text-sm"
                style={{ color: "var(--paper-text-muted)" }}
              >
                {pillar.body}
              </p>
            </li>
          ))}
        </ul>
        <p
          className="mx-auto mt-8 max-w-[40ch] text-center text-xs italic md:mt-10 md:text-sm"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {LANDING_COPY.impact.alliesPlaceholder}
        </p>
      </section>

      {/* §9 Founders */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
        <div className="mx-auto max-w-[700px] text-center">
          <h2
            className="fantasy-title text-2xl font-extrabold leading-tight md:text-4xl md:leading-[1.1]"
            style={{
              color: "var(--landing-text)",
              textShadow: "var(--landing-text-shadow-soft)",
            }}
          >
            {LANDING_COPY.founders.title}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[62ch] text-sm leading-relaxed md:text-base"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {LANDING_COPY.founders.lead}
          </p>
        </div>
        <ul
          className="mt-8 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {LANDING_COPY.founders.cards.map((card) => (
            <li
              key={card.name}
              className="flex flex-col gap-2 rounded-2xl border px-5 py-5"
              style={{
                background: "var(--landing-card-bg)",
                borderColor: "var(--landing-card-border)",
                boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
              }}
            >
              <h3
                className="fantasy-title text-base font-extrabold"
                style={{
                  color: "var(--landing-text)",
                  textShadow: "var(--landing-text-shadow)",
                }}
              >
                {card.name}
              </h3>
              {card.handle && (
                <p className="text-xs font-semibold" style={{ color: "var(--paper-text-muted)" }}>
                  {card.handle}
                </p>
              )}
              <p
                className="text-xs font-extrabold uppercase tracking-[0.10em]"
                style={{ color: "var(--landing-accent)" }}
              >
                {card.title}
              </p>
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

      {/* §6 Sponsors */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
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
                className="paper-tray flex min-h-[44px] items-center justify-center gap-3 transition active:scale-[0.99] md:px-6"
                style={{ color: "var(--paper-text)" }}
              >
                <CandyIcon name="share" className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold">{WHY_PAGE_COPY.sponsors.contactPrimary}</span>
              </a>
            ) : null}
            <a
              href={WHY_PAGE_COPY.sponsors.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="paper-tray flex min-h-[44px] items-center justify-center gap-3 transition active:scale-[0.99] md:px-6"
              style={{ color: "var(--paper-text)" }}
            >
              <CandyIcon name="copy" className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">{WHY_PAGE_COPY.sponsors.contactSecondary}</span>
            </a>
          </div>
        </div>
      </section>

      {/* §7 Final CTA */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-10 text-center md:px-10 md:py-20">
        <h2
          className="fantasy-title text-2xl font-extrabold leading-tight md:text-5xl md:leading-[1.05]"
          style={{
            color: "var(--landing-text)",
            textShadow: "var(--landing-title-glow)",
          }}
        >
          {LANDING_COPY.finalCta.headline}
        </h2>
        <p
          className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed md:text-base"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {LANDING_COPY.finalCta.subcopy}
        </p>
        <div className="mx-auto mt-6 flex w-full max-w-[420px] flex-col items-center justify-center gap-3 md:max-w-none md:flex-row">
          <LandingGreenCtaLink
            size="medium"
            className="w-full max-w-[300px]"
            href={`${PLAY_URL}/hub`}
            aria-label={LANDING_COPY.finalCta.primaryCta}
          >
            {LANDING_COPY.finalCta.primaryCta}
          </LandingGreenCtaLink>
          {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && (
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}?subject=${encodeURIComponent("Chesscito · Hablar con el equipo")}`}
              className={GHOST_CTA_CLASS}
            >
              {LANDING_COPY.finalCta.secondaryCta}
            </a>
          )}
        </div>
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
            {LANDING_COPY.disclaimer}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.7rem] md:text-xs">
            <a
              href={`${LEGAL_URL}/privacy`}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Privacy
            </a>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <a
              href={`${LEGAL_URL}/terms`}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Terms
            </a>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <a
              href={`${LEGAL_URL}/support`}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Support
            </a>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <a
              href={`${LEGAL_URL}/about`}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              About
            </a>
            <span style={{ color: "rgba(110, 65, 15, 0.35)" }}>·</span>
            <a
              href={`${LEGAL_URL}/stats`}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              Stats
            </a>
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            <p
              className="fantasy-title text-xs font-extrabold uppercase tracking-[0.18em]"
              style={{
                color: "rgba(110, 65, 15, 0.78)",
                textShadow: "var(--landing-text-shadow)",
              }}
            >
              {LANDING_COPY.footer.brand}
            </p>
            <p className="text-[0.65rem]" style={{ color: "rgba(110, 65, 15, 0.55)" }}>
              {LANDING_COPY.footer.year}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

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
          <img src={`${imageSrc}.png`} alt={imageAlt} className="h-full w-full object-cover" />
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
      <p className="text-sm leading-relaxed md:text-base" style={{ color: "var(--paper-text-muted)" }}>
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
    <section className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10 md:py-20">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
        {imageOnLeft ? (
          <>
            <div className="order-2 md:order-1">{visual}</div>
            <div className="order-1 md:order-2">{text}</div>
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
