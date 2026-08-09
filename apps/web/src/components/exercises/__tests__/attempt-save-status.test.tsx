import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { AttemptSaveStatus } from "../attempt-save-status";

/**
 * Founder, 2026-08-09: "debe ser flotante… el save no debería ser obligatorio
 * para pasar, sino un premio."
 *
 * Two things were wrong, and only one of them was position. The line sat in
 * normal flow, so it shoved the board down the screen. And it was WORDED as a
 * debt — "attempts haven't been saved yet" — for a state the player caused by
 * winning. Nothing here blocks him: the attempt is safe in the queue and he can
 * keep playing. So it floats, and it offers.
 */
describe("<AttemptSaveStatus>", () => {
  it("says nothing when the queue is empty", () => {
    const { container } = render(
      <AttemptSaveStatus status="idle" pendingCount={0} onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("floats instead of taking a row from the board", () => {
    render(
      <AttemptSaveStatus status="sending" pendingCount={1} onRetry={vi.fn()} />,
    );
    // jsdom has no layout, so the contract is carried by the class the
    // stylesheet keys the fixed positioning off. Losing it is the regression.
    const line = screen.getByTestId("attempt-save-status");
    expect(line.className).toMatch(/is-floating\b/);
  });

  it("offers the save as something earned, never as a debt", () => {
    render(
      <AttemptSaveStatus status="failed" pendingCount={2} onRetry={vi.fn()} />,
    );

    const line = screen.getByTestId("attempt-save-status");
    // The exact wording is editorial and will drift; what must not drift is
    // that it stops accusing. "haven't been saved yet" reads as the player
    // owing something for having won.
    expect(line.textContent).not.toMatch(/haven|hasn|yet/i);
    expect(line.textContent).toMatch(/ready to save/i);
  });

  it("calls onRetry from the save action", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <AttemptSaveStatus status="failed" pendingCount={1} onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no action while a delivery is still in flight", () => {
    render(
      <AttemptSaveStatus status="sending" pendingCount={1} onRetry={vi.fn()} />,
    );
    // Nothing to retry mid-flight, and offering it would invite a second POST
    // of an attempt the server is already answering.
    expect(screen.queryByRole("button")).toBeNull();
  });
});
