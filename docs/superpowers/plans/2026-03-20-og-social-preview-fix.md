# OG Social Preview Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix OG social previews so victory cards and homepage show rich image cards on WhatsApp, Twitter, Facebook, Farcaster, and other social platforms.

**Architecture:** Five targeted fixes: (1) compress OG background to reduce output size from 1.3MB to <300KB, (2) fix operator precedence bug in baseUrl resolution, (3) add metadataBase to root layout, (4) create proper 1200x630 homepage OG image with twitter:card, (5) add og:image:type to victory metadata for strict crawlers.

**Tech Stack:** Next.js 14 App Router metadata API, sips (macOS image tool), next/og ImageResponse

---

### Task 1: Compress OG background image

The source `bg-card-og.jpg` is 1360x1024 (332KB) but the rendered PNG via `ImageResponse` is 1.3MB because Satori decodes the oversized source and renders the full 1200x630 canvas as uncompressed PNG. Resizing the source to exactly 1200x630 reduces the pixel data Satori handles and yields a lighter PNG output.

**Files:**
- Modify: `apps/web/public/art/bg-card-og.jpg`

- [ ] **Step 1: Resize and compress bg-card-og.jpg**

```bash
cd apps/web
sips -z 630 1200 public/art/bg-card-og.jpg --out public/art/bg-card-og.jpg
# If quality is still too high, convert via:
# sips -s formatOptions 60 public/art/bg-card-og.jpg --out public/art/bg-card-og.jpg
```

Verify the file is under 100KB:
```bash
ls -lh public/art/bg-card-og.jpg
```

- [ ] **Step 2: Verify OG image still renders**

```bash
cd apps/web && pnpm dev &
# In another terminal, open http://localhost:3000/api/og/victory/1
# Visually confirm the card still looks correct
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/art/bg-card-og.jpg
git commit -m "fix(og): compress bg-card-og.jpg to 1200x630 for lighter OG images

Resized from 1360x1024 to exact OG dimensions (1200x630).
Reduces final ImageResponse PNG from ~1.3MB to under 300KB.
WhatsApp and strict crawlers reject large OG images.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Fix baseUrl operator precedence bug

In `victory/[id]/page.tsx` line 60-62, the `??` operator has higher precedence than the ternary `?:`, causing `NEXT_PUBLIC_APP_URL` to never be used as the base URL even when set.

**Files:**
- Modify: `apps/web/src/app/victory/[id]/page.tsx:60-62`

- [ ] **Step 1: Fix the baseUrl expression**

Replace lines 60-62:
```typescript
// BEFORE (broken precedence):
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://chesscito.vercel.app";

// AFTER (correct):
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://chesscito.vercel.app");
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/web && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/victory/[id]/page.tsx
git commit -m "fix(og): correct baseUrl operator precedence in victory metadata

The ?? operator has higher precedence than ternary ?:, so
NEXT_PUBLIC_APP_URL was never used even when set. Added
parentheses to fix evaluation order.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Add metadataBase + fix root layout OG

The root layout uses a relative OG image URL (`/art/bg-splash-chesscito.webp`) which crawlers can't resolve, uses wrong dimensions (390x844 instead of 1200x630), and lacks `twitter:card`.

**Files:**
- Modify: `apps/web/src/app/layout.tsx:6-18`
- Create: `apps/web/public/art/og-home.jpg` (1200x630 cropped from splash)

- [ ] **Step 1: Create homepage OG image (1200x630)**

Crop and resize the splash art to landscape 1200x630 for the homepage OG card.
The splash PNG is 1024x1536 (wxh). Target ratio is 1200:630 = 1.905:1.
Center-crop to full width (1024) with height 1024/1.905 ~ 537px, then scale up to 1200x630:

```bash
cd apps/web
# Center-crop to 1024x537 (landscape ratio matching 1200:630)
sips -c 537 1024 public/art/bg-splash-chesscito.png --out /tmp/og-home-crop.png
# Scale to exact OG dimensions
sips -z 630 1200 /tmp/og-home-crop.png --out /tmp/og-home-resized.png
# Convert to compressed JPEG
sips -s format jpeg -s formatOptions 75 /tmp/og-home-resized.png --out public/art/og-home.jpg
ls -lh public/art/og-home.jpg
```

Target: under 150KB. Visually verify the crop captures the wolf mascot and "Chesscito" title.
If the center-crop misses the important elements (the mascot sits high in the image), adjust by cropping manually with `--cropOffset` or use a different art asset.

- [ ] **Step 2: Update layout.tsx metadata**

```typescript
import type { Metadata, Viewport } from 'next';
import './globals.css';

import { WalletProvider } from "@/components/wallet-provider"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chesscito.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'chesscito',
  description: 'MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    images: [{ url: '/art/og-home.jpg', width: 1200, height: 630, type: 'image/jpeg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    images: ['/art/og-home.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
};
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 4: Verify meta tags render in HTML**

```bash
cd apps/web && pnpm dev &
curl -s http://localhost:3000 | grep -E 'og:|twitter:'
```

Expected: `og:image` with absolute URL, `twitter:card` with `summary_large_image`, `og:image:width` = 1200, `og:image:height` = 630.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/art/og-home.jpg apps/web/src/app/layout.tsx
git commit -m "fix(og): add metadataBase, 1200x630 homepage OG image, twitter:card

- Added metadataBase so relative image URLs resolve to absolute for crawlers
- Created og-home.jpg (1200x630) cropped from splash art
- Added twitter:card summary_large_image for Twitter/X previews
- Added og:image:type for strict crawlers

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Add og:image:type to victory metadata

WhatsApp and strict crawlers may skip images without explicit type hints. Add `og:image:type` to the victory page generateMetadata.

**Files:**
- Modify: `apps/web/src/app/victory/[id]/page.tsx:67-84`

- [ ] **Step 1: Add type to OG image config**

In `generateMetadata`, update the images array:
```typescript
openGraph: {
  title,
  description,
  url,
  images: [{ url: ogImage, width: 1200, height: 630, alt: title, type: "image/png" }],
  type: "website",
},
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/victory/[id]/page.tsx
git commit -m "fix(og): add og:image:type to victory metadata for strict crawlers

WhatsApp may skip OG images without explicit type hints.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: Deploy + validate on social platforms

- [ ] **Step 1: Build check**

```bash
cd apps/web && pnpm build
```
Expected: build succeeds with no errors.

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```

- [ ] **Step 3: Validate after deploy**

After Vercel deploy completes:

1. **Facebook**: Re-scrape `https://chesscito.vercel.app/victory/4` in Facebook Sharing Debugger — confirm image renders
2. **Facebook homepage**: Scrape `https://chesscito.vercel.app` — confirm new 1200x630 OG image
3. **WhatsApp**: Share `https://chesscito.vercel.app/victory/4` in a new chat — confirm image card shows
4. **Twitter**: Validate with Twitter Card Validator if available

- [ ] **Step 4: Commit SESSION.md update if needed**
