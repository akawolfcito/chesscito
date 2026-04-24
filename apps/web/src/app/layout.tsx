import type { Metadata, Viewport } from 'next';
import { Fredoka } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

import { WalletProvider } from "@/components/wallet-provider"

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-fredoka',
  display: 'swap',
});

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${fredoka.variable}`} suppressHydrationWarning>
      <body>
        <div className="flex min-h-[100dvh] justify-center">
          <div className="relative flex w-full max-w-[var(--app-max-width)] flex-col text-foreground">
            <WalletProvider>
              <main className="flex flex-1 flex-col">
                {children}
              </main>
            </WalletProvider>
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
