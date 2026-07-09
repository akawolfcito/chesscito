import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WelcomeBack } from "@/components/onboarding/welcome-back";

describe("WelcomeBack", () => {
  it("renders a single START CTA to the stored mode, a not-sure link to /classic, no progress counter or pills", async () => {
    render(await WelcomeBack({ preferredMode: "play" }));

    expect(screen.getByRole("link", { name: "START" })).toHaveAttribute(
      "href",
      "/api/enter?mode=play",
    );
    expect(screen.getByRole("link", { name: /not sure/i })).toHaveAttribute(
      "href",
      "/classic",
    );
    expect(screen.queryByText(/\d \/ 4/)).not.toBeInTheDocument();
  });

  it("points START at the learn destination when that was the stored mode", async () => {
    render(await WelcomeBack({ preferredMode: "learn" }));
    expect(screen.getByRole("link", { name: "START" })).toHaveAttribute(
      "href",
      "/api/enter?mode=learn",
    );
  });

  /**
   * This screen used to render `slide1.headline`, so one string had to greet a
   * returning player and orient a stranger at the same time. Now it owns its
   * copy, and slide 1 can be rewritten without silently rewriting this.
   */
  it("greets a returning player with its own headline, not slide 1's", async () => {
    render(await WelcomeBack({ preferredMode: "play" }));

    expect(
      screen.getByRole("heading", { name: /your board is waiting/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/two ways into chess/i)).not.toBeInTheDocument();
  });
});
