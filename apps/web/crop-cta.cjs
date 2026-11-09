const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('chesscito:first-visit', 'false'); } catch {}
  });
  await page.goto('http://localhost:3000/hub', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const btn = page.locator('button.hub-scaffold-arena-cta').first();
  const count = await page.locator('button.hub-scaffold-arena-cta').count();
  console.log('btn count:', count);
  const box = await btn.boundingBox();
  console.log('btn bbox:', JSON.stringify(box));
  if (box) {
    await page.screenshot({
      path: '/tmp/arena-cta-crop.png',
      clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 },
    });
  }
  await browser.close();
})();
