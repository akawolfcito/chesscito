import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ provenance: {} }));
vi.mock('node:fs/promises', () => ({ default: { readFile: vi.fn(async () => JSON.stringify(mocks.provenance)) } }));
vi.mock('../artifact-provenance.mjs', () => ({ sourceDigest: async () => 'current-source', artifactDigest: async () => 'current-output', releasePath: '.vinext/release.json', outputRoot: '.cloudflare/output/v0' }));
import { verifyArtifact, verifyProductionTopology } from '../verify-vinext.mjs';
import { publicInputDigest } from '../build-inputs.mjs';

function validHeader() {
  return { schema: 1, worker: 'chesscito-www-vinext-poc', origin: 'https://www.chesscito.com', mode: 'production', sourceDigest: 'current-source', artifactDigest: 'current-output', publicInputDigest: publicInputDigest() };
}
describe('prebuilt upload rejection', () => {
  it.each([
    ['worker', 'other-worker', 'Wrong Worker identity'],
    ['origin', 'https://candidate.workers.dev', 'Wrong production origin'],
    ['mode', 'preview', 'Wrong artifact mode'],
    ['sourceDigest', 'old-source', 'Source changed'],
    ['artifactDigest', 'modified-output', 'Artifact changed'],
    ['publicInputDigest', 'old-public-inputs', 'Public inputs changed'],
  ])('rejects mismatched %s before reading a deployable bundle', async (key, value, message) => {
    mocks.provenance = { ...validHeader(), [key]: value };
    await expect(verifyArtifact()).rejects.toThrow(message);
  });
});

describe('verified production Custom Domain', () => {
  it('accepts the exact www Custom Domain', () => {
    expect(() => verifyProductionTopology({ domains: ['www.chesscito.com'] })).not.toThrow();
  });
  it.each([
    {},
    { triggers: [{ type: 'fetch', pattern: 'www.chesscito.com/*' }] },
    { domains: ['chesscito.com'] },
    { domains: ['www.chesscito.com', 'candidate.example.com'] },
    { domains: ['www.chesscito.com'], triggers: [{ type: 'fetch', pattern: 'www.chesscito.com/*' }] },
  ])('rejects missing, changed or route-based attachment: %j', worker => {
    expect(() => verifyProductionTopology(worker)).toThrow();
  });
});
