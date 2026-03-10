# Share Card — Design Doc

**Date:** 2026-03-10
**Problem:** The ResultOverlay success screen has no branding or stats — users who screenshot it get a bare modal with no context. Issue #15 asks for a screenshotable share card.

## Approach: Enhance ResultOverlay

Upgrade the existing `<ResultOverlay />` success variants to be screenshot-friendly. No new libraries, no new routes, no canvas rendering. The overlay itself becomes the share card.

### New Elements

| Element | Variants | Description |
|---------|----------|-------------|
| Stars display | `badge`, `score` | Total stars for the current piece, e.g. `★★★☆☆ 12/15` |
| Branding footer | all success | Small "chesscito" wordmark + "on Celo" at bottom |

### Layout (success, updated)

```
Fullscreen backdrop (dark)
  reward-glow.png (pulsing, behind image)
  Large image (badge/item/icon)
  Title (fantasy-title style)
  Subtitle (1-2 lines)
  Stars row: ★★★☆☆ 12/15  ← NEW
  [View on CeloScan] link (optional)
  [Continue] button
  Branding: chesscito · on Celo  ← NEW
```

### Props Change

```typescript
// Add to ResultOverlayProps:
totalStars?: number;  // 0-15, for badge/score variants
```

### Stars Display Component

- 5 star icons representing exercises (filled = earned, empty = not)
- Each star maps to `progress.stars[i]` where filled = stars > 0
- Numeric total shown beside: `12/15`
- Only rendered for `badge` and `score` variants
- Color: `text-amber-400` for filled, `text-amber-400/30` for empty

### Branding Footer

- Text: "chesscito" (fantasy-title style, small) + "on Celo" (muted)
- Positioned at bottom of the overlay card
- Only on success variants (not error)
- Small enough to not distract, visible enough for screenshots

### What Stays the Same

- Error variant — unchanged
- Shop variant — gets branding footer but no stars
- Animation, CeloScan link, buttons — unchanged
- Component file location — same file

### Out of Scope

- Canvas export / download button
- Server-rendered OG images
- Permalink routes
- Social sharing APIs
- QR codes
