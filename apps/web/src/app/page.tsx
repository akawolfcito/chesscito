import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { detectWalletFromUserAgent } from "@/lib/server/wallet-detection";
import { LANDING_COPY } from "@/lib/content/editorial";

export const metadata: Metadata = {
  title: LANDING_COPY.meta.title,
  description: LANDING_COPY.meta.description,
  openGraph: {
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
  },
  twitter: {
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
  },
};

/**
 * `/` — public web landing for Chesscito. Server-side decides
 * between landing and direct redirect to the play hub.
 *
 * Wallet WebViews (MiniPay / Valora / Coinbase / Trust) get an
 * immediate `redirect("/hub")` so existing bookmarks land inside
 * the game without a flash of marketing content. Everyone else
 * sees the responsive Duolingo-style landing.
 *
 * The LandingPage component carries a client-side useMiniPay
 * fallback for wallets that the UA fingerprint table missed.
 */
export default function HomePage() {
  const ua = headers().get("user-agent");
  const wallet = detectWalletFromUserAgent(ua);
  if (wallet) {
    redirect("/hub");
  }
  return <LandingPage />;
}
