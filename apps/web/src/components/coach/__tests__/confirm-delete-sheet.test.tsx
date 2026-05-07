import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDeleteSheet } from "../confirm-delete-sheet";

describe("<ConfirmDeleteSheet>", () => {
  it("renders title and body when open", () => {
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("This is permanent.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /no/i })).toBeEnabled();
  });

  it("does not render when open=false", () => {
    render(
      <ConfirmDeleteSheet
        open={false}
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
  });

  it("fires onConfirm when accept button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        isWorking={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onOpenChange(false) when cancel button clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={onOpenChange}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /no/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons when isWorking=true", () => {
    render(
      <ConfirmDeleteSheet
        open
        onOpenChange={() => {}}
        title="Delete?"
        body="This is permanent."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {}}
        isWorking
      />,
    );
    expect(screen.getByRole("button", { name: /yes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /no/i })).toBeDisabled();
  });
});
