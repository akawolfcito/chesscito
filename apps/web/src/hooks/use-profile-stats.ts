import { useEffect, useState } from "react";

export type ProfileStats = {
  trophies: number;
  arenaWins: number;
  nftsMinted: number;
  dailyStreak: number;
  puzzlesSolved: number;
};

type State = {
  stats: ProfileStats | null;
  isLoading: boolean;
  error: Error | null;
};

const INITIAL: State = { stats: null, isLoading: false, error: null };

export function useProfileStats(address: `0x${string}` | undefined): State & { refetch: () => void } {
  const [state, setState] = useState<State>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setState(INITIAL);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fetch(`/api/profile/stats?address=${address}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ stats: null, isLoading: false, error: new Error(`HTTP ${res.status}`) });
          return;
        }
        const json = (await res.json()) as ProfileStats;
        setState({ stats: json, isLoading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ stats: null, isLoading: false, error: error as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  return { ...state, refetch: () => setTick((n) => n + 1) };
}
