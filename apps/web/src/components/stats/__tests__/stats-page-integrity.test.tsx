import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { StatsPage } from "../stats-page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import type { PublicStats } from "@/lib/stats/public-aggregator";

/**
 * How the page speaks about what it could NOT measure.
 *
 * The failure this locks down is not a wrong number — it is a number that looks
 * right. A capped read produced "Approx. App Sessions (7d) 46" and "Inactive
 * 962" with no visual difference from an exact count, because the warning
 * compared against a row count the server can never return and therefore never
 * fired. Audit: `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §9.
 */

const tokens = {
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
    red: "Red",
    purple: "Purple",
    silver: "Silver",
  },
} as unknown as Parameters<typeof StatsPage>[0]["nicknameTokens"];

function renderPage(overrides: Partial<PublicStats> = {}) {
  return render(
    <StatsPage
      stats={{ ...EMPTY_PUBLIC_STATS, ...overrides }}
      census={EMPTY_PLAYERS_CENSUS}
      nicknameTokens={tokens}
    />,
  );
}

describe("the integrity notice", () => {
  it("stays silent when every read came back whole", () => {
    renderPage({ dataIntegrity: { truncated: [], rowCeiling: 1_000 } });

    expect(screen.queryByTestId("integrity-notice")).not.toBeInTheDocument();
  });

  it("names the REAL ceiling, 1,000", () => {
    renderPage({
      dataIntegrity: { truncated: ["app sessions (7d)"], rowCeiling: 1_000 },
    });

    // It used to print 10,000 — a number no response can reach, so the copy was
    // describing a limit that did not exist while the real one did the damage.
    expect(screen.getByTestId("integrity-notice")).toHaveTextContent("1,000");
  });

  it("says the affected metrics are unavailable, and explicitly not zero", () => {
    renderPage({
      dataIntegrity: { truncated: ["app sessions (7d)"], rowCeiling: 1_000 },
    });

    const notice = screen.getByTestId("integrity-notice");
    expect(notice).toHaveTextContent(/temporarily unavailable/i);
    expect(notice).toHaveTextContent(/they are not zero/i);
    // The old copy said "lower bounds, not exact counts". A lower bound is a
    // number you can still reason with; these are not numbers at all.
    expect(notice).not.toHaveTextContent(/lower bounds/i);
  });

  it("names which reads were affected", () => {
    renderPage({
      dataIntegrity: {
        truncated: ["app sessions (7d)", "retention cohorts (30d)"],
        rowCeiling: 1_000,
      },
    });

    const notice = screen.getByTestId("integrity-notice");
    expect(notice).toHaveTextContent("app sessions (7d)");
    expect(notice).toHaveTextContent("retention cohorts (30d)");
  });
});

describe("null renders as an em-dash, never as a zero", () => {
  it("shows — for an unmeasured session count", () => {
    renderPage({ activeSessions7d: null, activeSessions30d: null });

    const card = screen
      .getByText("Approx. App Sessions (7d)")
      .closest("div") as HTMLElement;
    expect(within(card).getByText("—")).toBeInTheDocument();
    expect(within(card).queryByText("0")).not.toBeInTheDocument();
  });

  it("shows — for the three lifecycle buckets when the partition is unmeasured", () => {
    renderPage({
      accountLifecycle: {
        known: 3_077,
        newToday: 1_578,
        new7d: 3_058,
        active7d: null,
        dormant: null,
        inactive: null,
        resurrected7d: null,
      },
    });

    for (const label of ["Active (7d)", "Dormant", "Inactive"]) {
      const card = screen.getByText(label).closest("div") as HTMLElement;
      expect(within(card).getByText("—")).toBeInTheDocument();
    }
  });

  it("still prints the three EXACT head counts beside the em-dashes", () => {
    renderPage({
      accountLifecycle: {
        known: 3_077,
        newToday: 1_578,
        new7d: 3_058,
        active7d: null,
        dormant: null,
        inactive: null,
        resurrected7d: null,
      },
    });

    // These come from `count: "exact"` and are immune to the ceiling, so they
    // keep their numbers while the partition above them goes dark.
    expect(screen.getByText(/3,077 accounts ever seen/)).toBeInTheDocument();
    expect(screen.getByText(/1,578 arrived/)).toBeInTheDocument();
    expect(screen.getByText(/3,058 in the last 7 days/)).toBeInTheDocument();
  });

  it("says the window is the last 7 days, not 'this week'", () => {
    renderPage({
      accountLifecycle: {
        known: 3,
        newToday: 1,
        new7d: 2,
        active7d: 1,
        dormant: 1,
        inactive: 1,
        resurrected7d: 0,
      },
    });

    // A rolling 7-day window is not the UTC week the rest of the product uses.
    // Two "weeks" in one product is a defect even when both are computed right.
    // Scoped to the lifecycle caption: the on-chain block legitimately says
    // "7d ≈ this week" about a different metric family.
    const caption = screen.getByText(/accounts ever seen/);
    expect(caption).toHaveTextContent(/in the last 7 days/);
    expect(caption).not.toHaveTextContent(/this week/i);
  });
});

describe("the snapshot stamp", () => {
  it("states when the snapshot was taken instead of promising a cadence", () => {
    renderPage({ generatedAt: "2026-08-04T18:07:00.000Z" });

    const stamp = screen.getByTestId("snapshot-stamp");
    expect(stamp).toHaveTextContent("2026-08-04 18:07 UTC");
    // "Updated hourly" was measurably false: `revalidate` is a floor, and one
    // surface served a 5h22m-old snapshot under that exact line.
    expect(stamp).not.toHaveTextContent(/hourly/i);
  });
});

describe("the on-chain block is untouched by any of this", () => {
  it("keeps printing its exact counts", () => {
    renderPage({
      onchain: {
        ...EMPTY_PUBLIC_STATS.onchain,
        methodTx: {
          ...EMPTY_PUBLIC_STATS.onchain.methodTx,
          victoryMints: { lifetime: 249, last30d: 172, last7d: 148 },
        },
        uniqueOnchainUsersLifetime: 156,
      },
      dataIntegrity: { truncated: ["app sessions (7d)"], rowCeiling: 1_000 },
    });

    // Every source behind this block is a `count: "exact"` or a sub-1,000 scan,
    // so a capped analytics read must not dim it. It is also the MiniPay §8
    // deliverable — the part of the page that must never regress.
    expect(screen.getByText("249")).toBeInTheDocument();
    expect(screen.getByText("172")).toBeInTheDocument();
    expect(screen.getByText("156")).toBeInTheDocument();
  });
});
