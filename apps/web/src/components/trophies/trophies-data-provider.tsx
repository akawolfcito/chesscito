"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { getVictoryAddress } from "@/lib/game/victory-events";
import type { VictoryEntry } from "@/lib/game/victory-events";

export type ApiVictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

const OPTIMISTIC_TTL_MS = 2 * 60 * 1000;

export function toVictoryEntry(row: ApiVictoryRow): VictoryEntry {
  return {
    tokenId: BigInt(row.tokenId),
    player: row.player,
    difficulty: row.difficulty,
    totalMoves: row.totalMoves,
    blockNumber: 0n,
    logIndex: 0,
    timestamp: row.timestamp,
    timeMs: row.timeMs,
  };
}

export function getOptimisticVictory(): ApiVictoryRow | null {
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

export function clearOptimisticVictory() {
  try {
    sessionStorage.removeItem("chesscito:optimistic-victory");
  } catch {
    /* ignore */
  }
}

type TrophiesDataContextValue = {
  victories: VictoryEntry[] | undefined;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const TrophiesDataContext = createContext<TrophiesDataContextValue | null>(null);

/**
 * Shared `/api/my-victories` data source for the trophies surface.
 *
 * Before this provider, `TrophiesHeroBand` and `TrophiesBody` each fired
 * an independent fetch on mount + duplicated the optimistic-victory
 * merge logic. The hero never cleared the optimistic entry on confirm;
 * the body did. With one provider both consumers share the same
 * fetched + optimistic-merged list, and the clear-on-found behaviour is
 * applied exactly once.
 *
 * Mount this around any tree that pairs `<TrophiesHeroBand />` and
 * `<TrophiesBody hideHero />` as siblings. The hook throws if consumed
 * outside the provider so callers can't silently regress to two fetches.
 */
export function TrophiesDataProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("TROPHY_VITRINE_COPY");
  const { address, isConnected } = useAccount();
  const configured = getVictoryAddress() !== null;

  const [victories, setVictories] = useState<VictoryEntry[] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!address || !configured) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/my-victories?player=${address}`);
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic && optimistic.player.toLowerCase() === address.toLowerCase()) {
        const found = entries.some((e) => String(e.tokenId) === optimistic.tokenId);
        if (found) {
          clearOptimisticVictory();
        } else {
          entries.unshift(toVictoryEntry(optimistic));
        }
      }
      setVictories(entries);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [address, configured, t]);

  useEffect(() => {
    if (isConnected && address) {
      void reload();
    }
  }, [isConnected, address, reload]);

  return (
    <TrophiesDataContext.Provider value={{ victories, loading, error, reload }}>
      {children}
    </TrophiesDataContext.Provider>
  );
}

export function useTrophiesData(): TrophiesDataContextValue {
  const ctx = useContext(TrophiesDataContext);
  if (!ctx) {
    throw new Error(
      "useTrophiesData must be used within <TrophiesDataProvider>",
    );
  }
  return ctx;
}
