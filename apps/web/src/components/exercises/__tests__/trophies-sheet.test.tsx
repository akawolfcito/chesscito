import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { describe, expect, it, vi } from "vitest";
import { TrophiesSheet } from "../trophies-sheet";

vi.mock("@/components/trophies/trophies-body", () => ({
  TrophiesBody: () => <div data-testid="trophies-body" />,
  TrophiesHeroBand: () => <div data-testid="trophies-hero-band" />,
}));

vi.mock("@/components/trophies/trophies-data-provider", () => ({
  TrophiesDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="trophies-data-provider">{children}</div>
  ),
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

describe("TrophiesSheet — ContextualHeader canary", () => {
  it("mounts the close-control ContextualHeader (not the legacy ad-hoc header)", () => {
    render(<TrophiesSheet open onOpenChange={() => {}} showTrigger={false} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-component", "contextual-header");
    expect(header).toHaveAttribute("data-variant", "close-control");
  });

  it("renders exactly one close affordance (inline, not the floating absolute X)", () => {
    render(<TrophiesSheet open onOpenChange={() => {}} showTrigger={false} />);
    const closeButtons = screen.getAllByRole("button", { name: /close trophies/i });
    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].getAttribute("data-slot")).toBe("close-control");
  });
});
