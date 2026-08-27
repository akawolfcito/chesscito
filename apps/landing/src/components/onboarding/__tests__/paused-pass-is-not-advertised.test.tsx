import { describe, expect, it } from "vitest";

import { Slide2Body, Slide3Body } from "@/components/onboarding/slide-bodies";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { SEASON_PASS_SALES_PAUSED } from "@/lib/onboarding/sales";
import { renderWithIntl } from "@/test-utils/render-with-intl";

/**
 * ⛔ WHILE SALES ARE PAUSED, THE LANDING MUST NOT PRICE THE PASS.
 *
 * This is the same rule `/pricing` already enforces, applied to the surface
 * that was actually breaking it: slide 2 of the onboarding carousel quoted
 * "21-Day Season Pass · $0.99" to every first-time visitor while the app had
 * hidden the offer entirely. Nobody noticed because the pause was implemented
 * in `apps/web` and the landing is a separate app with its own copy bundle —
 * which is exactly the kind of gap a test has to hold, since no type error and
 * no broken build will ever point at it.
 *
 * ⚠️ These cases read the FLAG rather than asserting the absence outright, so
 * turning sales back on does not leave a red suite behind demanding that a
 * live offer stay hidden. A guard that has to be deleted to ship the feature it
 * guards gets deleted carelessly.
 */
describe("the paused Season Pass is not advertised", () => {
  it("is paused right now (guards every case below)", () => {
    // If this ever flips, the cases below stop asserting anything — so say it
    // out loud instead of letting them pass vacuously.
    expect(SEASON_PASS_SALES_PAUSED).toBe(true);
  });

  for (const locale of ["en", "es"] as const) {
    it(`slide 2 quotes no price for it in ${locale}`, () => {
      const { container } = renderWithIntl(<Slide2Body />, { locale });
      const text = container.textContent ?? "";

      expect(text).not.toContain("$0.99");
      expect(text.toLowerCase()).not.toContain("season pass");
      // The banner is the vehicle; make sure the whole thing is gone, not just
      // its words.
      expect(container.querySelector(".season-pass-banner")).toBeNull();
    });

    it(`slide 3 does not sell PRO on a benefit nobody can reach in ${locale}`, () => {
      // PRO is still for sale, so this slide stays. What it may NOT do is list
      // the paused pass among the things PRO includes: that sends a buyer
      // looking for something the app no longer shows.
      const { container } = renderWithIntl(<Slide3Body />, { locale });

      expect((container.textContent ?? "").toLowerCase()).not.toContain("season pass");
    });
  }

  /** The strings survive the pause on purpose — bringing the offer back must
   *  be one boolean, not a rewrite in two languages. */
  it("keeps the copy in both bundles, ready for the pass to return", () => {
    expect(enMessages.onboarding.slide2.passPrice).toBe("$0.99");
    expect(esMessages.onboarding.slide2.passLabel).toContain("Season Pass");
  });
});
