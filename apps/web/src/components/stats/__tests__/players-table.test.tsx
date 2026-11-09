/**
 * The census table's list and paginator.
 *
 * The component is a RENDERER. Order, identity and rank all arrive resolved
 * from the server, and re-deriving any of them here would create a second
 * source of truth that can disagree with the rank column sitting next to it.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §5.1, §5.3, §7 stage 4
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PLAYERS_PAGE_SIZE, PlayersTable } from "../players-table";
import type { PlayersCensus } from "@/lib/stats/players-census";
import type { AvatarVariant, NicknameTokens } from "@/lib/identity/identity-lite";

const tokens: NicknameTokens = {
  template: "{style} {piece} {number}",
  guestPrefix: "Guest",
  pieces: {
    pawn: "Pawn",
    knight: "Knight",
    rook: "Rook",
    bishop: "Bishop",
    queen: "Queen",
    king: "King",
  },
  styles: {
    golden: "Golden",
    green: "Green",
    blue: "Blue",
    coral: "Coral",
    tropical: "Tropical",
    bright: "Bright",
  },
};

const variant = (number: number): AvatarVariant => ({
  piece: "rook",
  style: "blue",
  number,
});

function census(rowCount: number, overrides: Partial<PlayersCensus> = {}): PlayersCensus {
  return {
    rows: Array.from({ length: rowCount }, (_, i) => ({
      rank: i + 1,
      rowId: `id_${i}`,
      variant: variant(i),
      totalScore: 1000 - i,
      isVerified: false,
      hasOnchain: false,
    })),
    total: rowCount,
    rowsRead: "ok",
    asOf: "2026-07-30T10:30:00.000Z",
    ...overrides,
  };
}

function rowsOnScreen(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("pagination", () => {
  it("shows a full page and no more", () => {
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    expect(rowsOnScreen()).toHaveLength(PLAYERS_PAGE_SIZE);
  });

  it("paginates from the 11th record, which is today's real state", async () => {
    // 17 ranked players in production: the table ships with the control
    // visible and two pages, not one long list.
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("shows the remainder on the last page, without filler rows", async () => {
    // 17 = 10 + 7. Padding the short page to full height would render seven
    // real players next to three phantoms.
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(rowsOnScreen()).toHaveLength(7);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("goes back", async () => {
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /previous/i }));

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(rowsOnScreen()).toHaveLength(PLAYERS_PAGE_SIZE);
  });

  it("cannot walk past either end", async () => {
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("renders no controls at all when everyone fits on one page", () => {
    render(<PlayersTable census={census(PLAYERS_PAGE_SIZE)} nicknameTokens={tokens} />);

    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/page \d+ of/i)).not.toBeInTheDocument();
  });
});

describe("it renders, it does not re-derive", () => {
  it("keeps the order it was given, even when scores do not descend", () => {
    // Ordering (including its tiebreak) lives in SQL. A sort here could
    // disagree with the rank column beside it.
    const unsorted = census(3);
    unsorted.rows = [
      { ...unsorted.rows[0], rank: 1, totalScore: 10 },
      { ...unsorted.rows[1], rank: 2, totalScore: 900 },
      { ...unsorted.rows[2], rank: 3, totalScore: 40 },
    ];

    render(<PlayersTable census={unsorted} nicknameTokens={tokens} />);

    const ranks = rowsOnScreen().map((li) => li.textContent?.match(/#(\d+)/)?.[1]);
    expect(ranks).toEqual(["1", "2", "3"]);
  });

  it("prints the rank the view gave, not the position on the page", async () => {
    render(<PlayersTable census={census(17)} nicknameTokens={tokens} />);

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    // Page 2 starts at rank 11. A position-derived rank would restart at 1.
    expect(rowsOnScreen()[0].textContent).toContain("#11");
  });

  it("keeps both rows when two players would render with the same name", () => {
    // 360k nickname combinations means collisions are likely at the ceiling.
    // Deduplicating — the way aggregateTopMinters does, by design, for a
    // different job — would delete a player from a census.
    const twins = census(2);
    twins.rows = [
      { ...twins.rows[0], variant: variant(7) },
      { ...twins.rows[1], variant: variant(7) },
    ];

    render(<PlayersTable census={twins} nicknameTokens={tokens} />);

    expect(rowsOnScreen()).toHaveLength(2);
  });
});
