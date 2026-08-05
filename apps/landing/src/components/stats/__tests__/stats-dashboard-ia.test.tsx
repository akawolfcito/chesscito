/**
 * Information architecture of `/stats`.
 *
 * This initiative reorganises what already exists: no RPC, no aggregator, no
 * cache and no data source is touched. So every rule here is about ORDER,
 * DISCLOSURE and WORDING — the three things that decide whether a correct
 * number is also a readable one.
 *
 * ⚠️ The assertions run against the RENDERED output, not against props, because
 * the defects this guards against (a collapsed block that reads as missing
 * data, a section that arrives before the summary) are only visible in the
 * document order.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatsDashboard } from "../stats-dashboard";
import { formatLaunchDate, MINIPAY_LAUNCH_DATE, statsCopy } from "@/lib/stats/copy";
// ⚠️ TYPE-only: `players-census.ts` pulls in the `server-only` module through
// the Supabase client, which throws the moment a test environment imports it.
import type { PlayersCensus } from "@/lib/stats/players-census";
import { EMPTY_PUBLIC_STATS, type PublicStats } from "@/lib/stats/types";

function trend(days: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    sessions: 100 + i,
    newInstalls: 10 + i,
    returningInstalls: 90,
  }));
}

function census(rows: number): PlayersCensus {
  return {
    total: rows,
    rowsRead: "ok",
    asOf: "2026-08-05T10:00:00.000Z",
    rows: Array.from({ length: rows }, (_, i) => ({
      rowId: `row-${i}`,
      rank: i + 1,
      totalScore: 1000 - i,
      variant: { style: "golden", piece: "rook", number: i + 1 } as PlayersCensus["rows"][number]["variant"],
      isVerified: false,
      hasOnchain: false,
    })),
  };
}

function stats(overrides: Partial<PublicStats> = {}): PublicStats {
  return {
    ...EMPTY_PUBLIC_STATS,
    generatedAt: "2026-08-05T12:00:00.000Z",
    installs: {
      sessions7d: 4410,
      sessions30d: 16255,
      appOpensRows30d: 20000,
      appOpenSessions30d: 15000,
    },
    activation: [
      { step: "app_opened", sessions: 3451 },
      { step: "hub_viewed", sessions: 2400 },
      { step: "exercise_started", sessions: 1800 },
      { step: "exercise_completed", sessions: 900 },
      { step: "daily_focus_completed", sessions: 320 },
    ],
    accessFunnel: { steps: [{ step: "gate_viewed", sessions: 17 }], failedSessions: 2 },
    accountLifecycle: {
      known: 373,
      newToday: 4,
      new7d: 40,
      active7d: 260,
      dormant: 113,
      inactive: 0,
      resurrected7d: 9,
    },
    habitDepth: {
      cohort: 1000,
      medianActiveDays: 2,
      buckets: [
        { minDays: 1, installs: 1000 },
        { minDays: 3, installs: 420 },
        { minDays: 7, installs: 120 },
        { minDays: 14, installs: 30 },
        { minDays: 21, installs: 5 },
      ],
    },
    retention: {
      d1: { returned: 100, cohort: 500 },
      d7: { returned: 40, cohort: 400 },
      week3: { returned: 0, cohort: 0 },
    },
    topCountries: [{ country: "KE", sessions: 320 }],
    activityTrend30d: trend(30),
    ...overrides,
  };
}

function renderDashboard(over: Partial<PublicStats> = {}, rows = 50, locale: "en" | "es" = "en") {
  return render(
    <StatsDashboard
      stats={stats(over)}
      breakdown={{
        learn: { sessions7d: 3000, sessions30d: 12000, appOpensRows30d: 0, appOpenSessions30d: 0 },
        play: { sessions7d: 1000, sessions30d: 3000, appOpensRows30d: 0, appOpenSessions30d: 0 },
        total: { sessions7d: 4410, sessions30d: 16255, appOpensRows30d: 0, appOpenSessions30d: 0 },
      }}
      census={census(rows)}
      locale={locale}
      localeOverride={null}
    />,
  );
}

/** Heading text in document order — the IA IS this list. */
function headingOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("h1, h2")).map((h) => h.textContent ?? "");
}

describe("section order", () => {
  it("tells the story summary-first: glance, then journey, then the detail", () => {
    const { container } = renderDashboard();
    const c = statsCopy("en");
    const order = headingOrder(container);

    expect(order).toEqual([
      c.title,
      c.sectionGlance,
      c.sectionJourney,
      c.sectionEngagement,
      c.sectionAudience,
      c.sectionActivity,
      c.sectionCelo,
      c.sectionMethod,
    ]);
  });

  it("keeps one page and one URL — no tabs, no nav", () => {
    const { container } = renderDashboard();
    expect(container.querySelectorAll('[role="tab"], [role="tablist"]')).toHaveLength(0);
  });
});

describe("launch context", () => {
  it("names the launch date, in the reader's language", () => {
    renderDashboard();
    expect(screen.getByTestId("stats-launch-context").textContent).toBe(
      `${statsCopy("en").launchPrefix} · August 3, 2026`,
    );
  });

  it("is Spanish in Spanish", () => {
    renderDashboard({}, 50, "es");
    expect(screen.getByTestId("stats-launch-context").textContent).toBe(
      `${statsCopy("es").launchPrefix} · 3 de agosto de 2026`,
    );
  });

  it("is an editorial constant, never a derived timestamp", () => {
    // ⛔ Deriving it from telemetry would need a new read — outside scope — and
    // would publish "when we started measuring" as "when we launched".
    expect(MINIPAY_LAUNCH_DATE).toBe("2026-08-03");
    expect(formatLaunchDate("en")).toBe("August 3, 2026");
  });
});

describe("at a glance", () => {
  it("is exactly five metrics — not four, not six", () => {
    renderDashboard();
    const glance = screen.getByTestId("stats-glance");
    expect(within(glance).getAllByTestId("stat-card")).toHaveLength(5);
  });

  it("reuses existing measurements and invents no ratio", () => {
    renderDashboard();
    const glance = screen.getByTestId("stats-glance");
    expect(glance.textContent).toContain("4,410"); // sessions 7d
    expect(glance.textContent).toContain("260"); // active people 7d
    expect(glance.textContent).toContain("1,800"); // exercises started
    expect(glance.textContent).toContain("900"); // exercises completed
    expect(glance.textContent).toContain("420"); // 3+ active days
    expect(glance.textContent).not.toMatch(/%/);
  });

  it("says the habit signal is still maturing, on the card itself", () => {
    renderDashboard();
    const glance = screen.getByTestId("stats-glance");
    expect(within(glance).getByText(statsCopy("en").glanceEarlyHabitNote)).toBeTruthy();
  });

  it("dashes an unmeasured metric instead of printing a zero", () => {
    renderDashboard({ activation: null, habitDepth: null, accountLifecycle: null });
    const glance = screen.getByTestId("stats-glance");
    const values = within(glance)
      .getAllByTestId("stat-value")
      .map((el) => el.textContent);
    expect(values.filter((v) => v === "—")).toHaveLength(4);
    expect(values).not.toContain("0");
  });
});

describe("from first visit to habit", () => {
  const steps = [
    "App opened",
    "Exercise started",
    "Exercise completed",
    "Daily focus completed",
    "Active on 3+ days",
  ];

  it("walks the five checkpoints in order", () => {
    renderDashboard();
    const journey = screen.getByTestId("stats-journey");
    const labels = within(journey)
      .getAllByTestId("bar-label")
      .map((el) => el.textContent);
    expect(labels).toEqual(steps);
  });

  it("carries the not-a-funnel disclaimer right below the walk", () => {
    renderDashboard();
    const journey = screen.getByTestId("stats-journey");
    expect(within(journey).getByText(statsCopy("en").journeyNote)).toBeTruthy();
  });

  it("prints no percentage between steps", () => {
    // ⛔ A step-to-step rate would assert a cohort relationship the data does
    // not support: these are independent counts over one window.
    renderDashboard();
    expect(screen.getByTestId("stats-journey").textContent).not.toMatch(/%/);
  });

  it("drops the habit checkpoint rather than faking it when unmeasured", () => {
    renderDashboard({ habitDepth: null });
    const journey = screen.getByTestId("stats-journey");
    const labels = within(journey)
      .getAllByTestId("bar-label")
      .map((el) => el.textContent);
    expect(labels).toEqual(steps.slice(0, 4));
  });
});

describe("the trend is a chart, and the table is its precision", () => {
  it("plots EVERY day — the disclosure holds precision, not data", () => {
    renderDashboard();
    expect(screen.getAllByTestId("trend-column")).toHaveLength(30);

    const details = screen.getByTestId("trend-table");
    expect(details.tagName).toBe("DETAILS");
    expect(within(details).getByText("Show the exact figures for all 30 days")).toBeTruthy();
    expect(details.querySelectorAll("tbody tr")).toHaveLength(30);
    expect(details.hasAttribute("open")).toBe(false);
  });

  it("scales the columns against the busiest day, not against themselves", () => {
    // A bar normalised on its own value makes every day look identical.
    renderDashboard();
    const cols = screen.getAllByTestId("trend-column");
    const heightOf = (col: HTMLElement) =>
      Array.from(col.querySelectorAll<HTMLElement>("div")).reduce(
        (sum, seg) => sum + Number.parseFloat(seg.style.height || "0"),
        0,
      );
    // The fixture rises monotonically, so the last day must be the tallest.
    expect(heightOf(cols[cols.length - 1])).toBeGreaterThan(heightOf(cols[0]));
    expect(heightOf(cols[cols.length - 1])).toBeCloseTo(100, 0);
  });

  it("splits each column into new and returning, never overlapping them", () => {
    // `newInstalls + returningInstalls === sessions` by construction, so the
    // two segments PARTITION the column.
    renderDashboard();
    const first = screen.getAllByTestId("trend-column")[0];
    expect(within(first).getByTestId("trend-segment-new")).toBeTruthy();
    expect(within(first).getByTestId("trend-segment-returning")).toBeTruthy();
  });

  it("identifies the two series by label, never by colour alone", () => {
    renderDashboard();
    const c = statsCopy("en");
    const activity = screen.getByText(c.sectionActivity).closest("section")!;
    expect(within(activity).getAllByText(c.trendNew).length).toBeGreaterThan(0);
    expect(within(activity).getAllByText(c.trendReturning).length).toBeGreaterThan(0);
  });

  it("carries a per-day tooltip with no JavaScript at all", () => {
    renderDashboard();
    const col = screen.getAllByTestId("trend-column")[0];
    expect(col.getAttribute("title")).toContain("2026-07-01");
    expect(col.getAttribute("title")).toContain("100");
  });

  it("describes itself to a screen reader", () => {
    renderDashboard();
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain(statsCopy("en").trendChartLabel);
  });

  it("falls back to the not-measured callout with no days at all", () => {
    renderDashboard({ activityTrend30d: [] });
    expect(screen.queryByTestId("trend-column")).toBeNull();
    expect(screen.queryByTestId("trend-table")).toBeNull();
  });
});

describe("progressive disclosure — players", () => {
  it("shows the top ten and counts the rest in the summary", () => {
    renderDashboard({}, 50);
    expect(screen.getByTestId("players-top").querySelectorAll("tbody tr")).toHaveLength(10);
    const details = screen.getByTestId("players-more");
    expect(within(details).getByText("Show 40 more players")).toBeTruthy();
    expect(details.querySelectorAll("tbody tr")).toHaveLength(40);
  });

  it("hides nothing when there are ten or fewer", () => {
    renderDashboard({}, 8);
    expect(screen.getByTestId("players-top").querySelectorAll("tbody tr")).toHaveLength(8);
    expect(screen.queryByTestId("players-more")).toBeNull();
    expect(screen.queryByTestId("players-cut")).toBeNull();
  });

  it("declares the 50-row cut against the counted population, in the open", () => {
    // ⚠️ The census counts 373 and the table renders 50. Without this line the
    // reader cannot reconcile the two, and an unreconcilable number reads as a
    // lie — so it is never inside the disclosure.
    renderDashboard({}, 373);
    const cut = screen.getByTestId("players-cut");
    expect(cut.textContent).toBe("This table lists the top 50 of 373 ranked players.");
    expect(cut.closest("details")).toBeNull();
  });
});

describe("what disclosure may never hide", () => {
  it("keeps the snapshot stamp, methodology and the census clock in the open", () => {
    const { container } = renderDashboard();
    const open = Array.from(container.querySelectorAll("details")).reduce(
      (html, d) => html.replace(d.outerHTML, ""),
      container.innerHTML,
    );
    const c = statsCopy("en");
    expect(open).toContain(c.snapshotAt);
    expect(open).toContain(c.methodBody.slice(0, 40));
    expect(open).toContain(c.censusAt);
    expect(open).toContain(c.surfaceNullNote.slice(0, 40));
  });

  it("keeps a degraded-data warning in the open", () => {
    renderDashboard({ dataIntegrity: { failedRpcs: ["stats_retention"] } });
    const warning = screen.getByText(statsCopy("en").integrityTitle);
    expect(warning.closest("details")).toBeNull();
  });
});
