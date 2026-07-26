/**
 * Hub right-rail availability signals (founder micro-block 2026-06-11).
 *
 * Contract under test:
 *  - Daily available → green "ready" dot; completed → static
 *    "Next Xh" / "Tomorrow" chip.
 *  - Coach tile shows a static PRO/Ask chip and never auto-fires
 *    analysis (its only side effect is the tap handler).
 *  - NO per-second timers: rendering the tiles must not register any
 *    setInterval (performance rule for MiniPay).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { fireEvent, screen } from "@testing-library/react";

vi.mock("@/lib/haptics", () => ({ hapticTap: () => {} }));
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false, address: undefined }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
}));

import { HubDailyTile } from "../hub-daily-tile";
import { HubArenaTile } from "../hub-arena-tile";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";
import { todayUtc } from "@/lib/daily/progress";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

/** setInterval calls made by APP code — excludes testing-library's
 *  internal waitFor heartbeat (checkRealTimersCallback @ 50ms). */
function appIntervalCalls(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter(
    (call: unknown[]) =>
      (call[0] as { name?: string }).name !== "checkRealTimersCallback",
  );
}

describe("HubDailyTile availability signal", () => {
  it("available daily shows the ready dot", async () => {
    render(<HubDailyTile />);
    const status = await screen.findByTestId("hub-tile-status");
    expect(status).toHaveAttribute("data-status", "ready");
  });

  it("completed daily shows a static Next/Tomorrow chip", async () => {
    // Seed the same storage key the progress module reads.
    window.localStorage.setItem(
      "chesscito:daily-progress",
      JSON.stringify({
        streak: 1,
        lastCompletedDate: todayUtc(),
        totalCompleted: 1,
      }),
    );
    render(<HubDailyTile />);
    const status = await screen.findByTestId("hub-tile-status");
    expect(status).toHaveAttribute("data-status", "label");
    expect(status.textContent).toMatch(/^(Next \d+h|Tomorrow)$/);
  });

  it("registers NO setInterval (no live countdown)", async () => {
    const spy = vi.spyOn(window, "setInterval");
    render(<HubDailyTile />);
    await screen.findByTestId("hub-tile-status");
    // testing-library's waitFor registers its own 50ms heartbeat
    // (checkRealTimersCallback) — filter the harness, keep the app.
    expect(appIntervalCalls(spy)).toHaveLength(0);
    spy.mockRestore();
  });

  it("supports an optional controlled Daily sheet while preserving trigger notifications", async () => {
    const onOpenChange = vi.fn();
    const view = render(
      <HubDailyTile open={false} onOpenChange={onOpenChange} />,
    );
    const status = await screen.findByTestId("hub-tile-status");
    const trigger = status.closest("button");
    expect(trigger).not.toBeNull();

    fireEvent.click(trigger!);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId("daily-tactic-sheet")).toBeNull();

    view.rerender(<HubDailyTile open onOpenChange={onOpenChange} />);
    expect(await screen.findByTestId("daily-tactic-sheet")).toBeInTheDocument();

    view.rerender(<HubDailyTile open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByTestId("daily-tactic-sheet")).toBeNull();
  });
});

describe("HubArenaTile (Mate) availability signal", () => {
  // The dot used to be a permanently-lit "ready" chip (no invented
  // logic behind it). It is now driven by the milestone machine's
  // `openedAt` — see hub-arena-tile.test.tsx for the full NEW-dot
  // contract. This test only confirms the timer discipline still holds.
  it("unlocked, never-opened tile shows the NEW dot, no timers", () => {
    const spy = vi.spyOn(window, "setInterval");
    render(<HubArenaTile setup={MINI_ARENA_SETUPS[0]} unlocked />);
    expect(screen.getByTestId("hub-tile-new")).toHaveAttribute(
      "data-status",
      "new",
    );
    expect(appIntervalCalls(spy)).toHaveLength(0);
    spy.mockRestore();
  });

  it("locked tile renders nothing (no dead signal)", () => {
    const { container } = render(
      <HubArenaTile setup={MINI_ARENA_SETUPS[0]} unlocked={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
