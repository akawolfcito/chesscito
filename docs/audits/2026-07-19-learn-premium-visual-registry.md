# LEARN premium visual registry — implementation report

**Date:** 2026-07-19

**Baseline:** `11a16982395a298d7c92a194bde0179b267c5ecf`

**Scope:** presentation-only Theme Builder vertical slice for LEARN

## Resolver

The single runtime chain remains:

```text
runtime surface → relevant entitlement → effective visual tier → registry → asset
```

- LEARN selects the existing technical `pro` registry slot from effective Training Pass coverage (direct Season Pass or real PRO).
- PLAY selects `pro` only from real PRO.
- FULL legacy retains its previous real-PRO resolver.
- `pro` is a visual slot name in LEARN, not a commercial PRO assertion. Copy, badges, source, price, expiry, +3 Shields and functional gates still consume their real entitlement contracts.
- Loading/error/unknown retain only the last successful visual tier. Confirmed inactive/expiry returns to DEFAULT. Stale presentation never authorizes a new action.

Effective Training Pass now has one wallet-scoped provider snapshot. Strict response validation, abort isolation and wallet matching prevent malformed or superseded responses from becoming confirmed inactive. Ledger failures return unresolved transport status; confirmed PRO remains authoritative.

## Registry and classification

All **162 slots** remain covered by the existing DEFAULT/PRO registry and central adapters.

| Classification | Slots |
|---|---:|
| learn | 31 |
| play | 21 |
| shared | 74 |
| full-legacy | 29 |
| dev-only | 0 |
| unknown | 7 |

Classification is based on current consumers, imports, mounted routes and runtime mode. It is displayed in `/dev/theme-builder`. Current membership is explicit; overlaps throw and future unaudited slots default to `unknown`, not `shared`.

UNKNOWN slots, left unmodified:

- `hub.principal-button`
- `pro-mission.sms`
- `shop.coach-pack-20`
- `hub.cta-principal`
- `landing.pre-chess`
- `landing.hero`
- `landing.progress-trophies`

Registry variant totals remain:

- 7 explicit PRO assets;
- 154 slots inheriting DEFAULT (151 implicit, 3 explicit);
- 1 explicit PRO `none` (`hub.guide`);
- 3 DEFAULT `none` overlays;
- 0 asset replacements in this slice.

The initial high-impact approved assets activated for effective Training Pass presentation in LEARN are the existing variants for `hub.avatar-lite`, `brand.ring-start-focus` and the shared `hub.avatar` where its LEARN consumer mounts. The exact current Hub LEARN hero is `hub.avatar-lite` (`/art/avatar-lite-hub` → `/art/avatar-pro`).

## Preserved surfaces and assets

- FULL legacy classification and asset configuration were not replaced. In particular, `hub.portal` and `hub.guide` remain FULL-only decisions; FULL continues to use real PRO exactly as before.
- PLAY continues to use real PRO only.
- `hub.pro-chip` still receives an explicit real-PRO variant from `HubProBadge`; direct Season Pass cannot light the PRO badge.
- The pre-existing untracked `apps/web/public/art/theme-builder/candy-forest/hub/guide/pro.*` triplet is a large PRO wordmark, not a premium wolf. It was neither referenced nor committed.
- DEFAULT, explicit PRO, `inherit`, `none`, fallback, builder preview, persistence, upload target and Undo contracts remain unchanged.

## Bypasses and deferred debt

No bypass was required to close this vertical slice. The audit still reports:

- six deprecated mastery piece slots hardcoded in `components/hub/mastery-tile.tsx`;
- `board.legacy-bg` as a mixed resolver/hardcoded legacy case;
- `/art/rivals/mara-avatar` and `/art/shop/pro` as active assets outside the registry;
- seven slots classified `unknown` above.

These cases were documented, not migrated.

## Files changed

- `apps/web/src/app/api/season-pass/status/route.ts`
- `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts`
- `apps/web/src/app/dev/theme-builder/page.tsx`
- `apps/web/src/components/wallet-provider.tsx`
- `apps/web/src/lib/season-pass/use-season-pass-status.ts`
- `apps/web/src/lib/season-pass/__tests__/use-season-pass-status.test.tsx`
- `apps/web/src/lib/themes/use-effective-theme-tier.ts`
- `apps/web/src/lib/themes/theme-registry.ts`
- `apps/web/src/lib/themes/catalog.ts`
- `apps/web/src/lib/themes/__tests__/surface-theme-tier.test.ts`
- `apps/web/src/lib/themes/__tests__/learn-theme-entitlement-integration.test.tsx`
- `apps/web/src/lib/themes/__tests__/theme-registry.test.ts`
- `apps/web/src/lib/themes/__tests__/catalog.test.ts`
- `apps/web/src/lib/themes/__tests__/provider-tree-invariant.test.ts`

## Verification

- Focused Vitest: **124 passed / 16 files**.
- Theme runtime coverage: **162 total**, **151 active resolver-connected**, **11 known exclusions**.
- Lint: clean.
- `git diff --check`: clean.
- TypeScript: slice files are clean; the global command remains blocked by the pre-existing modified `src/lib/coach/__tests__/use-coach-analysis.test.ts:139` (`string` is not assignable to ``0x${string}``). That unrelated file is excluded from this commit.
