/**
 * The census table's local header, and the states of the block as a whole.
 *
 * Everything asserted here is an adjacency rule. The page already carries a
 * global "Updated hourly · As of …" and a global truncation notice, both at the
 * very top; this table sits eight sections below them. A caveat the reader
 * cannot see while looking at the number it qualifies is not a caveat.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §4.1, §4.2, §4.4,
 *       §5.1, §5.2, §7 stage 5
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PlayersTable } from "../players-table";
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

function renderTable(c: PlayersCensus) {
  return render(<PlayersTable census={c} nicknameTokens={tokens} />);
}

describe("the header declares what the filters do not", () => {
  it("says the table ignores the page filters", () => {
    // It is the only block on the page that does not react to surface /
    // container. Undeclared, that reads as a broken render.
    renderTable(census(17));

    expect(screen.getByText(/not affected by the filters/i)).toBeInTheDocument();
  });

  it("prints the population next to the rows it is describing", () => {
    renderTable(census(17));

    // Targeted at the total's own node: a loose /17/ over the whole block
    // would also match a rank or a score once the fixture changes.
    expect(screen.getByTestId("census-total")).toHaveTextContent("17");
  });
});

describe("the timestamp belongs to THIS snapshot", () => {
  it("shows the census asOf, not a page-level time", () => {
    renderTable(census(17, { asOf: "2026-07-30T10:30:00.000Z" }));

    // The census caches on its own entry, so its age is its own. Rendering the
    // page's generatedAt here would be a correct time on the wrong data.
    expect(screen.getByTestId("census-as-of")).toBeInTheDocument();
  });

  it("shows NO time when the rows read failed", () => {
    // "Census as of 10:30" over a failed read claims a census happened at
    // 10:30. None did.
    renderTable(census(0, { rowsRead: "unavailable", total: 17 }));

    expect(screen.queryByTestId("census-as-of")).not.toBeInTheDocument();
  });
});

describe("the four internal outcomes", () => {
  it("rows and count both fine → rows and total", () => {
    renderTable(census(3));

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByTestId("census-total")).toHaveTextContent("3");
  });

  it("rows fine, count down → the table stays, the number goes", () => {
    renderTable(census(3, { total: null }));

    // Losing the table because a label failed would drop exactly what the
    // reader came for.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByTestId("census-total")).not.toBeInTheDocument();
  });

  it("rows fine, count down → never substitutes the row count", () => {
    // rows.length is the defect this replaces: it once announced "10 players"
    // to a player ranked 13th. On a truncated read it would be flatly wrong.
    renderTable(census(3, { total: null }));

    expect(screen.queryByTestId("census-total")).not.toBeInTheDocument();
  });

  it("genuinely empty board → an explicit message, not an error", () => {
    renderTable(census(0, { total: 0, rowsRead: "ok" }));

    expect(screen.getByText(/no ranked players yet/i)).toBeInTheDocument();
  });

  it("rows down but count alive → the total survives, no empty list", () => {
    renderTable(census(0, { total: 17, rowsRead: "unavailable" }));

    // An empty <ol> here would assert there are no players over a board of 17.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByTestId("census-total")).toHaveTextContent("17");
  });

  it("rows down and count down → the block renders nothing at all", () => {
    const { container } = renderTable(
      census(0, { total: null, rowsRead: "unavailable" }),
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("truncation is declared where the reader is", () => {
  it("says so when the population exceeds the rows shipped", () => {
    // 500 rows carried under a population of 900: without this line the table
    // silently claims to be the census it is not.
    renderTable(census(500, { total: 900 }));

    expect(screen.getByText(/first 500/i)).toBeInTheDocument();
  });

  it("stays quiet when every ranked player is on the page", () => {
    renderTable(census(17, { total: 17 }));

    expect(screen.queryByText(/first 500/i)).not.toBeInTheDocument();
  });

  it("stays quiet when the count is unavailable", () => {
    // With no population figure there is nothing to compare the row count to,
    // and guessing at truncation would be inventing a caveat.
    renderTable(census(500, { total: null }));

    expect(screen.queryByText(/first 500/i)).not.toBeInTheDocument();
  });
});
