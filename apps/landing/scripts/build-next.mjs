import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { buildEnvironment } from './build-inputs.mjs';
import { normalizeFrameworkEnv } from './framework-env.mjs';

// Retained Vercel rollback build uses the same public contract, no runtime secrets.
const env = buildEnvironment();
await normalizeFrameworkEnv();
for (const directory of ['.', '../..']) {
  if ((await fs.readdir(directory)).some(name => /^\.env(?:$|\.(?!template$|example$))/.test(name))) throw new Error('Rollback build requires a clean checkout without local dotenv files');
}
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { env, stdio: 'inherit' });
// Next owns/regenerates this file; keep generated route imports out of Git.
await normalizeFrameworkEnv();
process.exit(result.status ?? 1);
