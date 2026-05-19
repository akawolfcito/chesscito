const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('chesscito:first-visit', 'false'); } catch {}
    try { localStorage.setItem('chesscito:onboarding-complete', 'true'); } catch {}
  });
  await page.goto('http://localhost:3000/hub', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/hub-full-current.png', fullPage: true });
  const btn = page.locator('.hub-scaffold-arena-cta').first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box = await btn.boundingBox();
  console.log('btn bbox:', JSON.stringify(box));
  if (box) {
    await page.screenshot({
      path: '/tmp/arena-cta-current.png',
      clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24 },
    });
  }
  await browser.close();
  console.log('captured');
})();
