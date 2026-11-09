"use client";

import { useState } from "react";

/**
 * Dev utility — wipe ALL local Chesscito progress in one tap so a
 * fresh-user run can be tested on a real device (MiniPay included)
 * without digging through webview site-data settings.
 *
 * Scope: localStorage keys only (stars, labyrinth bests, onboarded
 * flag, guest session, cached UI state). The Peones ledger is
 * SERVER-side per wallet and is intentionally untouched — use a fresh
 * wallet or an admin adjustment for a clean economy slate.
 *
 * Lives under /dev (noindex, fixture root). Harmless by construction:
 * it can only clear the visitor's own browser storage.
 */
export default function DevResetPage() {
  const [cleared, setCleared] = useState<string[] | null>(null);

  function handleReset() {
    const removed: string[] = [];
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("chesscito")) {
          localStorage.removeItem(key);
          removed.push(key);
        }
      }
    } catch {
      // localStorage unavailable — nothing to clear.
    }
    setCleared(removed.sort());
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col gap-4 p-6">
      <h1 className="text-xl font-extrabold">Dev — Reset local progress</h1>
      <p className="text-sm opacity-80">
        Removes every <code>chesscito*</code> localStorage key (stars,
        labyrinth bests, onboarding, guest session). Server-side Peones
        ledger is NOT touched — use a fresh wallet for a clean economy.
      </p>
      <button
        type="button"
        onClick={handleReset}
        className="rounded-2xl bg-red-700 px-4 py-3 font-bold text-white active:scale-95"
      >
        Wipe local progress
      </button>
      {cleared ? (
        <div className="text-xs">
          <p className="font-bold">
            {cleared.length} key{cleared.length === 1 ? "" : "s"} removed:
          </p>
          <ul className="mt-1 list-disc pl-4 opacity-80">
            {cleared.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <p className="mt-2 font-bold">
            Reload the app (or reopen the MiniPay tab) to start fresh.
          </p>
        </div>
      ) : null}
    </main>
  );
}
