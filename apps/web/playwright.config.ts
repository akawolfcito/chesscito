import { defineConfig, devices } from "@playwright/test";

// 3002, not 3000. `/api/pro/status` only accepts an allow-listed origin, and a
// host outside it makes <ProOriginWarning> paint a fixed amber banner (z-100)
// over the top of every real page in dev — which is exactly what the VR
// screenshots capture. Defaulting to 3000 silently reddened every page-level
// baseline. Measured 2026-08-06: support-page and terms-page fail on 3000 and
// pass on 3002, with no code change in between.
const BASE_URL = process.env.BASE_URL || "http://localhost:3002";

// The dev server must listen on whatever BASE_URL points at, or Playwright waits
// for a URL nobody is serving. Deriving it keeps the two in sync when BASE_URL
// is overridden.
const BASE_URL_PORT = new URL(BASE_URL).port || "3002";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e-results/artifacts",
  // Refuse to start when the disk is nearly full, instead of dying mid-suite and
  // leaving videos and traces behind — which is what makes the NEXT run likelier
  // to die. Measures and aborts; never deletes. Floor: DISK_MIN_FREE_GB (10).
  globalSetup: "./scripts/preflight-disk.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e-results/report", open: "never" }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "minipay",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      // MiniPay store-required minimum viewport per
      // docs/reviews/2026-06-03-viewport-360x640-audit.md.
      // Additional coverage — `minipay` (390 × 844) stays canonical for VR.
      name: "minipay-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 640 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "iphone-safari",
      use: { ...devices["iPhone 15 Pro Max"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Serve the catalog uncached under E2E: the merged-catalog `unstable_cache`
    // "content" entry only revalidates on write, so a persisted `.next/cache`
    // from a prior run would otherwise serve stale boards after a catalog
    // regen. Prod never sets this — caching strategy there is untouched.
    // NEXT_PUBLIC_CHAIN_ID is pinned, not inherited. Shell exports WIN over
    // `.env*` in Next, so a developer with `NEXT_PUBLIC_CHAIN_ID=11142220`
    // (Celo Sepolia) exported in their profile silently reconfigured the app
    // under test: `getConfiguredChainId()` returned Sepolia while wagmi —
    // whose config is hardcoded `chains: [celo, celoSepolia]` — reported
    // mainnet 42220 for a disconnected visitor. The two can never agree, so
    // `getShopAddress()` returned null, the catalog read was never enabled,
    // and every buy pill stayed on "Coming soon". That is the whole story of
    // the long-red `hub-shop-sheet-open` baseline (diagnosed 2026-08-06):
    // the same commit went green or red depending on the operator's shell.
    // Must stay 42220 to match wagmi's `chains[0]`.
    // The PRO origin URLs are pinned for the SAME reason, one incident later
    // (2026-08-11). `ProOriginWarning` compares `window.location.origin` against
    // `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_PREVIEW_URL`, and a developer testing
    // on a phone points those at a tunnel host
    // (`…-fwd-maybe.trycloudflare.com`). Under test the app then runs on
    // localhost:3002, does not recognise itself, and paints a fixed amber
    // "DEV: PRO origin mismatch" banner across the TOP OF EVERY PAGE.
    //
    // That banner is what turned EIGHT baselines red at once — hub-clean,
    // hub-shop-sheet-open, hub-daily-tactic-open and the four legal/marketing
    // pages — none of which had a code regression. The reds tracked whoever
    // last ran a tunnel, exactly like the CHAIN_ID story above, and they are
    // the reason `CLAUDE.md`'s "66/66 green" claim stopped being true.
    //
    // Must equal the URL Playwright actually serves, or the banner comes back.
    env: {
      CONTENT_CACHE_DISABLED: "1",
      PORT: BASE_URL_PORT,
      NEXT_PUBLIC_CHAIN_ID: "42220",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXT_PUBLIC_PREVIEW_URL: BASE_URL,
    },
  },
});
