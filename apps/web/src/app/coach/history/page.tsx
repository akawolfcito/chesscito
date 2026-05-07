"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { COACH_COPY } from "@/lib/content/editorial";

/**
 * Coach session history page. Mounts the existing <CoachHistory> list
 * plus the new <CoachHistoryDeletePanel>. Page exists so the
 * "manage history" link in the <CoachPanel> footer (Task 7) has a target
 * (red-team P0-2 — verified the route did not exist before PR 4).
 *
 * Spec §9.2.
 *
 * 2026-05-07: added back-to-hub affordance (user got trapped on the
 * page with no escape) and a clickable entry handler stub —
 * <CoachHistory>'s onSelectEntry signature already supports navigation,
 * so we route the user to /arena where they can review the analysis
 * surfaced by the existing CoachPanel flow.
 */
function PageHeader() {
  return (
    <header className="mb-4 flex items-start gap-3 border-b border-[rgba(110,65,15,0.30)] pb-4">
      <Link
        href="/hub"
        aria-label="Back to hub"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(110,65,15,0.30)] text-lg font-bold transition-colors hover:bg-[rgba(110,65,15,0.08)]"
        style={{ color: "rgba(110, 65, 15, 0.85)" }}
      >
        ←
      </Link>
      <h1
        className="fantasy-title flex items-center gap-2 text-lg"
        style={{
          color: "rgba(110, 65, 15, 0.95)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
        }}
      >
        <CandyIcon name="coach" className="h-5 w-5" />
        {COACH_COPY.yourSessions}
      </h1>
    </header>
  );
}

export default function CoachHistoryPage() {
  const { address } = useAccount();

  if (!address) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
        <PageHeader />
        <p className="text-sm" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
          Connect your wallet to view your Coach history.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
      <PageHeader />
      <CoachHistory
        walletAddress={address}
        credits={0}
        onSelectEntry={() => {
          /* Tap → no-op on this page for now. Re-rendering the analysis
             requires the arena-page state machine (CoachPanel mounts
             inside the post-game modal flow). Cleaner port lands in a
             follow-up; until then the entries are read-only previews
             and tapping doesn't trap the user. */
        }}
      />
      <CoachHistoryDeletePanel />
    </main>
  );
}
