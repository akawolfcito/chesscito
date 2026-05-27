#!/usr/bin/env node
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
}).then(c => c.newPage());

await page.goto("http://localhost:3002/dev/arena-end-state?variant=win-celebration", {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(2000);

// Find scrim + popup container
const scrim = await page.locator('[role="alert"], [role="dialog"]').first();
const box1 = await scrim.boundingBox();
console.log("scrim bbox:", box1);

const inner = await scrim.locator('> div').first();
const box2 = await inner.boundingBox();
console.log("inner bbox:", box2);

const html = await inner.evaluate(el => el.outerHTML.slice(0, 200));
console.log("inner HTML start:", html);

// Take a full-page screenshot for debugging
await page.screenshot({
  path: "/tmp/debug-fullpage.png",
  fullPage: false,
});

await browser.close();
