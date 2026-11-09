/**
 * Where the census sits, and what it must not disturb.
 *
 * The founder's call was that the census is ADDED, not swapped in: the podium
 * that already works keeps working, and the new block follows it immediately.
 * Two lists on one screen only coexist if they read as different questions —
 * who is winning, and how many there are — so both headings have to survive
 * and the order between them has to be fixed, not incidental.
 *
 * Spec: docs/specs/2026-07-30-stats-full-players-table.md §5.0, §7 stage 6
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { StatsPage } from "../stats-page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import type { PlayersCensus } from "@/lib/stats/players-census";
import { IDENTITY_COPY } from "@/lib/content/editorial";
import type { NicknameTokens } from "@/lib/identity/identity-lite";

afterEach(cleanup);

const TOKENS = IDENTITY_COPY as unknown as NicknameTokens;

function censusWith(rowCount: number, over: Partial<PlayersCensus> = {}): PlayersCensus {
  return {
    rows: Array.from({ length: rowCount }, (_, i) => ({
      rank: i + 1,
      rowId: `id_${i}`,
      variant: { piece: "rook", style: "blue", number: i } as never,
      totalScore: 1000 - i,
      isVerified: false,
      hasOnchain: false,
    })),
    total: rowCount,
    rowsRead: "ok",
    asOf: "2026-07-30T10:30:00.000Z",
    ...over,
  };
}

const STATS_WITH_PODIUM = {
  ...EMPTY_PUBLIC_STATS,
  leaderboardTop10: [
    {
      rank: 1,
      rowId: "id_podium",
      variant: { piece: "queen", style: "golden", number: 7 } as never,
      totalScore: 9999,
      isVerified: false,
      hasOnchain: true,
    },
  ],
};

function renderPage(census: PlayersCensus, stats = STATS_WITH_PODIUM) {
  return render(
    <StatsPage stats={stats} census={census} nicknameTokens={TOKENS} />,
  );
}

/** Document order of two nodes, as the reader would meet them. */
function comesBefore(a: Element, b: Element): boolean {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("placement", () => {
  it("keeps the podium and adds the census after it", () => {
    renderPage(censusWith(3));

    const podium = screen.getByText(/community leaderboard/i);
    const table = screen.getByText(/not affected by the filters/i);

    expect(podium).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(comesBefore(podium, table)).toBe(true);
  });

  it("does not move the global data-integrity notice to suit the table", () => {
    // That notice sits above every number on purpose, because it describes
    // reads across the whole page. The table declares its own truncation in
    // its own header instead of borrowing this one.
    renderPage(censusWith(3), {
      ...STATS_WITH_PODIUM,
      dataIntegrity: { truncated: ["victories"], rowCeiling: 1_000 },
    });

    const notice = screen.getByTestId("integrity-notice");
    const podium = screen.getByText(/community leaderboard/i);

    expect(comesBefore(notice, podium)).toBe(true);
  });
});

describe("the podium is untouched", () => {
  it("still renders its own rows and its caveat", () => {
    renderPage(censusWith(3));

    expect(
      screen.getByText(/based on game scores, not only saved progress/i),
    ).toBeInTheDocument();
  });

  it("survives a census that failed entirely", () => {
    // Sibling degradation: the census going dark must not take the rest of the
    // page with it.
    renderPage(EMPTY_PLAYERS_CENSUS);

    expect(screen.getByText(/community leaderboard/i)).toBeInTheDocument();
    // The census block no longer vanishes on a failed read — it says it is
    // down and since when. Silently disappearing is how a dark census went
    // unnoticed in production for 18h34m, across a deploy.
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByTestId("census-last-attempt")).toBeInTheDocument();
    // What it must NOT do is claim a ranking it does not have.
    expect(screen.queryByTestId("census-total")).not.toBeInTheDocument();
  });
});

describe("the census block's own visibility", () => {
  it("renders a genuinely empty board rather than hiding", () => {
    // Zero ranked players is a fact worth stating. Only an unavailable read
    // hides the block.
    renderPage(censusWith(0, { total: 0, rowsRead: "ok" }));

    expect(screen.getByText(/no ranked players yet/i)).toBeInTheDocument();
  });

  it("keeps the population visible when only the rows read failed", () => {
    renderPage(censusWith(0, { total: 17, rowsRead: "unavailable" }));

    expect(screen.getByTestId("census-total")).toHaveTextContent("17");
  });
});
