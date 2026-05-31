# Shop Cleanup + VR Settle + PRO Days — Handoff

**Date:** 2026-05-30 (follow-up session) · **Branch:** main · **Range:** `91be4799..81c26d24` (3 commits)
**Status:** All commits pushed to `origin/main`. No production promote.

Sibling handoff: `2026-05-30-playercolor-callouts-vr-refresh-handoff.md` (the prior session's `6e3494d0..c44a591c` range — closed deferred-work #1 by pushing those 8 commits at the top of this session).

## What shipped

Three atomic commits closing three deferred ledger items from the prior handoff:

1. **`91be4799`** `chore(shop): drop unused SHOP_TILE_ASSETS bg field + orphan textures` — closes ledger #7.
2. **`1fec59c8`** `test(vr): wait for resolved shop price before hub-shop-sheet-open snapshot` — closes ledger #3.
3. **`81c26d24`** `feat(account-sheet): days-remaining sub-line on Manage PRO row` — closes ledger #5.

## Commit details

### `91be4799` — Shop tile bg field cleanup

Background of each shop card has been painted by the vitrine candy-pill CSS family since the 2026-05-25 redesign; the `bg` paths in `SHOP_TILE_ASSETS` were never read. Drops the field from the type + 5 entries and removes 9 orphan textures (`bg-{pro,founder,shield}.{avif,png,webp}`, 156KB total).

- `shop-catalog.ts:104` — `Record<ShopCopyKey, { icon: string; bg: string }>` → `Record<ShopCopyKey, { icon: string }>`
- 5 entries simplified
- Docstring rewritten (lines 92-103) to reflect that the background is CSS-driven
- 9 files deleted under `apps/web/public/art/shop/bg-*`
- Sweep confirmed `assets.bg` was never read — `shop-sheet.tsx:127-130` only references `assets.icon`
- Tests: 15/15 passing on `shop-catalog` + `shop-sheet`

Handoff line item count of 24 was off — there were only 9 unique files (3 textures × 3 formats); the original 24 figure double-counted `coachPack5`/`coachPack20` references that reused `bg-shield` / `bg-pro`.

### `1fec59c8` — VR settle for `hub-shop-sheet-open`

Root cause of the 2026-05-30 flake: `useShopSheetState` (line 211) calls `useReadContracts({ functionName: "getItem", ... })` for each SHOP_ITEM. Until the on-chain reads resolve, every buy pill renders its `buyButtonComingSoon` copy (`"Coming soon"`); once resolved it flips to `formatUsd(price)` (e.g., `"$1.99"`). The previous `settle(page, 500)` was not enough on cold RPC.

Fix: before snapshotting, wait for the first `.shop-item-tile-buy-pill--green` to contain `"$"` (10s timeout). One added expectation, no product touch.

Decision rationale (vs the two alternatives evaluated):

| Option | Why declined |
|---|---|
| Mock `page.route()` JSON-RPC | 30-45 min; viem multicall batching is non-trivial; net wasn't worth it for a single test |
| `/dev/shop-sheet/` fixture (VR-5/VR-7/VR-8 pattern) | 1-2h; pivots away from "Shop opened from the dock" as the entry path — loses meaningful coverage |

**Verification deferred** — disk + swap at session end violated VR safety thresholds, so the new wait was committed without a green VR pass. First post-reboot VR run should target this test specifically (`pnpm test:e2e:visual -g hub-shop-sheet-open`).

### `81c26d24` — PRO days-remaining sub-line

Closes the asymmetry where Shields / Coach / Founder rows in `<AccountSheet>` each carried point-of-use context but the PRO row did not. Now an active subscription reads:

```
[crown] Manage PRO                     [★ Active]
        23 days left
```

Implementation:

- **`lib/pro/days-remaining.ts`** (new) — pure helper `daysRemaining(expiresAtMs, nowMs) → number | null`. Returns `null` for missing / NaN / Infinity / already-past; otherwise `Math.max(1, Math.ceil(...))`. 11 unit tests cover boundary semantics (exact ms, 1d-1ms, 1d+1ms, 30d, expired).
- **`exercises-screen.tsx`** — `AccountSheet` accepts new `proExpiresAt: number | null` prop. Computes `daysLeft = daysRemaining(proExpiresAt, Date.now())` at render. Manage PRO row restructured to the two-line shape used by Shields/Founder (label + subtitle), with the days line gated on `proDaysLeft != null`. Uses `useTranslations("PRO_COPY")` + `statusActiveSuffix({ daysLeft })` so the copy ("Expires tomorrow" at 1d, "N days left" otherwise) stays sourced from editorial.
- **`hub-scaffold-client.tsx`** — `deriveProShape` migrated off its inline math + local `MS_PER_DAY` (–12 lines) to call the new helper. Behavior identical (the `Math.max(0, ...)` clamp was dead code under the upstream `active && expiresAt > now` filter).
- Three duplicate math sites (`pro-active-badge.tsx`, `pro-sheet.tsx`, `pro-chip.tsx`) intentionally left alone — they are VR-baselined surfaces and the scope here was the AccountSheet, not a sweep.
- No API change. `/api/pro/status` already returns `{ active, expiresAt }`; the field was being dropped at the parent.

Verification:
- Typecheck clean against the whole web package
- 95/95 passing on `lib/pro/**` + `hub-scaffold-client` tests
- 33/33 passing on `exercises/**` tests
- No AccountSheet VR baseline exists — `e2e/visual-regression.spec.ts` and snapshots dir scanned, no match for `account-sheet` / `AccountSheet`

## State at handoff

- **Branch:** `origin/main` up to date with local.
- **Production:** unchanged from `f54f6fc`.
- **Preview deploy:** will fire from the 3 pushed commits.
- **Disk / swap:** still in the red zone from the prior session — reboot continues to be mandatory before any further VR.
- **Tests:** all touched modules green. No full `pnpm test` run this session (cache-warm reuse from the prior session was sufficient for the targeted sweeps).

## Outstanding work — deferred ledger (post-update)

Closed this session: #1 (push), #3 (shop fixture race — implementation done, verification deferred), #5 (PRO days), #7 (partial — see below).

Still open:

1. **Verify the VR fix in `1fec59c8` actually breaks the flake** — `pnpm test:e2e:visual -g hub-shop-sheet-open` after reboot. If still flaky after 3 consecutive runs, escalate to the dev-fixture option discussed in §2.
2. **Hint-variant VR baselines** (#2 in the prior handoff) — credits hint paid + PRO + shields chip. Still gated on reboot + fixture additions.
3. **Founder perks UI** (#4) — gated on product decision about what Founder unlocks.
4. **Shared trophies data provider** (#6) — `TrophiesBody` + `TrophiesHeroBand` both fire `/api/my-victories`. Profile before pulling the lever; cheap endpoint, may not earn the abstraction.
5. **Production promote** (#9) — gated on (a) #1 verification + (b) MiniPay smoke on the cluster surfaces.

Trimmed from #7 (cleanup) — the `bg` field + 9 textures are gone. Residual cleanup left:
- `pro-active-badge.tsx` / `pro-sheet.tsx` / `pro-chip.tsx` could migrate to the shared `daysRemaining` helper. Each is VR-baselined, so the refactor only earns a commit if you're already touching the file. Not worth a dedicated PR.

New deferred work surfaced this session:

- **`SHOP_TILE_ASSETS` icon-only catalog has no test asserting paths resolve.** A trivial snapshot of the 5 entries would catch a typo before it ships. Cheap (5 min) but not urgent — the manual UI sweep would catch it too.

## Open questions for next session

- Should the shared `daysRemaining` helper also absorb the three remaining duplicate sites? Argument for: single source for "PRO time math" makes the EXPIRING threshold easier to migrate if product ever drops it from 3 days. Argument against: each surface is independently VR-baselined and the math is already 4 lines — abstraction earns little.
- Is `/coach/history` analytics catching the "user opened AccountSheet → days-remaining nudged them to renew" path? If we want to measure the surface, add a telemetry event on the sub-line render. Otherwise it's a calm UX win we can't quantify.

## Pointers

- Prior handoff (8 commits): `docs/handoffs/2026-05-30-playercolor-callouts-vr-refresh-handoff.md`
- Memory update this session: `project_account_inventory_rows` extended with PRO days-remaining as part of the point-of-use pattern.
- Cluster Closure Protocol — §1 no contracts changed, §3 no MEMORY.md restructure needed, §4 no feature branches to clean.

---

Wolfcito 🐾 @akawolfcito
