import { ArtImage } from "@/components/onboarding/art-image";
import { ICONS } from "@/lib/onboarding/slides";

/**
 * Slide 2's Season Pass offer. DECORATIVE on purpose — a plain div, no link, no
 * button, nothing focusable. The same rule ProStrip follows on slide 3: the
 * landing does not sell, and a control here would promise a checkout that is
 * two navigations away.
 *
 * The SHAPE, though, is the Play Hub's purchase CTA verbatim
 * (apps/web `.season-pass-banner`, `challenge-card.tsx`). That is the whole
 * point: the visitor meets the pass here and again inside the app, and it has
 * to be recognisable as the same thing. The class names are shared so the two
 * copies are greppable from each other — the CSS lives twice (this app has no
 * access to apps/web globals.css) and only prose keeps them in step.
 *
 * The chevron ships even though nothing here navigates: dropping it would make
 * the two surfaces differ, which costs more than the affordance it implies. It
 * is `aria-hidden`, so no assistive tech is told about a destination.
 */
export function SeasonPassBanner({
  title,
  benefits,
  price,
}: {
  title: string;
  benefits: string;
  price: string;
}) {
  return (
    <div className="season-pass-banner">
      <span className="season-pass-banner-icon">
        <ArtImage src={ICONS.seasonPass} alt="" />
      </span>
      <span className="season-pass-banner-copy">
        <span className="season-pass-banner-title">{title}</span>
        {/* Wraps to two lines rather than truncating: this is the only place
            the pass is explained, and the Spanish line is longer. */}
        <span className="season-pass-banner-benefits">{benefits}</span>
      </span>
      <span className="season-pass-banner-price">{price}</span>
      <svg viewBox="0 0 16 16" className="season-pass-banner-chevron" aria-hidden="true">
        <path
          d="M6 3.5L10.5 8L6 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
