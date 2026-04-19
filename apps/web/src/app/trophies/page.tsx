"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { TrophyList } from "@/components/trophies/trophy-list";
import { getVictoryAddress } from "@/lib/game/victory-events";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

type ApiVictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

function toVictoryEntry(row: ApiVictoryRow): VictoryEntry {
  return {
    tokenId: BigInt(row.tokenId),
    player: row.player,
    difficulty: row.difficulty,
    totalMoves: row.totalMoves,
    timeMs: row.timeMs,
    blockNumber: 0n,
    logIndex: 0,
    timestamp: row.timestamp,
  };
}

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

function getOptimisticVictory(): ApiVictoryRow | null {
  try {
    const raw = sessionStorage.getItem("chesscito:optimistic-victory");
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > OPTIMISTIC_TTL_MS) {
      sessionStorage.removeItem("chesscito:optimistic-victory");
      return null;
    }
    return {
      tokenId: entry.tokenId,
      player: entry.player,
      difficulty: entry.difficulty,
      totalMoves: entry.totalMoves,
      timeMs: entry.timeMs,
      timestamp: Math.floor(entry.ts / 1000),
    };
  } catch {
    return null;
  }
}

function clearOptimisticVictory() {
  try { sessionStorage.removeItem("chesscito:optimistic-victory"); } catch { /* ignore */ }
}

export default function TrophiesPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [myVictories, setMyVictories] = useState<VictoryEntry[]>();
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [myLoading, setMyLoading] = useState(false);
  const [hofLoading, setHofLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [hofError, setHofError] = useState<string | null>(null);

  const configured = getVictoryAddress() !== null;

  const loadHallOfFame = useCallback(async () => {
    if (!configured) {
      setHofLoading(false);
      return;
    }
    setHofLoading(true);
    setHofError(null);
    try {
      const res = await fetch("/api/hall-of-fame");
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        const found = entries.some((e) => e.player.toLowerCase() === optimistic.player.toLowerCase());
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setHallOfFame(entries);
    } catch {
      setHofError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setHofLoading(false);
    }
  }, [configured]);

  const loadMyVictories = useCallback(async () => {
    if (!address || !configured) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const res = await fetch(`/api/my-victories?player=${address}`);
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic && optimistic.player.toLowerCase() === address?.toLowerCase()) {
        const found = entries.some((e) => String(e.tokenId) === optimistic.tokenId);
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setMyVictories(entries);
    } catch {
      setMyError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setMyLoading(false);
    }
  }, [address, configured]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  useEffect(() => {
    if (isConnected && address) {
      void loadMyVictories();
    }
  }, [isConnected, address, loadMyVictories]);

  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center">
    <div className="mx-auto flex w-full max-w-[var(--app-max-width)] flex-col bg-[var(--surface-a)] backdrop-blur-2xl rounded-t-3xl">
      {/* Header Pattern B */}
      <header className="relative flex min-h-[96px] max-h-[120px] items-end border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] px-4 pb-4 pt-4 rounded-t-3xl">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-frosted-solid)] to-transparent opacity-30 rounded-t-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.10]"
          >
            <CandyBanner name="btn-back" className="h-7 w-7" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {TROPHY_VITRINE_COPY.pageTitle}
            </h1>
            <p className="text-xs text-slate-400">
              {TROPHY_VITRINE_COPY.pageDescription}
            </p>
          </div>
        </div>
      </header>

      {/* List zone — clean dark background */}
      <div className="flex-1 px-4 pt-4 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        {!configured && (
          <p className="py-6 text-center text-sm text-slate-500">
            {TROPHY_VITRINE_COPY.configError}
          </p>
        )}

        {configured && (
          <>
            {/* My Victories */}
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-label-gold)]" style={{ textShadow: "var(--text-shadow-label)" }}>
                <CandyIcon name="crown" className="h-4 w-4" />
                {TROPHY_VITRINE_COPY.myVictories}
              </h2>

              {!isConnected ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-center text-sm text-slate-500">
                    {TROPHY_VITRINE_COPY.connectWallet}
                  </p>
                  <button
                    onClick={() => openConnectModal?.()}
                    className="min-h-[44px] rounded-xl bg-white/[0.08] px-6 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-white/[0.12]"
                  >
                    {TROPHY_VITRINE_COPY.connectWalletButton}
                  </button>
                </div>
              ) : (
                <TrophyList
                  victories={myVictories}
                  loading={myLoading}
                  error={myError}
                  emptyMessage={TROPHY_VITRINE_COPY.noVictories}
                  variant="victory"
                  onRetry={loadMyVictories}
                />
              )}

              {isConnected && myVictories?.length === 0 && !myLoading && !myError && (
                <Link
                  href="/arena"
                  className="mt-3 flex min-h-[44px] items-center justify-center rounded-2xl bg-cyan-500/15 px-6 text-center text-sm font-semibold text-cyan-300 transition-all hover:bg-cyan-500/25 active:scale-[0.97]"
                >
                  {TROPHY_VITRINE_COPY.arenaLink}
                </Link>
              )}
            </section>

            {/* Hall of Fame */}
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-label-gold)]" style={{ textShadow: "var(--text-shadow-label)" }}>
                <CandyIcon name="trophy" className="h-4 w-4" />
                {TROPHY_VITRINE_COPY.hallOfFame}
              </h2>

              <TrophyList
                victories={hallOfFame}
                loading={hofLoading}
                error={hofError}
                emptyMessage={TROPHY_VITRINE_COPY.noGlobalVictories}
                variant="hall-of-fame"
                onRetry={loadHallOfFame}
              />
            </section>
          </>
        )}

        {/* Roadmap Banner — only shown to connected users with victories */}
        {isConnected && myVictories && myVictories.length > 0 && (
          <div className="mt-auto rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-center text-xs text-purple-300">
            {TROPHY_VITRINE_COPY.roadmap}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
