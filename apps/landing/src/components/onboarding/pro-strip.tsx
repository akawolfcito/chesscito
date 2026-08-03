import { ArtImage } from "@/components/onboarding/art-image";
import { ICONS } from "@/lib/onboarding/slides";

/**
 * Slide 3's evidence that a paid tier exists. DECORATIVE on purpose: a plain
 * div, no link, no button, nothing focusable. In the Play Hub the same shape
 * opens the purchase sheet, but the landing does not sell — a control here
 * would promise a checkout that is two navigations away.
 *
 * Ported from `.kingdom-card-pro-cta` MINUS its badge subtree: that art comes
 * from the theme system, which this app does not have. The icon is a plain
 * ArtImage instead, or the 66px the badge used to fill would render as a hole.
 */
export function ProStrip({
  title,
  benefits,
  price,
}: {
  title: string;
  benefits: string;
  price: string;
}) {
  return (
    <div className="onboarding-pro-strip">
      {/* Price on the corner, not inside the title. Same badge the Season Pass
          banner wears one slide earlier: a visitor should learn the cue once
          and read it everywhere. It used to live in the title string, where it
          competed with the plan name for the same line. */}
      <span className="onboarding-pro-strip-badge">{price}</span>
      <span className="onboarding-pro-strip-icon">
        <ArtImage src={ICONS.pro} alt="" />
      </span>
      <span className="onboarding-pro-strip-copy">
        <span className="onboarding-pro-strip-title">{title}</span>
        {/* Wraps to two lines rather than truncating: this is the only place
            the paid tier is explained, and the Spanish line is longer. The
            source rule ellipsised it. */}
        <span className="onboarding-pro-strip-benefits">{benefits}</span>
      </span>
    </div>
  );
}
