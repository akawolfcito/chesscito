# Play Hub Art Prompt Pack (2026-03-07)

## Current Baseline (for comparison)

- Desktop: [play-hub-baseline-2026-03-07-desktop.png](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/docs/design/play-hub-baseline-2026-03-07-desktop.png)
- Mobile: [play-hub-baseline-2026-03-07-mobile.png](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/docs/design/play-hub-baseline-2026-03-07-mobile.png)

## Art Direction Summary

- Visual tone: fantasy-chess, arcane forest, luminous runes, magical HUD.
- Palette: deep teal/cyan base, emerald accents, selective amber for warnings.
- Rendering style: polished 2D game UI illustration, soft bloom, high readability.
- Composition rule: center focus for board/action, UI ornaments must not block gameplay.

## Asset Pack (drop-in ready)

Target folder in app: `apps/web/public/art/`

### 1) `bg-playhub-forest-mobile.webp`
- Usage: main Play Hub atmosphere background (mobile).
- Resolution: `1170x2532` (or `1284x2778` if extra detail).
- Format: `WEBP`, quality 82-88.
- Max weight target: `<= 450 KB`.
- Safe areas:
  - keep central board zone with low texture noise
  - avoid bright highlights in bottom 30% (action panel readability)
- Prompt:
```text
Fantasy chess battleground in a mystical forest at night, mobile portrait composition, cinematic top-down perspective, soft cyan and emerald magical lights, subtle fog, ancient stone platform hints, no characters in foreground, center area visually calm for UI overlay, polished 2D game concept art, high detail but clean readability, premium mobile game style, soft bloom, volumetric light rays
```
- Negative prompt:
```text
photorealistic, text, logos, watermark, heavy clutter, blurry, noisy grain, oversaturated neon, hard contrast, UI elements, buttons, characters centered
```

### 2) `bg-playhub-forest-desktop.webp`
- Usage: main Play Hub atmosphere background (desktop/tablet).
- Resolution: `1920x1080` (optionally `2560x1440` source).
- Format: `WEBP`, quality 80-86.
- Max weight target: `<= 650 KB`.
- Prompt:
```text
Wide fantasy chess arena in an enchanted forest, horizontal composition, arcane atmosphere, moonlit cyan-green palette, layered depth with trees and glowing particles, clear center zone reserved for gameplay board, polished 2D game environment illustration, premium casual strategy game key art, cinematic but readable
```
- Negative prompt:
```text
text, logos, watermark, realistic photography, empty black background, over-detailed center clutter, harsh red/orange dominant tones
```

### 3) `panel-frame-rune.webp`
- Usage: decorative texture layer for HUD cards (`.rune-frame`).
- Resolution: `1024x1024` tile-friendly, seamless optional.
- Format: `WEBP` with alpha if needed, or opaque dark base.
- Max weight target: `<= 220 KB`.
- Prompt:
```text
Ornamental rune panel texture for fantasy game UI, dark cyan stone-metal material, engraved celtic-like details, subtle glow channels, symmetric decorative corners, clean center, highly readable overlay frame texture, game UI skin atlas style
```
- Negative prompt:
```text
text, symbols too bright, noisy texture, strong perspective distortion, realistic rust, grunge dirt overload
```

### 4) `shop-slot-frame.webp`
- Usage: optional slot frame for store cards and carousel.
- Resolution: `768x768`.
- Format: `WEBP` with alpha preferred.
- Max weight target: `<= 180 KB`.
- Prompt:
```text
Fantasy shop item slot frame, glowing cyan edges, beveled magical stone frame, elegant corners, center transparent area, game inventory UI element, polished 2D style, high contrast edges with subtle inner shadow
```
- Negative prompt:
```text
text labels, item icons, heavy ornaments blocking center, overglow, low resolution pixelation
```

### 5) `reward-glow.webp`
- Usage: visual burst for mission success overlay (`.reward-burst`).
- Resolution: `1024x1024`.
- Format: `WEBP` with alpha preferred.
- Max weight target: `<= 150 KB`.
- Prompt:
```text
Magical radial reward burst, cyan and emerald energy rays, soft volumetric bloom, transparent background, centered composition, fantasy victory VFX card backdrop, clean and elegant, no symbols
```
- Negative prompt:
```text
characters, text, logos, fire/explosion orange dominance, rough smoke, noisy particles
```

## Practical Integration Map (already prepared)

The CSS integration hooks are already in place at [globals.css](/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web/src/app/globals.css):

- `--playhub-bg-mobile` -> `/art/bg-playhub-forest-mobile.webp`
- `--playhub-bg-desktop` -> `/art/bg-playhub-forest-desktop.webp`
- `--playhub-rune-frame` -> `/art/panel-frame-rune.webp`
- `--playhub-reward-glow` -> `/art/reward-glow.webp`

Drop-in flow:
1. Export assets with exact filenames above.
2. Place files in `apps/web/public/art/`.
3. Rebuild (`pnpm --filter web build`) and review `/play-hub`.
4. Tune compression only if needed (keep readability first on mobile).

## Generator Settings Recommendation

- Preferred model profile: illustration / game concept art.
- Guidance scale: medium-high (7 to 9 equivalent).
- Sampling:
  - produce 4 variants per asset
  - select by readability under UI overlay first, style second
- Upscale: only after variant selection.

