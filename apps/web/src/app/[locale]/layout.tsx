import type { Metadata, Viewport } from 'next';
import { Fredoka, Rowdies } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import '../globals.css';

import { WalletProvider } from "@/components/wallet-provider"
import { DesktopAppFrame } from "@/components/chrome/desktop-app-frame"
import { routing } from "@/i18n/routing"

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: '700',
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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chesscito.com";

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
     * Default-locale canonical at the locale root. Per-page surfaces
     * (`/[locale]/hub`, `/[locale]/arena`, etc.) inherit this layout
     * metadata, so EN / ES / x-default get emitted on every page via
     * a single declaration. Google + Bing read `x-default` as the
     * fallback when no locale matches the user.
     */
    languages: {
      en: '/en',
      es: '/es',
      'x-default': '/en',
    },
  },
  openGraph: {
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    url: BASE_URL,
    images: [{ url: '/art/og-home.jpg', width: 1200, height: 630, type: 'image/jpeg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'chesscito',
    description: 'Learn chess piece movements with gamified on-chain challenges on Celo.',
    images: ['/art/og-home.jpg'],
  },
  other: {
    'talentapp:project_verification': '24912a54c2fbb019a7fd89ea904c1355dc572b6f955d4146c3078576fb4c77513b57c9f59e765b9fc63400005bcb9948f88b266c8862be94aef6d2adbf8473ee',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
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
        {/* The previous wrapper hard-clamped every route to
            --app-max-width (390 px), which made sense when every
            page was a mobile MiniPay surface. Now that "/" is the
            public web-responsive landing, the constraint moves to
            the routes that actually need it (exercises-screen, arena,
            victory, LegalPageShell — they each carry their own
            max-w wrapper). The flex justify-center stays so any
            page that opts back into the 390 px constraint still
            centers cleanly on desktop. */}
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
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
