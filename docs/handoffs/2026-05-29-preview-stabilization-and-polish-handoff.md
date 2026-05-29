# Preview Stabilization + UX Polish + OG Rendering — Handoff

**Date:** 2026-05-29
**Branch:** main
**Range:** `823a6f55..3bd071eb` (17 commits)
**Status:** Closed. Preview smoke green, production deploy intentionally deferred.

## What shipped

Three sub-clusters landed together in one session, driven by a single user goal: validate the previous coach-polish cluster on a real MiniPay device via a dedicated Vercel preview alias, fix every issue that surfaced, and stop the bleeding before next surface work.

### Sub-cluster 1 — Preview environment + 3 broken-flow bug fixes

Vercel preview separated from production (`preview.chesscito.com` alias, manual prod promotion).

- `772e1e56` — hoisted 4 `useCallback` hooks above early returns in `coach-game-client.tsx` so the build passes Rules of Hooks (prereq for Bug 1 fix).
- `d29e0912` — `enforceOrigin` allowlist extended with `NEXT_PUBLIC_PREVIEW_URL` + `VERCEL_BRANCH_URL`. Fixed uniform 403 on `/api/pro/status`, `/api/shields/me`, `/api/games` from the preview alias.
- `5ddb75a3` — cleared all ESLint warnings (aria-hidden on `<picture>`, hook deps, unused vars).
- `09a02878` — **Bug 1.** `/coach/[gameId]` SSR replaced internal HTTP fetch to `/api/games/[id]` with direct `getGameRecord(redis, wallet, id)` Redis read. Vercel Deployment Protection was returning the login HTML to SSR, the route saw 401 and rendered the empty-state. Direct Redis bypasses the auth wall entirely. New helper lives in `lib/coach/game-persistence.ts`.
- `b96d1fe3` — **Bug 2.** Play Again loop. `resetArenaState` called `coach.abort()` but left `coach.phase` non-idle, so the early return in `arena/page.tsx:1095` kept rendering `CoachPanel` on the post-popup view. Added `coach.setPhase("idle")` to the reset.
- `b57a1309` — **Bug 3.** Coach viewer error fallback used `router.back()` which looped to the same `/coach/[gameId]` URL. When `!gameRecord`, force `router.push("/hub")`. Plus arena telemetry: `arena_mount`, `arena_fresh_reset_fired`, `arena_x_close_fired`, `arena_pending_nav_consumed`.

### Sub-cluster 2 — UX polish (5 items from preview smoke)

- `fdcf6a47` — **#7.** Removed duplicate `coachPreview` slot from `VictoryClaimSuccess` (post-mint state showed REVIEW twice).
- `82454bb8` — **#5+#6 + B1.** Consolidated `VictoryClaimError` to single-line H1 + body for `kind="error"`. Mapped "No token with sufficient balance" to friendly `errorInsufficientBalance: "Add some USD stablecoin to save your victory."` Replaced contradictory "Your game result is saved" with "Your progress is safe. Tap try again any time."
- `b76e635f` + `b15b499a` — **#4.** Wrapped `ShareGrid` in cream candy-panel; v1 had `rgba(0.55)` opacity which let forest green bleed; v2 bumped to `0.92`. The frame now reads.
- `06fe7a4f` — **B4.** Arena terminal-state telemetry dedupe stability. Dropped `elapsedMs` from the dedupe key (keeps ticking → cache miss every render). Boolean-signature deps (`canClaim = Boolean(onClaimVictory)`) for `modal_open` effect to avoid callback-identity churn.

### Sub-cluster 3 — OG image rendering saga

This one was deep. Symptom: `/api/og/match` returned 500 ("Unsupported image type: unknown") on preview while production rendered correctly.

- `adb19ae4` — **Root cause #1.** Re-encoded 16 colormap PNGs (favicon-wolf, panel-mision-icon, bg-ch, star, 12 pieces) from 8-bit indexed to RGBA via `magick PNG32:`. Newer @vercel/og runtime rejects the indexed-colormap path silently. This was the real bug.
- `ad913744` — **Wrong workaround.** Switched all OG asset refs from `.png` to `.webp`. Eliminated the colormap problem but broke pieces + overlays on preview because Satori failed to decode the WebP variants in this runtime.
- `fea2d971` — **Defense-in-depth.** Added explicit `width` on piece + overlay `<img>` so Satori never has to decode bytes to infer aspect ratio.
- Vercel Deployment Protection ("Require Log In") was the underlying multiplier: it intercepted internal asset fetches from the Satori function and returned login HTML in place of image bytes. User toggled it OFF for this environment.
- `1f9abc6a` — **Final fix.** Reverted `.webp` → `.png` in `board-render.tsx` + all 5 OG routes (`match`, `victory/[id]`, `endgame`, `invite`, `exercise`). The colormap fix from `adb19ae4` keeps the PNGs valid; the explicit width from `fea2d971` stays for defense.
- `3bd071eb` — **Share preview fade-in.** `decoding="async"` + `opacity 0 → 1` 300ms transition on the `<img>` in `share-modal.tsx`. Kills the 90s-style top-down progressive JPEG paint.

## State at handoff

- Smoke validated green on `preview.chesscito.com` after the final OG revert + share fade.
- Production (`chesscito.com`) on commit `f54f6fc` continues to render OG cards correctly with the original PNG paths — no regression there.
- Telemetry verified: `arena_mount`, `arena_fresh_reset_fired`, `arena_pending_nav_consumed` rows captured for the web smoke session.
- Disk telemetry skill loaded but not run; user confirmed VR sprint will run in a dedicated post-reboot session.

## Outstanding work (carried forward to deferred-work.md)

- **`/coach/[gameId]` visor polish (Cluster C).** Gating production promotion. Needs concrete paint-points from user (screenshot + 3-5 issues). Not started.
- **VR baseline refresh.** Approx 14 baselines need refresh: Cluster B visual changes (arena end-state win-success, arena end-state error, share-modal opacity bump), the deferred 8 from #119 (coach-overlay + desktop viewport), and now OG-card visual changes. Blocked by disk pressure — needs reboot before running the full suite.
- **Bulk re-encode of ~144 colormap PNGs remaining under `apps/web/public/art/**`.** OG-side bypassed entirely (only the 16 OG-touched assets re-encoded). Browser-side path through `<picture>` AVIF/WebP fallback covers everything else, so this is low-priority hygiene only.
- **Plan C — filesystem reads in OG routes.** Evaluated and rejected. ~300ms savings on first cold hit, in exchange for `outputFileTracingIncludes` config + new coupling between routes and asset paths. Current `s-maxage=3600 + stale-while-revalidate=86400` already covers the perceived latency for share crawlers.

## Production promote — explicit defer

Quoted from session: "aun no está completo y tenemos muchas cosas por pulir antes de dar ese salto, entre ellas el visor que está muy crudo aun." Promote gated on Cluster C visor polish landing.

## Open questions for next session

- Paint-points for `/coach/[gameId]` visor — screenshot + 3-5 issues. Without this, any polish work is guessing.
- After Cluster C: smoke full app flow on `preview.chesscito.com` once more, then promote to `chesscito.com`.
- VR refresh — schedule a dedicated session with disk-telemetry pre-flight (reference: `memory/project_disk_telemetry.md`).
