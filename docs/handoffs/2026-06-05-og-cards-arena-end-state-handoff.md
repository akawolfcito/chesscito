# OG share-card alignment cluster — handoff

**Date:** 2026-06-05
**Branch:** `main`
**Range:** `141c96d3..eb85e87a` (7 commits, 10 ahead of `origin/main`)
**Status:** Local — not yet pushed, not yet promoted to production

## Scope

Migrate the four social-share `/api/og/*` routes to the arena-end-state vocabulary already established in-app: `panel-mision-icon` cream shell, `softenPanel` 1.1× zoom, emotion-mapped avatars, stat-pill family. Same recipe as the in-app popups so the social hand-off feels continuous with the screen the user just shared from.

Out-of-cluster bonus: closes the `result-overlay.tsx` migration (badge / shop / error variants) and adds a `/dev/exercises-popups` VR fixture with 3 new vr14 baselines.

## Commits

| SHA | Surface | Purpose |
|---|---|---|
| `141c96d3` | `result-overlay.tsx` + `/dev/exercises-popups` fixture | Migrate badge/shop/error popup variants to arena-end-state vocabulary + 3 vr14 baselines |
| `eab2cdbc` | `/api/og/exercise` | First card on the new recipe — panel-mision shell + softenPanel + stat pills + half-body avatar |
| `6f4e5cc3` | `/api/og/match` | Apply recipe + per-result emotion mapping (feliz / pensativo / triste). Adds `mascotScale` to CardShell. Fixes literal `\u2022` JSX bug |
| `bb4aca6c` | `/api/og/invite` | Apply recipe + drop heráldico BADGE for candy-forest `invite-icon` triplet. avatar-confiado (smirk challenger) |
| `c32c7df3` | `/api/og/invite` | Retire dead `piece` + `fen` hero branches — only the no-params fallback was ever called by the live share funnel |
| `2d6853d4` | `/api/og/victory/[id]` | Page-mirror layout: headline + 3 stat pills + "Can you beat this?" challenge block with avatar-confiado peek. Adds `mascotMode="none"` to CardShell |
| `eb85e87a` | `/api/og/exercise` (daily) | Enable `softenPanel` unconditionally (daily was opted out) + bump daily board 560 → 680 |

## Key decisions

- **Vocabulary unification.** All four cards now use `panel-mision-icon.png` as the shell, `softenPanel` to scale the asset 1.1× (hides the saturated leaf-frame border), and the same stat-pill recipe (`candy-stat-pill` parity).
- **Avatar emotion per route**, following `feedback_avatar_emotion_selection`:
  - victory → `avatar-confiado` (smirk challenger, addresses the visitor)
  - match win → `avatar-feliz`, draw → `avatar-pensativo`, loss → `avatar-triste`
  - invite → `avatar-confiado`
  - exercise piece-complete → mascot per existing logic
- **CardShell extensions.**
  - `mascotMode="none"` (new) lets a route embed its own avatar inside `heroSlot` instead of using the shell-anchored mascot. Used by victory to mirror the in-app coach-section composition.
  - `mascotScale?: number` (new, default 1.0) tunes the half-body avatar prominence. Match uses 0.6 (avatar is supporting cast to the result icon); exercise uses 1.0; invite uses 0.55.
- **Invite retirement.** The `piece` and `fen` hero branches were dead code (the live caller at `result-overlay.tsx:185` always hit the no-params URL) AND visually broken (111×146 piece sprites upscaled to 660×660 ≈ pixelated). Removed instead of patched. If a board-from-FEN preview is needed later, mint a dedicated route.
- **Daily exercise polish.** `softenPanel` was conditional on `type !== "daily"` so the daily variant rendered the raw green border. Made unconditional. Board hero bumped 560 → 680 for visual focus.

## Surfaces touched

- `apps/web/src/app/api/og/exercise/route.tsx` — full migration + daily board polish
- `apps/web/src/app/api/og/match/route.tsx` — full migration + per-result emotion
- `apps/web/src/app/api/og/invite/route.tsx` — full migration + dead branch removal
- `apps/web/src/app/api/og/victory/[id]/route.tsx` — full migration mirroring `/victory/[id]` page
- `apps/web/src/lib/og/card-shell.tsx` — `mascotMode="none"`, `mascotScale`, panel zoom
- `apps/web/src/components/exercises/result-overlay.tsx` — badge / shop / error vocabulary
- `apps/web/src/app/dev/exercises-popups/{fixture,page}.tsx` — VR fixture for new popup variants
- `apps/web/e2e/visual-regression.spec.ts` + 3 new vr14 baselines
- `apps/web/public/art/hub-new/invite-icon.{avif,webp,png}` — new candy-forest invite hero (PNG pngquant'd 1.5MB → 358KB)

## Smoke executed

Manual via local dev server (`http://localhost:3002`):

- `/api/og/victory/1` ✅ (HEAD smoke, user-validated 2026-06-05)
- `/api/og/exercise?type=daily&piece=knight&name=Fork+Drill&start=e4&target=f6&solved=true&streak=5` ✅ (post-polish, user-validated 2026-06-05)
- `/api/og/match` ✅ ("perfectos" per user)
- `/api/og/exercise?type=piece-complete&piece=rook&stars=12` ✅ ("perfectos" per user)
- `/api/og/invite?from=Wolfcito` ✅ ("perfectos" per user)

## What's NOT in this cluster

- **No VR for `/api/og/*`.** These are server-side image responses, not browser surfaces — `e2e/visual-regression.spec.ts` has no fixture coverage. If we ever want regression safety, the play is a `/dev/og-cards` fixture that mounts each route inside an `<img>` and snapshots it. Deferred — no telemetry suggests share-card drift is a problem.
- **Route handler observability.** Vercel hook flagged the four routes for missing logging/error instrumentation. Out of scope for a vocabulary unification cluster; revisit if a sharing failure mode shows up in prod logs.
- **`/api/og/endgame` route.** Touched only incidentally (shares the `panelBgUrl` import constant). Not part of this migration — its caller path is separate.

## Next steps

1. **Push** the 10 unpushed commits to `origin/main`.
2. **Promote to production** — `origin/production` should fast-forward to capture the OG migration before any live share gets cached with the old composition. Use `docs/release/release-process.md`.
3. **Bust OG cache** on shared posts (Twitter card validator / WhatsApp re-fetch) if any pre-migration shares are still live.

## Open questions

- Do we want a VR fixture for the 4 OG cards? Low-effort to add (one fixture page mounting `<img src="/api/og/...">` per route), and any future panel/avatar/copy drift would be auto-caught. **Recommendation:** defer until first regression actually bites.
- `/api/og/endgame` is the odd one out — same shell asset but pre-migration vocabulary. Worth a follow-up pass for full vocabulary unity?
