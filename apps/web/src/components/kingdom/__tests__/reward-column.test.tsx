import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RewardColumn } from "../reward-column";
import { REWARD_COPY } from "@/lib/content/editorial";

describe("RewardColumn", () => {
  it("renders a claimable tile with full-opacity gold gradient and a pulsing notif badge", () => {
    render(
      <RewardColumn
        tiles={[{ id: "rook", state: "claimable" }]}
      />,
    );
    const tile = screen.getByRole("button", {
      name: REWARD_COPY.rook.ariaLabel("claimable"),
    });
    expect(tile.className).toMatch(/reward-tile\b/);
    expect(tile.className).toMatch(/is-claimable\b/);
    const badge = within(tile).getByTestId("reward-tile-notif");
    expect(badge).toBeInTheDocument();
    expect(tile.textContent).toContain(REWARD_COPY.rook.label);
  });

  it("renders a locked tile with the locked modifier and a lock icon", () => {
    const { container } = render(
      <RewardColumn
        tiles={[{ id: "queen", state: "locked" }]}
      />,
    );
    const tile = screen.getByRole("button", {
      name: REWARD_COPY.queen.ariaLabel("locked"),
    });
    expect(tile.className).toMatch(/is-locked\b/);
    const lockSources = container.querySelectorAll(
      "source[srcset='/art/redesign/icons/lock.avif']",
    );
    expect(lockSources.length).toBeGreaterThan(0);
    expect(within(tile).queryByTestId("reward-tile-notif")).toBeNull();
  });

  it("renders a progress tile without a notif badge or lock icon", () => {
    const { container } = render(
      <RewardColumn
        tiles={[{ id: "bishop", state: "progress" }]}
      />,
    );
    const tile = screen.getByRole("button", {
      name: REWARD_COPY.bishop.ariaLabel("progress"),
    });
    expect(tile.className).toMatch(/is-progress\b/);
    expect(within(tile).queryByTestId("reward-tile-notif")).toBeNull();
    const lockSources = container.querySelectorAll(
      "source[srcset='/art/redesign/icons/lock.avif']",
    );
    expect(lockSources.length).toBe(0);
  });

  it("renders only the first 3 tiles plus an overflow indicator when given more than 3", () => {
    render(
      <RewardColumn
        tiles={[
          { id: "rook", state: "claimable" },
          { id: "bishop", state: "progress" },
          { id: "queen", state: "locked" },
          { id: "knight", state: "locked" },
          { id: "king", state: "locked" },
        ]}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(screen.getByTestId("reward-column-overflow")).toBeInTheDocument();
  });

  it("does not render the overflow indicator when given 3 or fewer tiles", () => {
    render(
      <RewardColumn
        tiles={[
          { id: "rook", state: "claimable" },
          { id: "bishop", state: "progress" },
          { id: "queen", state: "locked" },
        ]}
      />,
    );
    expect(screen.queryByTestId("reward-column-overflow")).toBeNull();
  });

  it("returns null when given an empty tiles array", () => {
    const { container } = render(<RewardColumn tiles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("fires onTap when a claimable tile is clicked", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardColumn
        tiles={[{ id: "rook", state: "claimable", onTap }]}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: REWARD_COPY.rook.ariaLabel("claimable"),
      }),
    );
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("fires onTap when a locked tile is clicked (parent decides the unlock-hint sheet)", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(
      <RewardColumn
        tiles={[{ id: "queen", state: "locked", onTap }]}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: REWARD_COPY.queen.ariaLabel("locked"),
      }),
    );
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("uses the editorial.ts REWARD_COPY[id].ariaLabel(state) for each tile aria-label", () => {
    render(
      <RewardColumn
        tiles={[
          { id: "victory", state: "claimable" },
          { id: "pawn", state: "progress" },
          { id: "king", state: "locked" },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: REWARD_COPY.victory.ariaLabel("claimable"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: REWARD_COPY.pawn.ariaLabel("progress"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: REWARD_COPY.king.ariaLabel("locked"),
      }),
    ).toBeInTheDocument();
  });

  it("merges a custom className alongside the base classes on the column wrapper", () => {
    const { container } = render(
      <RewardColumn
        tiles={[{ id: "rook", state: "claimable" }]}
        className="custom-extra-class"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/reward-column\b/);
    expect(wrapper.className).toMatch(/custom-extra-class/);
  });
});
