import { describe, expect, it } from "vitest";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import { renderWithIntl, screen, fireEvent } from "@/test-utils/render-with-intl";

describe("OnboardingCarousel", () => {
  it("renders slide 1 with a 1/4 progress counter and no Skip control", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /daily focus ritual/i })).toBeInTheDocument();
    expect(screen.queryByText(/skip/i)).not.toBeInTheDocument();
  });

  it("advances slide 1 -> 2 -> 3 -> 4 via the CTA button", () => {
    renderWithIntl(<OnboardingCarousel />);

    fireEvent.click(screen.getByRole("button", { name: "START" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /daily chess habit/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /upgrade for coach pro/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /learn the pieces first/i })).toBeInTheDocument();
  });

  it("slide 4 offers Learn as the only CTA, with Play reachable via a text link", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "START" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByRole("link", { name: /learn pieces/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(screen.getByRole("link", { name: /jump to play/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=play",
    );
    // The recommendation only holds if Play never grows back into a rival
    // button; both destinations stay reachable, one of them quietly.
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("always shows the Privacy/Terms/Support legal footer", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("back arrow is disabled on slide 1, enabled after advancing, and navigates back", () => {
    renderWithIntl(<OnboardingCarousel />);
    const back = screen.getByRole("button", { name: /previous slide/i });
    expect(back).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "START" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(back).not.toBeDisabled();

    fireEvent.click(back);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("top forward arrow advances a slide same as the CTA button", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("forward arrow is disabled on slide 4 (no slide 5); back arrow returns to slide 3", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "START" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByRole("heading", { name: /learn the pieces first/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next slide/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /previous slide/i }));
    expect(screen.getByRole("heading", { name: /upgrade for coach pro/i })).toBeInTheDocument();
  });

  it("swipes left to advance and right to go back", () => {
    renderWithIntl(<OnboardingCarousel />);
    const area = screen.getByTestId("slide-swipe-area");

    fireEvent.touchStart(area, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 50, clientY: 100 }] });
    expect(screen.getByText("2 / 4")).toBeInTheDocument();

    fireEvent.touchStart(area, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });
});
