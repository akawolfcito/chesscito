import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { StatsPage as StatsPageBase } from "../stats-page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import type { PublicStats } from "@/lib/stats/public-aggregator";
import { IDENTITY_COPY } from "@/lib/content/editorial";
import type { NicknameTokens } from "@/lib/identity/identity-lite";

afterEach(() => {
  cleanup();
});

// EN tokens (the test renders the default-locale bundle). Wrapper injects them
// so the 28 existing call sites stay unchanged.
const TOKENS = IDENTITY_COPY as unknown as NicknameTokens;
function StatsPage({ stats }: { stats: PublicStats }) {
  return <StatsPageBase stats={stats} nicknameTokens={TOKENS} />;
}

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
  topMinters: [
    {
      rowId: "id_m1",
      variant: { piece: "knight", style: "golden", number: 12 },
      mintCount: 1,
      lastMintedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    },
    {
      rowId: "id_m2",
      variant: { piece: "pawn", style: "green", number: 34 },
      mintCount: 1,
      lastMintedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ],
  leaderboardTop10: [
    { rank: 1, rowId: "id_l1", variant: { piece: "queen", style: "blue", number: 99 }, totalScore: 9999, isVerified: true, hasOnchain: false },
    { rank: 2, rowId: "id_l2", variant: { piece: "rook", style: "coral", number: 88 }, totalScore: 8888, isVerified: false, hasOnchain: false },
  ],
  activityTrend30d: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    sessions: i % 5,
    mints: i % 3,
  })),
  generatedAt: new Date().toISOString(),
  // Values chosen distinct from the non-onchain fixture numbers above
  // so single-match getByText assertions stay unambiguous.
  onchain: {
    methodTx: {
      victoryMints: { lifetime: 1201, last30d: 261, last7d: 71 },
      packPurchases: { lifetime: 322, last30d: 82, last7d: 19 },
      scoreSaves: { lifetime: 543, last30d: 123, last7d: 33 },
      welcomePackClaims: { lifetime: 884, last30d: 144, last7d: 24 },
    },
    uniqueOnchainUsersLifetime: 477,
    getPeonesVolume: { usdc: 123.45, usdt: 45.5, cusd: 9.75 },
    networkFeesPaidUsd: null,
    failedTxRate: null,
  },
  challengeFunnel: {
    opens: 42,
    starts: 38,
    completions: 29,
    shares: 14,
    continueToLite: 11,
  },
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

    expect(screen.getByText("Verified Progress Saves")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();

    expect(screen.getByText("Approx. App Sessions (7d)")).toBeInTheDocument();
    expect(screen.getByText("410")).toBeInTheDocument();

    expect(screen.getByText("Progress Saves (30d)")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("renders Welcome Packs Claimed as a secondary metric (not in hero)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Label is still present, just no longer in the platform-level hero row.
    expect(screen.getByText("Welcome Packs Claimed")).toBeInTheDocument();
    expect(screen.getByText("880")).toBeInTheDocument();
  });

  it("renders top minters as avatar + nickname (no raw wallet)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    expect(screen.getByText("Golden Knight #12")).toBeInTheDocument();
    expect(screen.getByText("Green Pawn #34")).toBeInTheDocument();
    // No raw wallet leaks into the rendered DOM.
    expect(document.body.textContent ?? "").not.toMatch(/0x[a-fA-F0-9]{6}/);
    // Section now shows total saves + last-save relative time instead
    // of per-event difficulty badges. Each sample wallet has 1 save.
    expect(screen.getAllByText("1 save").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/last save/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders Leaderboard top entries with rank, wallet, score", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("9,999")).toBeInTheDocument();
    expect(screen.getByText("8,888")).toBeInTheDocument();
  });

  it("renders the §8 on-chain activity section: per-method tx, unique wallets, Get Peones volume", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    // Section heading.
    expect(screen.getByText("On-chain Activity")).toBeInTheDocument();

    // Per-method lifetime counts (distinct fixture values).
    expect(screen.getByText("1,201")).toBeInTheDocument(); // victory mints lifetime
    expect(screen.getByText("322")).toBeInTheDocument(); // get peones lifetime
    expect(screen.getByText("543")).toBeInTheDocument(); // score saves lifetime
    expect(screen.getByText("884")).toBeInTheDocument(); // welcome packs lifetime

    // Unique on-chain wallets.
    expect(screen.getByText("Unique on-chain wallets")).toBeInTheDocument();
    expect(screen.getByText("477")).toBeInTheDocument();

    // Get Peones volume per stablecoin.
    expect(screen.getByText(/Get Peones volume/i)).toBeInTheDocument();
    expect(screen.getByText("123.45")).toBeInTheDocument(); // USDC
    expect(screen.getByText("45.5")).toBeInTheDocument(); // USDT
    expect(screen.getByText("9.75")).toBeInTheDocument(); // cUSD
  });

  it("keeps network fees + failed-tx + retention + countries in the Coming next lane", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const comingNext = screen.getByText("Coming next").closest("div");
    expect(comingNext).not.toBeNull();
    expect(comingNext).toHaveTextContent(/network fees/i);
    expect(comingNext).toHaveTextContent(/failed transaction rate/i);
    expect(comingNext).toHaveTextContent(/retention/i);
    expect(comingNext).toHaveTextContent(/countries/i);
  });

  it("renders an em-dash for a null on-chain metric (failed query)", () => {
    const withNull: PublicStats = {
      ...SAMPLE_STATS,
      onchain: {
        ...SAMPLE_STATS.onchain,
        uniqueOnchainUsersLifetime: null,
      },
    };
    render(<StatsPage stats={withNull} />);
    // The unique-wallets card now renders the em-dash placeholder.
    expect(screen.getByText("Unique on-chain wallets")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders em-dash placeholders for null fields without crashing", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);

    // All primary cards should show "—" placeholder
    const placeholders = screen.getAllByText("—");
    expect(placeholders.length).toBeGreaterThanOrEqual(3);

    // Empty lists show "no data" copy, not crashes
    expect(screen.getByText("No saves yet.")).toBeInTheDocument();
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
        /Leaderboard entries are based on game scores and may include players who have not saved progress on-chain/,
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
        "250 of 1234 progress saves happened in the last 30 days.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("56 progress saves happened in the last 7 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Most progress saves are Medium difficulty, showing steady mid-skill engagement.",
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
        /Approx\. app sessions and progress saves over the last 30 days\./,
      ),
    ).toBeInTheDocument();
    // "Approx. app sessions" is unique to the trend panel label.
    expect(screen.getByText("Approx. app sessions")).toBeInTheDocument();
    // "Progress saves" appears in the trend panel label AND in the
    // Tracked today bullet — getAllByText keeps both meanings legal.
    expect(screen.getAllByText("Progress saves").length).toBeGreaterThanOrEqual(2);
    // Totals from SAMPLE_STATS: sessions = sum(i%5 for i in 0..29) = 60,
    // mints = sum(i%3 for i in 0..29) = 30.
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("hides the Activity trend section entirely when the trend is empty", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);
    expect(screen.queryByText("Activity trend, last 30 days")).toBeNull();
  });

  it("renders the Progress difficulty mix chart with a band-aware caption", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Progress difficulty mix")).toBeInTheDocument();
    // SAMPLE_STATS difficulty: easy=500, medium=600, hard=134 →
    // medium is the max band, so caption is the mid-skill variant.
    expect(
      screen.getByText("Most current saves are mid-skill activity."),
    ).toBeInTheDocument();
  });

  it("renders the Progress difficulty mix as a single stacked bar with a complete aria-label", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // SAMPLE_STATS: easy=500, medium=600, hard=134, total=1234.
    // Percentages: 500/1234≈40.5→41, 600/1234≈48.6→49, 134/1234≈10.9→11.
    const bar = screen.getByRole("img", { name: /Difficulty mix:/i });
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute("aria-label")).toBe(
      "Difficulty mix: Easy 41%, Medium 49%, Hard 11%",
    );
  });

  it("renders the Progress difficulty mix legend with percent per band", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    // Legend row sits below the stacked bar — one chip per band.
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("49%")).toBeInTheDocument();
    expect(screen.getByText("11%")).toBeInTheDocument();
  });

  it("hides Progress difficulty mix when no difficulty data is available", () => {
    render(<StatsPage stats={EMPTY_PUBLIC_STATS} />);
    expect(screen.queryByText("Progress difficulty mix")).toBeNull();
  });

  it("renders 'Tracked today / Coming next' bifurcation", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(
      screen.getByText("Tracked today / Coming next"),
    ).toBeInTheDocument();
    // Tracked today bullets (sample)
    expect(screen.getByText("App sessions")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard scores")).toBeInTheDocument();
    // Coming next bullets (sample) — network fees + failed-tx + retention
    // + countries are the deliberately-deferred §8 metrics.
    expect(screen.getByText(/Network fees paid/)).toBeInTheDocument();
    expect(screen.getByText(/Retention cohorts/)).toBeInTheDocument();
    expect(screen.getByText(/Top countries/)).toBeInTheDocument();
  });

  it("renders sections in visual-momentum order (Snapshot → Trend → Mix → Signals → Windows → Recent → Leaderboard → Tracked → Methodology)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const order = [
      "Verified Progress Saves",
      "Activity trend, last 30 days",
      "Progress difficulty mix",
      "Platform signals",
      "Activity windows",
      "Top Active Wallets",
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

  it("Top Active Wallets heading uses the demoted appendix style (uppercase small caps, not bold lg)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const heading = screen.getByText("Top Active Wallets");
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

    const victoryLink = screen.getByRole("link", {
      name: /Progress saves contract on Celoscan/i,
    });
    expect(victoryLink).toHaveAttribute(
      "href",
      "https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0",
    );
    expect(victoryLink).toHaveAttribute("target", "_blank");
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
      screen.getByText("Unique active wallets"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Distinct wallets that saved progress"),
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
        "Based on game scores, not only saved progress.",
      ),
    ).toBeInTheDocument();
  });

  it("renders Challenge Funnel section when challengeFunnel is present", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);

    expect(screen.getByText("Challenge Funnel")).toBeInTheDocument();
    expect(screen.getByText("Opens")).toBeInTheDocument();
    expect(screen.getByText("Starts")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Shares")).toBeInTheDocument();
    expect(screen.getByText("Continued to Lite")).toBeInTheDocument();
    // Numeric values from SAMPLE_STATS.challengeFunnel
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("does not render Challenge Funnel section when challengeFunnel is null", () => {
    render(<StatsPage stats={{ ...SAMPLE_STATS, challengeFunnel: null }} />);
    expect(screen.queryByText("Challenge Funnel")).not.toBeInTheDocument();
  });
});
