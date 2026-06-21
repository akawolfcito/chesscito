import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { NextStepCard } from "../next-step-card";
import type { ContentLoopAction } from "@/lib/hub/content-loop";

afterEach(() => {
  cleanup();
});

const FORBIDDEN = /verified|on-?chain|\bNFT\b|\bmint\b|proof|brain health|cure|improves (focus|memory)|casino|wagering|\bprize\b/i;

function makeAction(variant: ContentLoopAction["variant"], destination: string | null = "/exercises"): ContentLoopAction {
  return {
    variant,
    destination,
    ctaEN: `CTA-${variant}`,
    ctaES: `CTA-ES-${variant}`,
    subEN: `Sub-${variant}`,
    subES: `Sub-ES-${variant}`,
  };
}

describe("<NextStepCard>", () => {
  it("renders null when isHydrated=false (no flash before data loads)", () => {
    const { container } = render(
      <NextStepCard action={makeAction("daily-pending")} isHydrated={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when isHydrated=false even when action is claim-pending", () => {
    const { container } = render(
      <NextStepCard action={makeAction("claim-pending", "/trophies")} isHydrated={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the card when isHydrated=true", () => {
    render(<NextStepCard action={makeAction("continue-path")} isHydrated={true} />);
    expect(screen.getByTestId("next-step-card")).toBeInTheDocument();
  });

  it("shows CTA text from the action", () => {
    render(<NextStepCard action={makeAction("daily-pending")} isHydrated={true} />);
    expect(screen.getByText("CTA-daily-pending")).toBeInTheDocument();
  });

  it("shows sub text from the action", () => {
    render(<NextStepCard action={makeAction("daily-pending")} isHydrated={true} />);
    expect(screen.getByText("Sub-daily-pending")).toBeInTheDocument();
  });

  it("renders a clickable link when destination is not null", () => {
    render(<NextStepCard action={makeAction("continue-path", "/exercises?piece=rook")} isHydrated={true} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/exercises?piece=rook");
  });

  it("come-back-tomorrow: no clickable link when destination is null", () => {
    render(
      <NextStepCard
        action={makeAction("come-back-tomorrow", null)}
        isHydrated={true}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    // The card itself still renders (informative state)
    expect(screen.getByTestId("next-step-card")).toBeInTheDocument();
  });

  it("view-progress: renders micro-card variant with data-variant attribute", () => {
    render(
      <NextStepCard
        action={makeAction("view-progress", "/trophies")}
        isHydrated={true}
      />,
    );
    const card = screen.getByTestId("next-step-card");
    expect(card).toHaveAttribute("data-variant", "view-progress");
  });

  it("view-progress: link navigates to /trophies", () => {
    render(
      <NextStepCard
        action={{ ...makeAction("view-progress", "/trophies") }}
        isHydrated={true}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trophies");
  });

  it("does not contain forbidden copy", () => {
    for (const variant of [
      "daily-pending",
      "claim-pending",
      "continue-path",
      "labyrinth-ready",
      "improve-stars",
      "next-piece",
      "come-back-tomorrow",
      "view-progress",
    ] as ContentLoopAction["variant"][]) {
      const dest = variant === "come-back-tomorrow" ? null : "/exercises";
      const { unmount } = render(
        <NextStepCard action={makeAction(variant, dest)} isHydrated={true} />,
      );
      expect(document.body.textContent).not.toMatch(FORBIDDEN);
      unmount();
    }
  });
});
