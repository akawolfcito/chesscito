import fs from 'node:fs/promises';
import path from 'node:path';

const forbidden = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL', 'UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REDIS_REST_URL', 'STATS_REFRESH_SECRET', 'CLOUDFLARE_API_TOKEN', 'CHESSCITO_SYNTHETIC_RUNTIME_ONLY'];
let files = 0;
async function scan(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|html|rsc|json|css|txt|xml)$/.test(entry.name)) {
      const text = await fs.readFile(file, 'utf8'); files++;
      if (forbidden.some(name => text.includes(name))) throw new Error('Server-only marker found in public output (contents withheld)');
    }
  }
}
await scan('.cloudflare/output/v0/workers/default/assets');
if (!files) throw new Error('No public output to scan');
console.log(JSON.stringify({ publicFilesScanned: files, serverOnlyMarkersAbsent: true }));
