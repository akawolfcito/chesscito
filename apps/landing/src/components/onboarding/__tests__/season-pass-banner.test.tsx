import { describe, expect, it } from "vitest";
import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { SeasonPassBanner } from "@/components/onboarding/season-pass-banner";

/**
 * The banner is the SAME shape the Play Hub uses for the purchase CTA
 * (apps/web · `.season-pass-banner`), on purpose: a visitor meets the pass here
 * and again in the app, and the recall only works if the two look identical.
 *
 * What must NOT cross over is the behaviour. The landing does not sell — the
 * checkout is two navigations away — so this is a picture of a button, not a
 * button. Slide 3's ProStrip made the same call.
 */
describe("SeasonPassBanner", () => {
  it("shows the pass, its benefits and its price", () => {
    renderWithIntl(
      <SeasonPassBanner title="21-Day Season Pass" benefits="Daily training" price="$0.99" />,
    );

    expect(screen.getByText("21-Day Season Pass")).toBeInTheDocument();
    expect(screen.getByText("Daily training")).toBeInTheDocument();
    expect(screen.getByText("$0.99")).toBeInTheDocument();
  });

  it("is not a control: nothing here is focusable or clickable", () => {
    const { container } = renderWithIntl(
      <SeasonPassBanner title="21-Day Season Pass" benefits="Daily training" price="$0.99" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("button, a")).toBeNull();
  });

  it("wears the same class as the Hub's CTA, so the two surfaces stay in sync", () => {
    const { container } = renderWithIntl(
      <SeasonPassBanner title="21-Day Season Pass" benefits="Daily training" price="$0.99" />,
    );

    expect(container.querySelector(".season-pass-banner")).not.toBeNull();
    expect(container.querySelector(".season-pass-banner-price")).not.toBeNull();
  });

  it("hides the chevron from assistive tech — it points at nothing here", () => {
    const { container } = renderWithIntl(
      <SeasonPassBanner title="21-Day Season Pass" benefits="Daily training" price="$0.99" />,
    );

    expect(container.querySelector(".season-pass-banner-chevron")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
