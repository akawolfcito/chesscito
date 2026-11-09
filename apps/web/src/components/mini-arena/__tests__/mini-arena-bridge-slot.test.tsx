import { describe, it, expect } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { MiniArenaBridgeSlot } from "../mini-arena-bridge-slot";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

const SETUP: MiniArenaSetup = {
  id: "kr-vs-k",
  name: "K+R vs K",
  description: "test setup",
  fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
  parMoves: 16,
  aiLevel: 0,
};

describe("MiniArenaBridgeSlot — gating", () => {
  it("renders nothing when unlocked=false (e2e: getByTestId count = 0)", () => {
    const { container } = render(
      <MiniArenaBridgeSlot setup={SETUP} unlocked={false} />,
    );
    expect(container.querySelector('[data-testid="mini-arena-bridge"]'))
      .toBeNull();
  });
});

describe("MiniArenaBridgeSlot — unlocked (post-StonePedestal migration)", () => {
  it("renders <span data-testid='mini-arena-bridge'> wrapping a <StonePedestal>", () => {
    render(<MiniArenaBridgeSlot setup={SETUP} unlocked />);
    const bridge = screen.getByTestId("mini-arena-bridge");
    expect(bridge.tagName).toBe("SPAN");
    expect(bridge.querySelector('[data-component="stone-pedestal"]'))
      .not.toBeNull();
  });

  it("inner StonePedestal is an enabled <button>", () => {
    render(<MiniArenaBridgeSlot setup={SETUP} unlocked />);
    const stone = screen
      .getByTestId("mini-arena-bridge")
      .querySelector('[data-component="stone-pedestal"]') as HTMLButtonElement;
    expect(stone.tagName).toBe("BUTTON");
    expect(stone.disabled).toBe(false);
  });

  it("aria-label embeds the setup name", () => {
    render(<MiniArenaBridgeSlot setup={SETUP} unlocked />);
    const stone = screen
      .getByTestId("mini-arena-bridge")
      .querySelector('[data-component="stone-pedestal"]') as HTMLElement;
    expect(stone.getAttribute("aria-label")).toMatch(/K\+R vs K/);
  });

  it("uses stone={4} (per spec migration mapping)", () => {
    render(<MiniArenaBridgeSlot setup={SETUP} unlocked />);
    const stone = screen
      .getByTestId("mini-arena-bridge")
      .querySelector('[data-component="stone-pedestal"]') as HTMLElement;
    expect(stone.getAttribute("data-stone")).toBe("4");
  });
});
