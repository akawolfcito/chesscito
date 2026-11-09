"use client";

import { CoachHistory } from "@/components/coach/coach-history";

const DEV_WALLET = "0xE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE";

export function CoachHistoryFixture({ credits }: { credits: number }) {
  return (
    <main
      data-testid="dev-coach-history-root"
      className="min-h-[100dvh] w-full bg-[#1a0f0a]"
    >
      <div className="mx-auto w-full max-w-[var(--app-max-width,390px)]">
        <CoachHistory
          walletAddress={DEV_WALLET}
          credits={credits}
          onSelectEntry={() => {}}
          onAnalyzeUnanalyzed={() => {}}
        />
      </div>
    </main>
  );
}
