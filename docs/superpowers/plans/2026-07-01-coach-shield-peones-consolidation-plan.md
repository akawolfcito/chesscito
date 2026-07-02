# Coach + Shield Peones Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the legacy Shop-approve-TX purchase paths for Coach credit packs (itemId 3/4) and Retry Shield (itemId 2), fixing a bug where one UI surface spends shields without telling the server, and adding a Peones-spend fallback so Shield can be paid for the same way Coach already is when a player has none left.

**Architecture:** Two independent, sequentially-committed deliverables sharing one root cause (both items were sold two ways at once). Part A deletes the Coach pack purchase path outright (Peones already covers the "no credits left" case). Part B first fixes a routing bug, then adds a server-verified Peones-spend branch to the existing shield counter endpoint (new SQL source + atomic consumption guard, modeled on — but not copy-pasted from — the Coach pattern), then deletes the Shield purchase path.

**Tech Stack:** Next.js 14 App Router route handlers, Upstash Redis (`@upstash/redis`, Lua `EVAL` for atomicity), Supabase Postgres (`peones_ledger` table + `peones_spend` RPC), wagmi/viem for on-chain reads, Vitest for unit tests, Playwright for the VR baseline.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-coach-shield-peones-consumables-phase1-design.md` (patched post-red-team; red-team doc: `2026-07-01-coach-shield-peones-consumables-phase1-redteam.md`). Every task below implements one numbered section of that spec.
- Peones cost for Shield fallback: **2 Peones**, flagged provisional — do not "round" or otherwise adjust it during implementation.
- `sourceId`/idempotency identity for the Shield Peones fallback is **`attemptSeq`** (existing counter in `exercises-screen.tsx`) — never a timestamp, never a bare exercise id.
- Commits: Conventional Commits (`feat:`/`fix:`/`refactor:`/`test:`/`docs:`) + `Wolfcito 🐾 @akawolfcito` footer. Stage explicit paths, never glob/bracket pathspecs (zsh expansion risk).
- Run `pnpm exec tsc --noEmit -p apps/web` and the relevant Vitest file(s) at the end of every task before committing. Run the full suite (`pnpm -C apps/web test`) at the end of Part A and again at the end of Part B.
- Two PRs: **PR-A** (Part A, branch `refactor/retire-coach-shop-tx-packs`) and **PR-B** (Part B, branch `feat/shield-peones-fallback`), each opened against `main` and auto-merged once green (per `[[feedback_auto_merge_prs_solo_main]]`).
- `PeonesLedgerSource` / `peones_ledger_source_check` / `schema-sync.test.ts` must always agree — this is asserted by a real test, not a convention to remember.

---

## Part A — Retire Coach pack Shop-TX purchase (itemId 3/4)

Verified scope note: `exercises-screen.tsx` carries its own duplicate `handleConfirmPurchase` (line 2047) used by the `/exercises` `<ShopSheet>`, but it has **no coach-pack branch** at all — it only special-cases `SHIELD_ITEM_ID` and `PRO_ITEM_ID`, defaulting everything else (including coach packs today) to `"shop_founder_badge"` and no verify POST. This means buying a coach pack via `/exercises` today silently never credits — a pre-existing bug, not introduced by this plan, and moot after Task A2 removes the coach tiles entirely. No `exercises-screen.tsx` edit is needed for Part A (unlike Part B, where the equivalent Shield branch is real and must be removed — see Task B7).

### Task A1: Delete the Coach pack verify-purchase route

**Files:**
- Delete: `apps/web/src/app/api/coach/verify-purchase/route.ts`
- Delete: `apps/web/src/app/api/coach/verify-purchase/__tests__/route.test.ts`

**Interfaces:**
- Consumes: nothing (leaf route).
- Produces: nothing — after this task, `POST /api/coach/verify-purchase` returns Next.js's default 404. Task A3 removes the last caller.

- [ ] **Step 1: Confirm no other file imports from this route's directory**

Run: `rtk proxy grep -rn "coach/verify-purchase" apps/web/src --include=*.ts --include=*.tsx`
Expected: only `use-shop-sheet-state.ts` (fetch string literal, removed in Task A3) — no TypeScript `import` statements (it's a route handler, never imported directly).

- [ ] **Step 2: Delete the route and its test**

```bash
git rm apps/web/src/app/api/coach/verify-purchase/route.ts
git rm apps/web/src/app/api/coach/verify-purchase/__tests__/route.test.ts
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: PASS (nothing else imports this route's exports — it only exported `POST`, a route-handler convention Next.js resolves by file path, not by import).

- [ ] **Step 4: Commit**

```bash
git add -u apps/web/src/app/api/coach/verify-purchase
git commit -m "refactor(coach): delete verify-purchase Shop-TX route

Peones already covers Coach analysis payment when the free-credit
seed runs out (Sprint 4). This was the last consumer of the
itemId 3/4 Shop-TX credit-pack purchase — retiring it in the same
cluster as the catalog/UI cleanup (next commit).

Wolfcito 🐾 @akawolfcito"
```

### Task A2: Remove Coach packs from the shop catalog

**Files:**
- Modify: `apps/web/src/lib/contracts/shop-catalog.ts`
- Modify: `apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SHOP_ITEMS` (3 entries: PRO, Founder, Founder-CELO-sibling), `ShopCopyKey` (drops `"coachPack5" | "coachPack20"`), `SHOP_TILE_ASSETS` (drops the two coach keys). `COACH_PACK_ITEMS` and `CoachPackSize` are deleted — Task A3/A4 are the only consumers and both are removed in this same Part.

- [ ] **Step 1: Remove the Coach pack type, constant, catalog entries, and copy-key union members**

In `apps/web/src/lib/contracts/shop-catalog.ts`, remove the `"coachPack5" | "coachPack20"` members from `ShopCopyKey` (lines 54-59):

```typescript
export type ShopCopyKey =
  | "founderBadge"
  | "retryShield"
  | "pro";
```

Remove the two coach entries from `SHOP_ITEMS` (lines 76-84 today), including the comment block above them:

```typescript
export const SHOP_ITEMS: readonly ShopCatalogEntry[] = [
  { itemId: PRO_ITEM_ID, copyKey: "pro" },
  { itemId: FOUNDER_BADGE_ITEM_ID, copyKey: "founderBadge" },
  { itemId: SHIELD_ITEM_ID, copyKey: "retryShield" },
  // Helper entry for the CELO route. Hidden from the shop card list —
  // only its on-chain configured/enabled flags drive the visibility of
  // the "Buy with CELO" button rendered next to founder.
  { itemId: FOUNDER_BADGE_CELO_ITEM_ID, copyKey: "founderBadge" },
] as const;
```

Remove the two coach entries from `SHOP_TILE_ASSETS` (lines 108-109):

```typescript
export const SHOP_TILE_ASSETS: Record<ShopCopyKey, { icon: string }> = {
  pro: { icon: "/art/shop/pro" },
  founderBadge: { icon: "/art/shop/founder" },
  retryShield: { icon: "/art/shop/shield" },
};
```

Delete the entire `CoachPackSize` type + `COACH_PACK_ITEMS` constant (lines 117-127, including their doc comment).

- [ ] **Step 2: Update the catalog test to match the new shape**

In `apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts`, remove `COACH_PACK_ITEMS` from the import list, delete the four coach-specific `it()` blocks (`"includes both coach packs..."`, `"publishes the 5-credit coach pack..."`, `"publishes the 20-credit coach pack..."`, `"keeps the 20-credit pack at a better unit price..."`), and update the two length-bearing assertions:

```typescript
it("exposes founder + PRO + shield + CELO sibling in the catalog with copy keys for locale-aware resolution", () => {
  // PRO + Founder + Shield + CELO sibling.
  expect(SHOP_ITEMS).toHaveLength(4);
  for (const item of SHOP_ITEMS) {
    expect(item.copyKey.length).toBeGreaterThan(0);
  }
});
```

```typescript
it("declares an icon basename for every ShopCopyKey", () => {
  const expectedKeys = ["pro", "founderBadge", "retryShield"];
  expect(entries.map(([key]) => key).sort()).toEqual(expectedKeys.sort());
});
```

- [ ] **Step 3: Run the test, expect it to fail first (red), confirming the old assertions were live**

Run: `pnpm -C apps/web exec vitest run src/lib/contracts/__tests__/shop-catalog.test.ts`
Expected before Step 1/2 edits: the pre-existing suite passes (baseline). Apply Step 1 first, re-run — EXPECT FAIL (`SHOP_ITEMS` now length 4, old test still expects 6 coach-inclusive assertions, `COACH_PACK_ITEMS` import errors). This confirms the test actually exercises the catalog shape.

- [ ] **Step 4: Apply Step 2 edits, re-run, expect pass**

Run: `pnpm -C apps/web exec vitest run src/lib/contracts/__tests__/shop-catalog.test.ts`
Expected: PASS, all coach-specific tests gone, remaining tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/contracts/shop-catalog.ts apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts
git commit -m "refactor(shop): remove Coach pack catalog entries (itemId 3/4)

Wolfcito 🐾 @akawolfcito"
```

### Task A3: Remove Coach pack purchase wiring from useShopSheetState

**Files:**
- Modify: `apps/web/src/lib/shop/use-shop-sheet-state.ts`
- Modify: `apps/web/src/lib/shop/__tests__/use-shop-sheet-state.test.tsx`

**Interfaces:**
- Consumes: `SHOP_ITEMS` (now 4 entries, from Task A2).
- Produces: `handleConfirmPurchase`'s `txSource` ternary no longer branches on `COACH_PACK_ITEMS`; the coach `else if` POST branch is gone.

- [ ] **Step 1: Remove the `COACH_PACK_ITEMS` import and its two ternary branches**

In `apps/web/src/lib/shop/use-shop-sheet-state.ts`, remove `COACH_PACK_ITEMS` from the `shop-catalog` import (line 24). Simplify the `txSource` ternary (lines 448-457):

```typescript
    const txSource =
      selectedItem.itemId === SHIELD_ITEM_ID
        ? "shop_retry_shield"
        : selectedItem.itemId === PRO_ITEM_ID
          ? "shop_pro"
          : "shop_founder_badge";
```

Delete the `else if` coach branch entirely (lines 505-532 today — the block starting `} else if (selectedItem.itemId === COACH_PACK_ITEMS[5].itemId ||` through its closing `}`), leaving:

```typescript
      if (selectedItem.itemId === SHIELD_ITEM_ID) {
        creditShieldServerSide(buyHash as `0x${string}`, address);
      } else if (selectedItem.itemId === PRO_ITEM_ID) {
        // verify-pro is the activation contract — without it the user
        // paid on-chain but coach:pro:<wallet> never lands in Redis.
        // Await the receipt + POST inline so an HTTP failure surfaces
        // in `errorMessage` and the user knows to retry from the PRO
        // sheet. The route is idempotent (proProcessedTx guard), so a
        // retry with the same txHash returns the same expiresAt.
        if (publicClient) {
          try {
            await waitForReceiptWithTimeout(publicClient, buyHash as `0x${string}`);
            const res = await fetch("/api/verify-pro", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ txHash: buyHash, walletAddress: address }),
            });
            if (!res.ok) {
              setErrorMessage(
                "PRO purchased on-chain — activation pending. Open the PRO menu to retry verification.",
              );
            }
          } catch {
            setErrorMessage(
              "PRO purchased on-chain — activation pending. Open the PRO menu to retry verification.",
            );
          }
        }
      }
```

- [ ] **Step 2: Update the hook's test file**

Run: `rtk proxy grep -n "COACH_PACK\|coach_5\|coach_20\|verify-purchase" apps/web/src/lib/shop/__tests__/use-shop-sheet-state.test.tsx`

Remove every test case that asserts on a coach-pack purchase branch (buys itemId 3n/4n, expects a `verify-purchase` POST, or expects `txSource: "shop_coach_5"|"shop_coach_20"`). Keep the Shield and PRO branch tests untouched.

- [ ] **Step 3: Run the test, confirm it fails before the source edit, passes after**

Run: `pnpm -C apps/web exec vitest run src/lib/shop/__tests__/use-shop-sheet-state.test.tsx`
Before Step 1: baseline green. After Step 1 (source edited) but before Step 2 (test still references `COACH_PACK_ITEMS`): FAIL with `COACH_PACK_ITEMS is not exported` / assertion mismatches. After Step 2: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/shop/use-shop-sheet-state.ts apps/web/src/lib/shop/__tests__/use-shop-sheet-state.test.tsx
git commit -m "refactor(shop): remove Coach pack purchase wiring from useShopSheetState

Wolfcito 🐾 @akawolfcito"
```

### Task A4: Remove Coach pack tiles from ShopSheet

**Files:**
- Modify: `apps/web/src/components/exercises/shop-sheet.tsx`
- Modify: `apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx`

**Interfaces:**
- Consumes: `SHOP_ITEMS` (4 entries).
- Produces: `ShopTier` drops `"coach"`, `copyKeyForItem`/`toneForCopyKey` drop their coach branches, the hero lane's `COACH_PACK_20_ITEM_ID` hero tile is gone (PRO becomes the sole hero tile), mini-lane drops itemId `3n`.

- [ ] **Step 1: Simplify `ShopTier` and its mapper**

```typescript
type ShopTier = "pro" | "shield" | "founder";

function tierForCopyKey(copyKey: ShopCopyKey): ShopTier {
  switch (copyKey) {
    case "pro":
      return "pro";
    case "retryShield":
      return "shield";
    case "founderBadge":
      return "founder";
  }
}
```

- [ ] **Step 2: Simplify `copyKeyForItem`**

```typescript
function copyKeyForItem(itemId: bigint): ShopCopyKey {
  if (itemId === PRO_ITEM_ID) return "pro";
  if (itemId === FOUNDER_BADGE_ITEM_ID) return "founderBadge";
  if (itemId === SHIELD_ITEM_ID) return "retryShield";
  return "retryShield";
}
```

- [ ] **Step 3: Simplify `toneForCopyKey`**

```typescript
function toneForCopyKey(copyKey: ShopCopyKey): ShopTileTone {
  switch (copyKey) {
    case "pro":
      return "purple";
    case "founderBadge":
      return "orange";
    case "retryShield":
      return "blue";
  }
}
```

- [ ] **Step 4: Collapse the hero lane to PRO only, drop coach from the mini lane**

Replace the hero-lane IIFE (today keyed on `COACH_PACK_20_ITEM_ID`) with a PRO-only hero tile — PRO keeps its featured ribbon since it's now the sole hero SKU:

```typescript
          {(() => {
            const heroItems = items.filter((it) => it.itemId === PRO_ITEM_ID);
            return heroItems.map((item, index) => {
              const copyKey = copyKeyForItem(item.itemId);
              return (
                <ShopItemCard
                  key={item.itemId.toString()}
                  item={item}
                  isFeatured={item.configured && item.enabled}
                  onSelectItem={onSelectItem}
                  position={index}
                  tier={tierForCopyKey(copyKey)}
                />
              );
            });
          })()}
```

Replace `const miniOrder: bigint[] = [3n, SHIELD_ITEM_ID];` with:

```typescript
              const miniOrder: bigint[] = [SHIELD_ITEM_ID];
```

- [ ] **Step 5: Update the ShopSheet test**

Run: `rtk proxy grep -n "coach\|Coach\|4n\|3n" apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx`

Remove assertions that expect a coach tile to render, expect `tier="coach"`, or reference `COACH_PACK_20_ITEM_ID`/itemId `3n`/`4n`. Update any snapshot/DOM assertion that counted tiles (hero lane now renders 1 tile, not 2; mini lane renders 1, not 2) to the new counts.

- [ ] **Step 6: Run test, expect fail-then-pass**

Run: `pnpm -C apps/web exec vitest run src/components/exercises/__tests__/shop-sheet.test.tsx`
Before Steps 1-4: baseline green. After Steps 1-4 (source edited, test not yet updated): FAIL (missing coach tiles / tier assertions). After Step 5: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/exercises/shop-sheet.tsx apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx
git commit -m "refactor(shop): remove Coach pack tiles from ShopSheet

PRO becomes the sole hero-lane tile; Shield is the only mini-lane
tile remaining after Coach packs retire.

Wolfcito 🐾 @akawolfcito"
```

### Task A5: Remove Coach pack copy, verify no orphan references, refresh VR baseline, verify Coach paywall CTA, close PR-A

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts`
- Modify: `apps/web/src/lib/content/messages/es.ts`
- Modify (if present): `apps/web/src/app/dev/exercises-popups/fixture.tsx`
- Modify: `apps/web/e2e/visual-regression.spec.ts`-covered baseline `hub-shop-sheet-open.png` (regenerated, not hand-edited)

**Interfaces:** none — pure cleanup + verification, no new exports.

- [ ] **Step 1: Remove `coachPack5`/`coachPack20` from `SHOP_ITEM_COPY`**

In `apps/web/src/lib/content/editorial.ts`, delete the `coachPack5` (lines 2068-2071) and `coachPack20` (lines 2072-2075) entries from `SHOP_ITEM_COPY`. Leave the `coachPack` (singular, no digit) entry alone — it is not part of `ShopCopyKey` and has no live consumer either way; touching it is out of scope for this cluster.

Mirror the same two-key removal in `apps/web/src/lib/content/messages/es.ts`'s `SHOP_ITEM_COPY.coachPack5`/`coachPack20` (lines 1597-1604).

- [ ] **Step 2: Check the dev fixture for a dangling reference**

Run: `rtk proxy grep -n "coachPack\|COACH_PACK" apps/web/src/app/dev/exercises-popups/fixture.tsx`

If it references `coachPack5`/`coachPack20`/`COACH_PACK_ITEMS`, remove that fixture entry the same way Task A2-A4 did for its production counterpart. If the grep returns nothing, no action needed — this step exists to catch a stale reference before `tsc` does.

- [ ] **Step 3: Verify the Coach "out of credits" CTA doesn't dead-end on the removed tiles**

Run: `rtk proxy grep -rn "shouldShowPaywall\|phase === \"paywall\"\|setPhaseState(\"paywall\")" apps/web/src/lib apps/web/src/app apps/web/src/components`

Verified during planning: `useCoachAnalysis`'s `"paywall"` phase (set in `use-coach-analysis.ts` when `attemptCoachSpendWithPeones` returns `insufficient`/`error`) has **no consumer that renders anything for it** in either `arena/page.tsx` or `coach-game-client.tsx` today — this is a pre-existing gap, not something this cluster introduces or regresses. `AccountCoachRow` (the component the shop-catalog.ts comment referred to as "the standalone CoachPaywall... funnels here") is defined but has zero render call sites anywhere in `apps/web/src` today (confirmed via `rtk proxy grep -rln "AccountCoachRow" apps/web/src` → only its own file + its own test). **Conclusion: there is no live "buy more coach credits" CTA pointing at the now-deleted tiles to repoint.** If the grep above turns up a render site this plan's research missed, stop and re-scope this step before continuing — do not guess a fix.

- [ ] **Step 4: Full suite + typecheck**

Run: `pnpm -C apps/web test`
Expected: all green, no orphan-import failures from the coach-pack deletion.

Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: PASS.

- [ ] **Step 5: Refresh the `hub-shop-sheet-open` VR baseline**

Run: `pnpm -C apps/web test:e2e:visual -- -g "hub-shop-sheet-open"`
Expected: FAIL on first run (tile grid changed — 2 fewer tiles). Re-run with the update flag your Playwright config uses for this suite (check `package.json`'s `test:e2e:visual` script for the `--update-snapshots` equivalent) to regenerate `hub-shop-sheet-open.png`, then re-run without the update flag to confirm it now passes.

- [ ] **Step 6: Commit copy + baseline**

```bash
git add apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts
git add apps/web/e2e/__screenshots__ # or wherever the updated baseline PNG lives — verify path via git status first
git commit -m "chore(shop): remove Coach pack copy, refresh VR baseline

Wolfcito 🐾 @akawolfcito"
```

- [ ] **Step 7: Push, open PR-A, merge**

```bash
git push -u origin refactor/retire-coach-shop-tx-packs
gh pr create --title "refactor(coach): retire Shop-TX credit-pack purchase" --body "Retires the itemId 3/4 Shop-approve-TX Coach pack purchase path. Coach analysis now has exactly 2 payment paths: PRO (bypass) and 1 Peón/use (Sprint 4, unchanged). Free 3-credit onboarding seed is untouched. Full suite green, VR baseline refreshed."
gh pr merge --merge --delete-branch
```

---

## Part B — Shield: fix bug, add Peones fallback, retire Shop-TX purchase

### Task B1: Add `"shield"` as a valid Peones ledger source (migration + type + schema-sync test)

This is Commit 0 of the Shield work — nothing else in Part B can land before this, per red-team P0-1.

**Files:**
- Create: `apps/web/supabase/migrations/20260701150000_peones_shield_source.sql`
- Modify: `apps/web/src/lib/peones/types.ts`
- Modify: `apps/web/src/lib/peones/__tests__/schema-sync.test.ts`

**Interfaces:**
- Produces: `PeonesLedgerSource` gains `"shield"`. This is consumed by Task B2 (`PEONES_SPEND_TARGETS`).

- [ ] **Step 1: Write the failing schema-sync assertion first**

In `apps/web/src/lib/peones/__tests__/schema-sync.test.ts`, add a new migration path constant and read it, following the existing `LABYRINTH_MIGRATION_PATH` pattern:

```typescript
const SHIELD_MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260701150000_peones_shield_source.sql",
);
```

```typescript
const shieldMigration = readFileSync(SHIELD_MIGRATION_PATH, "utf-8");
```

Add `"shield"` to `TS_SOURCES`:

```typescript
const TS_SOURCES: PeonesLedgerSource[] = [
  "daily_tactic",
  "daily_streak_bonus",
  "daily_lab",
  "exercise_completion",
  "labyrinth_completion",
  "senda_milestone",
  "pack_purchase",
  "welcome_pack",
  "coach",
  "hint",
  "retry",
  "save_game",
  "labyrinth_key",
  "admin_grant",
  "shield",
];
```

In the `"source SQL check matches..."` test, union in the new migration's CHECK list the same way the labyrinth migration is unioned in today:

```typescript
    const shieldMatch = shieldMigration.match(
      /check\s*\(\s*source\s+in\s*\(([\s\S]*?)\)\s*\)/i,
    );
    expect(shieldMatch, "shield migration must declare a CHECK list").not.toBeNull();
    const shieldSources = shieldMatch![1]!
      .split(",")
      .map((t) => t.trim().replace(/^'(.*)'$/, "$1"))
      .filter(Boolean);
    const effective = new Set([...sqlOriginal, ...wpSources, ...labSources, ...shieldSources]);
```

- [ ] **Step 2: Run the test, confirm it fails (file doesn't exist yet)**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/schema-sync.test.ts`
Expected: FAIL — `ENOENT` reading `20260701150000_peones_shield_source.sql` (doesn't exist yet), and separately `TS_SOURCES` now has `"shield"` with no SQL counterpart.

- [ ] **Step 3: Write the migration**

```sql
-- Chesscito — Peones shield source
--
-- 2026-07-01. Adds `shield` as a valid value of `peones_ledger.source`.
-- Backs the Peones-spend fallback for Retry Shield (Phase 1
-- consolidation, docs/superpowers/specs/2026-07-01-coach-shield-peones-
-- consumables-phase1-design.md) — mirrors the `coach` spend source's
-- shape, but a shield rescue is NOT a naturally idempotent artifact the
-- way a cached Coach analysis is, so the endpoint additionally holds a
-- one-row-one-grant SETNX guard in Redis (see /api/shields/spend) on
-- top of this ledger row. This migration only adds the source value;
-- it is not subject to the daily-family cap (not an earn), so
-- PEONES_DAILY_CAP_SOURCES and peones_balance_with_caps are unchanged.

alter table public.peones_ledger
  drop constraint peones_ledger_source_check;

alter table public.peones_ledger
  add constraint peones_ledger_source_check
  check (source in (
    'daily_tactic',
    'daily_streak_bonus',
    'daily_lab',
    'exercise_completion',
    'labyrinth_completion',
    'senda_milestone',
    'pack_purchase',
    'welcome_pack',
    'coach',
    'hint',
    'retry',
    'save_game',
    'labyrinth_key',
    'admin_grant',
    'shield'
  ));
```

- [ ] **Step 4: Add `"shield"` to the TypeScript union**

In `apps/web/src/lib/peones/types.ts`, update the `PeonesLedgerSource` doc comment's "Spend sources" line and the union itself:

```typescript
 *   coach, hint, retry, save_game, labyrinth_key, shield
 */
export type PeonesLedgerSource =
  // Earn — daily-family (the cap applies)
  | "daily_tactic"
  | "daily_streak_bonus"
  | "daily_lab"
  // Earn — non-daily
  | "exercise_completion"
  | "labyrinth_completion"
  | "senda_milestone"
  | "pack_purchase"
  | "welcome_pack"
  // Spend
  | "coach"
  | "hint"
  | "retry"
  | "save_game"
  | "labyrinth_key"
  | "shield"
  // Ops
  | "admin_grant";
```

- [ ] **Step 5: Run the test again, confirm it passes**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/schema-sync.test.ts`
Expected: PASS — all 5 `it()` blocks green, `"shield"` present on both sides.

- [ ] **Step 6: Apply the migration locally, then commit**

Run: `pnpm -C apps/web exec supabase migration list` (from `apps/web/` per `[[feedback_supabase_cwd]]`) to confirm the new file is picked up as pending. Per `[[feedback_supabase_workflow]]`, this migration is committed here; the hosted `db push --linked` apply is a separate, explicit operator step before PR-B merges to `main` — flag this to the user at the end of Part B, do not run it yourself without confirmation.

```bash
git add apps/web/supabase/migrations/20260701150000_peones_shield_source.sql apps/web/src/lib/peones/types.ts apps/web/src/lib/peones/__tests__/schema-sync.test.ts
git commit -m "feat(peones): add shield as a valid ledger source

Commit 0 of the Shield Peones-fallback feature (red-team P0-1) —
without this the fallback throws check_violation in prod while
mocked unit tests stay green.

Wolfcito 🐾 @akawolfcito"
```

### Task B2: Add `"shield"` as a Peones spend target

**Files:**
- Modify: `apps/web/src/lib/peones/spend-service.ts`
- Modify: `apps/web/src/lib/peones/__tests__/spend-service.test.ts`

**Interfaces:**
- Consumes: `PeonesLedgerSource` (now includes `"shield"`, from Task B1).
- Produces: `PEONES_SPEND_TARGETS` includes `"shield"`; `SPEND_COST_BY_TARGET.shield === 2`; `SPEND_IDEMPOTENCY_PREFIX_BY_TARGET.shield === "spend:shield:"`. Consumed by Task B3 (`shield-spend-fallback.ts`) and Task B4 (`/api/shields/spend` route).

- [ ] **Step 1: Read the existing test file to match its assertion style, then write the failing additions**

Add assertions (exact form depends on the existing file's structure — mirror however it currently asserts `PEONES_SPEND_TARGETS`/`SPEND_COST_BY_TARGET`/`SPEND_IDEMPOTENCY_PREFIX_BY_TARGET` membership for `"coach"`) for:
- `PEONES_SPEND_TARGETS` includes `"shield"`.
- `SPEND_COST_BY_TARGET.shield === 2`.
- `SPEND_IDEMPOTENCY_PREFIX_BY_TARGET.shield === "spend:shield:"`.
- `hasSpendIdempotencyPrefix("shield", "spend:shield:0xabc:5")` is `true`; `hasSpendIdempotencyPrefix("shield", "spend:coach:0xabc:5")` is `false`.
- `isPeonesSpendTarget("shield")` is `true`.

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/spend-service.test.ts`
Expected: FAIL — `"shield"` not yet in any of the three tables.

- [ ] **Step 3: Implement**

```typescript
export const PEONES_SPEND_TARGETS = [
  "coach",
  "hint",
  "retry",
  "save_game",
  "shield",
] as const;
```

```typescript
export const SPEND_COST_BY_TARGET: Readonly<Record<PeonesSpendTarget, number>> = {
  coach: 1,
  hint: 1,
  retry: 2, // DEPRECATED sink — never charged (see note above)
  save_game: 1,
  /** Shield rescue — 2 Peones. PROVISIONAL: carried over from the
   *  2026-06-05 Sprint 4 decision to unblock this cluster; operator
   *  has flagged this needs a real economic-model pass across all
   *  consumables (Coach's 1 Peón for a full LLM analysis is already
   *  suspect next to this). Do not treat as final. */
  shield: 2,
};
```

```typescript
export const SPEND_IDEMPOTENCY_PREFIX_BY_TARGET: Readonly<
  Record<PeonesSpendTarget, string>
> = {
  coach: "spend:coach:",
  hint: "spend:hint:",
  retry: "spend:retry:",
  save_game: "spend:save_game:",
  shield: "spend:shield:",
};
```

Add `"attemptSeq"` to `SPEND_METADATA_WHITELIST` only if it isn't already there — check first: it already is (line 101 of the current file), no change needed there.

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/spend-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/peones/spend-service.ts apps/web/src/lib/peones/__tests__/spend-service.test.ts
git commit -m "feat(peones): register shield as a spend target (2 Peones, provisional)

Wolfcito 🐾 @akawolfcito"
```

### Task B3: `shield-spend-fallback.ts` — client orchestrator

**Files:**
- Create: `apps/web/src/lib/peones/shield-spend-fallback.ts`
- Create: `apps/web/src/lib/peones/__tests__/shield-spend-fallback.test.ts`

**Interfaces:**
- Consumes: `submitPeonesSpend` (from `@/lib/peones/spend-client`, unchanged signature), `emitPeonesSpent`/`emitPeonesSpendBlocked`/`emitPeonesSpendFailed`/`emitPeonesSpendBypassed` (from `@/lib/peones/telemetry`, unchanged signatures).
- Produces: `buildShieldIdempotencyKey(wallet: string, attemptSeq: number): string` and `attemptShieldSpendWithPeones(args: ShieldPeonesAttemptArgs): Promise<ShieldPeonesAttempt>`. Consumed by Task B5 (`use-fail-rescue.ts`) and Task B7 (`exercises-screen.tsx`).

- [ ] **Step 1: Write the failing tests first** (mirrors `coach-spend-fallback.test.ts` structure exactly — same mocks, same describe blocks, swap `gameId`→`attemptSeq` and `"coach"`→`"shield"`)

```typescript
/**
 * Shield Peones spend fallback tests.
 *
 * Mirrors coach-spend-fallback.test.ts. Key difference under test:
 * the idempotency key is built from `attemptSeq` (a number), not a
 * gameId (a UUID string) — same-attempt retries collapse onto one
 * ledger row, a fresh attempt (advanced attemptSeq) gets a fresh row.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesSpent: vi.fn(),
  emitPeonesSpendBlocked: vi.fn(),
  emitPeonesSpendBypassed: vi.fn(),
  emitPeonesSpendFailed: vi.fn(),
}));

import {
  attemptShieldSpendWithPeones,
  buildShieldIdempotencyKey,
} from "@/lib/peones/shield-spend-fallback";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";
import type { PeonesSpendResult } from "@/lib/peones/spend-client";

const mockedSpent = vi.mocked(emitPeonesSpent);
const mockedBlocked = vi.mocked(emitPeonesSpendBlocked);
const mockedBypassed = vi.mocked(emitPeonesSpendBypassed);
const mockedFailed = vi.mocked(emitPeonesSpendFailed);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const SEQ = 7;

beforeEach(() => {
  mockedSpent.mockReset();
  mockedBlocked.mockReset();
  mockedBypassed.mockReset();
  mockedFailed.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildShieldIdempotencyKey", () => {
  it("uses the spend:shield:<wallet>:<attemptSeq> format", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).toBe(`spend:shield:${W}:${SEQ}`);
  });

  it("lowercases the wallet defensively", () => {
    const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    expect(buildShieldIdempotencyKey(upper, SEQ)).toBe(`spend:shield:${W}:${SEQ}`);
  });

  it("same attemptSeq always yields the same key (collapses retries onto one row)", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).toBe(buildShieldIdempotencyKey(W, SEQ));
  });

  it("a different attemptSeq yields a different key (fresh attempt, fresh row)", () => {
    expect(buildShieldIdempotencyKey(W, SEQ)).not.toBe(buildShieldIdempotencyKey(W, SEQ + 1));
  });
});

describe("attemptShieldSpendWithPeones — paid path", () => {
  it("returns kind:'paid' with the canonical idempotency key", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      debited: 2,
      newBalance: 10,
      attestationHash: "sha256:abc",
      ledgerId: 55,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({
      kind: "paid",
      peonesIdempotencyKey: `spend:shield:${W}:${SEQ}`,
      debited: 2,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 10,
      attestationHash: "sha256:abc",
    });
    expect(submitImpl).toHaveBeenCalledWith({
      wallet: W,
      amount: 2,
      target: "shield",
      targetId: String(SEQ),
      idempotencyKey: `spend:shield:${W}:${SEQ}`,
      metadata: { attemptSeq: SEQ, surface: "shield" },
    });
    expect(mockedSpent).toHaveBeenCalledTimes(1);
  });

  it("duplicate (debited=0, duplicate=true): paid result WITHOUT re-emitting peones_spent", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "success",
      wallet: W,
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      debited: 0,
      newBalance: 10,
      attestationHash: "sha256:abc",
      ledgerId: 55,
      duplicate: true,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result.kind).toBe("paid");
    if (result.kind === "paid") expect(result.duplicate).toBe(true);
    expect(mockedSpent).not.toHaveBeenCalled();
  });
});

describe("attemptShieldSpendWithPeones — failure paths", () => {
  it("insufficient_balance: returns kind:'insufficient' + emits blocked", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "insufficient_balance",
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({ kind: "insufficient" });
    expect(mockedBlocked).toHaveBeenCalledWith({
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      reason: "insufficient_balance",
    });
  });

  it("technical error: returns kind:'error' + emits failed with reason", async () => {
    const submitImpl = vi.fn().mockResolvedValue({
      kind: "error",
      error: "network",
    } satisfies PeonesSpendResult);

    const result = await attemptShieldSpendWithPeones({
      wallet: W,
      attemptSeq: SEQ,
      submitImpl,
    });

    expect(result).toEqual({ kind: "error", reason: "network" });
    expect(mockedFailed).toHaveBeenCalledWith({
      target: "shield",
      targetId: String(SEQ),
      requested: 2,
      reason: "network",
    });
  });
});
```

- [ ] **Step 2: Run, confirm fail (module doesn't exist)**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/shield-spend-fallback.test.ts`
Expected: FAIL — cannot resolve `@/lib/peones/shield-spend-fallback`.

- [ ] **Step 3: Implement**

```typescript
/**
 * Shield spend fallback — Peones-side payment path for a Retry
 * Shield rescue when the user has 0 shields left.
 *
 * Mirrors coach-spend-fallback.ts's shape, with one deliberate
 * difference: the idempotency identity is `attemptSeq` (a per-attempt
 * counter), not a gameId. A shield rescue is NOT a naturally
 * idempotent artifact the way a cached Coach analysis is — replaying
 * the same request must land on the same ledger row (same attempt),
 * while a genuinely new rescue attempt (advanced attemptSeq) must get
 * a fresh row. The server additionally holds a one-row-one-grant
 * Redis guard (see /api/shields/spend) so a captured, replayed key
 * cannot mint unlimited rescues from a single payment — see red-team
 * P0-2/P0-3 in docs/superpowers/specs/2026-07-01-coach-shield-peones-
 * consumables-phase1-redteam.md.
 *
 * Pure orchestration: NEVER throws. NEVER reads/writes localStorage.
 * NEVER mutates the server-side shield counter directly — that
 * happens inside /api/shields/spend's Peones branch (Task B4).
 */

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";

export type ShieldPeonesAttemptArgs = {
  wallet: string;
  /** Stable per-rescue-attempt identifier. Must be the SAME value for
   *  every retry of one rescue tap (network blip, double-tap) and a
   *  DIFFERENT value for a genuinely new rescue attempt — never a
   *  timestamp, never a bare exercise id (see module doc). */
  attemptSeq: number;
  /** Test seam. */
  submitImpl?: typeof submitPeonesSpend;
};

export type ShieldPeonesAttempt =
  | {
      kind: "paid";
      /** Forwarded to /api/shields/spend so the server can verify the
       *  Peones row exists AND has not already been consumed. */
      peonesIdempotencyKey: string;
      debited: number;
      duplicate: boolean;
      proBypassApplied: boolean;
      newBalance: number;
      attestationHash: string;
    }
  | { kind: "insufficient" }
  | { kind: "error"; reason: string };

/**
 * Builds the canonical Shield idempotency key. Same wallet + same
 * attemptSeq always collapses to the same key.
 *
 * Format mirrors calibration §9.1: `spend:shield:{wallet}:{attemptSeq}`.
 */
export function buildShieldIdempotencyKey(
  wallet: string,
  attemptSeq: number,
): string {
  return `spend:shield:${wallet.toLowerCase()}:${attemptSeq}`;
}

/**
 * Attempts to debit 2 Peones for a Shield rescue. Emits the relevant
 * telemetry event for the outcome. Caller decides what to render.
 */
export async function attemptShieldSpendWithPeones(
  args: ShieldPeonesAttemptArgs,
): Promise<ShieldPeonesAttempt> {
  const { wallet, attemptSeq, submitImpl } = args;
  const submit = submitImpl ?? submitPeonesSpend;
  const idempotencyKey = buildShieldIdempotencyKey(wallet, attemptSeq);
  const targetId = String(attemptSeq);

  const result = await submit({
    wallet,
    amount: 2,
    target: "shield",
    targetId,
    idempotencyKey,
    metadata: {
      attemptSeq,
      surface: "shield",
    },
  });

  if (result.kind === "success") {
    if (result.proBypassApplied && result.quotaLimit != null && result.quotaUsed != null) {
      emitPeonesSpendBypassed({
        target: "shield",
        targetId,
        requested: 2,
        debited: 0,
        newBalance: result.newBalance,
        attestationHash: result.attestationHash,
        quotaUsed: result.quotaUsed,
        quotaLimit: result.quotaLimit,
      });
    } else if (result.debited > 0 && !result.duplicate) {
      emitPeonesSpent({
        target: "shield",
        targetId,
        requested: 2,
        debited: result.debited,
        newBalance: result.newBalance,
        attestationHash: result.attestationHash,
        duplicate: result.duplicate,
        proBypassApplied: result.proBypassApplied,
      });
    }
    return {
      kind: "paid",
      peonesIdempotencyKey: idempotencyKey,
      debited: result.debited,
      duplicate: result.duplicate,
      proBypassApplied: result.proBypassApplied,
      newBalance: result.newBalance,
      attestationHash: result.attestationHash,
    };
  }

  if (result.kind === "insufficient_balance") {
    emitPeonesSpendBlocked({
      target: "shield",
      targetId,
      requested: 2,
      reason: "insufficient_balance",
    });
    return { kind: "insufficient" };
  }

  emitPeonesSpendFailed({
    target: "shield",
    targetId,
    requested: 2,
    reason: result.error,
  });
  return { kind: "error", reason: result.error };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -C apps/web exec vitest run src/lib/peones/__tests__/shield-spend-fallback.test.ts`
Expected: PASS, all assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/peones/shield-spend-fallback.ts apps/web/src/lib/peones/__tests__/shield-spend-fallback.test.ts
git commit -m "feat(peones): shield-spend-fallback client orchestrator

Wolfcito 🐾 @akawolfcito"
```

### Task B4: `/api/shields/spend` — Peones branch with SETNX consumption guard

This is the load-bearing correctness task (red-team P0-2/P0-3). The branch order matters: a `peonesIdempotencyKey` request must NEVER fall through to the counter-decrement path (at 0 balance that would 409 before the key is ever checked).

**Files:**
- Modify: `apps/web/src/app/api/shields/spend/route.ts`
- Modify: `apps/web/src/app/api/shields/spend/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Supabase `peones_ledger` table (read-only `select` — no write from this route; the write already happened via `/api/peones/spend` in Task B2/B3's flow), `@upstash/redis` (new SETNX guard key).
- Produces: `POST /api/shields/spend` accepts an optional `peonesIdempotencyKey` in the body. Consumed by Task B5 (`use-fail-rescue.ts`) and Task B7 (`exercises-screen.tsx`).

- [ ] **Step 1: Write the failing tests first**

Add to `apps/web/src/app/api/shields/spend/__tests__/route.test.ts` (extend the existing `redisMock`/`supabase` mocking pattern — this route currently has no Supabase import, so add a `getSupabaseServer` mock alongside the existing `redis`/`demo-signing` mocks, following the shape used in `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts` for `verifyPeonesCoachPayment`-equivalent tests):

```typescript
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));
```

```typescript
import { getSupabaseServer } from "@/lib/supabase/server";

function mockSupabaseLedgerRow(row: Record<string, unknown> | null, error: unknown = null) {
  vi.mocked(getSupabaseServer).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error }),
        }),
      }),
    }),
  } as never);
}

describe("POST /api/shields/spend — Peones fallback branch", () => {
  const SEQ = 7;
  const VALID_KEY = `spend:shield:${ADDRESS}:${SEQ}`;

  it("grants the rescue when a valid, unconsumed Peones key is presented at 0 balance", async () => {
    mockSupabaseLedgerRow({
      wallet: ADDRESS,
      event_type: "spend",
      source: "shield",
      source_id: String(SEQ),
    });
    // SETNX guard succeeds (key not previously consumed).
    redisMock.eval.mockResolvedValueOnce(1);

    const res = await POST(
      makeRequest({ walletAddress: ADDRESS, peonesIdempotencyKey: VALID_KEY, attemptSeq: SEQ }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // The Lua counter DECRBY must NOT have been attempted on this path.
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    expect(redisMock.eval).not.toHaveBeenCalledWith(
      expect.stringContaining("DECRBY"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects a replayed key (SETNX guard already consumed) — closes the P0-2 replay hole", async () => {
    mockSupabaseLedgerRow({
      wallet: ADDRESS,
      event_type: "spend",
      source: "shield",
      source_id: String(SEQ),
    });
    // SETNX guard fails — key already marked consumed by a prior call.
    redisMock.eval.mockResolvedValueOnce(0);

    const res = await POST(
      makeRequest({ walletAddress: ADDRESS, peonesIdempotencyKey: VALID_KEY, attemptSeq: SEQ }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_consumed");
  });

  it("fails closed when the ledger row doesn't match (wrong wallet/source/source_id)", async () => {
    mockSupabaseLedgerRow({
      wallet: ADDRESS,
      event_type: "spend",
      source: "shield",
      source_id: "999", // mismatched attemptSeq
    });

    const res = await POST(
      makeRequest({ walletAddress: ADDRESS, peonesIdempotencyKey: VALID_KEY, attemptSeq: SEQ }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("insufficient");
    expect(redisMock.eval).not.toHaveBeenCalledWith(
      expect.stringContaining("NX"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("fails closed when the Supabase lookup errors", async () => {
    mockSupabaseLedgerRow(null, { message: "connection reset" });

    const res = await POST(
      makeRequest({ walletAddress: ADDRESS, peonesIdempotencyKey: VALID_KEY, attemptSeq: SEQ }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("insufficient");
  });

  it("falls through to the counter path when no peonesIdempotencyKey is present", async () => {
    redisMock.eval.mockResolvedValueOnce([7, 1]);

    const res = await POST(makeRequest({ walletAddress: ADDRESS }));
    expect(res.status).toBe(200);
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("DECRBY"),
      [`coach:shields:credited:${ADDRESS}`],
      [],
    );
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm -C apps/web exec vitest run src/app/api/shields/spend/__tests__/route.test.ts`
Expected: FAIL — route doesn't yet parse `peonesIdempotencyKey`/`attemptSeq`, `getSupabaseServer` import doesn't exist in the route yet.

- [ ] **Step 3: Implement the Peones branch**

```typescript
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { Redis } from "@upstash/redis";

import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import {
  enforceOrigin,
  enforceRateLimit,
  getRequestIp,
} from "@/lib/server/demo-signing";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/shields/spend
 *
 * Consume one shield from the caller's Redis-backed balance, OR —
 * when the caller has none and presents a `peonesIdempotencyKey` —
 * verify a 2-Peones ledger payment and grant the rescue without
 * touching the counter.
 *
 * The Peones branch is NOT a copy of Coach's verify-only-existence
 * check (`verifyPeonesCoachPayment` in analyze/route.ts). A shield
 * rescue is not a naturally idempotent artifact the way a cached
 * Coach analysis is — "the ledger row exists" alone would let a
 * captured key be replayed for unlimited free rescues (red-team
 * P0-2). This route additionally holds a one-row-one-grant SETNX
 * guard in Redis (`shieldPeonesConsumed`) so each valid ledger row
 * grants exactly one rescue.
 *
 * Branch order: if `peonesIdempotencyKey` is present, take the
 * verify-only path FIRST — never attempt the counter Lua decrement
 * on this path (at 0 balance it would 409 before the key is ever
 * checked). Fail closed on any Supabase error/mismatch.
 */

const logger = createLogger({ route: "/api/shields/spend" });
const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

/** Lua: atomic balance check + decrement. Returns [newBalance, spent]
 *  where spent=1 on success, 0 on insufficient. */
const SHIELD_SPEND_LUA = `
  local cur = tonumber(redis.call('GET', KEYS[1])) or 0
  if cur < 1 then
    return { cur, 0 }
  end
  local newTotal = redis.call('DECRBY', KEYS[1], 1)
  return { newTotal, 1 }
`;

/** Lua: atomic one-row-one-grant guard. SETNX-with-TTL on the
 *  Peones-idempotency-key-derived Redis key; returns 1 if this call
 *  claimed it (first time), 0 if it was already claimed (replay). */
const SHIELD_PEONES_CONSUME_LUA = `
  local claimed = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1])
  if claimed then return 1 else return 0 end
`;

const PEONES_CONSUMED_TTL_SECONDS = 90 * 24 * 60 * 60;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Verifies a claimed Shield Peones payment against the ledger.
 * Fail-closed: any Supabase failure / shape mismatch returns false.
 */
async function verifyPeonesShieldPayment(
  peonesIdempotencyKey: string,
  wallet: string,
  attemptSeq: string,
): Promise<boolean> {
  const expected = `spend:shield:${wallet}:${attemptSeq}`;
  if (peonesIdempotencyKey !== expected) return false;
  const supabase = getSupabaseServer();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("peones_ledger")
    .select("wallet, event_type, source, source_id")
    .eq("idempotency_key", peonesIdempotencyKey)
    .maybeSingle();
  if (error || !data) return false;
  return (
    data.wallet === wallet &&
    data.event_type === "spend" &&
    data.source === "shield" &&
    data.source_id === attemptSeq
  );
}

export async function POST(req: Request) {
  try {
    try {
      enforceOrigin(req);
    } catch {
      return jsonError(403, "origin_blocked");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<{
      walletAddress: string;
      peonesIdempotencyKey: string;
      attemptSeq: number | string;
    }>;
    const walletAddress = body.walletAddress;
    if (!walletAddress) return jsonError(400, "missing_params");
    if (!isAddress(walletAddress)) return jsonError(400, "invalid_wallet");

    try {
      await enforceRateLimit(getRequestIp(req), walletAddress);
    } catch {
      return jsonError(429, "rate_limited");
    }

    const walletLower = walletAddress.toLowerCase();
    const walletHash = hashWallet(walletLower);

    // Peones branch — verify-only, never falls through to the
    // counter Lua on this path.
    if (
      body.peonesIdempotencyKey &&
      typeof body.peonesIdempotencyKey === "string" &&
      body.attemptSeq !== undefined
    ) {
      const attemptSeq = String(body.attemptSeq);
      let verified = false;
      try {
        verified = await verifyPeonesShieldPayment(
          body.peonesIdempotencyKey,
          walletLower,
          attemptSeq,
        );
      } catch (err) {
        logger.warn("shield_peones_verify_error", {
          wallet_hash: walletHash,
          errName: err instanceof Error ? err.name : "unknown",
        });
        verified = false; // fail-closed
      }

      if (!verified) {
        logger.info("shield_peones_insufficient", { wallet_hash: walletHash });
        return jsonError(409, "insufficient");
      }

      const consumeResult = (await redis.eval(
        SHIELD_PEONES_CONSUME_LUA,
        [`coach:shields:peones-consumed:${body.peonesIdempotencyKey}`],
        [PEONES_CONSUMED_TTL_SECONDS],
      )) as number;

      if (Number(consumeResult) !== 1) {
        logger.warn("shield_peones_replay_blocked", { wallet_hash: walletHash });
        return jsonError(409, "already_consumed");
      }

      logger.info("shield spent via peones", { wallet_hash: walletHash });
      return NextResponse.json({ ok: true, spent: 1, viaPeones: true });
    }

    // Counter branch (unchanged).
    const result = (await redis.eval(
      SHIELD_SPEND_LUA,
      [REDIS_KEYS.shieldsCredited(walletLower)],
      [],
    )) as [number, number] | (string | number)[];

    const balance = Number(Array.isArray(result) ? result[0] : 0);
    const spent = Number(Array.isArray(result) ? result[1] : 0);

    if (spent !== 1) {
      logger.info("insufficient", { wallet_hash: walletHash, balance });
      return jsonError(409, "insufficient");
    }

    logger.info("shield spent", { wallet_hash: walletHash, balance });

    return NextResponse.json({ ok: true, spent: 1, balance });
  } catch (err) {
    logger.error("unhandled exception", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "internal");
  }
}
```

Add the new key to `apps/web/src/lib/coach/redis-keys.ts` (the consume-guard key is inlined as a template literal above for simplicity, matching this route's existing style of inlining rather than always going through `REDIS_KEYS` — if you prefer consistency, add `shieldPeonesConsumed: (idempotencyKey: string) => \`coach:shields:peones-consumed:${idempotencyKey}\`` to `REDIS_KEYS` and use it in place of the inline template literal; either is acceptable, but pick one and use it in both the route and its test's key-format assertions).

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -C apps/web exec vitest run src/app/api/shields/spend/__tests__/route.test.ts`
Expected: PASS — all new + existing tests green (existing counter-path tests must still pass unmodified, confirming no regression).

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/shields/spend/route.ts apps/web/src/app/api/shields/spend/__tests__/route.test.ts
git commit -m "feat(shields): Peones-spend branch with one-row-one-grant guard

Not a copy of Coach's verify-only-existence check — a shield rescue
is not a naturally idempotent artifact, so a captured/replayed
idempotency key is blocked by an atomic SETNX consumption guard
(red-team P0-2). Branch order guarantees a Peones request never
falls through to the counter Lua (P1-2).

Wolfcito 🐾 @akawolfcito"
```

### Task B5: Wire the Peones fallback into `useFailRescue`

**Files:**
- Modify: `apps/web/src/lib/exercises/use-fail-rescue.ts`
- Test: `apps/web/src/lib/exercises/__tests__/use-fail-rescue.test.ts` (create if it doesn't exist — check first)

**Interfaces:**
- Consumes: `attemptShieldSpendWithPeones` (Task B3), extends `UseFailRescueOptions` with a required `attemptSeq: number` and `wallet: string | undefined` the caller must pass (Task B6 wires these from `exercises-screen.tsx`'s existing `attemptSeq` state and `address`).
- Produces: `onUseShield` now falls through to the Peones fallback when the server counter returns `insufficient` (409) AND `shieldsCount === 0` at call time.

- [ ] **Step 1: Check for an existing test file**

Run: `find apps/web/src/lib/exercises/__tests__ -iname "*fail-rescue*"`

If found, read it fully before writing new assertions so they match its existing mocking style. If not found, create `apps/web/src/lib/exercises/__tests__/use-fail-rescue.test.ts` using `@testing-library/react`'s `renderHook` (check `apps/web/src/lib/coach/__tests__/use-coach-credits.test.tsx` for this repo's established `renderHook` + `act` pattern before writing it from scratch).

- [ ] **Step 2: Write the failing test** — assert that when `shieldsCount === 0` and the server spend returns 409, `onUseShield` calls `attemptShieldSpendWithPeones` with the hook's `attemptSeq`/`wallet`, and on a `"paid"` result retries `/api/shields/spend` with `peonesIdempotencyKey` + `attemptSeq` in the body, calling `onRescued()` on success.

```typescript
it("falls through to the Peones fallback when shieldsCount is 0 and the counter path is insufficient", async () => {
  // useShieldsCount mocked to return 0, fetch mocked: first call
  // (counter path) → 409 insufficient; attemptShieldSpendWithPeones
  // mocked → paid; second fetch call (peones branch) → 200 ok.
  // Assert onRescued fires and NOT onSkipped.
});

it("does not attempt the Peones fallback when shieldsCount > 0 (counter path succeeds normally)", async () => {
  // existing behavior unchanged — no attemptShieldSpendWithPeones call.
});

it("falls through to onSkipped when the Peones fallback itself returns insufficient", async () => {
  // attemptShieldSpendWithPeones → { kind: "insufficient" } → onSkipped, not onServerError.
});
```

- [ ] **Step 3: Run, confirm fail**

Run: `pnpm -C apps/web exec vitest run src/lib/exercises/__tests__/use-fail-rescue.test.ts`
Expected: FAIL — current `onUseShield` has no Peones fallback branch.

- [ ] **Step 4: Implement**

Extend `UseFailRescueOptions` and `onUseShield`:

```typescript
export type UseFailRescueOptions = {
  onRescued: () => void;
  onSkipped: () => void;
  onServerError: () => void;
  onOpenShop: (focus: "welcome-pack" | "shield-sku") => void;
  /** Stable per-rescue-attempt counter — same value across retries of
   *  one rescue tap, advances on a genuinely new attempt. Threaded
   *  through to the Peones fallback's idempotency key. Owned by the
   *  caller (exercises-screen.tsx already tracks this for
   *  PeonesHintButton). */
  attemptSeq: number;
};
```

```typescript
  const onUseShield = useCallback(() => {
    if (!address || isSpending) return;
    setIsSpending(true);

    (async () => {
      try {
        const res = await fetch("/api/shields/spend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          spent?: number;
          balance?: number;
          error?: string;
        };

        if (res.ok && data.spent === 1 && typeof data.balance === "number") {
          writeCreditedCache(data.balance + readConsumedCount());
          dispatchShieldChange();
          optionsRef.current.onRescued();
          return;
        }

        // 409 insufficient with a 0 local balance — try the Peones
        // fallback before treating this as a deliberate skip.
        if (!res.ok && res.status === 409 && shieldsCount === 0) {
          const attempt = await attemptShieldSpendWithPeones({
            wallet: address,
            attemptSeq: optionsRef.current.attemptSeq,
          });
          if (attempt.kind === "paid") {
            const peonesRes = await fetch("/api/shields/spend", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                walletAddress: address,
                peonesIdempotencyKey: attempt.peonesIdempotencyKey,
                attemptSeq: optionsRef.current.attemptSeq,
              }),
            });
            if (peonesRes.ok) {
              optionsRef.current.onRescued();
              return;
            }
            optionsRef.current.onServerError();
            return;
          }
          // insufficient | error — same outcome as a deliberate skip.
          optionsRef.current.onSkipped();
          return;
        }

        if (!res.ok && res.status >= 500) {
          optionsRef.current.onServerError();
        } else {
          optionsRef.current.onSkipped();
        }
      } catch {
        optionsRef.current.onServerError();
      } finally {
        setIsSpending(false);
      }
    })();
  }, [address, isSpending, shieldsCount]);
```

Add the import: `import { attemptShieldSpendWithPeones } from "@/lib/peones/shield-spend-fallback";`

- [ ] **Step 5: Run, confirm pass**

Run: `pnpm -C apps/web exec vitest run src/lib/exercises/__tests__/use-fail-rescue.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/exercises/use-fail-rescue.ts apps/web/src/lib/exercises/__tests__/use-fail-rescue.test.ts
git commit -m "feat(exercises): wire Peones fallback into useFailRescue

Wolfcito 🐾 @akawolfcito"
```

### Task B6: Thread `attemptSeq` from `exercises-screen.tsx` into `useFailRescue`

**Files:**
- Modify: `apps/web/src/components/exercises/exercises-screen.tsx`

**Interfaces:**
- Consumes: `attemptSeq` (already a live value in this file — read its exact source at the `useFailRescue` call site around line 1507 before editing; it's the same value already passed to `PeonesHintButton` at line 2558).
- Produces: nothing new exported — `useFailRescue`'s new required option is satisfied.

- [ ] **Step 1: Read the current `useFailRescue` call site**

Run: `rtk proxy grep -n "attemptSeq\|useFailRescue" apps/web/src/components/exercises/exercises-screen.tsx`

Confirm `attemptSeq` is in scope at the point `failRescue = useFailRescue({...})` is called (line ~1507). It is — `attemptSeq` is destructured earlier in the component (line 983) for the `attemptSeq`-advance chain the retry guard uses.

- [ ] **Step 2: Add the option**

Add `attemptSeq,` to the `useFailRescue({...})` call's options object (alongside the existing `onRescued`/`onSkipped`/`onServerError`/`onOpenShop`).

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: PASS (the new required field is now satisfied; if `attemptSeq` isn't in scope where expected, this is where it fails loudly instead of silently).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/exercises/exercises-screen.tsx
git commit -m "feat(exercises): thread attemptSeq into useFailRescue

Wolfcito 🐾 @akawolfcito"
```

### Task B7: Fix the legacy local-only `handleUseShield` in `exercises-screen.tsx`

Red-team P1-1/P2: `handleUseShield` (line 1718) is the second UI surface (`ContextualActionSlot`, both call sites at lines 2652 and 2686) that spends a shield — today it decrements `chesscito:shields:consumed` locally and never calls the server, unlike `FailRescueModal`'s `onUseShield` (already server-backed). It also early-returns at `shieldCount <= 0`, meaning it can never reach the Peones fallback either.

**Files:**
- Modify: `apps/web/src/components/exercises/exercises-screen.tsx`
- Test: create `apps/web/src/components/exercises/__tests__/exercises-screen.test.tsx` scoped narrowly to this function if no broader test file exists — check first with `find apps/web/src/components/exercises/__tests__ -iname "*exercises-screen*"`.

**Interfaces:**
- Consumes: `attemptShieldSpendWithPeones` (Task B3), `attemptSeq` (already in scope in this component).
- Produces: `handleUseShield` becomes async, gains an in-flight guard, calls `/api/shields/spend` for real, and falls through to the Peones fallback at 0 balance — matching `useFailRescue.onUseShield`'s contract (async, guarded, real server call, Peones fallback) without literally duplicating that hook's internal state (this component doesn't need `isSpending` exposed to a caller — a local ref suffices since nothing outside `handleUseShield` reads it).

- [ ] **Step 1: Write the failing test**

If no test file exists for this component today, write a minimal, narrowly-scoped one that renders just enough to exercise `handleUseShield` in isolation — check `apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx` for this repo's convention on mocking `exercises-screen.tsx`'s heavy dependency tree (wagmi hooks, `useAccount`, etc.) before writing setup boilerplate; do not invent a different mocking pattern than what's already established.

Assert:
1. Tapping the shield action with `shieldCount > 0` calls `POST /api/shields/spend` (not the old `consumeOneShield()` local decrement).
2. A second rapid tap while the first request is in flight is a no-op (guard).
3. With `shieldCount === 0`, tapping calls `attemptShieldSpendWithPeones` (not an early return with no network call at all, which is today's behavior).

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm -C apps/web exec vitest run src/components/exercises/__tests__/exercises-screen.test.tsx`
Expected: FAIL against the current synchronous, unguarded, local-only `handleUseShield`.

- [ ] **Step 3: Implement**

Replace `handleUseShield` (currently lines 1718-1723):

```typescript
  const shieldSpendingRef = useRef(false);

  async function handleUseShield() {
    if (phase !== "failure" || shieldSpendingRef.current) return;
    shieldSpendingRef.current = true;
    autoReset.invalidate();

    try {
      const res = await fetch("/api/shields/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        spent?: number;
        balance?: number;
      };

      if (res.ok && data.spent === 1 && typeof data.balance === "number") {
        writeCreditedCache(data.balance + readConsumedCount());
        dispatchShieldChange();
        resetBoard();
        return;
      }

      if (!res.ok && res.status === 409 && shieldCount === 0 && address) {
        const attempt = await attemptShieldSpendWithPeones({
          wallet: address,
          attemptSeq,
        });
        if (attempt.kind === "paid") {
          const peonesRes = await fetch("/api/shields/spend", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              peonesIdempotencyKey: attempt.peonesIdempotencyKey,
              attemptSeq,
            }),
          });
          if (peonesRes.ok) {
            resetBoard();
            return;
          }
        }
      }
      // insufficient / error / 5xx — no shield spent, board still
      // resets so the player isn't stuck on the failure state.
      resetBoard();
    } finally {
      shieldSpendingRef.current = false;
    }
  }
```

Add `const shieldSpendingRef = useRef(false);` near the component's other refs (not inline where shown above if the file's convention groups ref declarations together — check nearby `autoReset`/similar ref patterns first). Add the import: `import { attemptShieldSpendWithPeones } from "@/lib/peones/shield-spend-fallback";`. Remove the now-dead `consumeOneShield` import (line 58) — confirm it has no other call site first:

Run: `rtk proxy grep -n "consumeOneShield" apps/web/src/components/exercises/exercises-screen.tsx apps/web/src/lib/shop/shield-storage.ts`
Expected: only the import (line 58, to be removed) and its definition in `shield-storage.ts` remain — if any other call site turns up, do not remove the import; investigate first.

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm -C apps/web exec vitest run src/components/exercises/__tests__/exercises-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/exercises/exercises-screen.tsx apps/web/src/components/exercises/__tests__/exercises-screen.test.tsx
git commit -m "fix(exercises): route ContextualActionSlot shield use through the server

handleUseShield decremented localStorage only and never told the
server — silently bypassing /api/shields/spend, unlike
FailRescueModal's onUseShield. Also never reached the Peones
fallback (early-returned at 0 balance). Now async, guarded against
double-tap, and falls through to Peones the same way the rescue
modal does.

Wolfcito 🐾 @akawolfcito"
```

### Task B8: Retire the Shield Shop-TX purchase path (itemId 2)

**Files:**
- Delete: `apps/web/src/app/api/credit-shield/route.ts`
- Delete: `apps/web/src/app/api/credit-shield/__tests__/route.test.ts`
- Modify: `apps/web/src/lib/contracts/shop-catalog.ts`
- Modify: `apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts`
- Modify: `apps/web/src/lib/shop/use-shop-sheet-state.ts`
- Modify: `apps/web/src/lib/shop/__tests__/use-shop-sheet-state.test.tsx`
- Modify: `apps/web/src/components/exercises/shop-sheet.tsx`
- Modify: `apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx`
- Modify: `apps/web/src/components/exercises/exercises-screen.tsx` (its own duplicate purchase handler — verified real, unlike Coach's equivalent in Part A)
- Modify: `apps/web/src/lib/shop/shield-storage.ts` (queue half only)
- Modify: `apps/web/src/lib/shop/use-shield-sync.ts`
- Modify: `apps/web/src/lib/content/editorial.ts` / `messages/es.ts` (Shop-purchase copy only)

**Interfaces:**
- Produces: `SHIELD_ITEM_ID`/`SHIELDS_PER_PURCHASE` removed entirely from `shop-catalog.ts` (verified: after this task their only remaining reference anywhere would be dead code — full grep confirms no consumer survives outside what this task deletes). `readDisplayedShields`/`readCreditedCache`/`readConsumedCount`/`consumeOneShield` and the boot-sync `GET /api/shields/me` hydration (both halves of `shield-storage.ts`/`use-shield-sync.ts` NOT related to the purchase queue) are untouched — Season Pass and the welcome-pack grant still need them.

- [ ] **Step 1: Delete the route**

```bash
git rm apps/web/src/app/api/credit-shield/route.ts
git rm apps/web/src/app/api/credit-shield/__tests__/route.test.ts
```

- [ ] **Step 2: Remove `SHIELD_ITEM_ID`/`SHIELDS_PER_PURCHASE` and the `"retryShield"` copy key from the catalog**

In `apps/web/src/lib/contracts/shop-catalog.ts`, delete the `SHIELD_ITEM_ID` constant + its doc comment (lines 1-7), delete `SHIELDS_PER_PURCHASE` + its doc comment (lines 112-115), remove `"retryShield"` from `ShopCopyKey`, remove the `{ itemId: SHIELD_ITEM_ID, copyKey: "retryShield" }` entry from `SHOP_ITEMS`, and remove `retryShield: { icon: "/art/shop/shield" }` from `SHOP_TILE_ASSETS`. `SHOP_ITEMS` is now `[PRO, Founder, Founder-CELO-sibling]` (3 entries — same count as after Task A2, since Task A2 already removed Coach and this task removes Shield from the same already-shrunk list).

- [ ] **Step 3: Update `shop-catalog.test.ts`**

Remove `SHIELD_ITEM_ID`/`SHIELDS_PER_PURCHASE` from the import, delete the `"ships the shield row..."` and `"credits 3 shield uses per purchase..."` tests, delete the `SHIELD_ITEM_ID` assertion inside the `"publishes the founder badge..."` test (keep the Founder/CELO-sibling assertions), update the `SHOP_TILE_ASSETS` `expectedKeys` list to `["pro", "founderBadge"]`.

- [ ] **Step 4: Run shop-catalog test, confirm fail-then-pass**

Run: `pnpm -C apps/web exec vitest run src/lib/contracts/__tests__/shop-catalog.test.ts`
After Step 2 only: FAIL. After Step 3: PASS.

- [ ] **Step 5: Remove Shield purchase wiring from `use-shop-sheet-state.ts`**

Remove `SHIELD_ITEM_ID` from the `shop-catalog` import. Remove `creditShieldServerSide` (the whole `useCallback`, lines 357-384) and its imports (`enqueuePendingTx`, `dequeuePendingTx`, `writeCreditedCache` from `shield-storage`, `dispatchShieldChange` from `shield-events`) — confirm no other use before deleting each:

Run: `rtk proxy grep -n "enqueuePendingTx\|dequeuePendingTx\|writeCreditedCache\|dispatchShieldChange\|creditShieldServerSide" apps/web/src/lib/shop/use-shop-sheet-state.ts`

Simplify the `txSource` ternary (drop the `SHIELD_ITEM_ID` branch):

```typescript
    const txSource =
      selectedItem.itemId === PRO_ITEM_ID
        ? "shop_pro"
        : "shop_founder_badge";
```

Remove the `if (selectedItem.itemId === SHIELD_ITEM_ID) { creditShieldServerSide(...) } else if` branch, leaving only the PRO `if`.

- [ ] **Step 6: Update `use-shop-sheet-state.test.tsx`**

Remove every Shield-purchase-branch test (buys itemId 2n, expects `creditShieldServerSide`/`credit-shield` POST, expects `txSource: "shop_retry_shield"`).

- [ ] **Step 7: Run, confirm fail-then-pass**

Run: `pnpm -C apps/web exec vitest run src/lib/shop/__tests__/use-shop-sheet-state.test.tsx`

- [ ] **Step 8: Remove the Shield tile + copy-key/tone branches from `shop-sheet.tsx`**

Remove `SHIELD_ITEM_ID` from the import. Simplify `ShopTier` to `"pro" | "founder"`, drop the `"shield"` case from `tierForCopyKey`. Simplify `copyKeyForItem` to only branch on `PRO_ITEM_ID`/`FOUNDER_BADGE_ITEM_ID`, defaulting to `"founderBadge"`. Drop the `"retryShield"` case from `toneForCopyKey`. Change `const miniOrder: bigint[] = [SHIELD_ITEM_ID];` (set in Task A4) to remove the mini-lane entirely if it now has nothing left — replace the mini-cards lane's item-mapping IIFE with an empty array (`const miniOrder: bigint[] = [];`) rather than deleting the surrounding grid, since the Welcome Pack tile still renders in that lane.

- [ ] **Step 9: Update `shop-sheet.test.tsx`**

Remove Shield-tile assertions (tier="shield", itemId 2n rendering, `retryShield` copy key lookups).

- [ ] **Step 10: Run, confirm fail-then-pass**

Run: `pnpm -C apps/web exec vitest run src/components/exercises/__tests__/shop-sheet.test.tsx`

- [ ] **Step 11: Remove the Shield branch from `exercises-screen.tsx`'s duplicate `handleConfirmPurchase`**

Remove `SHIELD_ITEM_ID` from the `shop-catalog` import (keep `PRO_ITEM_ID`). Simplify the `txSource` ternary (lines 2066-2071):

```typescript
    const txSource =
      selectedItem.itemId === PRO_ITEM_ID
        ? "shop_pro"
        : "shop_founder_badge";
```

Remove the `if (selectedItem.itemId === SHIELD_ITEM_ID && address) { ... } else if (selectedItem.itemId === PRO_ITEM_ID ...` branch's Shield half (lines 2131-2157), leaving only the PRO `else if`. Remove `enqueuePendingTx`/`dequeuePendingTx`/`writeCreditedCache`/`dispatchShieldChange` imports from this file **only if** Step 3 confirmed Task B7's `handleUseShield` fix doesn't still need `writeCreditedCache`/`dispatchShieldChange` (it does — Task B7 uses both). Re-run the grep from Step 5 scoped to this file before removing any import:

Run: `rtk proxy grep -n "enqueuePendingTx\|dequeuePendingTx\|writeCreditedCache\|dispatchShieldChange" apps/web/src/components/exercises/exercises-screen.tsx`
Expected: `enqueuePendingTx`/`dequeuePendingTx` have zero remaining call sites (safe to remove the import) — `writeCreditedCache`/`dispatchShieldChange` still have one each (Task B7's `handleUseShield`, keep those two imports).

- [ ] **Step 12: Typecheck the whole app**

Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: PASS.

- [ ] **Step 13: Remove the purchase-queue half of `shield-storage.ts` / `use-shield-sync.ts`**

In `apps/web/src/lib/shop/shield-storage.ts`, remove `SHIELDS_PENDING_TX_KEY`, `PENDING_TX_TTL_MS`, `PENDING_TX_QUEUE_MAX`, `PendingShieldTx`, `readQueueRaw`, `writeQueue`, `enqueuePendingTx`, `dequeuePendingTx`, `readPendingTxs`. Keep everything else (`readDisplayedShields`, `readCreditedCache`, `writeCreditedCache`, `readConsumedCount`, `consumeOneShield` — now dead per Task B7's Step 3 grep, confirm again here and remove if still unreferenced, `consumeLegacyShieldsForMigration`).

In `apps/web/src/lib/shop/use-shield-sync.ts`, remove the "1. Drain pending queue" block (the `for (const entry of queued)` loop and its `readPendingTxs`/`dequeuePendingTx` imports) from `sync()`, keeping the legacy-migration step and the `GET /api/shields/me` hydration step untouched — Season Pass and the welcome-pack grant still rely on this hydration to reflect their credits.

Run: `pnpm -C apps/web exec vitest run src/lib/shop/__tests__/shield-storage.test.ts src/lib/shop/__tests__/use-shield-sync.test.tsx`
Expected: update any test asserting the removed queue functions still exist, then PASS.

- [ ] **Step 14: Remove Shield Shop-purchase copy**

In `apps/web/src/lib/content/editorial.ts`, remove `retryShield` from `SHOP_ITEM_COPY` (lines 2042-2048) — but check first whether `SHIELD_COPY` (lines 384-389, the fail-rescue modal's copy, unrelated to the Shop tile) or welcome-pack copy references `SHOP_ITEM_COPY.retryShield` before deleting; if unreferenced, delete. Mirror in `messages/es.ts`.

- [ ] **Step 15: Full suite + typecheck**

Run: `pnpm -C apps/web test`
Run: `pnpm exec tsc --noEmit -p apps/web`
Expected: both green.

- [ ] **Step 16: Refresh the `hub-shop-sheet-open` VR baseline again** (tile grid changed again — Shield tile now gone too)

Run: `pnpm -C apps/web test:e2e:visual -- -g "hub-shop-sheet-open"`, regenerate, re-verify green (same procedure as Task A5 Step 5).

- [ ] **Step 17: Commit**

```bash
git add -A apps/web/src/app/api/credit-shield apps/web/src/lib/contracts/shop-catalog.ts apps/web/src/lib/contracts/__tests__/shop-catalog.test.ts apps/web/src/lib/shop apps/web/src/components/exercises/shop-sheet.tsx apps/web/src/components/exercises/__tests__/shop-sheet.test.tsx apps/web/src/components/exercises/exercises-screen.tsx apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts
git commit -m "refactor(shop): retire Shield Shop-TX purchase path (itemId 2)

Shields now come from Season Pass, the welcome-pack freebie, or —
once out — 2 Peones per rescue (this Part's earlier commits). The
credited-counter display/hydration path (shield-storage.ts's cache
half, use-shield-sync.ts's GET /api/shields/me step) is untouched;
only the standalone-purchase queue half is removed.

Wolfcito 🐾 @akawolfcito"
```

- [ ] **Step 18: Push, open PR-B, flag the hosted migration apply, merge**

```bash
git push -u origin feat/shield-peones-fallback
gh pr create --title "feat(shield): Peones fallback + retire Shop-TX purchase" --body "Fixes the ContextualActionSlot local-only shield-consume bug, adds a 2-Peones fallback for shield rescues (red-teamed: SETNX consumption guard closes a replay hole a naive Coach-mirror would have had), and retires the itemId 2 Shop-TX purchase. Season Pass + welcome-pack grants untouched. Full suite green, VR baseline refreshed. NOT yet verified on real chain — no funded wallet in the coding sandbox, same constraint as the PRO rail work."
```

Before merging, tell the operator: the `20260701150000_peones_shield_source.sql` migration from Task B1 needs `supabase db push --linked` run by a human from `apps/web/` (per `[[feedback_supabase_workflow]]`) — do not run this yourself without explicit confirmation, and confirm it's applied (`supabase migration list --linked` shows it in both Local and Remote) before treating the feature as live in Prod.

```bash
gh pr merge --merge --delete-branch
```

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage**: Part A covers spec §"Scope 1" fully. Part B covers §"Scope 2" 2a (Task B7) → 2b (Tasks B1-B5) → 2c (Task B8), matching the spec's required commit order (bugfix → fallback → retirement) exactly, plus B6 (a small threading task the spec's prose implied but didn't enumerate as its own step).
- **Verified-vs-inherited findings**: this plan corrects one red-team claim after direct verification — P1-1's "Coach also has a second purchase path in exercises-screen.tsx" does not hold (that file's duplicate `handleConfirmPurchase` has no coach branch at all); the Shield half of that same finding DOES hold and is Task B8 Step 11.
- **Type consistency**: `attemptSeq` is a `number` throughout (Task B2's `targetId`/`SPEND_METADATA_WHITELIST` already accept it as such); `/api/shields/spend`'s new body field carries it as `number | string` and coerces to `String(attemptSeq)` once, matching the ledger's `source_id: string | null` column type — the same coercion Coach's `gameId` (already a string) doesn't need, called out explicitly in Task B4 Step 3 so a future reader isn't confused by the asymmetry.
