/**
 * MiniArenaSheet defer contract (JS cluster P3, 2026-06-12).
 *
 * The sheet's subtree drags chess.js + js-chess-engine (~29KB gz) into
 * /hub's first load when imported statically. Contract: the sheet module
 * must NOT mount until the player first taps the Mate tile — afterwards
 * it stays mounted so Radix close animations keep working.
 */
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { fireEvent, screen } from "@testing-library/react";

vi.mock("@/lib/haptics", () => ({ hapticTap: () => {} }));

const sheetMounted = vi.fn();
vi.mock("@/components/mini-arena/mini-arena-sheet", () => ({
  MiniArenaSheet: ({ open }: { open: boolean }) => {
    sheetMounted(open);
    return open ? <div data-testid="mini-arena-sheet" /> : null;
  },
}));

import { HubArenaTile } from "../hub-arena-tile";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";

describe("HubArenaTile sheet defer", () => {
  it("does not mount MiniArenaSheet before the first tap", () => {
    render(<HubArenaTile setup={MINI_ARENA_SETUPS[0]} unlocked />);

    expect(screen.getByTestId("mini-arena-trigger")).toBeInTheDocument();
    expect(sheetMounted).not.toHaveBeenCalled();
  });

  it("mounts and opens the sheet on first tap", async () => {
    render(<HubArenaTile setup={MINI_ARENA_SETUPS[0]} unlocked />);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByTestId("mini-arena-sheet")).toBeInTheDocument();
    expect(sheetMounted).toHaveBeenCalledWith(true);
  });
});
