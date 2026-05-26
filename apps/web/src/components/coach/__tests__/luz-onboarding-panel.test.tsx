import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import userEvent from "@testing-library/user-event";

import { LuzOnboardingPanel } from "../luz-onboarding-panel";
import { COACH_ONBOARDING_COPY } from "@/lib/content/editorial";

describe("LuzOnboardingPanel — outcome branching", () => {
  it("renders the win intro when outcome='win'", () => {
    render(
      <LuzOnboardingPanel outcome="win" onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(screen.getByText(COACH_ONBOARDING_COPY.intros.win)).toBeInTheDocument();
  });

  it("renders the lose intro when outcome='lose'", () => {
    render(
      <LuzOnboardingPanel outcome="lose" onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(screen.getByText(COACH_ONBOARDING_COPY.intros.lose)).toBeInTheDocument();
  });

  it("renders the draw intro when outcome='draw'", () => {
    render(
      <LuzOnboardingPanel outcome="draw" onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(screen.getByText(COACH_ONBOARDING_COPY.intros.draw)).toBeInTheDocument();
  });
});

describe("LuzOnboardingPanel — CTA handlers", () => {
  it("renders both accept and decline buttons with editorial labels", () => {
    render(
      <LuzOnboardingPanel outcome="win" onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: COACH_ONBOARDING_COPY.ctaAccept }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: COACH_ONBOARDING_COPY.ctaDecline }),
    ).toBeInTheDocument();
  });

  it("invokes onAccept when the accept button is tapped", async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <LuzOnboardingPanel outcome="win" onAccept={onAccept} onDecline={onDecline} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: COACH_ONBOARDING_COPY.ctaAccept }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
  });

  it("invokes onDecline when the decline button is tapped", async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <LuzOnboardingPanel outcome="lose" onAccept={onAccept} onDecline={onDecline} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: COACH_ONBOARDING_COPY.ctaDecline }),
    );
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });
});
