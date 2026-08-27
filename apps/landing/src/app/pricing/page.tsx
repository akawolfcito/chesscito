import type { Metadata } from "next";

import { LEGAL_URL, PLAY_URL } from "@/lib/app-urls";
import {
  PAYMENT_NOTE,
  PLANS,
  RENEWAL_NOTE,
  type Medallion,
} from "@/lib/pricing/plans";

/**
 * The public pricing page.
 *
 * ⛔ **ONE URL, and it is `/pricing`.** It sits outside the next-intl matcher
 * (like `/classic` and `/stats`), so there is no `/en/pricing` and no
 * `/es/pricing`. Business directories ask for an exact address, and a locale
 * prefix is how that requirement quietly stops being met.
 *
 * ⛔ **INDEXABLE, unlike `/stats`.** That page is `noindex` because it is a
 * listing deliverable that must not surface in search. This one exists to BE
 * found, so it declares a canonical and stays in the sitemap.
 *
 * ⚠️ **No regional framing anywhere on this page.** Measured over 30 days, the
 * audience spans twelve countries — Nigeria 36.7%, Kenya, South Africa, Brazil,
 * Indonesia, Uganda, Ghana, Colombia, India, Mexico among them. Prices are in
 * dollars and settle in stablecoins, so they are the same everywhere; the page
 * says what is charged, never to whom.
 */
export const metadata: Metadata = {
  title: "Pricing — Chesscito",
  description:
    "Chesscito is free to play. Peones from $0.05 and PRO at $1.99 for 30 days, paid in stablecoins on Celo.",
  alternates: { canonical: "https://www.chesscito.com/pricing" },
};

/** The piece inside the ring. A triplet, like every other image on this site:
 *  AVIF first, WebP next, PNG last — the browser takes the first it can read. */
function MedallionArt({ medallion }: { medallion: Medallion }) {
  return (
    <picture>
      <source srcSet={`/art/pricing/${medallion.asset}.avif`} type="image/avif" />
      <source srcSet={`/art/pricing/${medallion.asset}.webp`} type="image/webp" />
      <img
        alt=""
        aria-hidden="true"
        className="pricing-medallion-piece"
        draggable={false}
        src={`/art/pricing/${medallion.asset}.png`}
      />
    </picture>
  );
}

export default function PricingPage() {
  return (
    <div className="pricing-shell">
      {/* The background, as a triplet. 1.9 MB as PNG, 63 KB as AVIF — on a page
          a directory may score for performance, that gap is the whole reason
          this is a <picture> and not a CSS background-image. */}
      <picture className="pricing-bg">
        <source srcSet="/art/pricing/bg-pricing.avif" type="image/avif" />
        <source srcSet="/art/pricing/bg-pricing.webp" type="image/webp" />
        <img alt="" aria-hidden="true" src="/art/pricing/bg-pricing.png" />
      </picture>

      <main className="pricing-page">
        <header className="pricing-head">
          {/* ⛔ THE WORDMARK, LINKED HOME. Without it this page was an orphan:
              somebody arriving from a business directory saw three cards and no
              way to tell whose product it is or where the rest of it lives. For
              a listing that is the most expensive thing missing (Sally). */}
          <a aria-label="Chesscito home" className="pricing-brand" href="/">
            <picture>
              <source srcSet="/art/pricing/title-chesscito.avif" type="image/avif" />
              <source srcSet="/art/pricing/title-chesscito.webp" type="image/webp" />
              <img alt="Chesscito" draggable={false} src="/art/pricing/title-chesscito.png" />
            </picture>
          </a>

          <h1 className="pricing-title">Pricing</h1>
          <p className="pricing-subtitle">
            Chesscito is free to play. You only pay for what you choose to add.
          </p>
        </header>

        <section aria-label="Plans" className="pricing-grid">
          {PLANS.map((plan) => (
            <article
              className={`pricing-card${plan.featured ? " is-featured" : ""}`}
              data-plan={plan.id}
              data-tone={plan.tone}
              key={plan.id}
            >
              {plan.badge ? (
                <span className="pricing-badge">{plan.badge}</span>
              ) : null}

              <div className="pricing-medallion">
                <MedallionArt medallion={plan.medallion} />
              </div>

              <h2 className="pricing-ribbon">{plan.name}</h2>

              <p className="pricing-card-price">
                <span className="pricing-card-amount">{plan.price}</span>
                {plan.cadence ? (
                  <span className="pricing-card-cadence">{plan.cadence}</span>
                ) : null}
              </p>

              <p className="pricing-card-summary">{plan.summary}</p>

              <ul className="pricing-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <span aria-hidden="true" className="pricing-check">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <footer className="pricing-foot">
          <p className="pricing-note">{PAYMENT_NOTE}</p>
          <p className="pricing-note">{RENEWAL_NOTE}</p>
          <a
            className="landing-green-cta landing-green-cta--medium pricing-cta"
            href={PLAY_URL}
          >
            Start playing
          </a>
        </footer>

        {/* The same four destinations the home already lists, and the same
            LEGAL_URL behind them — a directory checks that these exist. */}
        <nav aria-label="Legal" className="pricing-legal">
          <a href={`${LEGAL_URL}/privacy`}>Privacy</a>
          <span aria-hidden="true">·</span>
          <a href={`${LEGAL_URL}/terms`}>Terms</a>
          <span aria-hidden="true">·</span>
          <a href={`${LEGAL_URL}/support`}>Support</a>
          <span aria-hidden="true">·</span>
          <a href={`${LEGAL_URL}/about`}>About</a>
        </nav>
      </main>
    </div>
  );
}
