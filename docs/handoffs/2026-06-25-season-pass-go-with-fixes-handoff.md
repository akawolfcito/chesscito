# Lite Season Pass — "GO with fixes" remediation (2026-06-25)

Scope: apply only the audit fixes to make Season Pass safe, Lite-isolated, and
demo-consistent. No new features, no contract changes, no new visual surfaces.
Phase 2 (visible Season Pass UX) is intentionally deferred.

## 1. Summary of changes

| # | Fix | What changed |
|---|-----|--------------|
| 1 | Server-side Lite gate | `verify-payment` rejects `lite_season_pass_21` in Full builds with `season_pass_unavailable` (404) via a runtime `isLiteModeServer()` check. Peones path untouched; chain/token/receipt/amount verification unchanged. |
| 2 | Hide Peones in Lite | `PeonesHintButton` no longer mounts in Lite (it is a Peones spend). No new action-row CTA — Season Pass stays reachable via the existing Hub + Lite CTAs. |
| 3 | Reconcile `shieldsPending` | If Redis fails after the pass insert, the row is persisted with `shields_credited = 0` + `metadata.shieldsPending = true`. A later verification of the same tx retries the credit exactly once and flips the row to `3` / pending=false. Already-credited passes never touch Redis (no double-credit). |
| 4 | Hub price from config | The Hub Season Pass pill reads days/shields/price from `SEASON_PASSES` (`getSeasonPass` + `formatUsd`). Compact single-line copy `🛡️ 21-Day Pass · +3 Shields · $1.99` (no CSS change; em-dash removed per anti-AI-prose rule). |
| 5 | Error mapping | New pure `mapSeasonPassError()` maps raw rail/verify reasons to actionable buyer messages (configured / wrong-chain / unsupported-token / cancelled / could-not-verify / fallback); `SeasonPassSheet` consumes it. |

## 2. Files modified

- `apps/web/src/lib/feature-flags.ts` — add `isLiteModeServer()` (runtime env read).
- `apps/web/src/app/api/verify-payment/route.ts` — Lite gate (Fix 1) + shields reconcile (Fix 3).
- `apps/web/src/components/exercises/exercises-screen.tsx` — gate `PeonesHintButton` mount (Fix 2).
- `apps/web/src/components/hub/hub-scaffold.tsx` — config-derived CTA label (Fix 4).
- `apps/web/src/lib/season-pass/use-season-pass-rail.ts` — `mapSeasonPassError()` (Fix 5).
- `apps/web/src/components/payments/season-pass-sheet.tsx` — consume `mapSeasonPassError()` (Fix 5).

## 3. Tests added / modified

- `apps/web/src/app/api/verify-payment/__tests__/route.test.ts`
  - Full mode + `lite_season_pass_21` → `season_pass_unavailable` 404, no receipt, no ledger.
  - Lite mode → Peones pack still credits (gate is Season-Pass-only).
  - Retry of a pending pass → reconciles, credits 3 once, no duplicate insert.
  - Third retry (already credited) → no Redis, no double-credit.
  - Season-pass block now runs with `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`; mock extended with `update().eq()`.
- `apps/web/src/lib/season-pass/__tests__/map-season-pass-error.test.ts` (new) — 6 cases covering every bucket + null/undefined/unknown fallback.

## 4. Commands executed

- `vitest run` verify-payment → 25/25
- `vitest run` map-season-pass-error → 6/6
- `tsc --noEmit` → clean
- `vitest run` verify-payment + season-pass/status + rail-config + transfer-builder + map-season-pass-error → 60/60
- `vitest run` exercises + hub + payments + season-pass → 332/332 (no regressions)
- `vitest run` (full apps/web suite) → **4449/4449 passing, 353 files, 0 failures**

## 5. Type-check result

`pnpm exec tsc --noEmit` → **0 errors**.

## 6. Remaining risks

- **`isLiteModeServer()` depends on `NEXT_PUBLIC_CHESSCITO_LITE_MODE` being set in the Lite deployment env.** If a Lite build ships without it, the gate fails closed (Season Pass 404 even in Lite). Verify the env on the Lite preview/prod target before demo.
- **Fix 3 reconcile uses `metadata.shieldsPending` + `shields_credited < shieldsOnPurchase`.** Pre-existing rows written before this change carry `shields_credited = 3` and no flag, so they are treated as already-credited (correct for normal purchases; only rows that genuinely failed Redis pre-change would not auto-heal — none expected in the personal/MiniPay snapshot).
- **Fix 2 hides the hint only**; if any other Peones-bearing element mounts on the exercises surface in Lite, it is out of scope here. Spot-checked: hint was the active Peones spend in the action row.
- **No DB migration** was added; `metadata` is an existing JSON column. If `shields_credited`/`metadata` are not present in `lite_season_passes`, Fix 3 reconcile would no-op — confirm schema.
- Fixes 2 and 4 have **no unit harness** (large client components) → covered by the manual checklist below.

## 7. Manual checklist (demo, MiniPay 390px)

Lite build (`NEXT_PUBLIC_CHESSCITO_LITE_MODE=true`):
- [ ] Hub shows `🛡️ 21-Day Pass · +3 Shields · $1.99`; tap opens the Season Pass sheet.
- [ ] Exercises action row shows **no** HINT / Peones button; no Peones anywhere in Lite.
- [ ] Season Pass pay → success credits 3 shields; re-tap same pass shows "Already active", no extra shields.
- [ ] Force an error (wrong chain / cancel) → sheet shows the mapped message ("Switch to Celo Mainnet." / "Transaction was cancelled.").

Full build (`NEXT_PUBLIC_CHESSCITO_LITE_MODE` unset/false):
- [ ] Exercises HINT (Peones) still works; Peones pack purchase still credits.
- [ ] Any direct `lite_season_pass_21` call to `/api/verify-payment` returns 404 `season_pass_unavailable`.

## Next (Phase 2, not in this pass)
- Visible Season Pass UX (richer Hub/exercises surface, status reflection). Deferred per founder.

Wolfcito 🐾 @akawolfcito
