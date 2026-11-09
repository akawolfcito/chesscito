import { spawnSync, execFileSync } from 'node:child_process';
import { verifyArtifact } from './verify-vinext.mjs';

if (!process.argv.includes('--execute')) {
  console.error('No deployment performed. Validate with verify:vinext; an authorized operator must explicitly pass --execute.');
  process.exit(1);
}
try {
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Uncommitted source');
  await verifyArtifact({ release: true });
} catch {
  console.error('Deployment blocked: clean checkout, matching fresh artifact/public inputs and verified www attachment are required.');
  process.exit(1);
}
// Authentication is only inherited here, never by build/prerender.
const result = spawnSync('cf', ['deploy', '--prebuilt', '--mode', 'production'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
