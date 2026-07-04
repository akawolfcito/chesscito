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
    expect(screen.queryByText("4 / 4")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /choose your path/i })).toBeInTheDocument();
  });

  it("slide 4 renders both CTAs linking to /api/enter with the correct mode, no progress counter", () => {
    renderWithIntl(<OnboardingCarousel />);
    fireEvent.click(screen.getByRole("button", { name: "START" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(screen.getByRole("link", { name: /start learning/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
    expect(screen.getByRole("link", { name: /enter arena/i })).toHaveAttribute(
      "href",
      "/api/enter?mode=play",
    );
  });

  it("always shows the Privacy/Terms/Support legal footer", () => {
    renderWithIntl(<OnboardingCarousel />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Terms")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });
});
