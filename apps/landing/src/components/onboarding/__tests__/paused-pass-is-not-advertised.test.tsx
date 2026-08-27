import { afterEach, describe, expect, it } from "vitest";

import { Slide2Body, Slide3Body } from "@/components/onboarding/slide-bodies";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { isSeasonPassSalesEnabled } from "@/lib/onboarding/sales";
import { renderWithIntl } from "@/test-utils/render-with-intl";

/**
 * ⛔ THE CAROUSEL MUST NOT ADVERTISE A PASS NOBODY CAN BUY.
 *
 * The gap this closes: the pause was implemented in `apps/web`, and the landing
 * is a separate app with its own copy bundle, so slide 2 kept quoting
 * "21-Day Season Pass · $0.99" to every first-time visitor for two days. No type
 * error and no broken build could ever have pointed at it.
 *
 * ⚠️ These cases drive the REAL FLAG rather than asserting absence outright, so
 * turning sales back on does not leave a red suite demanding that a live offer
 * stay hidden. A guard you must delete to ship the feature it guards gets
 * deleted carelessly.
 */

const ENV_VAR = "NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED";

afterEach(() => {
  delete process.env[ENV_VAR];
});

describe("the paused Season Pass is not advertised", () => {
  it("reads the SAME env var the app gates the real sale on", () => {
    // ⛔ The whole point of the rewrite. A local constant would let the app
    // resume selling while this carousel stayed silent forever.
    delete process.env[ENV_VAR];
    expect(isSeasonPassSalesEnabled()).toBe(false);

    process.env[ENV_VAR] = "true";
    expect(isSeasonPassSalesEnabled()).toBe(true);
  });

  it("treats anything but the exact string \"true\" as paused", () => {
    // Money-moving flags must never be switched on by a typo.
    for (const value of ["", "1", "TRUE", "yes", "false"]) {
      process.env[ENV_VAR] = value;
      expect(isSeasonPassSalesEnabled(), `"${value}" must not enable`).toBe(false);
    }
  });

  for (const locale of ["en", "es"] as const) {
    it(`slide 2 quotes no price for it in ${locale} while paused`, () => {
      delete process.env[ENV_VAR];
      const { container } = renderWithIntl(<Slide2Body />, { locale });
      const text = container.textContent ?? "";

      expect(text).not.toContain("$0.99");
      expect(text.toLowerCase()).not.toContain("season pass");
      // The banner is the vehicle: make sure the whole thing is gone, not just
      // its words.
      expect(container.querySelector(".season-pass-banner")).toBeNull();
    });

    it(`slide 2 brings the banner back in ${locale} when sales resume`, () => {
      // ⛔ The direction the old constant could never prove. Without this, a
      // guard that silently stopped rendering forever would still pass.
      process.env[ENV_VAR] = "true";
      const { container } = renderWithIntl(<Slide2Body />, { locale });

      expect(container.querySelector(".season-pass-banner")).not.toBeNull();
      expect(container.textContent).toContain("$0.99");
    });

    it(`slide 3 never sells PRO on a benefit nobody can reach in ${locale}`, () => {
      // PRO is still for sale, so this slide stays. What it may NOT do is list
      // the paused pass among the things PRO includes: that sends a buyer
      // looking for something the app no longer shows.
      delete process.env[ENV_VAR];
      const { container } = renderWithIntl(<Slide3Body />, { locale });

      expect((container.textContent ?? "").toLowerCase()).not.toContain("season pass");
    });
  }

  /** The strings survive the pause on purpose — resuming must be a setting, not
   *  a rewrite in two languages. */
  it("keeps the copy in both bundles, ready for the pass to return", () => {
    expect(enMessages.onboarding.slide2.passPrice).toBe("$0.99");
    expect(esMessages.onboarding.slide2.passLabel).toContain("Season Pass");
  });
});
