import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DailyLimitBanner } from "@/components/daily/daily-limit-banner";

// Mock hoursUntilNextUtcDay from tile-availability
vi.mock("@/lib/hub/tile-availability", () => ({
  hoursUntilNextUtcDay: vi.fn(),
}));

import { hoursUntilNextUtcDay } from "@/lib/hub/tile-availability";
const mockHours = hoursUntilNextUtcDay as ReturnType<typeof vi.fn>;

describe("DailyLimitBanner", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockReset();
    window.localStorage.clear();
  });

  describe("soft limit (isHardMax=false)", () => {
    it("renders 'Great focus today!' heading", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText("Great focus today!")).toBeInTheDocument();
    });

    it("renders countdown as plain reminder text when < 12h remaining", () => {
      mockHours.mockReturnValue(5.5);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText("More in 5h 30m")).toBeInTheDocument();
    });

    it("renders 'More tomorrow' when >= 12h remaining", () => {
      mockHours.mockReturnValue(14);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText("More tomorrow")).toBeInTheDocument();
    });

    it("does not render the removed paid CTA", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(
        screen.queryByRole("button", { name: /Unlock 5 more today/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onBack when 'Back to Hub' is clicked", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      screen.getByRole("button", { name: /Back to Hub/i }).click();
      expect(onBack).toHaveBeenCalledOnce();
    });

    it("close (X) dismisses without navigating to Hub", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      fireEvent.click(screen.getByRole("button", { name: /Close/i }));
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.queryByText("Great focus today!")).not.toBeInTheDocument();
    });
  });

  describe("show-once per UTC day", () => {
    it("renders nothing when already acknowledged today", () => {
      mockHours.mockReturnValue(3);
      const dayKey = new Date().toISOString().slice(0, 10);
      window.localStorage.setItem(`chesscito:daily-limit-ack:${dayKey}`, "1");
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.queryByText("Great focus today!")).not.toBeInTheDocument();
    });

    it("persists acknowledgement after the close button", () => {
      mockHours.mockReturnValue(3);
      const dayKey = new Date().toISOString().slice(0, 10);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      screen.getByRole("button", { name: /Close/i }).click();
      expect(
        window.localStorage.getItem(`chesscito:daily-limit-ack:${dayKey}`),
      ).toBe("1");
    });
  });

  describe("hard max (isHardMax=true)", () => {
    it("renders hard max copy", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={true} onBack={onBack} />);
      expect(screen.getByText(/That's enough focus for today/)).toBeInTheDocument();
    });

    it("does not render paid CTA at hard max", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={true} onBack={onBack} />);
      expect(screen.queryByRole("button", { name: /Unlock 5 more today/i })).not.toBeInTheDocument();
    });
  });
});
