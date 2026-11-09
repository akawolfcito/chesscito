import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { ArenaConfirmModal } from "../arena-confirm-modal";

afterEach(cleanup);

const base = {
  title: "Leave the match?",
  body: "Your progress in this match will be lost.",
  confirmLabel: "Leave",
  cancelLabel: "Keep playing",
  closeAriaLabel: "Close",
  confirmTestId: "confirm-x",
};

describe("ArenaConfirmModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ArenaConfirmModal
        open={false}
        {...base}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the title + body + both actions when open", () => {
    render(
      <ArenaConfirmModal open {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Leave the match?")).toBeInTheDocument();
    expect(
      screen.getByText("Your progress in this match will be lost."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("confirm-x")).toBeInTheDocument();
    expect(screen.getByText("Keep playing")).toBeInTheDocument();
  });

  it("the danger CTA fires onConfirm only", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ArenaConfirmModal
        open
        {...base}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("confirm-x"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("the danger CTA carries the --danger modifier", () => {
    render(
      <ArenaConfirmModal open {...base} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByTestId("confirm-x").className).toContain(
      "arena-result-secondary-action--danger",
    );
  });

  it("the neutral CTA and the red X both back out via onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ArenaConfirmModal
        open
        {...base}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Keep playing"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
