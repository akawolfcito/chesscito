import { describe, expect, it } from "vitest";
import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { ProStrip } from "@/components/onboarding/pro-strip";

/**
 * Slide 3's evidence that a paid tier exists. Decorative by design — the
 * landing does not sell — and priced the same way every other paid surface is:
 * a badge floating on the corner, never a figure inside the sentence.
 */
describe("ProStrip", () => {
  function render() {
    return renderWithIntl(
      <ProStrip title="PRO · 30 days" benefits="Full Play" price="$1.99" />,
    );
  }

  it("shows the plan, its benefits and its price", () => {
    render();

    expect(screen.getByText("PRO · 30 days")).toBeInTheDocument();
    expect(screen.getByText("Full Play")).toBeInTheDocument();
    expect(screen.getByText("$1.99")).toBeInTheDocument();
  });

  /** The price used to live inside `proTitle`, competing with the plan name for
   *  the same line. It now wears the house badge — the same one the Season Pass
   *  banner uses one slide earlier — so the cue is learned once. */
  it("floats the price as a corner badge, outside the title", () => {
    const { container } = render();

    const badge = container.querySelector(".onboarding-pro-strip-badge");
    expect(badge?.textContent).toBe("$1.99");
    expect(container.querySelector(".onboarding-pro-strip-title")?.textContent).not.toContain(
      "$1.99",
    );
  });

  it("is not a control: the landing does not sell", () => {
    const { container } = render();

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("button, a")).toBeNull();
  });
});
