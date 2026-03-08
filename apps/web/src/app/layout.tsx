import type { Metadata } from 'next';
import './globals.css';

import { WalletProvider } from "@/components/wallet-provider"

export const metadata: Metadata = {
  title: 'chesscito',
  description: 'MiniPay MiniApp for playful cognitive enrichment through pre-chess challenges.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="relative flex min-h-screen flex-col text-foreground">
          <WalletProvider>
            <main className="flex flex-1 flex-col">
              {children}
            </main>
          </WalletProvider>
        </div>
      </body>
    </html>
  );
}
