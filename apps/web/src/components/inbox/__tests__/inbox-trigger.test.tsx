import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { InboxTrigger } from "../inbox-trigger";

/**
 * `InboxTrigger` is the presentational half of the header Inbox entry.
 *
 * It exists so the hub can be PHOTOGRAPHED. `InboxChip` reads the wallet
 * (`useAccount`) and the inbox itself, and `/dev` mounts no wagmi provider — so
 * the chip rendered nothing there and the vr17 baselines froze a header without
 * the envelope that actually ships. Same split the repo already made for the
 * Daily (`HubDailyTile` → `HubDailyTrigger`) and the Peones chip.
 *
 * Everything here must be derivable from props alone: the moment this component
 * reads a hook, the fixture goes blind again.
 */
describe("InboxTrigger", () => {
  it("renders the envelope and no badge when nothing is unread", () => {
    render(<InboxTrigger unread={0} onClick={vi.fn()} />);

    expect(screen.getByTestId("inbox-chip")).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-chip-badge")).not.toBeInTheDocument();
  });

  it("shows the exact count while it fits in the badge", () => {
    render(<InboxTrigger unread={3} onClick={vi.fn()} />);

    expect(screen.getByTestId("inbox-chip-badge")).toHaveTextContent("3");
  });

  it("caps the badge at 9+ so a long number cannot stretch the header", () => {
    render(<InboxTrigger unread={42} onClick={vi.fn()} />);

    expect(screen.getByTestId("inbox-chip-badge")).toHaveTextContent("9+");
  });

  it("announces the unread count to screen readers, not just in colour", () => {
    const { rerender } = render(<InboxTrigger unread={0} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();

    rerender(<InboxTrigger unread={2} onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Inbox, 2 unread" }),
    ).toBeInTheDocument();
  });

  it("reports the tap to its owner and never navigates on its own", () => {
    const onClick = vi.fn();
    render(<InboxTrigger unread={1} onClick={onClick} />);

    fireEvent.click(screen.getByTestId("inbox-chip"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks the unread state on the element so CSS can dress it", () => {
    const { rerender } = render(<InboxTrigger unread={0} onClick={vi.fn()} />);
    expect(screen.getByTestId("inbox-chip")).not.toHaveAttribute("data-unread");

    rerender(<InboxTrigger unread={5} onClick={vi.fn()} />);
    expect(screen.getByTestId("inbox-chip")).toHaveAttribute("data-unread");
  });
});
