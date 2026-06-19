# Chesscito Lite Mode — Phase 1 Design Spec

**Date:** 2026-06-19  
**Branch:** `feature/chesscito-lite-mode`  
**Approach approved:** Option A — Middleware-first + central helper

---

## 1. Context

Two Vercel projects share the same monorepo:

| Project | Env var | Experience |
|---|---|---|
| Full | `NEXT_PUBLIC_CHESSCITO_LITE_MODE=false` | Complete experience (Arena, Shop, PRO, Coach, Victory NFT) |
| Lite | `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true` | Reduced MiniPay-first: Train, Progress, Stats, Save Score |

`NEXT_PUBLIC_*` vars are baked at build time — each project compiles its own bundle. The flag is a build-time constant, not a runtime toggle.

---

## 2. Helper central

**File:** `src/lib/feature-flags.ts` (exists, currently empty `export {}`)

```ts
export const CHESSCITO_LITE_MODE =
  process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true";
```

Single source of truth. All other files import from here.

---

## 3. Route classification

### Full-only routes (redirect → `/hub` in Lite)

These are actual Next.js routes that exist today:

| Route | Reason |
|---|---|
| `/arena` | Chess AI match — Full-only |
| `/coach` (and `/coach/*`) | AI Coach review — Full-only |
| `/victory` (and `/victory/*`) | Victory NFT claim/view — Full-only |

These don't exist as routes today but are guarded proactively (noop until created):

| Path | Rationale |
|---|---|
| `/shop` | Shop could become a route; guard now is cheap |
| `/pro` | Same |
| `/founder` | Same |

### Lite-safe routes (no change)

`/`, `/hub`, `/exercises`, `/stats`, `/trophies`, `/share/*`, `/about`, `/why`, `/privacy`, `/terms`, `/support`

**Trophies decision:** `/trophies` shows match victories from DB. Founder content is already hidden (comment `founder 2026-06-16: show what exists, don't promise`). No Shop/PRO sheets mounted. Lite-compatible — no redirect needed.

---

## 4. Middleware redirect (locale-aware)

**File:** `src/middleware.ts`

The middleware must be locale-aware. Routes can arrive as:
- `/arena` (default locale, no prefix)
- `/en/arena` (explicit EN prefix)
- `/es/arena` (ES locale)

The redirect must preserve the locale prefix:
- `/arena` → `/hub`
- `/en/arena` → `/en/hub`
- `/es/arena` → `/es/hub`

**Algorithm:**

```
const FULL_ONLY_SEGMENTS = ["arena", "coach", "victory", "shop", "pro", "founder"]
const KNOWN_LOCALES = ["en", "es"]

function isFullOnlyPath(pathname: string): boolean {
  // Strip optional leading locale prefix: /en/arena → /arena, /es/coach → /coach
  let stripped = pathname
  for (const locale of KNOWN_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      stripped = pathname.slice(locale.length + 1) || "/"
      break
    }
  }
  // Match /arena or /arena/anything
  return FULL_ONLY_SEGMENTS.some(
    (seg) => stripped === `/${seg}` || stripped.startsWith(`/${seg}/`)
  )
}

function liteRedirectTarget(pathname: string, baseUrl: string): URL {
  // Detect locale prefix
  let prefix = ""
  for (const locale of KNOWN_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      prefix = `/${locale}`
      break
    }
  }
  return new URL(`${prefix}/hub`, baseUrl)
}
```

The Lite block runs **before** `intlMiddleware(request)` and **after** the ES_READY redirect block (existing logic unchanged).

---

## 5. Hub scaffold gates

**File:** `src/components/hub/hub-scaffold-client.tsx`

When `CHESSCITO_LITE_MODE === true`:

| Element | Action |
|---|---|
| `<ProSheet>` | Not rendered (JSX conditional) |
| `<ShopSheet>` | Not rendered |
| `<PurchaseConfirmSheet>` | Not rendered |
| `<BadgeSheet>` | Not rendered |
| `onArenaPress` | Replaced with no-op (no navigation to `/arena`) |
| `onProTap` / `onProTilePress` / `onPremiumTap` | No-op (no sheet open) |
| `onShieldsTap` | No-op |
| `onCoachTap` | No-op |
| PRO/Shop telemetry events | Suppressed (no `track("monetization.*")`) |

The hooks (`useProSheetState`, `useShopSheetState`, `useBadgeSheetState`) continue to run — removing them would require larger refactors and could break sibling logic. Only the rendered JSX and tap handlers are gated.

**`initialSheet` handling in Lite:** `shop`, `pro`, `badges` deep-links are silently ignored (no sheet open, no redirect). `trophies` and `profile` deep-links remain functional.

---

## 6. `.env.template` update

Add one line with default `false` and a comment:

```
# Lite Mode — set to true in the Lite Vercel project for a reduced MiniPay-first experience.
# Full project must explicitly set this to false.
NEXT_PUBLIC_CHESSCITO_LITE_MODE=false
```

---

## 7. What Phase 1 does NOT do

- No bundle optimization / tree-shaking of Full-only imports
- No dynamic import split per mode
- No changes to payment rail, Supabase, contracts, Redis, salts, admin tokens
- No deletion of Full-only features
- No new routes or pages
- No changes to `/exercises`, `/stats`, `/share/*`, `/trophies`
- No changes to API routes

Bundle/performance optimization is deferred to Phase 2.

---

## 8. Validation criteria

| Check | How |
|---|---|
| Build passes (both modes) | `pnpm exec tsc --noEmit` + `pnpm build` |
| Typecheck clean | `pnpm exec tsc --noEmit` |
| Full (env=false) behavior unchanged | Manual smoke: Arena, Coach, Shop all reachable |
| Lite (env=true) `/arena` → `/hub` | `curl -I localhost:3000/arena` sees 307 → `/hub` |
| Lite `/es/arena` → `/es/hub` | `curl -I localhost:3000/es/arena` sees 307 → `/es/hub` |
| Lite hub: no ProSheet, no ShopSheet | Visual smoke at 390px |
| No payment rail breakage | Existing payment flow unaffected (not touched) |
| No training flow breakage | `/exercises` works identically in both modes |

---

## 9. Files affected

| File | Change |
|---|---|
| `src/lib/feature-flags.ts` | Add `CHESSCITO_LITE_MODE` export |
| `src/middleware.ts` | Add Lite redirect block (locale-aware) |
| `src/components/hub/hub-scaffold-client.tsx` | Gate sheets and CTAs |
| `apps/web/.env.template` | Document new var |

**Files NOT touched:** all other routes, API handlers, lib modules, contracts, payment logic, Supabase migrations.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Middleware locale detection diverges from `next-intl` routing | Use the same `KNOWN_LOCALES` array derived from `routing.locales` (imported from `@/i18n/routing`) to stay in sync |
| `onTrophyTap` in hub navigates to `/trophies` — safe in Lite | `/trophies` is Lite-safe; this tap can remain unchanged |
| `initialSheet=trophies` deep-link still navigates to `/trophies` | Safe — `/trophies` is Lite-safe |
| Hub `onCoachTap` with `pro.active` navigates to `/coach/history` | Gated to no-op in Lite (coach is Full-only) |
| Accidental Full deploy with `LITE_MODE=true` | `.env.template` default `=false` + Vercel project env must be explicit |
| `/share/*` cards link to `/victory/*` URLs — Lite user follows link → gets redirected | Accepted for Phase 1; share cards are external links, not in-app navigation |
