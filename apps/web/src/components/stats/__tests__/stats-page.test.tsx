import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { StatsPage as StatsPageBase } from "../stats-page";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/public-aggregator";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import type { PublicStats } from "@/lib/stats/public-aggregator";
import { IDENTITY_COPY } from "@/lib/content/editorial";
import type { NicknameTokens } from "@/lib/identity/identity-lite";

afterEach(() => {
  cleanup();
});

// EN tokens (the test renders the default-locale bundle). Wrapper injects them
// so the 28 existing call sites stay unchanged.
const TOKENS = IDENTITY_COPY as unknown as NicknameTokens;
// The census is a sibling prop, not part of `stats`. These cases predate it and
// are about the dashboard, so they get the unavailable census: the block hides
// and nothing else on the page changes. Census behaviour has its own suites
// (players-table*, players-census-placement).
function StatsPage({ stats }: { stats: PublicStats }) {
  return (
    <StatsPageBase
      stats={stats}
      census={EMPTY_PLAYERS_CENSUS}
      nicknameTokens={TOKENS}
    />
  );
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
    // The two series always partition `sessions` — same invariant the
    // aggregator guarantees, so the fixture cannot describe an impossible day.
    newInstalls: i % 5 === 0 ? 0 : 1,
    returningInstalls: i % 5 === 0 ? 0 : (i % 5) - 1,
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
  filters: { surface: "all", container: "all" },
  appOpens30d: 1500,
  activation: [
    { step: "app_opened", sessions: 1500 },
    { step: "hub_viewed", sessions: 1200 },
    { step: "exercise_started", sessions: 800 },
    { step: "exercise_completed", sessions: 600 },
    { step: "daily_focus_completed", sessions: 300 },
  ],
  topCountries: [
    { country: "BR", sessions: 420 },
    { country: "NG", sessions: 210 },
  ],
  retention: {
    d1: { returned: 300, cohort: 1000 },
    d7: { returned: 120, cohort: 900 },
    week3: { returned: 64, cohort: 700 },
  },
  // Values chosen NOT to collide with any other number on the page — the
  // headline tiles already own 410 and 250, and getByText would go ambiguous.
  accountLifecycle: {
    known: 881,
    newToday: 13,
    new7d: 97,
    active7d: 407,
    dormant: 263,
    inactive: 211,
    resurrected7d: 33,
  },
  habitDepth: {
    buckets: [
      { minDays: 1, installs: 701 },
      { minDays: 3, installs: 383 },
      { minDays: 7, installs: 191 },
      { minDays: 14, installs: 73 },
      { minDays: 21, installs: 26 },
    ],
    cohort: 701,
    medianActiveDays: 4,
  },
  accessFunnel: {
    steps: [
      { step: "gate_viewed", sessions: 900 },
      { step: "login_started", sessions: 640 },
      { step: "login_succeeded", sessions: 520 },
      { step: "wallet_ready", sessions: 505 },
      { step: "first_exercise_completed", sessions: 310 },
    ],
    failedSessions: 47,
  },
  dataIntegrity: { truncated: [], rowCeiling: 10000 },
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

  it("keeps indexer-gated metrics in the Coming next lane (retention D1/D7 + countries now ship)", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    const comingNext = screen.getByText("Coming next").closest("div");
    expect(comingNext).not.toBeNull();
    expect(comingNext).toHaveTextContent(/network fees/i);
    expect(comingNext).toHaveTextContent(/failed transaction rate/i);
    // Only the further-out D30 / D3 / D21 cohorts stay deferred.
    expect(comingNext).toHaveTextContent(/retention d30/i);
    // Top countries + D1/D7 are no longer deferred — they render in the
    // Acquisition & Activation block above.
    expect(comingNext).not.toHaveTextContent(/top countries/i);
    expect(screen.getByText("App Opens (30d)")).toBeInTheDocument();
    expect(screen.getByText(/Top countries · by sessions/)).toBeInTheDocument();
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

  it("renders the access funnel from the door through the first finished exercise", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Login screen shown")).toBeInTheDocument();
    expect(screen.getByText("Signed in")).toBeInTheDocument();
    expect(screen.getByText("First exercise finished")).toBeInTheDocument();
    // The terminal step's count must be readable — it is the "did they reach
    // value" number the whole section exists for.
    expect(screen.getByText("310")).toBeInTheDocument();
  });

  it("reports login failures beside the funnel, never as a funnel step", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(
      screen.getByText(/47 of these sessions hit a login error/i),
    ).toBeInTheDocument();
  });

  it("hides the access funnel when the query failed", () => {
    render(<StatsPage stats={{ ...SAMPLE_STATS, accessFunnel: null }} />);
    expect(screen.queryByText("Login screen shown")).toBeNull();
  });

  it("names the truncated reads instead of printing confident partial numbers", () => {
    render(
      <StatsPage
        stats={{
          ...SAMPLE_STATS,
          dataIntegrity: {
            truncated: ["active sessions (7d)"],
            rowCeiling: 1000,
          },
        }}
      />,
    );
    // The copy no longer says "lower bounds": a capped read does not make a
    // windowed metric smaller, it makes it a different window. Those metrics
    // now go to `—` and the notice says so.
    // Scoped by testid, not by free text: the census block carries its own
    // "temporarily unavailable" line and a global query would match both.
    const notice = screen.getByTestId("integrity-notice");
    expect(notice).toHaveTextContent(/temporarily unavailable/i);
    expect(notice).toHaveTextContent(/active sessions \(7d\)/);
  });

  it("stays silent about integrity when every read came back whole", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.queryByText(/lower bounds/i)).toBeNull();
  });

  it("splits the trend into new vs returning installs", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("New installs")).toBeInTheDocument();
    expect(screen.getByText("Returning installs")).toBeInTheDocument();
  });

  it("renders the account lifecycle as people, with the partition adding up", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("Active (7d)")).toBeInTheDocument();
    expect(screen.getByText("Dormant")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    // 407 + 263 + 211 = 881 known — the copy states the denominator so the
    // three buckets can be checked against it by eye.
    expect(screen.getByText(/Of 881 accounts ever seen/)).toBeInTheDocument();
  });

  it("shows resurrections apart from the partition", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText(/33 came back after going quiet/i)).toBeInTheDocument();
  });

  it("hides the lifecycle block when there is no account denominator", () => {
    render(<StatsPage stats={{ ...SAMPLE_STATS, accountLifecycle: null }} />);
    expect(screen.queryByText("Dormant")).toBeNull();
  });

  it("renders habit depth up to the 21-day promise", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText("21+ days")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(
      screen.getByText(/median 4 of 701 active installs/i),
    ).toBeInTheDocument();
  });

  it("labels week-3 retention as a window, not an exact day", () => {
    render(<StatsPage stats={SAMPLE_STATS} />);
    expect(screen.getByText(/week 3/i)).toBeInTheDocument();
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
    // Coming next bullets (sample) — network fees + failed-tx stay in the
    // deferred lane (need an indexer). Retention D1/D7 + top countries now
    // SHIP in the Acquisition & Activation block, so the deferred lane only
    // mentions the further-out D30 / D3 / D21 cohorts.
    expect(screen.getByText(/Network fees paid/)).toBeInTheDocument();
    expect(screen.getByText(/Retention D30/)).toBeInTheDocument();
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
    expect(screen.getByText("Continued to Learn")).toBeInTheDocument();
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
