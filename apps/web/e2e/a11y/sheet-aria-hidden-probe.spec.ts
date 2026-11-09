// A11y probe — Radix Sheet "Blocked aria-hidden" warning.
//
// Drives Chromium through every Sheet trigger reachable from anonymous
// sessions, listens to the page's console stream for the canonical
// Chrome a11y warning, and outputs a per-sheet report. The spec is
// non-asserting by default (always passes) so it can be run as a probe
// without polluting the CI gate; flip `STRICT_ASSERT` to `true` once
// the fix lands to use the same spec as a regression guard.
//
// Backs the candidate fix work in
// `docs/superpowers/specs/2026-06-05-radix-sheet-aria-hidden-a11y-fix.md`.
// The probe answers "which sheets trigger the warning today" — the
// prerequisite for picking between Path A (universal) and Path B
// (per-callsite blur) in that spec.
//
// Run:  cd apps/web && pnpm exec playwright test e2e/a11y/sheet-aria-hidden-probe.spec.ts --project=minipay --reporter=list
import { test, expect, type Page, type ConsoleMessage, type CDPSession } from "@playwright/test";

const STRICT_ASSERT = false;

const WARNING_NEEDLE = "Blocked aria-hidden";

type Finding = {
  sheet: string;
  trigger: string;
  warning: string;
};

async function bypassFirstVisit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}

function attachWarningCollector(page: Page, sink: string[]): void {
  page.on("console", (msg: ConsoleMessage) => {
    const text = msg.text();
    if (
      text.includes(WARNING_NEEDLE) ||
      text.toLowerCase().includes("retained focus")
    ) {
      sink.push(`[console:${msg.type()}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    if (
      error.message.includes(WARNING_NEEDLE) ||
      error.message.toLowerCase().includes("retained focus")
    ) {
      sink.push(`[pageerror] ${error.message}`);
    }
  });
}

/**
 * Attach a CDP Audits listener. Chrome's modern a11y warnings (including
 * "Blocked aria-hidden because descendant retained focus") are delivered
 * via the Audits.issueAdded event, NOT the console. This is the only
 * reliable way to capture them in headless Playwright runs.
 *
 * The issue code is `GenericIssue` with `errorType:
 * "FormLabelHasNeitherForNorNestedInput"` … no wait, for the focus-aria
 * case it's `GenericIssue` with `errorType:
 * "FormInputAssignedAutocompleteValueToIdOrNameAttributeError"` … the
 * exact code shape varies by Chromium version, so we capture the FULL
 * issue payload and let the report filter.
 */
async function attachCdpAuditsListener(
  page: Page,
  sink: string[],
): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Audits.enable");
  cdp.on("Audits.issueAdded", (event) => {
    const payload = JSON.stringify(event.issue);
    if (
      payload.toLowerCase().includes("aria-hidden") ||
      payload.toLowerCase().includes("retained focus") ||
      payload.toLowerCase().includes("accessibilityissue")
    ) {
      sink.push(`[cdp:audit] ${payload}`);
    }
  });
  return cdp;
}

async function settle(page: Page, ms = 600): Promise<void> {
  await page.waitForTimeout(ms);
}

async function dismissSheet(page: Page): Promise<void> {
  // Press Escape — Radix Dialog binds this to close. Fallback: click
  // the overlay (Radix renders it as a fixed-inset div). The escape
  // path is the cleanest because it doesn't mutate focus through a
  // synthetic click.
  await page.keyboard.press("Escape");
  await settle(page, 400);
}

/**
 * Open a sheet by aria-label or test-id, capture any aria-hidden
 * warning emitted during the open transition, then dismiss.
 *
 * We poll a brief window post-open to catch warnings that fire on
 * focus settling — Chrome emits the warning on the microtask after
 * aria-hidden cascade lands, which can fall a few frames after the
 * Sheet animation starts.
 */
async function probeSheet(
  page: Page,
  label: string,
  trigger: () => Promise<void>,
  findings: Finding[],
  warnings: string[],
): Promise<void> {
  const baseline = warnings.length;
  await trigger();
  await settle(page, 800);
  const newWarnings = warnings.slice(baseline);
  for (const warning of newWarnings) {
    findings.push({ sheet: label, trigger: label, warning });
  }
  await dismissSheet(page);
}

test.describe("a11y probe — Radix Sheet aria-hidden", () => {
  test("anonymous /exercises dock sheets", async ({ page }) => {
    const warnings: string[] = [];
    const findings: Finding[] = [];
    attachWarningCollector(page, warnings);
    await attachCdpAuditsListener(page, warnings);

    await bypassFirstVisit(page);
    await page.goto("/exercises", { waitUntil: "load", timeout: 30_000 });
    // Splash clear — same pattern as visual-regression.spec.ts hub-clean.
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      timeout: 30_000,
    });
    await settle(page, 600);

    // Dock items expose aria-label translated from messages/en.ts under
    // EXERCISES_COPY.dockAriaLabel*. The PersistentDock renders a <nav>
    // with role="navigation" and a <button> per slot with aria-label
    // matching the slot label key (pieces, arena, badge, shop,
    // trophies, leaderboard).
    // Labels canonical from editorial.ts HUB_V2_DOCK_COPY:
    //   arena → "Arena", badge → "Badges", trophies → "Trophies",
    //   leaderboard → "Leaders". Shop slot uses t("shop") which is
    //   "Shop" in EN. The nav landmark is aria-label="Game navigation".
    const dockSelectors: Array<[string, string]> = [
      ["dock-badge", 'nav[aria-label="Game navigation"] button[aria-label="Badges"]'],
      ["dock-shop", 'nav[aria-label="Game navigation"] button[aria-label="Shop"]'],
      ["dock-trophies", 'nav[aria-label="Game navigation"] button[aria-label="Trophies"]'],
      ["dock-leaderboard", 'nav[aria-label="Game navigation"] button[aria-label="Leaders"]'],
    ];

    for (const [label, selector] of dockSelectors) {
      const trigger = page.locator(selector).first();
      const visible = await trigger.isVisible().catch(() => false);
      if (!visible) {
        console.log(`[probe] skip ${label} — trigger not visible`);
        continue;
      }
      await probeSheet(
        page,
        label,
        async () => {
          await trigger.click({ trial: false });
        },
        findings,
        warnings,
      );
    }

    // Emit the report to the test log so it's visible in the reporter
    // output. JSON for machine consumption; human-readable summary for
    // the reporter's stdout.
    console.log("[probe] findings:", JSON.stringify(findings, null, 2));
    console.log(
      `[probe] summary — ${findings.length} aria-hidden warning(s) across ` +
        `${dockSelectors.length} dock sheets`,
    );

    if (STRICT_ASSERT) {
      expect(findings).toEqual([]);
    }
  });

  test("anonymous /exercises piece-picker + drawer sheets", async ({ page }) => {
    const warnings: string[] = [];
    const findings: Finding[] = [];
    attachWarningCollector(page, warnings);
    await attachCdpAuditsListener(page, warnings);

    await bypassFirstVisit(page);
    await page.goto("/exercises", { waitUntil: "load", timeout: 30_000 });
    await expect(page.locator(".playhub-intro-overlay")).toBeHidden({
      timeout: 30_000,
    });
    await settle(page, 600);

    // The piece picker sits in the contextual header — opens
    // PiecePickerSheet. Aria-label varies; match common synonyms.
    const piecePicker = page
      .locator(
        'button[aria-label*="iece"], header button[aria-label*="ick"], [role="button"][aria-label*="iece"]',
      )
      .first();
    if (await piecePicker.isVisible().catch(() => false)) {
      await probeSheet(
        page,
        "piece-picker",
        async () => {
          await piecePicker.click();
        },
        findings,
        warnings,
      );
    } else {
      console.log("[probe] skip piece-picker — trigger not visible");
    }

    // Any visible exercise tile opens ExerciseDrawer. Tap the first
    // tile inside the rail grid.
    const exerciseTile = page
      .locator(
        '[data-testid="exercise-rail"] button, [data-testid^="exercise-tile"], main button[class*="exercise"]',
      )
      .first();
    if (await exerciseTile.isVisible().catch(() => false)) {
      await probeSheet(
        page,
        "exercise-drawer",
        async () => {
          await exerciseTile.click();
        },
        findings,
        warnings,
      );
    } else {
      console.log("[probe] skip exercise-drawer — trigger not visible");
    }

    console.log("[probe] findings:", JSON.stringify(findings, null, 2));
    console.log(
      `[probe] summary — ${findings.length} aria-hidden warning(s) across piece-picker + drawer`,
    );

    if (STRICT_ASSERT) {
      expect(findings).toEqual([]);
    }
  });

  test("anonymous root Hub daily-tactic sheet", async ({ page }) => {
    const warnings: string[] = [];
    const findings: Finding[] = [];
    attachWarningCollector(page, warnings);
    await attachCdpAuditsListener(page, warnings);

    await bypassFirstVisit(page);
    await page.goto("/", { waitUntil: "load", timeout: 30_000 });
    await settle(page, 800);

    // DailyTacticSheet is opened from the StonePedestal "Daily tactic"
    // pillar on the root Hub. Match the same selector used by visual-regression
    // for vr2-hub-daily-tactic-sheet-open (button with aria-label
    // "Daily tactic").
    const dailyTrigger = page
      .locator('button[aria-label*="aily"], [aria-label*="aily"][role="button"]')
      .first();
    const visible = await dailyTrigger.isVisible().catch(() => false);
    if (visible) {
      await probeSheet(
        page,
        "hub-daily-tactic",
        async () => {
          await dailyTrigger.click();
        },
        findings,
        warnings,
      );
    } else {
      console.log("[probe] skip hub-daily-tactic — trigger not visible");
    }

    console.log("[probe] findings:", JSON.stringify(findings, null, 2));
    console.log(
      `[probe] summary — ${findings.length} aria-hidden warning(s) on root Hub`,
    );

    if (STRICT_ASSERT) {
      expect(findings).toEqual([]);
    }
  });
});
