import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HubOnboardingCard } from "@/components/hub/onboarding-card";

describe("<HubOnboardingCard>", () => {
  it("renders title + body + dismiss", () => {
    render(<HubOnboardingCard onDismiss={() => {}} />);
    expect(screen.getByText(/welcome to chesscito/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /got it/i })).toBeInTheDocument();
  });

  it("fires onDismiss on click", () => {
    const onDismiss = vi.fn();
    render(<HubOnboardingCard onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
