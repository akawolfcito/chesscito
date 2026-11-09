import fs from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import { buildEnvironment, publicInputDigest, PRODUCTION_ORIGIN, WORKER_NAME } from './build-inputs.mjs';
import { artifactDigest, sourceDigest, releasePath } from './artifact-provenance.mjs';
import { normalizeFrameworkEnv } from './framework-env.mjs';

await normalizeFrameworkEnv();
const sourceBeforeBuild = await sourceDigest();
const env = buildEnvironment(); // Validate before output changes or loading Vite.
// Restrict deletion to this app's generated build directories.
for (const directory of ['dist', '.cloudflare/output', '.vinext']) await fs.rm(directory, { recursive: true, force: true });
const result = spawnSync(process.execPath, ['scripts/build-vinext-worker.mjs'], { env, stdio: 'inherit' });
await normalizeFrameworkEnv();
if (result.status !== 0) process.exit(result.status ?? 1);
if (await sourceDigest() !== sourceBeforeBuild) throw new Error('Source changed during build; rerun from a stable checkout');
await fs.mkdir('.vinext', { recursive: true });
await fs.writeFile(releasePath, JSON.stringify({
  schema: 1, worker: WORKER_NAME, origin: PRODUCTION_ORIGIN, mode: 'production',
  gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDigest: sourceBeforeBuild, artifactDigest: await artifactDigest(),
  publicInputDigest: publicInputDigest(), supportContactConfigured: Boolean(env.NEXT_PUBLIC_SUPPORT_EMAIL),
  builtAt: new Date().toISOString(),
}, null, 2));
const check = spawnSync(process.execPath, ['scripts/verify-vinext.mjs'], { env, stdio: 'inherit' });
process.exit(check.status ?? 1);
