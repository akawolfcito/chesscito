import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { KingdomCard } from "../kingdom-card";

describe("KingdomCard", () => {
  it("renders the panel title, body and the 3 benefit labels in both states", () => {
    render(<KingdomCard pro={{ active: false }} onProDiscover={() => {}} />);

    expect(screen.getByText("Play Kingdom")).toBeInTheDocument();
    expect(
      screen.getByText("Play matches, sharpen tactics, and improve with Coach."),
    ).toBeInTheDocument();
    expect(screen.getByText("Quick Match")).toBeInTheDocument();
    expect(screen.getByText("Coach Review")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(
      document.querySelector('[data-theme-slot="hub.quick-match-benefit"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-theme-slot="hub.coach-review-benefit"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-theme-slot="hub.rewards-benefit"]'),
    ).not.toBeNull();
  });

  it("non-PRO: the explanatory PRO strip is the tappable discovery surface", async () => {
    const onProDiscover = vi.fn();
    render(<KingdomCard pro={{ active: false }} onProDiscover={onProDiscover} />);

    const cta = screen.getByRole("button", {
      name: "PRO inactive: tap to learn more",
    });
    expect(cta).toHaveTextContent("Chesscito PRO");
    expect(cta).toHaveTextContent("Season Pass + unlimited Coach");
    expect(cta).toHaveTextContent("Unlock");
    await userEvent.click(cta);
    expect(onProDiscover).toHaveBeenCalledTimes(1);
  });

  it("PRO active: the same strip exposes days remaining and opens management", async () => {
    const onProDiscover = vi.fn();
    render(
      <KingdomCard
        pro={{ active: true, daysRemaining: 206 }}
        onProDiscover={onProDiscover}
      />,
    );

    const cta = screen.getByRole("button", {
      name: "PRO active, 206 days remaining",
    });
    expect(cta).toHaveAttribute("data-pro-status", "active");
    expect(cta).toHaveTextContent("206d");
    await userEvent.click(cta);
    expect(onProDiscover).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["loading", "Checking", "PRO status is being checked"],
    ["unknown", "Unavailable", "PRO status unavailable: try again shortly"],
    ["error", "Unavailable", "PRO status unavailable: try again shortly"],
  ] as const)(
    "maps %s to a human-readable status inside the PRO strip",
    (status, visibleStatus, ariaLabel) => {
      render(
        <KingdomCard
          pro={{ active: false, status, staleVisualActive: false }}
          onProDiscover={() => {}}
        />,
      );

      const cta = screen.getByRole("button", { name: ariaLabel });
      expect(cta).toHaveAttribute("data-pro-status", status);
      expect(cta).toHaveTextContent(visibleStatus);
    },
  );

  it("retains active chip art when an unavailable response has trusted stale state", () => {
    render(
      <KingdomCard
        pro={{ active: false, status: "error", staleVisualActive: true }}
        onProDiscover={() => {}}
      />,
    );

    expect(screen.getByTestId("kingdom-pro-cta")).toHaveAttribute(
      "data-pro-visual-stale",
      "true",
    );
  });
});
