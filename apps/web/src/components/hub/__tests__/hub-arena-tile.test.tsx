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
import {
  getMilestoneStore,
  markOpened,
  recordEarned,
  selectPending,
} from "@/lib/progression/milestone-storage";
import { milestoneKey } from "@/lib/progression/types";
import { MINI_ARENA_SETUPS } from "@/lib/game/mini-arena";

const SPECIAL_TRAINING_KEY = milestoneKey("special-training");

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

  it("does not flash a stale NEW dot for a veteran whose migration seed lands after mount", () => {
    // Mount BEFORE the store has anything — matches the real tile, which
    // sits unconditionally in HubScaffold while `unlocked` is still false.
    const { rerender } = render(<HubArenaTile setup={setup} unlocked={false} />);

    // Simulate the migration effect (seedExistingPlayer, wired in a later
    // task) landing AFTER mount and seeding "special-training" WITH
    // `openedAt` already set — exactly what a veteran player, long past
    // 12 rook stars, gets so they never see a retroactive NEW dot.
    recordEarned([{ id: "special-training" }]);
    markOpened("special-training");

    // Only now does `unlocked` flip true (rook stars arrive via a
    // post-hydration effect too) — the render where a mount-time snapshot
    // would already be frozen stale.
    rerender(<HubArenaTile setup={setup} unlocked />);

    expect(screen.queryByTestId("hub-tile-new")).not.toBeInTheDocument();
  });

  it("persists openedAt to the store on tap, even when the milestone was never recorded", () => {
    const { getByRole } = render(<HubArenaTile setup={setup} unlocked />);

    fireEvent.click(getByRole("button"));

    const event = getMilestoneStore().events[SPECIAL_TRAINING_KEY];
    expect(event?.openedAt).toBeDefined();
  });

  /**
   * The tap IS the recognition. `recordEarned` writes `earnedAt` and NO
   * `celebratedAt`, so without the `markCelebrated` in the same gesture the
   * event stays PENDING and the celebration queue pops "Special Training
   * Unlocked" on the player's next solve — for content they just opened.
   */
  it("stamps the milestone celebrated on tap, so it can never be left pending", () => {
    const { getByRole } = render(<HubArenaTile setup={setup} unlocked />);

    fireEvent.click(getByRole("button"));

    const store = getMilestoneStore();
    expect(store.events[SPECIAL_TRAINING_KEY]?.celebratedAt).toBeDefined();
    // The queue is built from `selectPending` — this is the assertion that
    // actually says "no overlay will fire for this".
    expect(selectPending(store).map((event) => event.id)).not.toContain(
      "special-training",
    );
  });

  it("leaves an already-celebrated milestone alone — the tap is idempotent", () => {
    // A player who saw the overlay first and taps the tile afterwards: the
    // recognition already happened and must not be re-dated.
    recordEarned([{ id: "special-training" }]);
    const { getByRole, unmount } = render(<HubArenaTile setup={setup} unlocked />);
    fireEvent.click(getByRole("button"));
    const first = getMilestoneStore().events[SPECIAL_TRAINING_KEY]?.celebratedAt;
    unmount();

    render(<HubArenaTile setup={setup} unlocked />);
    fireEvent.click(screen.getByRole("button"));

    expect(getMilestoneStore().events[SPECIAL_TRAINING_KEY]?.celebratedAt).toBe(
      first,
    );
  });

  it("stays opened after reload once tapped from an empty store", () => {
    const { unmount, getByRole } = render(<HubArenaTile setup={setup} unlocked />);
    fireEvent.click(getByRole("button"));
    unmount();

    render(<HubArenaTile setup={setup} unlocked />);

    expect(screen.queryByTestId("hub-tile-new")).not.toBeInTheDocument();
  });
});
