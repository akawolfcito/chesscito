import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PRODUCTION_ORIGIN, publicInputs } from './build-inputs.mjs';

const origin = process.argv[2];
const url = new URL(origin);
assert.equal(url.origin, origin, 'Supply an origin without path or credentials');
assert(!url.username && !url.password);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
assert(local || origin === PRODUCTION_ORIGIN || (process.argv.includes('--candidate') && url.protocol === 'https:'), 'Candidate HTTPS origins require --candidate');
const inputs = publicInputs();
const results = { httpChecks: 0, browser: [], supportContactPresent: false };
let staticAsset;
const headers = {'accept-language':'en', 'cookie':'NEXT_LOCALE=en'};
for (const pathname of ['/', '/es', '/classic', '/pricing', '/stats']) {
  const response = await fetch(origin + pathname, {redirect:'manual', headers});
  assert.equal(response.status, 200, pathname);
  const body = await response.text();
  if (pathname === '/') staticAsset = body.match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1];
  assert.match(body, new RegExp(`<html[^>]*lang="${pathname === '/es' ? 'es' : 'en'}"`), pathname);
  const canonical = body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, PRODUCTION_ORIGIN + (['/pricing','/stats'].includes(pathname) ? pathname : ''), 'Production canonical mismatch');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert(response.headers.get('strict-transport-security')?.includes('max-age=31536000'));
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  if (pathname === '/classic') {
    results.supportContactPresent = body.includes('mailto:');
    const expected = process.argv.find(arg => arg.startsWith('--expect-support='))?.split('=')[1];
    if (expected !== undefined) { assert(['true','false'].includes(expected)); assert.equal(results.supportContactPresent, expected === 'true'); }
  }
  if (pathname === '/stats') assert(body.includes('noindex'));
  results.httpChecks++;
}
assert(staticAsset, 'Missing hashed client asset');
const asset = await fetch(origin + staticAsset, {redirect:'manual'});
assert.equal(asset.status, 200);
assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
assert(asset.headers.get('cache-control')?.includes('immutable'));
results.httpChecks++;
const sitemap = await fetch(origin + '/sitemap.xml', {redirect:'manual'});
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
assert(xml.includes(`<loc>${PRODUCTION_ORIGIN}</loc>`));
assert(!/workers\.dev|vercel\.app|<loc>[^<]*\/stats/.test(xml));
results.httpChecks++;
for (const [mode, target] of [['learn',inputs.NEXT_PUBLIC_LEARN_URL],['play',inputs.NEXT_PUBLIC_PLAY_URL]]) {
  const response = await fetch(`${origin}/api/enter?mode=${mode}`, {redirect:'manual'});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), target + '/');
  results.httpChecks++;
}
for (const pathname of ['/api/revalidate-stats','/api/internal/stats/refresh']) {
  const response = await fetch(origin + pathname, {method:'POST', redirect:'manual'});
  assert.equal(response.status, 401); results.httpChecks++;
}
for (const pathname of ['/_vinext/static-cache/index.json', '/missing-route']) {
  const response = await fetch(origin + pathname, {redirect:'manual'});
  assert.equal(response.status, 404); results.httpChecks++;
}
const browser=await chromium.launch({headless:true, channel:"chrome"});
try {
 for(const locale of ['en','es']) {
  const context=await browser.newContext({viewport:{width:390,height:844},locale});
  const page=await context.newPage(); const errors=[];const failed=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)failed.push({path:new URL(r.url()).pathname,status:r.status()})});
  await page.goto(origin+(locale==='es'?'/es':'/'),{waitUntil:'networkidle'});
  await page.getByText(locale==='es'?'1 de 4':'1 of 4',{exact:true}).waitFor();
  for(let i=0;i<3;i++) await page.locator('.onboarding-advance-cta').click();
  await page.getByText(locale==='es'?'4 de 4':'4 of 4',{exact:true}).waitFor();
  assert.equal(await page.locator('a[href="/api/enter?mode=learn"]').count(),1);
  assert.equal(await page.locator('a[href="/api/enter?mode=play"]').count(),1);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  const imageFailures=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')));
  assert.equal(await page.locator("html").getAttribute("lang"), locale);
  results.browser.push({locale, firstTimeAndNavigation:true, errorCount:errors.length, failedRequestCount:failed.length, imageFailureCount:imageFailures.length});
  await context.addCookies([{name:'chesscito_onboarded',value:'true',url:origin},{name:'chesscito_preferred_mode',value:'learn',url:origin}]);
  await page.reload({waitUntil:'networkidle'});
  await page.getByText(locale==='es'?'4 de 4':'4 of 4',{exact:true}).waitFor();
  await page.getByText(locale==='es'?'Última vez':'Last used',{exact:true}).waitFor();
  results.browser.at(-1).returningVisitor=true;
  const other = locale === "en" ? "es" : "en";
  await page.locator(".onboarding-locale-switch-option").filter({hasText: other.toUpperCase()}).click();
  await page.getByText(other === "es" ? "4 de 4" : "4 of 4", {exact:true}).waitFor();
  results.browser.at(-1).localeSwitch=true;
  await context.close();
 }
} finally {await browser.close();}

assert(results.browser.every(r => !r.errorCount && !r.failedRequestCount && !r.imageFailureCount));
console.log(JSON.stringify({...results, canonicalVerified:true, productDestinationsVerified:true, rawDocumentLanguagesVerified:true, securityHeadersVerified:true}));
