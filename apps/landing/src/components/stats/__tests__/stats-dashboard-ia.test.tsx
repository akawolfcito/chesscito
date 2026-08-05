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

describe("progressive disclosure — trend", () => {
  it("shows seven days and hides the other 23 behind a counted summary", () => {
    renderDashboard();
    const visible = screen.getByTestId("trend-recent").querySelectorAll("tbody tr");
    expect(visible).toHaveLength(7);

    const details = screen.getByTestId("trend-more");
    expect(details.tagName).toBe("DETAILS");
    expect(within(details).getByText("Show 23 more days")).toBeTruthy();
    expect(details.querySelectorAll("tbody tr")).toHaveLength(23);
  });

  it("shows the MOST RECENT seven, not the oldest", () => {
    renderDashboard();
    const rows = screen.getByTestId("trend-recent").querySelectorAll("tbody tr");
    expect(rows[rows.length - 1]?.textContent).toContain("2026-07-30");
  });

  it("renders no empty disclosure when there is nothing to hide", () => {
    renderDashboard({ activityTrend30d: trend(5) });
    expect(screen.getByTestId("trend-recent").querySelectorAll("tbody tr")).toHaveLength(5);
    expect(screen.queryByTestId("trend-more")).toBeNull();
  });

  it("starts collapsed — the summary is the whole point", () => {
    renderDashboard();
    expect(screen.getByTestId("trend-more").hasAttribute("open")).toBe(false);
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
