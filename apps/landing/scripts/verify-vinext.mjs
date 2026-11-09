import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { appIsrCacheKey } from 'vinext/internal/server/isr-cache';
import { artifactDigest, sourceDigest, releasePath, outputRoot } from './artifact-provenance.mjs';
import { publicInputDigest, PRODUCTION_ORIGIN, WORKER_NAME } from './build-inputs.mjs';

export function verifyProductionTopology(worker) {
  assert.deepEqual(worker.domains, ['www.chesscito.com'], 'Release requires the verified www Custom Domain');
  assert(!worker.triggers?.some(trigger => trigger.type === 'fetch'), 'Production Custom Domain must not use a fetch route');
}

export async function verifyArtifact({ release = false } = {}) {
  const provenance = JSON.parse(await fs.readFile(releasePath, 'utf8'));
  assert.equal(provenance.schema, 1, 'Missing build provenance');
  assert.equal(provenance.worker, WORKER_NAME, 'Wrong Worker identity');
  assert.equal(provenance.origin, PRODUCTION_ORIGIN, 'Wrong production origin');
  assert.equal(provenance.mode, 'production', 'Wrong artifact mode');
  assert.equal(provenance.sourceDigest, await sourceDigest(), 'Source changed; rebuild');
  assert.equal(provenance.artifactDigest, await artifactDigest(), 'Artifact changed; rebuild');
  assert.equal(provenance.publicInputDigest, publicInputDigest(), 'Public inputs changed; rebuild with release inputs');
  assert(Number.isFinite(Date.parse(provenance.builtAt)), 'Invalid build timestamp');
  assert(/^[a-f0-9]{40}$/.test(provenance.gitRevision), 'Invalid Git provenance');
  const build = JSON.parse(await fs.readFile(`${outputRoot}/config.json`, 'utf8'));
  assert.equal(build.accountId, 'ae2320931263fecf2dac77c445ee28a8', 'Wrong account identity');
  assert.equal(build.buildContext.isPreview, false, 'Unexpected preview artifact');
  assert.equal(build.buildContext.mode, 'production', 'Output is not production');
  const base = `${outputRoot}/workers/default`;
  const worker = JSON.parse(await fs.readFile(`${base}/worker.config.json`, 'utf8'));
  assert.equal(worker.name, WORKER_NAME, 'Wrong generated Worker');
  assert.equal(worker.workersDev, false, 'workers.dev exposure must be disabled');
  assert.equal(worker.previewUrls, false, 'Preview URLs must be disabled');
  assert.equal(worker.compatibilityDate, '2026-10-03');
  assert(worker.compatibilityFlags.includes('nodejs_compat'));
  assert.equal(worker.assets.notFoundHandling, 'none');
  assert.deepEqual(worker.assets.runWorkerFirst, ['/_vinext/static-cache/*'], 'Private cache must execute guard');
  assert(worker.env.ASSETS, 'Missing ASSETS binding');
  for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STATS_REFRESH_SECRET']) assert.equal(worker.env[name]?.type, 'secret', `Missing private declaration: ${name}`);
  await fs.access(path.join(base, 'bundle', worker.manifest.mainModule));
  const manifest = JSON.parse(await fs.readFile('dist/server/vinext-prerender.json', 'utf8'));
  const cache = `${base}/assets/_vinext/static-cache`;
  const index = JSON.parse(await fs.readFile(`${cache}/index.json`, 'utf8'));
  for (const route of ['/en', '/es', '/classic', '/pricing', '/?__vinext_rewrite=%2Fen']) {
    for (const kind of ['html', 'rsc']) {
      const id = createHash('sha256').update(appIsrCacheKey(route, kind, manifest.buildId)).digest('hex');
      assert(index[id], `Missing prerender: ${route} ${kind}`);
      const body = await fs.readFile(`${cache}/${id}.${kind}`, 'utf8');
      if (kind === 'html') {
        assert(body.includes(`<html lang="${route === '/es' ? 'es' : 'en'}"`), `Wrong raw document language: ${route}`);
        assert(body.includes(`rel="canonical" href="${PRODUCTION_ORIGIN}${route === '/pricing' ? '/pricing' : ''}"`), `Wrong canonical: ${route}`);
        if (route === '/classic') assert.equal(body.includes('mailto:'), provenance.supportContactConfigured, 'Support input did not reach prerender');
      }
    }
  }
  // Match the externally verified attachment exactly before release.
  if (release) verifyProductionTopology(worker);
  console.log(JSON.stringify({ artifactVerified: true, productionMode: true, rawLocaleHtmlVerified: true, supportContactPresent: provenance.supportContactConfigured, domainTopologyEncoded: worker.domains?.length === 1 && worker.domains[0] === 'www.chesscito.com' }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try { await verifyArtifact({ release: process.argv.includes('--release') }); }
  catch { console.error('Artifact validation failed. Check source/config/public inputs and rebuild; release requires the verified www Custom Domain with no fetch route.'); process.exitCode = 1; }
}
