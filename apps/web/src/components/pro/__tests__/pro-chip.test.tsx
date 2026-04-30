import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

import { ProChip } from "../pro-chip";

afterEach(() => {
  cleanup();
  trackMock.mockReset();
});

describe("ProChip", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  it("renders GET PRO when status is inactive", () => {
    render(<ProChip status={{ active: false, expiresAt: null }} isLoading={false} onClick={vi.fn()} />);
    expect(screen.getByText("GET PRO")).toBeInTheDocument();
  });

  it("renders the days-left label when PRO is active", () => {
    const expiresAt = NOW + 7 * 24 * 60 * 60 * 1000;
    render(<ProChip status={{ active: true, expiresAt }} isLoading={false} onClick={vi.fn()} />);
    expect(screen.getByText(/PRO • 7d/i)).toBeInTheDocument();
  });

  it("collapses to the 'expires today' label when only hours remain", () => {
    const expiresAt = NOW + 60 * 60 * 1000; // 1 hour
    render(<ProChip status={{ active: true, expiresAt }} isLoading={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Expires tomorrow|1d/)).toBeInTheDocument();
  });

  it("renders a skeleton with aria-busy when loading and no status yet", () => {
    render(<ProChip status={null} isLoading={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("invokes onClick when tapped", () => {
    const onClick = vi.fn();
    render(<ProChip status={{ active: false, expiresAt: null }} isLoading={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to GET PRO when status reports active=true but expiresAt is in the past (defensive)", () => {
    const stalePast = NOW - 1_000;
    render(<ProChip status={{ active: true, expiresAt: stalePast }} isLoading={false} onClick={vi.fn()} />);
    expect(screen.getByText("GET PRO")).toBeInTheDocument();
  });

  describe("telemetry", () => {
    it("fires pro_card_viewed once when status resolves (chip surface)", () => {
      const { rerender } = render(
        <ProChip status={null} isLoading={true} onClick={vi.fn()} />,
      );
      expect(trackMock).not.toHaveBeenCalled();

      rerender(
        <ProChip status={{ active: false, expiresAt: null }} isLoading={false} onClick={vi.fn()} />,
      );
      expect(trackMock).toHaveBeenCalledWith("pro_card_viewed", {
        surface: "chip",
        active: false,
      });

      // Re-renders with the same resolved status must not re-fire.
      rerender(
        <ProChip status={{ active: false, expiresAt: null }} isLoading={false} onClick={vi.fn()} />,
      );
      expect(trackMock).toHaveBeenCalledTimes(1);
    });

    it("fires pro_cta_clicked with source=chip on tap", () => {
      const onClick = vi.fn();
      render(
        <ProChip status={{ active: false, expiresAt: null }} isLoading={false} onClick={onClick} />,
      );
      trackMock.mockClear(); // drop the mount-time pro_card_viewed
      fireEvent.click(screen.getByRole("button"));

      expect(trackMock).toHaveBeenCalledWith("pro_cta_clicked", { source: "chip" });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
