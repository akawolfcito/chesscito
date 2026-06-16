"use client";

import { notFound } from "next/navigation";

import { WalletProvider } from "@/components/wallet-provider";
import { ChesitoCard } from "@/components/peones/chesito-card";

/**
 * VR + design fixture for the Chesito Card. Renders the card in its two
 * production contexts:
 *   1. Account-sheet hero (on the cream sheet-bg-hub surface)
 *   2. HUD-chip modal (floating on the candy-modal-scrim)
 *
 * usePeonesBalance returns "guest" without a connected wallet, so the balance
 * reads "--" here; the layout, frame, colors, peón hero, and Top up CTA are
 * all production-accurate.
 */
export const dynamic = "force-dynamic";

export default function ChesitoCardDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <WalletProvider>
      <main
        data-testid="dev-chesito-card-root"
        className="min-h-[100dvh] w-full bg-[#1a0f0a] p-4"
      >
        <div className="mx-auto flex w-full max-w-[var(--app-max-width)] flex-col gap-6">
          <section className="sheet-bg-hub rounded-2xl p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#5a3c14]">
              Account hero
            </p>
            <ChesitoCard />
          </section>

          <section className="candy-modal-scrim relative flex items-center justify-center rounded-2xl py-10">
            <div className="relative mx-4 w-full max-w-[360px]">
              <ChesitoCard />
            </div>
          </section>
        </div>
      </main>
    </WalletProvider>
  );
}
