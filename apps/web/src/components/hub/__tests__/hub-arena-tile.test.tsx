/**
 * Special Training NEW dot (progression cluster, Task 12).
 *
 * The tile used to carry a permanently-lit `HubTileStatusChip
 * kind="ready"` — the dot meant "this button exists", not "something
 * new is here". Contract under test: the dot is driven by the
 * milestone machine's `openedAt` and clears the first time the player
 * opens Special Training.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";

import { HubArenaTile } from "../hub-arena-tile";
import { markOpened, recordEarned } from "@/lib/progression/milestone-storage";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";

const setup = MINI_ARENA_SETUPS[0];

beforeEach(() => {
  window.localStorage.clear();
});

describe("HubArenaTile NEW dot", () => {
  it("shows NEW while the unlocked content has never been opened", () => {
    recordEarned([{ id: "special-training" }]);
    render(<HubArenaTile setup={setup} unlocked />);
    expect(screen.getByTestId("hub-tile-new")).toBeInTheDocument();
  });

  it("drops the dot once the player has opened it", () => {
    recordEarned([{ id: "special-training" }]);
    markOpened("special-training");
    render(<HubArenaTile setup={setup} unlocked />);
    expect(screen.queryByTestId("hub-tile-new")).not.toBeInTheDocument();
  });

  it("clears on tap and stays cleared", () => {
    recordEarned([{ id: "special-training" }]);
    render(<HubArenaTile setup={setup} unlocked />);
    expect(screen.getByTestId("hub-tile-new")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByTestId("hub-tile-new")).not.toBeInTheDocument();
  });
});
