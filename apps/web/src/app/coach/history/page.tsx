"use client";

import { useAccount } from "wagmi";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";

/**
 * Coach session history page. Mounts the existing <CoachHistory> list
 * plus the new <CoachHistoryDeletePanel>. Page exists so the
 * "manage history" link in the <CoachPanel> footer (Task 7) has a target
 * (red-team P0-2 — verified the route did not exist before PR 4).
 *
 * Spec §9.2.
 */
export default function CoachHistoryPage() {
  const { address } = useAccount();

  if (!address) {
    return (
      <main className="mx-auto max-w-[var(--app-max-width,390px)] px-4 py-6">
        <p className="text-sm text-white/65">Connect your wallet to view your Coach history.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--app-max-width,390px)] px-4 py-6">
      <CoachHistory
        walletAddress={address}
        credits={0}
        onSelectEntry={() => {
          /* No-op on this dedicated page — entries are read-only here. */
        }}
      />
      <CoachHistoryDeletePanel />
    </main>
  );
}
