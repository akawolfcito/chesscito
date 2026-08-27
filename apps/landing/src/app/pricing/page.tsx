import type { Metadata } from "next";

import { PAYMENT_NOTE, PLANS } from "@/lib/pricing/plans";

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

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-head">
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
            key={plan.id}
          >
            <h2 className="pricing-card-name">{plan.name}</h2>

            <p className="pricing-card-price">
              <span className="pricing-card-amount">{plan.price}</span>
              {plan.cadence ? (
                <span className="pricing-card-cadence">{plan.cadence}</span>
              ) : null}
            </p>

            <p className="pricing-card-summary">{plan.summary}</p>

            <ul className="pricing-card-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <footer className="pricing-foot">
        <p>{PAYMENT_NOTE}</p>
        <p>
          {/* Plain, and deliberately so: a pricing page that hides how to stop
              paying is a pricing page nobody trusts. */}
          PRO renews only when you choose to buy it again. There is no
          subscription to cancel and no stored payment method.
        </p>
        <a className="pricing-cta" href="https://play.chesscito.com">
          Start playing
        </a>
      </footer>
    </main>
  );
}
