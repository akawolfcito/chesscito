import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const outputRoot = '.cloudflare/output/v0';
export const releasePath = '.vinext/release.json';

export async function sourceDigest() {
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps/landing', 'pnpm-lock.yaml', 'package.json', 'pnpm-workspace.yaml', 'tsconfig.json'], { cwd: '../..', encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const name of names) {
    // Deleted tracked files are represented explicitly until committed.
    let data;
    try { data = await fs.readFile(path.join('../..', name)); } catch (error) { if (error.code !== 'ENOENT') throw error; data = Buffer.from('[deleted]'); }
    hash.update(name).update('\0').update(data).update('\0');
  }
  return hash.digest('hex');
}

export async function artifactDigest(directory = outputRoot) {
  const hash = createHash('sha256');
  async function visit(dir) {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) hash.update(path.relative(directory, file)).update('\0').update(await fs.readFile(file)).update('\0');
      else throw new Error('Unexpected link in deployment output');
    }
  }
  await visit(directory);
  return hash.digest('hex');
}
