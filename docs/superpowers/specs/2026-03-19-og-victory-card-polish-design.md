# OG Victory Card — Premium Visual Polish

**Issue**: #59
**Date**: 2026-03-19
**Status**: Design approved

## Objective

Elevate the existing OG victory card (`/api/og/victory/[id]`) from functional-minimal to premium dark fantasy. The technical architecture is already complete (onchain reads, ImageResponse, metadata). This spec covers **visual polish only**.

## Approach

- **Cinzel font** — local `.ttf` bundled in repo (OFL license included), with system serif fallback
- **King SVG silhouette** — data URI `<img>` for Satori compatibility, with PNG fallback plan
- **Same color palette** — improved execution (contrast, glow, spacing)
- **1200x630** primary (no other sizes in scope)
- **Hardened route** — input validation, cache headers, error card for invalid/missing tokens

## Visual Composition

### Background

- **Base gradient**: radial from center-right, `#0b1628` → `#0a1424`. Replaces the existing `linear-gradient(160deg, ...)`.
- **Teal atmosphere**: radial glow centered on headline area, `rgba(94,234,212,0.03)`, radius ~600px. Barely visible — adds depth without competing.

### King SVG Watermark

- Chess king silhouette as inline SVG path
- Size: ~280px height
- Position: right-center, vertically centered
- Opacity: `0.04–0.05` (must not compete with text, even in small previews)
- Purpose: ambient texture reinforcing chess identity

### Content Layout (top to bottom, centered)

**Safe zone**: 80px padding on all 4 sides. All text lives inside this area. The king SVG may bleed outside partially (decorative only).

#### 1. Headline — "CHECKMATE"

- Font: **Cinzel**, 72px, weight 700
- Color: `#5eead4` (teal)
- Letter-spacing: `0.08em`
- Text-shadow: `0 0 30px rgba(94,234,212,0.20)` — subtle glow, must NOT soften text edges. Keep blur moderate and opacity low so letterforms stay crisp.
- Always shows "CHECKMATE" — all minted victories are wins, and the contract has no end-reason field

#### 2. Separator

- Horizontal line, 1px height, ~200px width, centered
- Color: `rgba(94,234,212,0.15)`
- Margin: 20px above and below
- Purpose: visual breathing room between headline and stats

#### 3. Performance Block

- Format: `{moves} MOVES • {time}`
- Font: system sans-serif, 38px, weight 700
- Color: `#f5f5f5`
- Letter-spacing: `0.04em`
- Must be scannable in < 1 second
- **Value clamping** (R8): moves display capped at `999+`, time capped at `99:59`. Prevents layout overflow from extreme uint16/uint32 contract values.

#### 4. Difficulty Pill

- Text: `EASY` / `MEDIUM` / `HARD`, uppercase
- Font: 14px, weight 600, letter-spacing `0.12em`
- Color: `rgba(160,205,225,0.45)` (muted cyan)
- Background: `rgba(255,255,255,0.03)`
- Border: `1px solid rgba(160,205,225,0.12)`
- Border-radius: 20px
- Padding: `6px 24px`
- Must feel **auxiliary** — never compete with headline or performance
- Margin-bottom: 28px

#### 5. Challenge Line

- Text: "Can you beat this?"
- Font: system sans-serif, 28px, weight 600
- Color: `#fbbf24` (amber)
- Letter-spacing: `0.02em`
- This is the viral hook — must be clearly readable

#### 6. Identity Line

- Format: `Victory #{id} • by {player}`
- If space is tight, **prioritize** `by {player}` over `Victory #{id}`
- **ID truncation** (R11): if tokenId exceeds 10 digits, display as `Victory #1234567890...`
- Player resolution order: username → ENS → wallet short (`0xA3...9F`)
- Font: 16px, weight 400
- Color: `rgba(160,205,225,0.4)`
- Margin-bottom: 8px

#### 7. Brand

- Text: "CHESSCITO"
- Font: 14px, weight 700, letter-spacing `0.15em`
- Color: `rgba(20,184,166,0.30)`
- Position: right-aligned in the flex flow (not absolute positioning)
- **Satori safe** (R10): Satori has known issues with `position: absolute` inside flex containers. Use `alignSelf: flex-end` within the main flex column instead. If this doesn't render correctly, fall back to centered like the rest.
- Must be the most subtle element on the card

## Visual Hierarchy (enforced)

```
1. CHECKMATE        (Cinzel 72px, teal, glow)
2. 7 MOVES • 0:16   (sans 38px, white)
3. Can you beat this? (sans 28px, amber)
4. [HARD]            (14px pill, muted)
5. by 0xA3...9F      (16px, very muted)
6. CHESSCITO         (14px, barely visible)
```

Nothing may compete with levels 1–3. Levels 4–6 are informational only.

## Safe Zones

- 80px padding on all sides (6.7% width, 12.7% height)
- WhatsApp crops ~10% from edges in preview — 80px padding covers this
- Headline at 72px remains legible at thumbnail widths down to ~300px
- No critical text near edges

## Thumbnail-Proof Criteria

The card must pass this test: **shrink to 300px wide — can you still read the headline and performance line?**

- Headline: Cinzel 72px at 1200px = effective ~18px at 300px thumbnail. Readable.
- Performance: 38px at 1200px = effective ~9.5px at 300px. Tight but readable with bold weight.
- Challenge line: 28px = ~7px at thumbnail. Readable as amber accent.
- Everything below challenge line is bonus context at thumbnail size.

## Route Hardening

### Input Validation (R1)

Validate `params.id` at the top of the handler before any processing:

```typescript
const raw = params.id;
if (!raw || !/^\d{1,78}$/.test(raw)) {
  // Return 400 — do not render a card for invalid IDs
  return new Response("Invalid token ID", { status: 400 });
}
const tokenId = BigInt(raw);
```

Rejects: non-numeric, negative, empty, excessively long. `BigInt()` is only called after regex validation.

### Cache Headers (R2)

Victory data is immutable onchain — cache aggressively on successful responses:

```typescript
headers: {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  "CDN-Cache-Control": "public, s-maxage=86400",
}
```

- 24h fresh cache, 7-day stale-while-revalidate
- Applies only to successful (200) responses
- Error/404 responses: `Cache-Control: no-store`

### Error Card (R3)

When the contract call fails (RPC down, token doesn't exist, network error), do NOT render fake stats. Instead:

- Render a **"Victory not found"** card with the same dark background and brand, but no stats
- Text: "Victory not found" (centered, muted cyan, 36px)
- Subtext: "This victory may not exist yet" (16px, muted)
- Brand footer: same as success card
- Return HTTP 200 (so crawlers don't retry) but with `Cache-Control: no-store` (so stale data doesn't persist)

This prevents fabricated stats from being indexed by social crawlers.

### Client Reuse (R5)

Move `createPublicClient` to module scope:

```typescript
const client = createPublicClient({
  chain: celo,
  transport: http(),
});
```

Reused across invocations within the same edge isolate. Eliminates per-request connection overhead.

## Technical Implementation

### Font Loading (R6 resolved — local only, no CDN)

```typescript
const CINZEL_FONT_URL = new URL(
  "../../../../../assets/fonts/Cinzel-Bold.ttf",
  import.meta.url
);

let cinzelData: ArrayBuffer | null = null;
try {
  const res = await fetch(CINZEL_FONT_URL);
  if (!res.ok) throw new Error(`Font fetch ${res.status}`);
  cinzelData = await res.arrayBuffer();
} catch {
  // Falls back to system serif — card still renders
}
```

- **Local font file only**: `src/assets/fonts/Cinzel-Bold.ttf` bundled in the repo
- **No Google Fonts CDN** — eliminates external runtime dependency entirely
- Fetched once per edge cold start, cached by runtime
- Used only for headline "CHECKMATE"
- All other text uses system sans-serif
- If fetch fails → system serif fallback, card still renders (degraded typography only)

### Font Licensing (R7)

Cinzel is licensed under the SIL Open Font License (OFL). OFL requires the license file to accompany any redistribution of the font.

- Include `src/assets/fonts/OFL-Cinzel.txt` alongside the TTF
- This is a one-time addition, legally required

### Font Compatibility Gate

**Before merging**: verify Cinzel renders correctly in Satori/`ImageResponse` on Vercel edge. Known risks:
- Some TTF files with complex OpenType features don't render in Satori
- Weight/style variants may not map correctly

**Test procedure**: deploy to Vercel preview, hit `/api/og/victory/1` directly, verify headline renders in Cinzel (not system fallback). If Cinzel fails in Satori, fall back to bundling Inter Bold and accept the reduced typographic impact.

### King SVG (R9 — Satori compatibility)

- Defined as a single SVG constant, encoded as `data:image/svg+xml` base64
- Rendered as `<img src="data:image/svg+xml;base64,..." />` with absolute positioning
- This approach is Satori-compatible (Satori does not support inline `<svg>` elements reliably)
- No external file, no fetch — pure inline data URI

**Fallback plan**: if SVG data URI doesn't render in Satori (known quirks with complex paths/viewBox), convert the king silhouette to a small PNG (~2KB at 280px) and use `data:image/png;base64,...` instead. Satori handles raster `<img>` more reliably than SVG data URIs.

**Test procedure**: same as font — verify on Vercel preview that the king silhouette appears (faintly, at 0.04–0.05 opacity). If invisible or broken, switch to PNG data URI.

### Data Source

No changes to data fetching. Same onchain reads:
- `victories(tokenId)` → `[difficulty, totalMoves, timeMs]`
- `ownerOf(tokenId)` → player address

### File Changes

| File | Change |
|------|--------|
| `app/api/og/victory/[id]/route.tsx` | Restyle layout, add font/SVG, input validation, cache headers, error card, client reuse |
| `src/assets/fonts/Cinzel-Bold.ttf` | New file — Cinzel Bold font (OFL licensed) |
| `src/assets/fonts/OFL-Cinzel.txt` | New file — SIL Open Font License (required by OFL) |

Three file changes. No new npm dependencies, no architectural changes.

## What This Is NOT

- Not a redesign of the share flow
- Not a new route or new metadata structure
- Not a change to the victory page (`/victory/[id]`)
- Not scope for 1080x1080 or 1080x1920 variants
- Not adding new data to the contract or API

## Quality Criteria

### Visual
- [ ] Readable in < 1 second
- [ ] Legible at thumbnail size (~300px wide)
- [ ] Feels premium, not like a screenshot
- [ ] Communicates competitive challenge
- [ ] Works as rich preview in WhatsApp
- [ ] Works as rich preview in X (twitter:card summary_large_image)
- [ ] King watermark invisible at first glance, noticed on second look
- [ ] Headline glow adds depth without softening text edges
- [ ] Difficulty pill feels auxiliary, never dominant

### Technical (from red-team review)
- [ ] Invalid token IDs return 400, not a crash (R1)
- [ ] Successful responses have `Cache-Control: public, s-maxage=86400` (R2)
- [ ] Non-existent tokens show "Victory not found" card, not fake stats (R3)
- [ ] `createPublicClient` is at module scope, not per-request (R5)
- [ ] Font loaded locally, no Google CDN references in code (R6)
- [ ] OFL license file included with Cinzel font (R7)
- [ ] Moves clamped at 999+, time at 99:59 (R8)
- [ ] King SVG renders in Satori on Vercel preview (R9)
- [ ] Brand right-aligned via flex, not absolute positioning (R10)
- [ ] Token ID display truncated at 10 digits (R11)
