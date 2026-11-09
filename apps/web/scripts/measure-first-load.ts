/**
 * How many bytes of JavaScript a MiniPay player actually downloads before the
 * hub is usable (spec 2026-08-07-wallet-branch-lazy-load; founder, 2026-08-07).
 *
 * ⛔ THE ARBITER OF THIS FRONT IS THIS SCRIPT, NOT `next build`.
 * Measured on 2026-08-07: the route table and the route's own chunk graph
 * disagreed by 2.6× before the split and agreed after it. Neither is the
 * player's experience. This is: a browser, a real production server, bytes on
 * the wire, cut at product milestones.
 *
 * Decisions baked in, each because the obvious alternative measures something
 * else:
 *   - `encodedDataLength`, never `response.body().length` — the second is the
 *     DECOMPRESSED size, which nobody downloads.
 *   - `next start` over a production build, never `pnpm dev` — unminified and
 *     unsplit code has no relation to what ships.
 *   - product milestones, never `networkidle` — idle includes RPC calls,
 *     analytics and prefetches, so it measures the network, not the player.
 *   - MiniPay is the persona. Web is out of scope by decision; `--persona=web`
 *     exists only as a free diagnostic and gates nothing.
 *
 * Usage:
 *   pnpm -C apps/web measure:first-load -- --label=current
 *   pnpm -C apps/web measure:first-load -- --url=https://preview… --label=preview
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, devices, type Page, type BrowserContext } from "@playwright/test";

import { findPrivyEvidence } from "@/lib/bundle/minipay-graph-guard";

type Persona = "minipay" | "web";

type MilestoneName = "T1" | "T2" | "Tbranch" | "T3";

type Milestone = {
  name: MilestoneName;
  what: string;
  /** Diagnostic milestones may be absent (the baseline has no branch marker)
   *  without failing the run. */
  optional?: boolean;
};

/**
 * ⚠️ T2 CANNOT USE `[data-wallet-branch]`. That attribute was born with this
 * change, so the baseline would wait for something that never appears and every
 * baseline number would be a timeout.
 *
 * T2 is the hub's tile status chip: it predates this work (verified at
 * `cd380e7f`), it renders INSIDE the wallet-scoped product contexts — so it
 * cannot appear before a branch mounts — and it is the signal a player reads to
 * know the hub is answering. `challenge-card` was the first candidate and is
 * WRONG: it does not render on this build's hub at all, which a measurement
 * would have reported as a 45 s timeout instead of a number.
 *
 * T1 is `main`. In the baseline it is server-rendered and arrives early; here it
 * cannot exist until the branch mounts. That gap is not noise — it is the blank
 * window this change creates (E2), and it belongs in the report.
 */
const MILESTONES: Milestone[] = [
  { name: "T1", what: "main" },
  { name: "T2", what: '[data-testid="hub-tile-status"]' },
  { name: "Tbranch", what: '[data-wallet-branch="injected"]', optional: true },
];

type Sample = {
  milestone: MilestoneName;
  /** ms since navigation started. */
  atMs: number;
  jsRequests: number;
  jsEncodedBytes: number;
  urls: string[];
  /** Requests whose body carries Privy-only code. MUST be empty for MiniPay. */
  privyUrls: string[];
};

/**
 * Web Vitals as the PAGE reports them, not as a lab tool estimates them.
 *
 * ⚠️ `tbtMs` is an APPROXIMATION and is named so on purpose: real TBT is
 * measured between FCP and Time to Interactive, and TTI is not observable from
 * a `PerformanceObserver`. This sums the blocking part of every long task from
 * FCP to the last milestone — comparable between runs of THIS instrument, not
 * comparable with a Lighthouse number.
 */
/** One layout shift, with WHICH nodes moved — a CLS number alone cannot tell a
 *  late image from a shell swap, and those need opposite fixes. */
type LayoutShiftRecord = {
  atMs: number;
  value: number;
  sources: { tag: string; className: string; testid: string | null }[];
};

type Vitals = {
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number;
  longTasks: { startMs: number; durationMs: number }[];
  shifts: LayoutShiftRecord[];
  tbtApproxMs: number;
  /** Entry types this browser refused, if any. */
  failed: string[];
  /** The paint timeline, kept as the cross-check that caught the instrument
   *  reporting `n/a` for a page that had painted. */
  paintEntries: { name: string; startMs: number }[];
};

type Run = {
  label: string;
  persona: Persona;
  url: string;
  measuredAt: string;
  /** Network/CPU profile, so a number is never compared across profiles by
   *  accident. */
  profile: string;
  samples: Sample[];
  vitals: Vitals;
  /** Everything downloaded by T3, for auditing a surprising number. */
  allJs: { url: string; bytes: number }[];
};

/**
 * Lighthouse's mobile profile, reproduced by hand so runs are reproducible and
 * the numbers are recognisable: 150 ms RTT, 1.6 Mbps down, 750 kbps up, and a
 * 4× CPU slowdown. ⚠️ The CPU multiplier matters more than the bandwidth on a
 * hydration-bound page — dropping it would flatter every result.
 */
const SLOW_4G = {
  latencyMs: 150,
  downloadKbps: 1_638.4,
  uploadKbps: 750,
  cpuSlowdown: 4,
};

/**
 * Collected in the page, before any app code runs, with `buffered: true` so
 * entries that fired before this executed are not lost.
 *
 * ⛔ PLAIN STRING, NOT A FUNCTION — and this is not style.
 * `addInitScript(fn)` serialises `fn.toString()`, and tsx/esbuild compiles named
 * inner functions with a `__name(...)` call that only exists inside the bundle.
 * In the page that is `__name is not defined`: the script dies after creating
 * the store and before registering a single observer. The run then reported
 * `FCP n/a · LCP n/a · CLS 0 · 0 long tasks` for a page that had painted at
 * 576 ms — four values that all read as data and were all absence. A string is
 * immune to every transpiler helper.
 *
 * ⚠️ Each observer is also kept in `observers`: one with no strong reference can
 * be collected, and a collected observer stops delivering entries silently.
 */
const VITALS_INIT_SCRIPT = `
(function () {
  var store = {
    fcpMs: null,
    lcpMs: null,
    cls: 0,
    longTasks: [],
    shifts: [],
    failed: [],
    observers: []
  };
  window.__chesscitoVitals = store;

  function observe(type, handle) {
    try {
      var observer = new PerformanceObserver(function (list) {
        list.getEntries().forEach(handle);
      });
      observer.observe({ type: type, buffered: true });
      store.observers.push(observer);
    } catch (error) {
      store.failed.push(type + ": " + error);
    }
  }

  observe("paint", function (entry) {
    if (entry.name === "first-contentful-paint") store.fcpMs = entry.startTime;
  });
  observe("largest-contentful-paint", function (entry) {
    store.lcpMs = entry.startTime;
  });
  observe("layout-shift", function (entry) {
    if (entry.hadRecentInput) return;
    store.cls += entry.value;
    // WHICH element moved, not just how much. A CLS number alone cannot tell a
    // late-loading image from the shell swap, and those need opposite fixes.
    var sources = (entry.sources || []).map(function (source) {
      var node = source.node;
      return {
        tag: node && node.tagName ? node.tagName.toLowerCase() : "unknown",
        className: node && typeof node.className === "string" ? node.className.slice(0, 80) : "",
        testid: node && node.getAttribute ? node.getAttribute("data-testid") : null
      };
    });
    store.shifts.push({ atMs: entry.startTime, value: entry.value, sources: sources });
  });
  observe("longtask", function (entry) {
    store.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
  });
})();
`;

function arg(name: string, fallback?: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}=…`);
}

/** MiniPay is a WebView with an injected provider. `isMiniPayEnv()` reads
 *  exactly this, so the persona is one init script — no extension, no fixture. */
async function emulateMiniPay(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(window, "ethereum", {
      value: {
        isMiniPay: true,
        request: async () => [],
        on: () => {},
        removeListener: () => {},
      },
      configurable: true,
    });
  });
}

async function measure(
  page: Page,
  cdp: Awaited<ReturnType<BrowserContext["newCDPSession"]>>,
  url: string,
  persona: Persona,
  filmstripDir: string | null,
): Promise<{
  samples: Sample[];
  vitals: Vitals;
  allJs: { url: string; bytes: number }[];
}> {
  const urlByRequest = new Map<string, string>();
  const bytesByUrl = new Map<string, number>();
  const privyUrls = new Set<string>();
  const bodyChecks: Promise<void>[] = [];

  cdp.on("Network.responseReceived", (event) => {
    urlByRequest.set(event.requestId, event.response.url);
  });
  cdp.on("Network.loadingFinished", (event) => {
    const requested = urlByRequest.get(event.requestId);
    if (!requested || !isJs(requested)) return;
    // encodedDataLength is what crossed the wire, compression included.
    bytesByUrl.set(requested, event.encodedDataLength);
  });

  // Content inspection is separate from byte counting on purpose: the body is
  // read to CLASSIFY a chunk, never to size it.
  page.on("response", (response) => {
    if (!isJs(response.url())) return;
    bodyChecks.push(
      response
        .text()
        .then((text) => {
          if (findPrivyEvidence(text)) privyUrls.add(response.url());
        })
        .catch(() => {
          /* a body we cannot read is reported by its absence from allJs */
        }),
    );
  });

  const started = Date.now();
  // `commit`: start the clock when navigation actually begins, not when some
  // arbitrary load event decides the page is done.
  await page.goto(url, { waitUntil: "commit", timeout: 60_000 });

  // ⚠️ A filmstrip run is QUALITATIVE ONLY. Screenshotting costs main-thread
  // time, which is the very thing being measured under CPU throttling — so its
  // timings are never the ones reported. It answers one question the numbers
  // cannot: is the player looking at a blank screen or at something.
  let filmstripStop: (() => void) | null = null;
  if (filmstripDir) {
    mkdirSync(filmstripDir, { recursive: true });
    let frame = 0;
    let stopped = false;
    const shoot = async (): Promise<void> => {
      while (!stopped) {
        const at = Date.now() - started;
        try {
          await page.screenshot({
            path: path.join(filmstripDir, `${String(frame++).padStart(3, "0")}-${at}ms.png`),
          });
        } catch {
          /* the page may be navigating; a missing frame is not a failure */
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };
    void shoot();
    filmstripStop = () => {
      stopped = true;
    };
  }

  const samples: Sample[] = [];
  const snapshot = async (milestone: MilestoneName): Promise<void> => {
    await Promise.all(bodyChecks);
    const urls = [...bytesByUrl.keys()];
    samples.push({
      milestone,
      atMs: Date.now() - started,
      jsRequests: urls.length,
      jsEncodedBytes: [...bytesByUrl.values()].reduce((a, b) => a + b, 0),
      urls,
      privyUrls: urls.filter((u) => privyUrls.has(u)),
    });
  };

  for (const milestone of MILESTONES) {
    try {
      // ⚠️ Optional milestones wait BRIEFLY. The first baseline run spent 45 s
      // waiting for a marker that commit never had, and T3 — defined as "T2 plus
      // two seconds" — landed at 47.5 s. The bytes stayed valid (a wider window
      // can only add), but a clock that reports 47 s for a 2 s settle is a
      // number nobody can reconcile.
      await page.waitForSelector(milestone.what, {
        timeout: milestone.optional ? 5_000 : 45_000,
        state: "attached",
      });
    } catch (error) {
      if (!milestone.optional) throw error;
      // The baseline has no branch marker. Recording its absence is the point.
      continue;
    }
    await snapshot(milestone.name);
  }

  // T3 — T2 + 2s of settle. Anything that arrives here was DEFERRED, not saved:
  // this is the number that tells whether the split moved bytes or removed them.
  await page.waitForTimeout(2_000);
  await snapshot("T3");
  filmstripStop?.();

  const raw = await page.evaluate(() => {
    const collected = (
      window as unknown as {
        __chesscitoVitals: {
          fcpMs: number | null;
          lcpMs: number | null;
          cls: number;
          longTasks: { startMs: number; durationMs: number }[];
          shifts: LayoutShiftRecord[];
          failed: string[];
        };
      }
    ).__chesscitoVitals;
    return {
      fcpMs: collected.fcpMs,
      lcpMs: collected.lcpMs,
      cls: collected.cls,
      longTasks: collected.longTasks,
      shifts: collected.shifts,
      failed: collected.failed,
      // Cross-check from the timeline itself. If the observer missed FCP but the
      // entry exists, the run is reporting absence as data and must say so.
      paintEntries: performance
        .getEntriesByType("paint")
        .map((entry) => ({ name: entry.name, startMs: entry.startTime })),
    };
  });

  if (raw.fcpMs == null && raw.paintEntries.some((e) => e.name === "first-contentful-paint")) {
    throw new Error(
      "The page recorded a first-contentful-paint but the observer did not. " +
        "The instrument is broken; the numbers would be absence dressed as data.\n" +
        JSON.stringify(raw),
    );
  }

  // TBT approximation: the blocking share (over 50 ms) of every long task after
  // FCP. Named `approx` because the real definition ends at TTI, which is not
  // observable here — see the type's comment.
  const fcp = raw.fcpMs ?? 0;
  const tbtApproxMs = raw.longTasks
    .filter((task) => task.startMs >= fcp)
    .reduce((total, task) => total + Math.max(0, task.durationMs - 50), 0);

  void persona;
  return {
    samples,
    vitals: { ...raw, tbtApproxMs },
    allJs: [...bytesByUrl.entries()]
      .map(([url, bytes]) => ({ url, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

/** `null` prints as `n/a`, never as `0` — a missing metric and a zero metric are
 *  different facts and only one of them is good news. */
function fmt(ms: number | null): string {
  return ms == null ? "n/a" : `${Math.round(ms)} ms`;
}

function isJs(url: string): boolean {
  return /\.js(\?|$)/.test(new URL(url).pathname + (url.includes("?") ? "?" : ""));
}

async function main(): Promise<void> {
  const label = arg("label");
  const url = arg("url", "http://localhost:3002/");
  const persona = arg("persona", "minipay") as Persona;
  const outFile = arg(
    "out",
    path.resolve(process.cwd(), "../../docs/measurements/first-load-minipay.json"),
  );

  // ⚠️ Default is UNTHROTTLED so the byte comparison against the stored baseline
  // stays apples-to-apples. Throttling changes timings, never bytes — but a run
  // labelled without its profile is a number nobody can reproduce, so the
  // profile travels inside the record.
  const throttle = arg("throttle", "none");

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    // Same viewport as the canonical `minipay` Playwright project, so this
    // measurement and the VR are looking at the same device.
    viewport: { width: 390, height: 844 },
  });
  if (persona === "minipay") await emulateMiniPay(context);
  await context.addInitScript({ content: VITALS_INIT_SCRIPT });

  const page = await context.newPage();
  // A page error during a measurement run is not noise: the `__name is not
  // defined` that killed the vitals init script was invisible until this line
  // existed, and the run happily reported four metrics that were all absence.
  page.on("pageerror", (error) => console.log("  ⚠️ pageerror:", error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // A warm cache measures the second visit. Every player has a first one.
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  if (throttle === "slow4g") {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: SLOW_4G.latencyMs,
      downloadThroughput: (SLOW_4G.downloadKbps * 1024) / 8,
      uploadThroughput: (SLOW_4G.uploadKbps * 1024) / 8,
    });
    // The CPU multiplier is not decoration: this page is hydration-bound, so
    // leaving it at 1× would flatter every timing on a developer machine.
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW_4G.cpuSlowdown });
  }

  const filmstripDir = process.argv.includes("--filmstrip")
    ? path.resolve(process.cwd(), `e2e-results/filmstrip/${label}`)
    : null;

  const { samples, vitals, allJs } = await measure(page, cdp, url, persona, filmstripDir);
  await browser.close();

  const run: Run = {
    label,
    persona,
    url,
    measuredAt: new Date().toISOString(),
    profile: throttle === "slow4g" ? "slow4g+4xCPU" : "unthrottled",
    samples,
    vitals,
    allJs,
  };

  mkdirSync(path.dirname(outFile), { recursive: true });
  let history: Run[] = [];
  try {
    history = JSON.parse(readFileSync(outFile, "utf8")) as Run[];
  } catch {
    /* first run */
  }
  writeFileSync(
    outFile,
    JSON.stringify([...history.filter((r) => r.label !== label), run], null, 2),
  );

  console.log(`\n${persona} · ${run.profile} · ${url}`);
  for (const sample of samples) {
    console.log(
      `  ${sample.milestone.padEnd(7)} ${String(sample.atMs).padStart(6)} ms  ` +
        `${(sample.jsEncodedBytes / 1024).toFixed(1).padStart(8)} kB  ` +
        `${String(sample.jsRequests).padStart(3)} js  ` +
        `privy: ${sample.privyUrls.length}`,
    );
  }
  const blocking = vitals.longTasks.filter((t) => t.durationMs > 50);
  console.log(
    `\n  FCP ${fmt(vitals.fcpMs)}  LCP ${fmt(vitals.lcpMs)}  CLS ${vitals.cls.toFixed(4)}  ` +
      `TBT~ ${Math.round(vitals.tbtApproxMs)} ms  long tasks ${blocking.length}` +
      (blocking.length
        ? ` (max ${Math.round(Math.max(...blocking.map((t) => t.durationMs)))} ms)`
        : ""),
  );
  for (const shift of vitals.shifts) {
    console.log(
      `  shift ${shift.value.toFixed(4)} @ ${Math.round(shift.atMs)} ms → ` +
        shift.sources.map((s) => `${s.tag}.${s.className.split(" ")[0]}`).join(", "),
    );
  }
  console.log(`\n  → ${outFile}\n`);
}

void main();
