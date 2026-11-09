import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "ae2320931263fecf2dac77c445ee28a8",
  worker: defineWorker({
    name: "chesscito-www-vinext-poc",
    entrypoint: "vinext/server/fetch-handler",
    workersDev: false,
    previewUrls: false,
    // Preserve intentionally enabled production Workers logs.
    observability: { logs: { enabled: true } },
    // Verified production Worker Custom Domain; this is not a fetch route.
    domains: ["www.chesscito.com"],
    compatibilityDate: "2026-10-03",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none", runWorkerFirst: ["/_vinext/static-cache/*"] },
    env: {
      ASSETS: bindings.assets(),
      // Endpoint strings are kept private too; secret() avoids publishing values.
      UPSTASH_REDIS_REST_URL: bindings.secret(),
      UPSTASH_REDIS_REST_TOKEN: bindings.secret(),
      SUPABASE_URL: bindings.secret(),
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
      STATS_REFRESH_SECRET: bindings.secret(),
    },
  }),
});
