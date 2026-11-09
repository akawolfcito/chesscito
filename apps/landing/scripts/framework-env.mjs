import fs from 'node:fs/promises';

// Both frameworks rewrite this file. Keep their generated route imports out
// of the tracked source, while preserving Vinext augmentation separately.
export async function normalizeFrameworkEnv() {
  await fs.writeFile('next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// Framework-owned file. Vinext additions live in vinext-env.d.ts.\n');
}
