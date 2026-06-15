# Handoff — HUB START-HERE removal + PRO flaky fix + permissions (2026-06-15, sesión 2)

## State
- `main` = **`ac3dec37`** — **2 commits AHEAD of `origin/main`** (`18e03d35`),
  NOT pushed yet.
- `production` = **`8c5f2bb4`** — `main` is **10 commits ahead** of prod.
- Suite: PRO surface 179/179 green; full suite not re-run this session
  (baseline 3730 from sesión 1, +2 reescritos en use-pro-status).
- VR: **0 drift** — the START HERE ribbon was never under VR (hub-clean
  captures `/exercises`, not the `/hub` HubScaffold footer).
- Working tree clean. `settings.local.json` edited (gitignored).

## Shipped this session (NOT pushed)
- `b2ea0941` `style(hub)`: retire the START HERE ribbon on the Train
  Pieces CTA. Removed the `<span class="hub-scaffold-start-here-ribbon">`
  in `hub-scaffold.tsx`, its CSS block in `globals.css`, the
  `startHereLabel` copy in `editorial.ts` + `messages/es.ts`, and the
  stale wrap comment. Wrap + gold halo stay; ribbon was `position:absolute`
  → zero layout shift.
- `ac3dec37` `fix(pro)`: preserve last-known PRO status on transient fetch
  failures. **Root cause of the "PRO disappeared once in the HUB then
  self-healed" report**: `use-pro-status.ts` mapped ANY non-ok response
  (403 read-rate-limit, 500, cold function) and network error to
  `{ active:false }`, which `useIsProActive` treated as authoritative and
  demoted the paying user. Fix: only an OK body mutates status; transient
  failures preserve the last value (self-heals on next OK fetch); a
  first-load failure leaves status `null` so `useIsProActive` falls back
  to its localStorage cache. Real lapses still downgrade via OK
  `{active:false}`. Tests reescritos + 3 nuevos; 17 pass (use-pro-status +
  use-is-pro-active), 179 across PRO surface.

## Permissions (settings.local.json, NOT committed — gitignored)
- **Diagnosis**: the user kept getting prompted because "always allow" had
  saved 41 EXACT `kill <pids>` / `pkill -f "<pattern>"` rules that never
  recur. Read-only commands were already covered (auto-allow + existing
  wildcards). 
- **Applied**: removed the 41 exact rules, added `Bash(kill:*)`,
  `Bash(pkill:*)`, `Bash(lsof:*)`, `Bash(ps:*)`. allow 660→623. JSON valid.
  Backup at `/tmp/settings.local.bak.*.json`.
- `nohup` intentionally NOT added — use the Bash tool's `run_in_background`
  instead (harness-native, survives turns, no arbitrary-exec wrapper).
- ⚠️ Likely takes effect NEXT session (settings load at start). If it still
  prompts, restart the session.

## NEXT (next session = "continuemos")
1. **PUSH + PROMOTE** (deferred by founder this session):
   - `git push origin main` (ships the 2 new commits).
   - Smoke preview, then `git push origin main:production` (clean FF from
     `8c5f2bb4`) — ships 10 commits: rivals + confirm modals + JOURNAL fix +
     icons + sticky leaderboard + START-HERE removal + PRO flaky fix.
   - Poll www, smoke. (Pre-launch, no real users.)
2. Smoke on MiniPay/390px: rival selector + gameplay HUD identity,
   quit/resign modals, JOURNAL PLAY, leaderboard sticky, **PRO chip stays
   stable while navigating the hub** (the fix), no START HERE ribbon.
3. Verify the new permission wildcards stopped the prompts.

## Gotchas / notes
- VR clean-server recipe: Playwright's `webServer` reuses `:3000`; to use a
  clean server, `rm -rf .next` then let Playwright start `pnpm dev` on
  `:3000` (do NOT override BASE_URL to a port Playwright won't start). A
  manual `PORT=3947 pnpm dev` background process kept dying on its own this
  session — avoid; use Playwright-managed server on `:3000` after
  `rm -rf .next`.
- Orphan cleanup still pending from sesión 1: `/art/hub/panel-pro.*`,
  orphan copy `aiThinking`/`confirmQuitLabel`/`resignConfirm`/
  `confirmResignLabel`. Confirm before deleting.
- Full suite (3730) not re-run end-to-end this session; run before promote.
