/**
 * db-backed-content — read-path rollout flag (Phase 2c, 2026-06-17).
 *
 * Default OFF so the player read path stays byte-identical to the compiled
 * baseline: with the flag off the `/exercises` server boundary mounts NO
 * `ExerciseCatalogProvider`, so every consumer falls through to the baseline
 * `EXERCISES` default and never touches the DB.
 *
 * Turn on per environment with `CONTENT_OVERLAY_ENABLED=true`. Server-only on
 * purpose (NOT `NEXT_PUBLIC_`): only the server component decides whether to
 * call `getMergedCatalog()` and mount the provider; the client just consumes
 * whatever pools it is handed. Single constant on purpose — easy to delete at
 * cluster close once the overlay is the default. Do NOT build a flag framework
 * around this.
 */
export const CONTENT_OVERLAY_ENABLED =
  process.env.CONTENT_OVERLAY_ENABLED === "true";
