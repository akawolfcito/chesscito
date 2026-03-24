# MiniPay Store Submission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Chesscito for MiniPay Store submission — legal pages, support, ownership, app identity, security headers, PWA manifest, and submission document.

**Architecture:** 4 new routes (`/terms`, `/privacy`, `/support`, `/about`) rendered as server components with copy from `editorial.ts`. A `...` (More) icon in the play-hub HUD bar links to `/about`. Security headers in `next.config.js`. PWA manifest via App Router convention. Final submission doc with all fields.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `lucide-react` icons

**Spec:** `docs/superpowers/specs/2026-03-23-minipay-submission-design.md`

**Note on testing:** This project has no automated test framework for UI components (per CLAUDE.md: "No hay tests automatizados por ahora"). Tasks skip TDD for page components and use manual verification + `next build` type-checking instead.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `apps/web/src/lib/content/editorial.ts` (append) | `LEGAL_COPY`, `SUPPORT_COPY`, `ABOUT_COPY` constants |
| Create | `apps/web/src/components/legal-page-shell.tsx` | Shared layout for legal/info pages (back button, title, max-width, dark bg) |
| Create | `apps/web/src/app/terms/page.tsx` | Terms of Service page |
| Create | `apps/web/src/app/privacy/page.tsx` | Privacy Policy page |
| Create | `apps/web/src/app/support/page.tsx` | Support page |
| Create | `apps/web/src/app/about/page.tsx` | About hub page |
| Create | `apps/web/src/app/about/invite-link.tsx` | Client component for share/invite button on About |
| Modify | `apps/web/src/components/play-hub/mission-panel.tsx:126` | Add `moreAction` prop slot in HUD bar |
| Modify | `apps/web/src/app/page.tsx:695` | Pass `moreAction` Link to MissionPanel |
| Copy   | `apps/web/public/art/favicon-wolf.png` -> `apps/web/public/icon-512.png` | 512x512 icon for Store + manifest |
| Create | `apps/web/src/app/manifest.ts` | PWA manifest (App Router convention) |
| Modify | `apps/web/next.config.js` | Security headers (`async headers()`) |
| Modify | `apps/web/package.json` | Add `description` and `author` fields |
| Create | `docs/network-manifest.md` | Network origins audit document |
| Create | `docs/minipay-submission.md` | Final submission fields document |

---

## Task 1: Add editorial copy constants

**Files:**
- Modify: `apps/web/src/lib/content/editorial.ts:432` (append after `COACH_COPY`)

- [ ] **Step 1: Add `LEGAL_COPY`, `SUPPORT_COPY`, and `ABOUT_COPY` to editorial.ts**

Append after the last export (`COACH_COPY`):

```typescript
export const LEGAL_COPY = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 2026",
    sections: [
      {
        heading: "Service Description",
        body: "Chesscito is an educational pre-chess game experience on the Celo blockchain, accessible via MiniPay. The service provides interactive chess piece movement puzzles with on-chain collectibles.",
      },
      {
        heading: "Eligibility",
        body: "You must have a compatible wallet (such as MiniPay) to use Chesscito. Age eligibility is determined by your applicable jurisdiction.",
      },
      {
        heading: "Wallet Responsibility",
        body: "You are solely responsible for the security of your wallet, private keys, and seed phrases. Chesscito never requests, stores, or has access to these.",
      },
      {
        heading: "On-Chain Transactions",
        body: "Certain actions — including badge claims, score submissions, shop purchases, and NFT mints — interact with smart contracts on the Celo blockchain. These transactions are irreversible once confirmed on-chain.",
      },
      {
        heading: "Digital Assets",
        body: "NFTs, badges, and shop items obtained through Chesscito have no guaranteed value, liquidity, or appreciation. They are game collectibles, not financial instruments.",
      },
      {
        heading: "Third-Party Dependencies",
        body: "Some features depend on third-party infrastructure, wallets, and blockchain networks that may be unavailable, delayed, or behave unexpectedly.",
      },
      {
        heading: "Service Changes",
        body: "Chesscito may modify, pause, or discontinue features at any time without prior notice.",
      },
      {
        heading: "Limitation of Liability",
        body: 'The service is provided "as is". Chesscito and its operator are not liable for losses arising from blockchain transactions, wallet issues, or service interruptions.',
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "March 2026",
    sections: [
      {
        heading: "Data We Handle",
        body: "When you use Chesscito, the following data is involved: your public wallet address (provided by your wallet at connection), on-chain interaction data such as scores, badges, and purchases (publicly visible on the Celo blockchain), and local app state including tutorial progress, shield count, and gameplay preferences.",
      },
      {
        heading: "Data We Do Not Collect",
        body: "Chesscito does not collect passwords, seed phrases, government-issued identification, personal identifiable information (PII), or analytics and tracking cookies.",
      },
      {
        heading: "Local Storage",
        body: "Tutorial state, gameplay preferences, retry shields, and UX settings are stored on your device for UX purposes. On-chain actions and related blockchain data are public by nature and may be transmitted through wallet and network infrastructure required to operate the app.",
      },
      {
        heading: "Third-Party Infrastructure",
        body: "Chesscito uses Celo RPC providers for blockchain reads and writes, and WalletConnect for wallet connection. We do not use analytics vendors or ad networks.",
      },
      {
        heading: "Purpose of Data Use",
        body: "Data is used solely to operate the game: validate moves, record scores, process purchases, and mint collectibles.",
      },
      {
        heading: "Data Retention",
        body: "On-chain data is permanent by nature of blockchain. Local data stored on your device can be cleared by you at any time through your browser settings.",
      },
      {
        heading: "Contact",
        body: "For privacy-related questions, visit our Support page or email ${NEXT_PUBLIC_SUPPORT_EMAIL}.",
      },
    ],
  },
} as const;

export const SUPPORT_COPY = {
  title: "Support",
  primaryChannel: {
    label: "Email",
    value: "${NEXT_PUBLIC_SUPPORT_EMAIL}",
    href: "mailto:${NEXT_PUBLIC_SUPPORT_EMAIL}",
  },
  secondaryChannel: {
    label: "GitHub Issues",
    value: "Report a bug or request a feature",
    href: "https://github.com/wolfcito/chesscito/issues",
  },
  howToReport: "Describe the issue, include screenshots if possible, and mention your device and browser.",
  reportableIssues: [
    "Loading problems",
    "Transaction errors",
    "UI bugs",
    "Gameplay questions",
    "Feature requests",
  ],
  responseTime: "We aim to respond within 48 hours.",
} as const;

export const ABOUT_COPY = {
  title: "Chesscito",
  operatedBy: "Operated by Wolfcito",
  handle: "@akawolfcito",
  version: "v0.1.0",
  links: {
    support: "Support",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    invite: "Invite a Friend",
  },
} as const;
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to editorial.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/content/editorial.ts
git commit -m "feat: add legal, support, and about copy to editorial.ts"
```

---

## Task 2: Create shared legal page shell component

**Files:**
- Create: `apps/web/src/components/legal-page-shell.tsx`

- [ ] **Step 1: Create the shared layout component**

This is a client component (needs `useRouter` for back button). All legal/info pages use this shell.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type LegalPageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#0b1220]">
      <div className="flex w-full max-w-[var(--app-max-width)] flex-col px-5 py-4">
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-cyan-200/70 transition hover:text-cyan-50"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-cyan-50">{title}</h1>
        </header>
        <div className="flex-1 space-y-6 pb-8 text-sm leading-relaxed text-cyan-100/80">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/legal-page-shell.tsx
git commit -m "feat: add shared legal page shell component"
```

---

## Task 3: Create Terms of Service page

**Files:**
- Create: `apps/web/src/app/terms/page.tsx`

- [ ] **Step 1: Create the Terms page**

Server component that renders from `LEGAL_COPY.terms`:

```tsx
import { LegalPageShell } from "@/components/legal-page-shell";
import { LEGAL_COPY } from "@/lib/content/editorial";

export const metadata = {
  title: "Terms of Service — Chesscito",
  description: "Terms of Service for Chesscito, an educational pre-chess game on Celo.",
};

export default function TermsPage() {
  const { title, lastUpdated, sections } = LEGAL_COPY.terms;

  return (
    <LegalPageShell title={title}>
      <p className="text-xs text-cyan-300/50">Last updated: {lastUpdated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-2 text-sm font-semibold text-cyan-200">
            {section.heading}
          </h2>
          <p>{section.body}</p>
        </section>
      ))}
    </LegalPageShell>
  );
}
```

- [ ] **Step 2: Verify the route compiles and renders**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/terms` listed in routes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/terms/page.tsx
git commit -m "feat: add Terms of Service page (/terms)"
```

---

## Task 4: Create Privacy Policy page

**Files:**
- Create: `apps/web/src/app/privacy/page.tsx`

- [ ] **Step 1: Create the Privacy page**

Server component that renders from `LEGAL_COPY.privacy`:

```tsx
import { LegalPageShell } from "@/components/legal-page-shell";
import { LEGAL_COPY } from "@/lib/content/editorial";

export const metadata = {
  title: "Privacy Policy — Chesscito",
  description: "Privacy Policy for Chesscito, an educational pre-chess game on Celo.",
};

export default function PrivacyPage() {
  const { title, lastUpdated, sections } = LEGAL_COPY.privacy;

  return (
    <LegalPageShell title={title}>
      <p className="text-xs text-cyan-300/50">Last updated: {lastUpdated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-2 text-sm font-semibold text-cyan-200">
            {section.heading}
          </h2>
          <p>{section.body}</p>
        </section>
      ))}
    </LegalPageShell>
  );
}
```

- [ ] **Step 2: Verify route compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/privacy` listed in routes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/privacy/page.tsx
git commit -m "feat: add Privacy Policy page (/privacy)"
```

---

## Task 5: Create Support page

**Files:**
- Create: `apps/web/src/app/support/page.tsx`

- [ ] **Step 1: Create the Support page**

```tsx
import { LegalPageShell } from "@/components/legal-page-shell";
import { SUPPORT_COPY } from "@/lib/content/editorial";
import { Mail, Github } from "lucide-react";

export const metadata = {
  title: "Support — Chesscito",
  description: "Get help with Chesscito — report issues, ask questions, or request features.",
};

export default function SupportPage() {
  return (
    <LegalPageShell title={SUPPORT_COPY.title}>
      {/* Primary channel */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          Contact Us
        </h2>
        <a
          href={SUPPORT_COPY.primaryChannel.href}
          className="flex min-h-[44px] items-center gap-3 rounded-xl bg-cyan-950/40 px-4 py-3 text-cyan-100 transition hover:bg-cyan-950/60"
        >
          <Mail size={18} className="shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium">{SUPPORT_COPY.primaryChannel.label}</p>
            <p className="text-xs text-cyan-300/60">{SUPPORT_COPY.primaryChannel.value}</p>
          </div>
        </a>
      </section>

      {/* Secondary channel */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          Technical Issues
        </h2>
        <a
          href={SUPPORT_COPY.secondaryChannel.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center gap-3 rounded-xl bg-cyan-950/40 px-4 py-3 text-cyan-100 transition hover:bg-cyan-950/60"
        >
          <Github size={18} className="shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium">{SUPPORT_COPY.secondaryChannel.label}</p>
            <p className="text-xs text-cyan-300/60">{SUPPORT_COPY.secondaryChannel.value}</p>
          </div>
        </a>
      </section>

      {/* How to report */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          How to Report an Issue
        </h2>
        <p className="mb-3">{SUPPORT_COPY.howToReport}</p>
        <ul className="list-inside list-disc space-y-1 text-cyan-100/70">
          {SUPPORT_COPY.reportableIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>

      {/* Response time */}
      <section>
        <p className="text-xs text-cyan-300/50">{SUPPORT_COPY.responseTime}</p>
      </section>
    </LegalPageShell>
  );
}
```

- [ ] **Step 2: Verify route compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/support` listed in routes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/support/page.tsx
git commit -m "feat: add Support page (/support)"
```

---

## Task 6: Create About hub page

**Files:**
- Create: `apps/web/src/app/about/page.tsx`

- [ ] **Step 1: Create the About page**

The About page is a server component that imports a small client component (`InviteLink`) for the share button. Create both in the same step.

First, create `apps/web/src/app/about/invite-link.tsx`:

```tsx
"use client";

import { Share2 } from "lucide-react";
import { ABOUT_COPY } from "@/lib/content/editorial";

export function InviteLink() {
  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          void navigator.share({
            title: "Chesscito",
            text: "Learn chess piece movements with gamified on-chain challenges on Celo.",
            url: "https://chesscito.vercel.app",
          });
        } else {
          void navigator.clipboard.writeText("https://chesscito.vercel.app");
        }
      }}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-cyan-950/40 px-4 py-3 text-cyan-100 transition hover:bg-cyan-950/60"
    >
      <Share2 size={18} className="shrink-0 text-cyan-400" />
      <span className="text-sm font-medium">{ABOUT_COPY.links.invite}</span>
    </button>
  );
}
```

Then, create `apps/web/src/app/about/page.tsx`:

```tsx
import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";
import { ABOUT_COPY } from "@/lib/content/editorial";
import { LifeBuoy, Shield, FileText } from "lucide-react";
import { InviteLink } from "./invite-link";

export const metadata = {
  title: "About — Chesscito",
  description: "About Chesscito — operator, support, and legal information.",
};

const ABOUT_LINKS = [
  { href: "/support", label: ABOUT_COPY.links.support, icon: LifeBuoy },
  { href: "/privacy", label: ABOUT_COPY.links.privacy, icon: Shield },
  { href: "/terms", label: ABOUT_COPY.links.terms, icon: FileText },
] as const;

export default function AboutPage() {
  return (
    <LegalPageShell title="About">
      {/* Identity */}
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        <picture>
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt="Chesscito logo"
            className="h-16 w-16 drop-shadow-[0_0_12px_rgba(103,232,249,0.4)]"
          />
        </picture>
        <h2 className="text-xl font-bold text-cyan-50">{ABOUT_COPY.title}</h2>
        <p className="text-xs text-cyan-300/60">{ABOUT_COPY.operatedBy}</p>
        <p className="text-xs text-cyan-300/40">{ABOUT_COPY.handle}</p>
        <p className="text-[10px] text-cyan-300/30">{ABOUT_COPY.version}</p>
      </div>

      {/* Links */}
      <nav className="space-y-2">
        {ABOUT_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] items-center gap-3 rounded-xl bg-cyan-950/40 px-4 py-3 text-cyan-100 transition hover:bg-cyan-950/60"
          >
            <Icon size={18} className="shrink-0 text-cyan-400" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}

        {/* Invite / Share — duplicated from dock, not moved */}
        <InviteLink />
      </nav>
    </LegalPageShell>
  );
}
```

- [ ] **Step 2: Verify route compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/about` listed in routes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/about/page.tsx apps/web/src/app/about/invite-link.tsx
git commit -m "feat: add About hub page (/about)"
```

---

## Task 7: Add `...` (More) icon to play-hub HUD bar

**Files:**
- Modify: `apps/web/src/components/play-hub/mission-panel.tsx:14,100,126`
- Modify: `apps/web/src/app/page.tsx:695`

- [ ] **Step 1: Add `moreAction` prop to MissionPanel**

In `apps/web/src/components/play-hub/mission-panel.tsx`:

Add `moreAction?: ReactNode;` to `MissionPanelProps` (after `pieceHint` on line ~28).

In the JSX, insert `{moreAction}` after the `exerciseDrawer` and before the Lv span (around line 127):

Replace the block:
```tsx
          <div className="ml-auto flex items-center gap-2">
            {exerciseDrawer}
            <span className="shrink-0 text-xs text-cyan-300/70 tracking-[0.14em] uppercase">
              Lv {level}
            </span>
          </div>
```

With:
```tsx
          <div className="ml-auto flex items-center gap-2">
            {exerciseDrawer}
            <span className="shrink-0 text-xs text-cyan-300/70 tracking-[0.14em] uppercase">
              Lv {level}
            </span>
            {moreAction}
          </div>
```

- [ ] **Step 2: Pass the More link from page.tsx**

In `apps/web/src/app/page.tsx`, add import at the top:

```tsx
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
```

Note: `Link` from `next/link` may already be imported elsewhere — check and reuse if so. `MoreHorizontal` is from `lucide-react` which is already a dependency.

Then pass `moreAction` to `<MissionPanel>` (around line 695), adding it as a new prop:

```tsx
          moreAction={
            <Link
              href="/about"
              className="flex h-11 w-11 items-center justify-center text-cyan-300/50 transition hover:text-cyan-50"
              aria-label="More options"
            >
              <MoreHorizontal size={18} />
            </Link>
          }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Manual verification**

Run: `cd apps/web && npm run dev`
Open `http://localhost:3000` — verify `...` icon appears in HUD bar, top-right, and navigates to `/about`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/mission-panel.tsx apps/web/src/app/page.tsx
git commit -m "feat: add More icon in play-hub HUD linking to /about"
```

---

## Task 8: Generate 512x512 icon

**Files:**
- Copy: `apps/web/public/art/favicon-wolf.png` -> `apps/web/public/icon-512.png`

Note: This must run before Task 9 (manifest) because the manifest references `/icon-512.png`.

- [ ] **Step 1: Copy the source artwork (already 512x512)**

```bash
cp apps/web/public/art/favicon-wolf.png apps/web/public/icon-512.png
```

- [ ] **Step 2: Verify dimensions**

```bash
sips -g pixelWidth -g pixelHeight apps/web/public/icon-512.png
```

Expected: `pixelWidth: 512`, `pixelHeight: 512`

- [ ] **Step 3: Verify it's accessible**

Run dev server, then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/icon-512.png`
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/icon-512.png
git commit -m "feat: add 512x512 icon for MiniPay Store submission"
```

---

## Task 9: Create PWA manifest

**Files:**
- Create: `apps/web/src/app/manifest.ts`

- [ ] **Step 1: Create the manifest file**

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chesscito",
    short_name: "Chesscito",
    description:
      "Learn chess piece movements with gamified on-chain challenges on Celo.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 2: Verify `/icon.png` resolves**

Run: `cd apps/web && npm run dev &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/icon.png`
Expected: `200`

If it returns 404, the App Router file-based convention doesn't serve it at `/icon.png` for the manifest. In that case, copy `apps/web/src/app/icon.png` to `apps/web/public/icon.png`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/manifest.ts
git commit -m "feat: add PWA manifest via App Router convention"
```

---

## Task 10: Add security headers to next.config.js

**Files:**
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: Add `async headers()` to the config**

Replace the entire `next.config.js` content:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/play-hub', destination: '/' }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage": false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
};

module.exports = nextConfig;
```

- [ ] **Step 2: Verify headers are served**

Run dev server, then:
```bash
curl -sI http://localhost:3000 | grep -iE "x-content-type|referrer-policy|permissions-policy|x-dns|strict-transport|x-frame"
```

Expected: All 6 headers present in the response.

Note: `Strict-Transport-Security` may not appear in local HTTP dev — this is expected (only applies on HTTPS). Verify on Vercel preview after deploy.

- [ ] **Step 3: Verify build still passes**

Run: `cd apps/web && npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.js
git commit -m "feat: add security headers to next.config.js"
```

---

## Task 11: Update package.json metadata

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add `description` and `author` fields**

Add after `"private": true,`:

```json
  "description": "MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges",
  "author": "Wolfcito (@akawolfcito)",
```

- [ ] **Step 2: Verify JSON is valid**

Run: `cd apps/web && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json
git commit -m "chore: add description and author to package.json"
```

---

## Task 12: Audit and create network manifest

**Files:**
- Create: `docs/network-manifest.md`

- [ ] **Step 1: Audit external hosts in the codebase**

Search for all external URLs, fetch calls, RPC endpoints, and third-party origins:

```bash
cd apps/web && grep -rn "https\?://" src/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules | grep -v ".test." | sort -u
```

Also check:
- `apps/web/src/lib/contracts/chains.ts` for RPC URLs
- Wagmi/RainbowKit config for WalletConnect hosts
- Any analytics or monitoring scripts
- `apps/web/src/components/wallet-provider.tsx` for wallet infra

- [ ] **Step 2: Create the network manifest document**

Create `docs/network-manifest.md` with the audited hosts in the format:

```markdown
# Network Manifest — Chesscito

**Audit date:** 2026-03-23
**Method:** Manual code inspection of `apps/web/src/`
**App URL:** https://chesscito.vercel.app

## External Origins

| Host | Protocol | Purpose | CSP Directive |
|------|----------|---------|---------------|
| `forno.celo.org` | HTTPS | Celo RPC (default provider) | `connect-src` |
| ... | ... | ... | ... |

## Notes

- No analytics vendors or ad networks are used.
- No external CSS or font CDNs.
```

Fill with actual hosts found during audit. Do NOT use wildcards — list exact hosts.

- [ ] **Step 3: Commit**

```bash
git add docs/network-manifest.md
git commit -m "docs: add network manifest with audited external origins"
```

---

## Task 13: Create submission document

**Files:**
- Create: `docs/minipay-submission.md`

- [ ] **Step 1: Create the submission document**

```markdown
# MiniPay Store Submission — Chesscito

**Prepared:** 2026-03-23

## Required Submission Fields

| Field | Value |
|-------|-------|
| App name | Chesscito |
| Tagline | Learn chess piece movements with gamified on-chain challenges on Celo. |
| Publisher | Wolfcito |
| Public handle | @akawolfcito |
| Support URL | https://chesscito.vercel.app/support |
| Terms of Service | https://chesscito.vercel.app/terms |
| Privacy Policy | https://chesscito.vercel.app/privacy |
| Category | education |
| App URL (linkUrl) | https://chesscito.vercel.app |
| Icon | `apps/web/public/icon-512.png` — 512x512 PNG |

## Supporting Artifacts

- **Network manifest:** [docs/network-manifest.md](./network-manifest.md)
- **PageSpeed report:** `TODO: run after production deploy, save to docs/pagespeed-report-YYYY-MM-DD.md`
- **Verified contracts on Celoscan:**
  - Badges: [0xf92759E5525763554515DD25E7650f72204a6739](https://celoscan.io/address/0xf92759E5525763554515DD25E7650f72204a6739)
  - Scoreboard: [0x1681aAA176d5f46e45789A8b18C8E990f663959a](https://celoscan.io/address/0x1681aAA176d5f46e45789A8b18C8E990f663959a)
  - Shop: [0x24846C772af7233ADfD98b9A96273120f3a1f74b](https://celoscan.io/address/0x24846C772af7233ADfD98b9A96273120f3a1f74b)
  - VictoryNFT: [0x0eE22F830a99e7a67079018670711C0F94Abeeb0](https://celoscan.io/address/0x0eE22F830a99e7a67079018670711C0F94Abeeb0)
- **Sample transactions:** `TODO: add one tx link per user-facing method`

## Pre-Submission Checklist

- [ ] All URLs open correctly on mobile (no 404, no auth required)
- [ ] PageSpeed Insights measured on production (mobile profile)
- [ ] Google Form fields verified against current form
- [ ] Icon 512x512 ready for upload
- [ ] Network manifest complete
- [ ] MiniPay WebView testing passed (preview + production)
```

- [ ] **Step 2: Commit**

```bash
git add docs/minipay-submission.md
git commit -m "docs: add MiniPay Store submission document"
```

---

## Task 14: Full build verification and final commit

- [ ] **Step 1: Run full build**

```bash
cd apps/web && npx next build 2>&1 | tail -30
```

Expected: Build succeeds. All new routes listed: `/terms`, `/privacy`, `/support`, `/about`.

- [ ] **Step 2: Run existing tests**

```bash
cd apps/web && npm test
```

Expected: All existing tests pass (no regressions).

- [ ] **Step 3: Verify manifest is accessible**

```bash
cd apps/web && npm run dev &
sleep 3
curl -s http://localhost:3000/manifest.webmanifest | head -20
```

Expected: Valid JSON with `name: "Chesscito"`, both icon entries.

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:3000` in browser:
1. Verify `...` icon in HUD bar top-right
2. Click `...` -> navigates to `/about`
3. `/about` shows logo, operator info, version, 3 links
4. Each link navigates to the correct page
5. Back button on each page returns to previous page
6. All pages are legible, dark background, mobile-width

- [ ] **Step 5: Post-deploy tasks (not automated)**

After merging and deploying to production:
1. Run PageSpeed Insights on `https://chesscito.vercel.app` (mobile)
2. Save report to `docs/pagespeed-report-2026-03-23.md`
3. Test in MiniPay WebView (preview first, then production)
4. Verify all submission URLs work
5. Fill out and submit the Google Form
