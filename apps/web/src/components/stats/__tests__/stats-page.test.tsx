import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { StatsPage } from "../stats-page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import type { PublicStats } from "@/lib/stats/public-aggregator";

afterEach(() => {
  cleanup();
});

const SAMPLE_STATS: PublicStats = {
  totalVictories: 1234,
  victories7d: 56,
  victories30d: 250,
  uniqueMintersLifetime: 312,
  victoriesByDifficulty: { easy: 500, medium: 600, hard: 134 },
  welcomePacksLifetime: 880,
  welcomePacks7d: 22,
  activeSessions7d: 410,
  activeSessions30d: 1402,
  coachAnalysesLifetime: 77,
  coachAnalyses7d: 9,
  hallOfFame: [
    {
      token_id: 42,
      player: "0xabcdef0000000000000000000000000000001234",
      difficulty: 3,
      total_moves: 45,
      time_ms: 90_000,
      tx_hash: "0xtxhash-hof-1",
      minted_at: new Date(Date.now() - 60 * 1000).toISOString(),
    },
    {
      token_id: 41,
      player: "0x0000abcdef000000000000000000000000005678",
      difficulty: 1,
      total_moves: 22,
      time_ms: 30_000,
      tx_hash: "0xtxhash-hof-2",
      minted_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ],
  leaderboardTop10: [
    { rank: 1, player: "0xabc1230000000000000000000000000000009999", total_score: 9999, is_verified: true },
    { rank: 2, player: "0xdef4560000000000000000000000000000008888", total_score: 8888, is_verified: false },
  ],
  generatedAt: new Date().toISOString(),
};

describe("StatsPage", () => {
  it("renders the three platform-level primary headline metrics", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    expect(screen.getByText("Total Victories Minted")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();

    expect(screen.getByText("Approx. Active Sessions (7d)")).toBeInTheDocument();
    expect(screen.getByText("410")).toBeInTheDocument();

    expect(screen.getByText("Victories (30d)")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("renders Welcome Packs Claimed as a secondary metric (not in hero)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Label is still present, just no longer in the platform-level hero row.
    expect(screen.getByText("Welcome Packs Claimed")).toBeInTheDocument();
    expect(screen.getByText("880")).toBeInTheDocument();
  });

  it("renders the difficulty breakdown with mapped labels", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // Easy/Medium/Hard appear in both the difficulty cards AND the
    // Hall of Fame badges, so use getAllByText.
    expect(screen.getAllByText("Easy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Medium").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Hard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
    expect(screen.getByText("134")).toBeInTheDocument();
  });

  it("renders Hall of Fame entries with truncated wallet + difficulty + relative time", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    expect(screen.getByText("0xabcd…1234")).toBeInTheDocument();
    expect(screen.getByText("0x0000…5678")).toBeInTheDocument();
    // Hall of Fame badges: Easy + Hard appear once in cards, once per
    // matching row — total ≥ 2 for Hard (1 card + 1 row), ≥ 2 for Easy.
    expect(screen.getAllByText("Hard").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Easy").length).toBeGreaterThanOrEqual(2);
  });

  it("renders Leaderboard top entries with rank, wallet, score", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("9,999")).toBeInTheDocument();
    expect(screen.getByText("8,888")).toBeInTheDocument();
  });

  it("renders em-dash placeholders for null fields without crashing", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);

    // All primary cards should show "—" placeholder
    const placeholders = screen.getAllByText("—");
    expect(placeholders.length).toBeGreaterThanOrEqual(3);

    // Empty lists show "no data" copy, not crashes
    expect(screen.getByText("No mints yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Leaderboard is currently unavailable."),
    ).toBeInTheDocument();
  });

  it("renders the methodology caveat block", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Methodology")).toBeInTheDocument();
    expect(
      screen.getByText(/Active sessions counted by anonymous client-side IDs/),
    ).toBeInTheDocument();
  });

  it("disambiguates the cards whose source differs from Victories table", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Unique Minter Wallets reads `victories.player` distinct — calling
    // it out prevents the reader from assuming it tracks the broader
    // leaderboard player population.
    expect(
      screen.getByText("Wallets with Victory mints"),
    ).toBeInTheDocument();

    // Welcome Packs ledger started post-launch — sublabel signals the
    // zero/low value is a recency artifact, not absence of users.
    expect(
      screen.getByText("Claims tracked after launch"),
    ).toBeInTheDocument();

    // Leaderboard reads `leaderboard_v` (derived from `scores`), NOT
    // `victories`. The microcopy stops the reader from cross-counting
    // the rank list against the Unique Minter Wallets card.
    expect(
      screen.getByText(
        "Based on game scores, not only minted victories.",
      ),
    ).toBeInTheDocument();
  });
});
