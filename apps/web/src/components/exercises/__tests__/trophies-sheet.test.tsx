import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrophiesSheet } from "../trophies-sheet";

vi.mock("@/components/trophies/trophies-body", () => ({
  TrophiesBody: () => <div data-testid="trophies-body" />,
}));

describe("TrophiesSheet — showTrigger gate", () => {
  it("renders the dock trigger by default", () => {
    render(<TrophiesSheet open={false} onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: /trophies/i })).toBeInTheDocument();
  });

  it("omits the orphan trigger when showTrigger is false", () => {
    render(
      <TrophiesSheet open={false} onOpenChange={() => {}} showTrigger={false} />,
    );
    expect(screen.queryByRole("button", { name: /trophies/i })).not.toBeInTheDocument();
  });
});
