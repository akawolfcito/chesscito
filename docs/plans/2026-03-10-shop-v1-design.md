# Shop v1: Retry Shield — Design

**Goal:** Add a purchasable "Retry Shield" consumable. On failure, player can use a shield to skip the failure animation and retry instantly.

---

## Item Definition

- **itemId:** 2n (Founder Badge is 1n)
- **Label:** "Retry Shield"
- **Subtitle:** "Failed an exercise? Use a shield to try again without penalty."
- **Price:** Configured on-chain via Shop contract (`getItem`/`buyItem`)
- **Uses per purchase:** 3

## Gameplay Effect

- On exercise failure with shields > 0:
  - PhaseFlash shows "Try again" + "Use Shield (N left)" button
  - Tapping: decrements shield count, resets exercise immediately, skips 1.5s failure wait
  - Not tapping (auto-fade after 3s): normal failure flow
- On failure with 0 shields: current behavior unchanged
- Shield count in `localStorage` key: `chesscito:shields`
- After purchase: shield count += 3

## UI Changes

- **PhaseFlash (failure):** Shield button below "Try again" when shields > 0. Auto-fades after 3s (instead of normal 1.1s) to give time to tap.
- **Dock area:** Small shield counter badge near reset button when count > 0
- **Shop:** New SHOP_ITEMS entry (itemId: 2n)

## Purchase Flow

Same as Founder Badge: ShopSheet → PurchaseConfirmSheet → approve USDC → buyItem(2n, 1n) → increment localStorage shields by 3

## Files to Modify

- `apps/web/src/app/play-hub/page.tsx` — shield state, purchase increment, pass to PhaseFlash
- `apps/web/src/components/play-hub/mission-panel.tsx` — PhaseFlash shield button on failure
- `apps/web/src/lib/content/editorial.ts` — shield copy
- SHOP_ITEMS in page.tsx — add itemId 2n

## Scope

- One consumable (Retry Shield)
- localStorage for balance
- No contract changes
- No on-chain balance tracking
