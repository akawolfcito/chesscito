import type { Metadata, Viewport } from 'next';
import { Fredoka, Rowdies } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import '../globals.css';

import { WalletProvider } from "@/components/wallet-provider"
import { DesktopAppFrame } from "@/components/chrome/desktop-app-frame"
import { routing } from "@/i18n/routing"

const fredoka = Fredoka({
  subsets: ['latin'],
  // Load both regular + bold cuts. 400 is needed for the kingdom-anchor
  // tagline lead — without it the browser falls back to the only loaded
  // weight (700) and the lead reads as bold against the bold closer.
  weight: ['400', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

// Display face for titles + button actions. Self-hosted by Next so we
// avoid the `<link>`-to-googleapis hop and the FOUT it incurs. Three
// weights cover label hierarchy (300 light, 400 default, 700 bold).
const rowdies = Rowdies({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-rowdies',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.chesscito.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'chesscito',
  description: 'MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  alternates: {
    /**
     * Under `localePrefix: "as-needed"` the default locale (EN)
     * serves at the bare root and ES nests under `/es`. Per-page
     * surfaces inherit this layout metadata, so EN / ES / x-default
     * get emitted on every page via a single declaration. Google +
     * Bing read `x-default` as the fallback when no locale matches
     * the user.
     */
    languages: {
      en: '/',
      es: '/es',
      'x-default': '/',
    },
  },
  openGraph: {
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    url: BASE_URL,
    // Candy-branded OG rendered via Satori (replaces the stale v1 dark-wizard
    // /art/og-home.jpg). Portrait 1080×1350, same CardShell as the share cards.
    images: [{ url: '/api/og/home', width: 1080, height: 1350, type: 'image/jpeg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    images: ['/api/og/home'],
  },
  other: {
    'talentapp:project_verification': '24912a54c2fbb019a7fd89ea904c1355dc572b6f955d4146c3078576fb4c77513b57c9f59e765b9fc63400005bcb9948f88b266c8862be94aef6d2adbf8473ee',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  // Sprint 4 commit O (2026-06-08) — disable browser-level zoom
  // globally for game-UX hygiene. Rationale:
  //   - The drag-to-move gesture (commit N) competes with pinch-zoom
  //     when the user uses two fingers; disabling pinch prevents
  //     accidental zooms mid-drag.
  //   - Double-tap-zoom on iOS Safari fires when the user does
  //     tap-piece-then-tap-target in rapid succession — the legacy
  //     tap flow becomes janky. Removing it cleans the gesture model.
  //   - Chesscito is visual-first (project memory rule); legibility
  //     does not depend on text zoom because hit-targets are ≥44px
  //     and chips/labels are candy-large by design.
  //   - Accessibility note: low-vision users retain OS-level zoom
  //     (iOS Settings → Accessibility → Zoom, Android equivalent),
  //     which applies above the browser and still works. We trade
  //     in-browser zoom (which we never benefited from) for game
  //     gesture stability.
  // If a future route needs pinch-zoom (e.g. lore reading mode), the
  // container can opt back in with `touch-action: pinch-zoom`.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`dark ${fredoka.variable} ${rowdies.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Route surfaces own their mobile width constraints. The canonical
            root now renders the Hub and DesktopAppFrame supplies its app
            shell treatment without reintroducing a global 390px clamp. */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-[100dvh] justify-center">
            <div className="relative flex w-full flex-col text-foreground">
              <WalletProvider>
                <main className="flex flex-1 flex-col">
                  <DesktopAppFrame>{children}</DesktopAppFrame>
                </main>
              </WalletProvider>
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
