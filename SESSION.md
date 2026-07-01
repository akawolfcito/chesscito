# Session Handoff — 2026-07-01

Full detail: `docs/handoffs/2026-07-01-treasury-canary-and-pro-rail-handoff.md`.

## Completed today
- Get Peones Treasury canary closed out (rollback exercise + final review,
  both live-verified). PR #159 merged to `main`. Still disabled-by-default
  in Production.
- Legacy Get Peones + Season Pass repointed to `ChesscitoTreasury`, live in
  Preview and Production, both Vercel projects (`play` + `lite`).
- MiniPay `eth_signTypedData_v4` confirmed on a real device.
- Full monetization audit done — see
  `docs/product/chesscito-monetization-consolidation-audit-2026-07-01.md`.
- Chesscito PRO backend migrated to the no-approve treasury rail (new SKU,
  migration, verify-payment branch, shared Redis extend logic). Tested:
  4597/4597 passing, tsc clean. Committed (`652d2965`), pushed to `main`.

## Current State
- **Branch**: `main`, in sync with origin, nothing uncommitted except the
  always-untracked `apps/web/supabase/config.toml` / `.gitignore`.
- **Build**: 4597/4597 passing, tsc clean.
- Old Shop `buyItem` PRO path (itemId 6) still works unchanged — the new
  rail is additive, not a cutover yet.
- New `pro_subscriptions` migration committed, not yet applied to hosted
  Supabase (applies via normal deploy/CI, not manual).
- Docker/local Supabase: stopped.

## Next Task
**Phase 1, Task 4 (not started): wire the PRO purchase UI** — switch
`<ProSheet>` / `useShopSheetState`'s PRO branch from approve+`buyItem` to
the no-approve rail (`sku: "chesscito_pro_30"`), same pattern as
`GetPeonesSheet`/`SeasonPassSheet`. Backend is done; this is UI-only. Test
in a real browser/MiniPay before calling it done. Full detail + follow-ups
(retire Coach-pack Shop-TX, build Shield Peones-spend) in the handoff doc.

## Notes
- Command hygiene: `git -C`/`pnpm -C`/`supabase --workdir`, never `cd`; one
  cmd per call; Write tool for files.
- Vercel: `production` branch = Production, `main` = Preview, for both
  `play` and `lite` projects — see [[feedback_vercel_production_branch]].
