import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersistentDock } from "../persistent-dock";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/hub"));
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

describe("PersistentDock — v1 5-slot taxonomy (SPEC 1 D7)", () => {
  it("renders exactly 5 dock slots in v1 taxonomy", () => {
    pathnameMock.mockReturnValue("/hub");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pieces/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /board/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
    // Removed from the dock in v1 — entries moved to Profile / HUD chip
    // / future SPEC. Asserting absence keeps the taxonomy contract tight.
    expect(screen.queryByRole("button", { name: /trophies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /badges/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^arena$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
  });

  it("marks Home active on /hub and Pieces inactive", () => {
    pathnameMock.mockReturnValue("/hub");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /home/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /pieces/i })).not.toHaveAttribute("aria-current");
  });

  it("marks Pieces active on /exercises and Home inactive", () => {
    pathnameMock.mockReturnValue("/exercises");

    render(<PersistentDock />);

    expect(screen.getByRole("button", { name: /pieces/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /home/i })).not.toHaveAttribute("aria-current");
  });
});
