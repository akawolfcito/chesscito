# Badge Collection Sheet — Design

**Goal:** Replace the mystery "Claim Badge" button with a "Badges" sheet that shows all 3 badge states (claimed, claimable, locked) so users always know what they have and what's next.

**Approach:** New `BadgeSheet` component following the existing Sheet pattern (shop, leaderboard). Reads on-chain `hasClaimedBadge` for all 3 levelIds + localStorage progress for star counts. Claim action lives inside the sheet.

---

## Badge States

| State | Condition | Visual | Action |
|-------|-----------|--------|--------|
| **Claimed** | `hasClaimedBadge[levelId] === true` | Full color image, green checkmark, "Owned" | View only |
| **Claimable** | `totalStars >= 10` AND `!hasClaimedBadge` | Full color image, glow pulse, "Claim Badge" button | Triggers `onClaim(levelId)` |
| **Locked** | `totalStars < 10` | Grayscale image, progress text "4/10 ★" | None |

## Data Requirements

For each of the 3 pieces (rook, bishop, knight):
- **On-chain**: `hasClaimedBadge(address, levelId)` — need 3 separate `useReadContract` calls (levelId 1, 2, 3)
- **Off-chain**: `localStorage chesscito:progress:{piece}` — read star arrays, compute `totalStars`

Current limitation: `useExerciseProgress` only loads one piece at a time. Solution: read localStorage directly for the other 2 pieces inside the sheet (simple `JSON.parse` of 3 keys).

## Component API

```tsx
type BadgeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // On-chain state for all 3 pieces
  badgesClaimed: { rook: boolean; bishop: boolean; knight: boolean };
  // Claim handler — sheet calls this with the piece key
  onClaim: (piece: "rook" | "bishop" | "knight") => void;
  isClaimBusy: boolean;
};
```

Star progress is read internally from localStorage (no need to thread through props).

## Layout (390px mobile)

```
┌─────────────────────────────────┐
│         Your Badges             │
│   Collect all three to master   │
│        the board                │
│                                 │
│  ┌─────────────────────────────┐│
│  │  [rook-img]                 ││
│  │  Rook Ascendant     ✓ Owned ││
│  │  ★★★★★★★★★★ 15/15          ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │  [bishop-img]               ││
│  │  Bishop Ascendant           ││
│  │  ★★★★☆☆☆☆☆☆  4/15          ││
│  │  Need 6 more ★ to unlock   ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │  [knight-img]  (grayscale)  ││
│  │  Knight Ascendant           ││
│  │  ☆☆☆☆☆☆☆☆☆☆  0/15          ││
│  │  Complete exercises to start││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

Vertical list (not 3-column grid) because each card needs room for status + action.

## Dock Button Change

- Label: "Badges" (was "Claim Badge")
- Always enabled (always tappable to view collection)
- Notification dot: shown when ANY piece has `claimable` state
- `onClick` → opens BadgeSheet instead of triggering claim directly

## Error Handling

- `BadgeAlreadyClaimed` revert → show "You already own this badge!" instead of generic error
- Network errors → standard ResultOverlay error flow

## Files to Modify

- Create: `apps/web/src/components/play-hub/badge-sheet.tsx`
- Modify: `apps/web/src/app/play-hub/page.tsx` — add 3 badge reads, wire BadgeSheet, update dock button
- Modify: `apps/web/src/components/play-hub/onchain-actions-panel.tsx` — badge button opens sheet
- Modify: `apps/web/src/lib/content/editorial.ts` — add BADGE_SHEET_COPY
- Modify: `apps/web/src/lib/errors.ts` — handle BadgeAlreadyClaimed specifically
