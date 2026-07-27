import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { StreakNudgeScreen } from "../streak-nudge-screen";
import { STREAK_NUDGE_COPY } from "@/lib/content/editorial";

function setup(overrides: Partial<Parameters<typeof StreakNudgeScreen>[0]> = {}) {
  const onDismiss = vi.fn();
  const onOpenDaily = vi.fn();
  renderWithIntl(
    <StreakNudgeScreen onDismiss={onDismiss} onOpenDaily={onOpenDaily} {...overrides} />,
  );
  return { onDismiss, onOpenDaily };
}

describe("StreakNudgeScreen", () => {
  it("states the rule and offers the way in", () => {
    setup();

    expect(screen.getByText(STREAK_NUDGE_COPY.title)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: STREAK_NUDGE_COPY.cta }),
    ).toBeInTheDocument();
  });

  it("is the only modal on screen", () => {
    setup();

    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
  });

  it("dismisses on a tap outside the panel", () => {
    const { onDismiss, onOpenDaily } = setup();

    fireEvent.click(document.querySelector('[aria-modal="true"]')!);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenDaily).not.toHaveBeenCalled();
  });

  it("dismisses on a tap INSIDE the panel, because the hint says tap anywhere", () => {
    const { onDismiss, onOpenDaily } = setup();

    fireEvent.click(screen.getByText(STREAK_NUDGE_COPY.body));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenDaily).not.toHaveBeenCalled();
  });

  it("dismisses on the explicit close button, identically", () => {
    const { onDismiss, onOpenDaily } = setup();

    fireEvent.click(screen.getByRole("button", { name: STREAK_NUDGE_COPY.closeLabel }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenDaily).not.toHaveBeenCalled();
  });

  it("opens the Daily WITHOUT the dismiss-anywhere surface eating the tap", () => {
    const { onDismiss, onOpenDaily } = setup();

    fireEvent.click(screen.getByRole("button", { name: STREAK_NUDGE_COPY.cta }));

    expect(onOpenDaily).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
