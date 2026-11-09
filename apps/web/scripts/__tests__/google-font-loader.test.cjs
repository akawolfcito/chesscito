// Run with: node --test apps/web/scripts/__tests__/google-font-loader.test.cjs
// Exercises the installed Next loader, including its production-only failure path.
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const googleDir = 'next/dist/compiled/@next/font/dist/google/';
const { findFontFilesInCss } = require(googleDir + 'find-font-files-in-css');
const css = (url, format = 'woff2') => `/* latin */
@font-face {
  font-family: 'Fredoka';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${url})${format ? ` format('${format}')` : ''};
}`;

for (const [name, url, format, expected] of [
  ['ordinary URL', 'https://fonts.gstatic.com/s/test.woff2', 'woff2', 'woff2'],
  ['extensionless kit', 'https://fonts.gstatic.com/l/font?kit=test&skey=test&v=v1', 'woff2', 'woff2'],
  ['query and fragment', 'https://fonts.gstatic.com/s/test.woff?version=1#font', 'woff2', 'woff'],
  ['TrueType hint', 'https://fonts.gstatic.com/l/font?kit=ttf', 'truetype', 'ttf'],
  ['OpenType hint', 'https://fonts.gstatic.com/l/font?kit=otf', 'opentype', 'otf'],
  ['WOFF hint', 'https://fonts.gstatic.com/l/font?kit=woff', 'woff', 'woff'],
  ['EOT hint', 'https://fonts.gstatic.com/l/font?kit=eot', 'embedded-opentype', 'eot'],
  ['Chrome WOFF2 default', 'https://fonts.gstatic.com/l/font?kit=no-format', '', 'woff2'],
]) {
  test(`production loader: ${name}`, async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chesscito-font-test-'));
    const mockPath = path.join(dir, 'responses.cjs');
    const declarations = css(url, format);
    writeFileSync(mockPath, `module.exports = ${JSON.stringify({
      'https://fonts.googleapis.com/css2?family=Fredoka:wght@400&display=swap': declarations,
    })};`);
    const previous = process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
    process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = mockPath;
    const loaderPath = require.resolve(googleDir + 'loader');
    delete require.cache[loaderPath];
    const emitted = [];
    try {
      const result = await require(loaderPath).default({
        functionName: 'Fredoka',
        data: [{ subsets: ['latin'], weight: ['400'], variable: '--font-fredoka', display: 'swap' }],
        isDev: false,
        isServer: true,
        emitFontFile(buffer, ext, preload, sizeAdjust) {
          emitted.push({ buffer, ext, preload, sizeAdjust });
          return `/_next/static/media/test.${ext}`;
        },
      });
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].ext, expected);
      assert.equal(emitted[0].preload, true);
      assert.equal(emitted[0].sizeAdjust, true);
      // Next's documented mock mode returns URL bytes; this test proves loader
      // handling, not font binary validity or visual rendering.
      assert.equal(emitted[0].buffer.toString(), url);
      assert.equal(result.css, declarations.replace(url, `/_next/static/media/test.${expected}`));
      assert.equal(result.variable, '--font-fredoka');
      assert.equal(result.weight, '400');
      assert.ok(result.adjustFontFallback);
    } finally {
      if (previous === undefined) delete process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
      else process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = previous;
      delete require.cache[mockPath];
      delete require.cache[loaderPath];
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('deduplicates URLs and only preloads the selected subset', () => {
  const url = 'https://fonts.gstatic.com/l/font?kit=shared';
  const files = findFontFilesInCss(`${css(url)}\n${css(url)}\n${css(url + 'ext').replace('/* latin */', '/* latin-ext */')}`, ['latin']);
  assert.equal(files.length, 2);
  assert.equal(files[0].preloadFontFile, true);
  assert.equal(files[1].preloadFontFile, false);
});
