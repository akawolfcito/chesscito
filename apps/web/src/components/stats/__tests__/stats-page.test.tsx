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
  activityTrend30d: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    sessions: i % 5,
    mints: i % 3,
  })),
  generatedAt: new Date().toISOString(),
};

describe("StatsPage", () => {
  it("renders the public dashboard header (title + intro + framing block)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(
      screen.getByText("Chesscito Platform Stats"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Public activity metrics for Chesscito as a mini app/,
      ),
    ).toBeInTheDocument();
    // Platform-vs-player framing block sits under the intro so the
    // reader cannot mistake the page for a personal profile.
    expect(
      screen.getByText(
        /These numbers describe platform-level activity, not a single player profile/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the three platform-level primary headline metrics", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    expect(screen.getByText("Victory NFTs Minted")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();

    expect(screen.getByText("Approx. App Sessions (7d)")).toBeInTheDocument();
    expect(screen.getByText("410")).toBeInTheDocument();

    expect(screen.getByText("Victory Mints (30d)")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("renders Welcome Packs Claimed as a secondary metric (not in hero)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Label is still present, just no longer in the platform-level hero row.
    expect(screen.getByText("Welcome Packs Claimed")).toBeInTheDocument();
    expect(screen.getByText("880")).toBeInTheDocument();
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

  it("renders the methodology caveat block with the platform framing copy", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Methodology")).toBeInTheDocument();
    // Term-level definitions kept here so a reader can decode the
    // metric labels above; the "not yet" enumeration moved into the
    // "Tracked today / Coming next" section.
    expect(
      screen.getByText(/Active sessions are anonymous app sessions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Leaderboard entries are based on game scores and may include players who have not minted a Victory NFT/,
      ),
    ).toBeInTheDocument();
  });

  it("does NOT render the legacy 'What this shows' bullets (absorbed into Hero subtitle)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // The orientation bullets used to live in their own block before
    // the visual-momentum refactor; their job is now done by the
    // Hero subtitle, which already names sessions/victories/onboarding/
    // community. The bullets must NOT render as a separate section.
    expect(screen.queryByText("What this shows")).toBeNull();
    expect(
      screen.queryByText("Recent app activity from anonymous sessions."),
    ).toBeNull();
    expect(
      screen.queryByText("On-chain saved victories from Chesscito records."),
    ).toBeNull();
    expect(
      screen.queryByText("Community activity from mints and scoreboards."),
    ).toBeNull();
  });

  it("renders Platform signals derived from the current snapshot", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Platform signals")).toBeInTheDocument();
    // SAMPLE_STATS: victories30d=250, totalVictories=1234, victories7d=56,
    // diff easy=500 medium=600 hard=134 → Medium is the max band.
    expect(
      screen.getByText(
        "250 of 1234 Victory mints happened in the last 30 days.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("56 Victory mints happened in the last 7 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Most minted victories are Medium difficulty, showing steady mid-skill engagement.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the Platform signals fallback paragraph when no insight is computable", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);
    // The visual-momentum refactor places Platform signals between
    // the two chart sections and Activity windows. Hiding it entirely
    // breaks the scroll rhythm, so the section now keeps its header
    // and shows a single defensive line instead.
    expect(screen.getByText("Platform signals")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Platform signals will appear here as activity accumulates/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the Activity trend section with both series labeled", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(
      screen.getByText("Activity trend, last 30 days"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Approx\. app sessions and Victory mints over the last 30 days\./,
      ),
    ).toBeInTheDocument();
    // "Approx. app sessions" is unique to the trend panel label.
    expect(screen.getByText("Approx. app sessions")).toBeInTheDocument();
    // "Victory mints" appears in the trend panel label AND in the
    // Tracked today bullet — getAllByText keeps both meanings legal.
    expect(screen.getAllByText("Victory mints").length).toBeGreaterThanOrEqual(2);
    // Totals from SAMPLE_STATS: sessions = sum(i%5 for i in 0..29) = 60,
    // mints = sum(i%3 for i in 0..29) = 30.
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("hides the Activity trend section entirely when the trend is empty", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);
    expect(screen.queryByText("Activity trend, last 30 days")).toBeNull();
  });

  it("renders the Victory difficulty mix chart with a band-aware caption", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Victory difficulty mix")).toBeInTheDocument();
    // SAMPLE_STATS difficulty: easy=500, medium=600, hard=134 →
    // medium is the max band, so caption is the mid-skill variant.
    expect(
      screen.getByText("Most current mints are mid-skill activity."),
    ).toBeInTheDocument();
  });

  it("renders the Victory difficulty mix as a single stacked bar with a complete aria-label", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // SAMPLE_STATS: easy=500, medium=600, hard=134, total=1234.
    // Percentages: 500/1234≈40.5→41, 600/1234≈48.6→49, 134/1234≈10.9→11.
    const bar = screen.getByRole("img", { name: /Difficulty mix:/i });
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute("aria-label")).toBe(
      "Difficulty mix: Easy 41%, Medium 49%, Hard 11%",
    );
  });

  it("renders the Victory difficulty mix legend with percent per band", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // Legend row sits below the stacked bar — one chip per band.
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("49%")).toBeInTheDocument();
    expect(screen.getByText("11%")).toBeInTheDocument();
  });

  it("hides Victory difficulty mix when no difficulty data is available", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);
    expect(screen.queryByText("Victory difficulty mix")).toBeNull();
  });

  it("renders 'Tracked today / Coming next' bifurcation", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(
      screen.getByText("Tracked today / Coming next"),
    ).toBeInTheDocument();
    // Tracked today bullets (sample)
    expect(screen.getByText("App sessions")).toBeInTheDocument();
    expect(screen.getByText("Welcome pack claims")).toBeInTheDocument();
    // Coming next bullets (sample)
    expect(screen.getByText("Connected wallets")).toBeInTheDocument();
    expect(screen.getByText("Retention cohorts")).toBeInTheDocument();
    expect(screen.getByText("Purchase conversion")).toBeInTheDocument();
  });

  it("renders sections in visual-momentum order (Snapshot → Trend → Mix → Signals → Windows → Recent → Leaderboard → Tracked → Methodology)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const order = [
      "Victory NFTs Minted",
      "Activity trend, last 30 days",
      "Victory difficulty mix",
      "Platform signals",
      "Activity windows",
      "Recent Victory Mints",
      "Community Leaderboard",
      "Tracked today / Coming next",
      "Methodology",
    ];
    const anchors = order.map((txt) => screen.getByText(txt));
    for (let i = 1; i < anchors.length; i++) {
      const prev = anchors[i - 1];
      const curr = anchors[i];
      // compareDocumentPosition returns DOCUMENT_POSITION_FOLLOWING
      // when curr appears after prev in the document.
      const followsPrev =
        prev.compareDocumentPosition(curr) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(followsPrev).toBeTruthy();
    }
  });

  it("Executive Snapshot tiles use the hero variant (text-3xl number)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // 1,234 is unique to the Victory NFTs Minted hero tile.
    const valueEl = screen.getByText("1,234");
    expect(valueEl.className).toContain("text-3xl");
    expect(valueEl.className).toContain("md:text-4xl");
  });

  it("Recent Victory Mints heading uses the demoted appendix style (uppercase small caps, not bold lg)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const heading = screen.getByText("Recent Victory Mints");
    expect(heading.className).toContain("uppercase");
    expect(heading.className).not.toContain("font-bold");
  });

  it("Community Leaderboard heading uses the demoted appendix style", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const heading = screen.getByText("Community Leaderboard");
    expect(heading.className).toContain("uppercase");
    expect(heading.className).not.toContain("font-bold");
  });

  it("does NOT render the standalone 'Victories by difficulty' 3-card grid (absorbed into stacked bar)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.queryByText("Victories by difficulty")).toBeNull();
  });

  it("renders the External verification footer with Talent Protocol and Celoscan outbound links", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("External verification")).toBeInTheDocument();

    const talentLink = screen.getByRole("link", {
      name: /Talent Protocol/i,
    });
    expect(talentLink).toHaveAttribute(
      "href",
      "https://talent.app/~/projects/e850a453-2b0c-4080-a070-781d712791a7",
    );
    expect(talentLink).toHaveAttribute("target", "_blank");
    expect(talentLink.getAttribute("rel") ?? "").toContain("noopener");
    expect(talentLink.getAttribute("rel") ?? "").toContain("noreferrer");

    const celoscanLink = screen.getByRole("link", {
      name: /Badges contract on Celoscan/i,
    });
    expect(celoscanLink).toHaveAttribute(
      "href",
      "https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739",
    );
    expect(celoscanLink).toHaveAttribute("target", "_blank");
    expect(celoscanLink.getAttribute("rel") ?? "").toContain("noopener");
    expect(celoscanLink.getAttribute("rel") ?? "").toContain("noreferrer");
  });

  it("External verification block sits after Methodology in DOM order", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const methodology = screen.getByText("Methodology");
    const externalVerification = screen.getByText("External verification");
    const followsMethodology =
      methodology.compareDocumentPosition(externalVerification) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(followsMethodology).toBeTruthy();
  });

  it("disambiguates the cards whose source differs from Victories table", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Unique Minter Wallets card label uses the platform-level phrasing;
    // the sublabel restates the source explicitly so a reader does not
    // assume it tracks the broader leaderboard population.
    expect(
      screen.getByText("Wallets with Victory Mints"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Distinct wallets that minted a Victory"),
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
