// Internal build process, launched with sanitized inputs by build-vinext.mjs.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { appIsrCacheKey } from "vinext/internal/server/isr-cache";
import path from "node:path";
import { createBuilder } from "vite";
import { VINEXT_BUILD_LIFECYCLE_CONFIG } from "vinext/internal/build/lifecycle";
import { runPrerender } from "vinext/internal/build/run-prerender";
import { finalizeCacheAdapterPrerenderOutput } from "vinext/internal/config/prerender";
import { resolvePrerenderOutputDirs } from "@vinext/cloudflare/internal/deploy";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";

const root = process.cwd();
const builder = await createBuilder({ mode: "production", [VINEXT_BUILD_LIFECYCLE_CONFIG]: {} });
await builder.buildApp();
const output = resolvePrerenderOutputDirs(root, "cf", null);
process.env.CHESSCITO_STATIC_PRERENDER = "1";
try {
  const result = await runPrerender({ root, routeRootConfig: output });
  for (const path of ["/en", "/es", "/classic", "/pricing"]) {
    if (!result?.routes.some((route) => (route.path ?? route.route) === path && route.status === "rendered")) {
      throw new Error(`Missing static output for ${path}`);
    }
  }
} finally {
  delete process.env.CHESSCITO_STATIC_PRERENDER;
}
// Do not publish OS metadata copied from public/.
async function removeOsMetadata(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await removeOsMetadata(file);
    else if (entry.name === ".DS_Store") await fs.unlink(file);
  }
}
await removeOsMetadata(output.clientOutDir);
await finalizeCacheAdapterPrerenderOutput({ cdn: staticAssetsAdapter() }, root, { clientOutDir: output.clientOutDir });

// vinext partitions rewritten responses by both the source and destination.
// The English as-needed rewrite therefore needs this precise cache alias.
const manifest = JSON.parse(await fs.readFile(path.join(root, "dist/server/vinext-prerender.json"), "utf8"));
const cacheDirectory = path.join(output.clientOutDir, "_vinext/static-cache");
const indexPath = path.join(cacheDirectory, "index.json");
const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
const id = (pathname, kind) => createHash("sha256").update(appIsrCacheKey(pathname, kind, manifest.buildId)).digest("hex");
for (const kind of ["html", "rsc"]) {
  const source = id("/en", kind);
  const destination = id("/?__vinext_rewrite=%2Fen", kind);
  if (!index[source]) throw new Error(`Missing English ${kind} cache entry`);
  index[destination] = index[source];
  await fs.copyFile(path.join(cacheDirectory, `${source}.${kind}`), path.join(cacheDirectory, `${destination}.${kind}`));
}
await fs.writeFile(indexPath, JSON.stringify(index));
