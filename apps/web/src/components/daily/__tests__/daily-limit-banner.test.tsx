import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DailyLimitBanner } from "@/components/daily/daily-limit-banner";

// Mock hoursUntilNextUtcDay from tile-availability
vi.mock("@/lib/hub/tile-availability", () => ({
  hoursUntilNextUtcDay: vi.fn(),
}));

import { hoursUntilNextUtcDay } from "@/lib/hub/tile-availability";
const mockHours = hoursUntilNextUtcDay as ReturnType<typeof vi.fn>;

// Mock navigation
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("DailyLimitBanner", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockReset();
  });

  describe("soft limit (isHardMax=false)", () => {
    it("renders 'Great focus today.' heading", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText("Great focus today.")).toBeInTheDocument();
    });

    it("renders countdown when < 12h remaining", () => {
      mockHours.mockReturnValue(5.5);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText(/More opens in/)).toBeInTheDocument();
      expect(screen.getByText(/5h 30m/)).toBeInTheDocument();
    });

    it("renders 'Tomorrow' when >= 12h remaining", () => {
      mockHours.mockReturnValue(14);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      expect(screen.getByText(/More opens/)).toBeInTheDocument();
      expect(screen.getByText(/Tomorrow/)).toBeInTheDocument();
    });

    it("renders disabled paid CTA", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      const unlockBtn = screen.getByRole("button", { name: /Unlock 5 more today/i });
      expect(unlockBtn).toBeDisabled();
    });

    it("calls onBack when 'Back to Hub' is clicked", () => {
      mockHours.mockReturnValue(3);
      render(<DailyLimitBanner isHardMax={false} onBack={onBack} />);
      screen.getByRole("button", { name: /Back to Hub/i }).click();
      expect(onBack).toHaveBeenCalledOnce();
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
