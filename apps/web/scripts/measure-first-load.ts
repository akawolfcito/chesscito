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

type Run = {
  label: string;
  persona: Persona;
  url: string;
  measuredAt: string;
  samples: Sample[];
  /** Everything downloaded by T3, for auditing a surprising number. */
  allJs: { url: string; bytes: number }[];
};

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

async function measure(page: Page, cdp: Awaited<ReturnType<BrowserContext["newCDPSession"]>>, url: string, persona: Persona): Promise<{ samples: Sample[]; allJs: { url: string; bytes: number }[] }> {
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

  void persona;
  return {
    samples,
    allJs: [...bytesByUrl.entries()]
      .map(([url, bytes]) => ({ url, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
  };
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

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    // Same viewport as the canonical `minipay` Playwright project, so this
    // measurement and the VR are looking at the same device.
    viewport: { width: 390, height: 844 },
  });
  if (persona === "minipay") await emulateMiniPay(context);

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // A warm cache measures the second visit. Every player has a first one.
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  const { samples, allJs } = await measure(page, cdp, url, persona);
  await browser.close();

  const run: Run = {
    label,
    persona,
    url,
    measuredAt: new Date().toISOString(),
    samples,
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

  console.log(`\n${persona} · ${url}`);
  for (const sample of samples) {
    console.log(
      `  ${sample.milestone.padEnd(7)} ${String(sample.atMs).padStart(6)} ms  ` +
        `${(sample.jsEncodedBytes / 1024).toFixed(1).padStart(8)} kB  ` +
        `${String(sample.jsRequests).padStart(3)} js  ` +
        `privy: ${sample.privyUrls.length}`,
    );
  }
  console.log(`\n  → ${outFile}\n`);
}

void main();
