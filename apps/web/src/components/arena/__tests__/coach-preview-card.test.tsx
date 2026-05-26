import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import userEvent from "@testing-library/user-event";

import { CoachPreviewCard } from "../coach-preview-card";
import { ARENA_COPY, COACH_CTA_COPY } from "@/lib/content/editorial";

const COPY = ARENA_COPY.coachPreview;

describe("CoachPreviewCard — free user (proActive=false)", () => {
  it("renders the inactive title + chips and OMITS the legacy stat-dump body", () => {
    render(
      <CoachPreviewCard
        proActive={false}
        credits={3}
        onPrimaryCta={vi.fn()}
      />,
    );

    expect(screen.getByText(COPY.inactiveTitle)).toBeInTheDocument();
    for (const benefit of COPY.lockedBenefits) {
      expect(screen.getByText(benefit)).toBeInTheDocument();
    }
    // The stat-dump ("You finished a … match in … moves. Coach found
    // key moments behind …") was the surface this task replaces.
    expect(screen.queryByText(/You finished a /i)).not.toBeInTheDocument();
  });

  it("renders askWithCounter CTA carrying the credits count when credits > 0", () => {
    render(
      <CoachPreviewCard
        proActive={false}
        credits={2}
        onPrimaryCta={vi.fn()}
      />,
    );

    const expected = COACH_CTA_COPY.askWithCounter(2);
    const button = screen.getByRole("button", { name: expected });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/2/);
  });

  it("renders askWhenZero CTA when credits === 0", () => {
    render(
      <CoachPreviewCard
        proActive={false}
        credits={0}
        onPrimaryCta={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: COACH_CTA_COPY.askWhenZero });
    expect(button).toBeInTheDocument();
  });

  it("does NOT render the inactiveCta legacy label ('PRO REVIEW')", () => {
    render(
      <CoachPreviewCard
        proActive={false}
        credits={3}
        onPrimaryCta={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: COPY.inactiveCta })).not.toBeInTheDocument();
  });

  it("invokes onPrimaryCta on tap (credits > 0)", async () => {
    const onPrimaryCta = vi.fn();
    render(
      <CoachPreviewCard
        proActive={false}
        credits={2}
        onPrimaryCta={onPrimaryCta}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: COACH_CTA_COPY.askWithCounter(2) }),
    );
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });

  it("invokes onPrimaryCta on tap (credits === 0)", async () => {
    const onPrimaryCta = vi.fn();
    render(
      <CoachPreviewCard
        proActive={false}
        credits={0}
        onPrimaryCta={onPrimaryCta}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: COACH_CTA_COPY.askWhenZero }),
    );
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });
});

describe("CoachPreviewCard — PRO user (proActive=true)", () => {
  it("renders activeTitle, activeBody, activeCta", () => {
    render(<CoachPreviewCard proActive credits={0} onPrimaryCta={vi.fn()} />);

    expect(screen.getAllByText(COPY.activeTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(COPY.activeBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.activeCta })).toBeInTheDocument();
  });

  it("does NOT render the locked benefit chips", () => {
    render(<CoachPreviewCard proActive credits={0} onPrimaryCta={vi.fn()} />);

    for (const benefit of COPY.lockedBenefits) {
      expect(screen.queryByText(benefit)).not.toBeInTheDocument();
    }
  });

  it("ignores credits — PRO users never see a counter CTA", () => {
    render(<CoachPreviewCard proActive credits={42} onPrimaryCta={vi.fn()} />);

    expect(screen.queryByRole("button", { name: COACH_CTA_COPY.askWithCounter(42) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COACH_CTA_COPY.askWhenZero })).not.toBeInTheDocument();
  });

  it("invokes onPrimaryCta on tap", async () => {
    const onPrimaryCta = vi.fn();
    render(<CoachPreviewCard proActive credits={0} onPrimaryCta={onPrimaryCta} />);

    await userEvent.click(screen.getByRole("button", { name: COPY.activeCta }));
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });
});
