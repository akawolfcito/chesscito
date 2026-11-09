/**
 * Dev surface gating — the ONE place that answers "is this tool alive here?".
 *
 * The rule (founder, 2026-07-17): `/dev/*` and `/api/dev/*` live in local AND
 * preview, and NEVER in production.
 *
 * ⚠️ Gate on VERCEL_ENV, NOT NODE_ENV. A Vercel PREVIEW build runs with
 * NODE_ENV="production", so a NODE_ENV gate 404s the tooling exactly where the
 * founder wants it. That mismatch already shipped, in both directions: the pages
 * gated on NODE_ENV (dead in preview) while `/api/dev/publish` gated on
 * VERCEL_ENV (alive in preview) — the endpoint that WRITES outlived the UI that
 * drives it.
 *
 * Spec: docs/specs/2026-07-17-builder-kind-aware.md §Regla de entornos.
 */

/** True where a dev tool may render/respond. Production is the only "no". */
export function isDevSurfaceEnabled(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/**
 * True where the builder's Save can actually write `content/*.json`.
 *
 * ⚠️ A SECOND axis, narrower than isDevSurfaceEnabled(). `baseline-write.ts`
 * writes the working tree with writeFileSync(process.cwd()), and Vercel's
 * deployment filesystem is READ-ONLY — so Save is LOCAL-ONLY. Preview renders
 * the builder and validates a draft, and must say why Save is off rather than
 * throw a 500 from the fs.
 */
export function canWriteBaseline(): boolean {
  return !process.env.VERCEL;
}
