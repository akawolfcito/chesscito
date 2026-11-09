import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, fireEvent } from "@testing-library/react";
import { DisplayNameDialog } from "@/components/profile/display-name-dialog";

describe("<DisplayNameDialog>", () => {
  it("renders input pre-filled with current name", () => {
    render(
      <DisplayNameDialog open initialValue="Akawolf" onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByDisplayValue("Akawolf")).toBeInTheDocument();
  });

  it("calls onSave with trimmed value when Save tapped", () => {
    const onSave = vi.fn();
    render(<DisplayNameDialog open initialValue="" onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Wolfcito  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("Wolfcito");
  });

  it("calls onCancel when Cancel tapped", () => {
    const onCancel = vi.fn();
    render(<DisplayNameDialog open initialValue="x" onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("enforces 20-character max", () => {
    render(<DisplayNameDialog open initialValue="" onSave={() => {}} onCancel={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.maxLength).toBe(20);
  });
});
