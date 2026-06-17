# Backlog — Isolate /dev tools into a separate app (apps/tech)

**Date**: 2026-06-17
**Status**: backlog (needs spec) — NOT zero-risk, do not do ad-hoc

## Motivation
The `/dev/*` surfaces (board-procedural, board-calibration, labyrinth-builder,
coach-viewer, arena-end-state, … ~18 pages + `/api/dev/*`) are developer tools
that should never reach players. They must stay out of the production chesscito
app, ideally out of its bundle entirely.

## Current protection (already in place — sufficient for now)
Every `/dev` page guards with `if (process.env.NODE_ENV === "production")
notFound()`. On Vercel, `NODE_ENV === "production"` in BOTH preview and prod
builds, so these routes **404 everywhere on Vercel** and only render under local
`next dev`. The dev API (`/api/dev/labyrinth`) has the same guard. So they do not
"see the light of day" in prod today — they are local-dev-only.

Caveats of the runtime guard:
- The page/route code is still **compiled into the prod bundle** (just
  unreachable). Tiny size cost; a leaked guard (e.g. someone using `VERCEL_ENV`
  loosely) would expose it. Two pages (`button-gallery`, `reset`) currently have
  NO guard — audit them as part of this.

## Proposed (this backlog item)
Move `/dev/*` + `/api/dev/*` into a **separate Turborepo app** (`apps/tech`),
deployed to its own (auth-gated / non-public) Vercel project, so they are
physically absent from the chesscito player bundle.

### Why it's NOT zero-risk (why it needs a spec, not an ad-hoc move)
- Shared imports: dev pages import from `@/lib/game/*`, `@/components/*`,
  `@/lib/content/*`. A new app needs the same path aliases + access to those
  modules (extract to a shared package, or alias into `apps/web/src`). Getting
  the module graph wrong breaks the build.
- Assets: dev assets (`public/dev/tablero/*`) move with them; verify references.
- Tooling: tsconfig paths, tailwind config, eslint, Vitest projects all need the
  new app wired into Turborepo + CI.
- Deploy: a second Vercel project + env vars + an auth gate (these tools write
  via `/api/dev/labyrinth`).

### Acceptance (when speced)
- [ ] `apps/tech` builds and serves all current `/dev` pages + `/api/dev`.
- [ ] chesscito (`apps/web`) prod bundle contains ZERO `/dev` route code.
- [ ] `apps/tech` is auth-gated (not publicly reachable).
- [ ] Full suite green; no regressions in `apps/web`.
- [ ] Audit + fix the unguarded `button-gallery` / `reset` pages.

## Decision for now
Keep the `NODE_ENV` guard (already prod-safe). Do the `apps/tech` split as a
dedicated speced task when there's capacity.
