"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Crown, ArrowLeft } from "lucide-react";
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
      setHallOfFame(rows.map(toVictoryEntry));
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
      setMyVictories(rows.map(toVictoryEntry));
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
    <div className="mission-shell flex min-h-[100dvh] justify-center bg-black/50">
    <div className="mx-auto flex w-full max-w-[var(--app-max-width)] flex-col bg-[var(--surface-a)] backdrop-blur-2xl rounded-t-3xl">
      {/* Header Pattern B */}
      <header className="relative flex min-h-[96px] max-h-[120px] items-end border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] px-4 pb-4 pt-4 rounded-t-3xl">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-frosted-solid)] to-transparent opacity-35 rounded-t-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.10]"
          >
            <ArrowLeft className="h-4 w-4 text-slate-300" />
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
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[rgba(200,180,130,0.55)]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                <Crown className="h-3.5 w-3.5 text-[rgba(220,190,100,0.7)] drop-shadow-[0_0_3px_rgba(200,170,100,0.2)]" />
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
                    Connect Wallet
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
                  className="mt-1 block min-h-[44px] flex items-center justify-center text-center text-sm font-semibold text-cyan-400 underline"
                >
                  {TROPHY_VITRINE_COPY.arenaLink}
                </Link>
              )}
            </section>

            {/* Hall of Fame */}
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[rgba(200,180,130,0.55)]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                <Crown className="h-3.5 w-3.5 text-[rgba(220,190,100,0.7)] drop-shadow-[0_0_3px_rgba(200,170,100,0.2)]" />
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

        {/* Roadmap Banner */}
        <div className="mt-auto rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-center text-xs text-purple-300">
          {TROPHY_VITRINE_COPY.roadmap}
        </div>
      </div>
    </div>
    </div>
  );
}
