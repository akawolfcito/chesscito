#!/usr/bin/env node
// One-shot Playwright capture of the polished victory popup flow.
// Outputs PNGs into docs/ux-reviews/2026-05-27-victory-popup-flow/.
//
// Usage:  node scripts/capture-victory-popup-flow.mjs
// Assumes dev server running on http://localhost:3002.

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(
  ROOT,
  "docs/ux-reviews/2026-05-27-victory-popup-flow",
);
const BASE = process.env.BASE_URL || "http://localhost:3002";

const VARIANTS = [
  { slug: "resigned", note: "loss popup reference" },
  { slug: "win-celebration", note: "polished — primary flow" },
  { slug: "win-claiming", note: "TX in flight" },
  { slug: "win-success", note: "saved!" },
  { slug: "win-error", note: "TX failed" },
  { slug: "win-cancelled", note: "user cancelled TX" },
  { slug: "win-timeout", note: "TX timeout" },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  for (const { slug, note } of VARIANTS) {
    const page = await ctx.newPage();
    const url = `${BASE}/dev/arena-end-state?variant=${slug}`;
    process.stdout.write(`→ ${slug.padEnd(20)} (${note}) ... `);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(800);
      const file = path.join(OUT_DIR, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log("ok");
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
    await page.close();
  }

  await ctx.close();
  await browser.close();
  console.log(`\nScreenshots saved to: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
