"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { Crown, ArrowLeft } from "lucide-react";
import { TrophyList } from "@/components/trophies/trophy-list";
import {
  fetchMyVictories,
  fetchHallOfFame,
  getVictoryAddress,
} from "@/lib/game/victory-events";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";
import type { VictoryEntry } from "@/lib/game/victory-events";

export default function TrophiesPage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const [myVictories, setMyVictories] = useState<VictoryEntry[]>();
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [myLoading, setMyLoading] = useState(false);
  const [hofLoading, setHofLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [hofError, setHofError] = useState<string | null>(null);

  const configured = getVictoryAddress() !== null;

  const loadHallOfFame = useCallback(async () => {
    if (!client || !configured) {
      setHofLoading(false);
      return;
    }
    setHofLoading(true);
    setHofError(null);
    try {
      const data = await fetchHallOfFame(client);
      setHallOfFame(data);
    } catch {
      setHofError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setHofLoading(false);
    }
  }, [client, configured]);

  const loadMyVictories = useCallback(async () => {
    if (!client || !address || !configured) return;
    setMyLoading(true);
    setMyError(null);
    try {
      const data = await fetchMyVictories(client, address);
      setMyVictories(data);
    } catch {
      setMyError(TROPHY_VITRINE_COPY.loadError);
    } finally {
      setMyLoading(false);
    }
  }, [client, address, configured]);

  useEffect(() => {
    void loadHallOfFame();
  }, [loadHallOfFame]);

  useEffect(() => {
    if (isConnected && address) {
      void loadMyVictories();
    }
  }, [isConnected, address, loadMyVictories]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--app-max-width)] flex-col bg-[#0a1424]">
      {/* Hero zone — art background, max 200px */}
      <div className="relative flex items-end px-4 pb-4 pt-6" style={{ minHeight: 160, maxHeight: 200 }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a2a3f] to-[#0a1424] opacity-80" />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              {TROPHY_VITRINE_COPY.pageTitle}
            </h1>
            <p className="text-xs text-slate-400">
              {TROPHY_VITRINE_COPY.pageDescription}
            </p>
          </div>
        </div>
      </div>

      {/* List zone — clean dark background */}
      <div className="flex-1 px-4 pb-8">
        {!configured && (
          <p className="py-6 text-center text-sm text-slate-500">
            {TROPHY_VITRINE_COPY.configError}
          </p>
        )}

        {configured && (
          <>
            {/* My Victories */}
            <section className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                {TROPHY_VITRINE_COPY.myVictories}
              </h2>

              {!isConnected ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  {TROPHY_VITRINE_COPY.connectWallet}
                </p>
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
                  className="mt-1 block text-center text-xs font-semibold text-cyan-400 underline"
                >
                  {TROPHY_VITRINE_COPY.arenaLink}
                </Link>
              )}
            </section>

            {/* Hall of Fame */}
            <section className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Crown className="h-3.5 w-3.5 text-purple-400" />
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
  );
}
